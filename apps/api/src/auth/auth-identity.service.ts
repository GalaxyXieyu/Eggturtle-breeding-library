import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuditAction, ErrorCode } from '@eggturtle/shared';
import type {
  AuthUser,
  PasswordLoginResponse,
  PhoneLoginResponse,
  RegisterRequest,
  RegisterResponse,
  RequestCodeResponse,
  RequestSmsCodeResponse,
  SwitchTenantRequest,
  SwitchTenantResponse,
  VerifyCodeResponse,
} from '@eggturtle/shared';
import { Prisma, TenantMemberRole } from '@prisma/client';
import { randomBytes, randomInt } from 'node:crypto';

import { PrismaService } from '../prisma.service';

import { AuthSharedService } from './auth-shared.service';
import { SmsVerificationService } from './sms-verification.service';

type SmsCodePurpose = 'register' | 'login' | 'binding' | 'replace';

const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const REFERRAL_CODE_LENGTH = 8;

@Injectable()
export class AuthIdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly smsVerificationService: SmsVerificationService,
    private readonly authSharedService: AuthSharedService,
  ) {}

  async requestCode(email: string, surface?: string): Promise<RequestCodeResponse> {
    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        isSuperAdmin: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException({
        message: 'Email code login is only available for existing accounts.',
        errorCode: ErrorCode.Unauthorized,
      });
    }

    this.authSharedService.assertAdminSurfaceAccess(user, surface);

    const code = this.authSharedService.generateCode();
    const salt = randomBytes(16).toString('hex');
    const codeHash = this.authSharedService.hashCode(code, salt);
    const ttlMinutes = Number(process.env.AUTH_CODE_TTL_MINUTES ?? 10);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    await this.prisma.authCode.create({
      data: {
        email,
        codeHash,
        salt,
        expiresAt,
      },
    });

    const shouldExposeDevCode = this.authSharedService.isDevCodeEnabled();
    if (shouldExposeDevCode) {
      console.info('[Auth v0] request-code', {
        email,
        code,
        expiresAt: expiresAt.toISOString(),
      });
    }

    return {
      ok: true,
      expiresAt: expiresAt.toISOString(),
      ...(shouldExposeDevCode ? { devCode: code } : {}),
    };
  }

  async requestSmsCode(
    phoneNumber: string,
    purpose: SmsCodePurpose = 'register',
    surface?: string,
  ): Promise<RequestSmsCodeResponse> {
    const { shadowEmail, user } = await this.authSharedService.loadPhoneIdentity(this.prisma, phoneNumber);

    if (purpose === 'login' && !user) {
      throw new UnauthorizedException({
        message: 'Phone number is not registered.',
        errorCode: ErrorCode.Unauthorized,
      });
    }

    if (purpose === 'register' && user && this.authSharedService.isRegisteredPhoneAccount(user, shadowEmail)) {
      throw new ConflictException({
        message: 'Phone number is already registered.',
        errorCode: ErrorCode.InvalidRequestPayload,
      });
    }

    if (purpose === 'login' && user) {
      this.authSharedService.assertAdminSurfaceAccess(user, surface);
    }

    const code = this.authSharedService.generateCode();
    const salt = randomBytes(16).toString('hex');
    const codeHash = this.authSharedService.hashCode(code, salt);
    const ttlMinutes = Number(process.env.AUTH_CODE_TTL_MINUTES ?? 10);
    const validTimeSeconds = ttlMinutes * 60;
    const expiresAt = new Date(Date.now() + validTimeSeconds * 1000);
    const now = new Date();

    const authCode = await this.prisma.authCode.create({
      data: {
        email: this.authSharedService.toSmsCodeKey(phoneNumber),
        codeHash,
        salt,
        expiresAt,
      },
    });

    const shouldExposeDevCode = this.authSharedService.isDevCodeEnabled();
    if (!shouldExposeDevCode) {
      try {
        await this.smsVerificationService.sendSmsCode({
          phoneNumber,
          code,
          validTimeSeconds,
          outId: `${purpose}-${Date.now()}-${randomInt(1000, 10_000)}`,
        });
      } catch (error) {
        await this.prisma.authCode
          .updateMany({
            where: {
              id: authCode.id,
              consumedAt: null,
            },
            data: {
              consumedAt: now,
            },
          })
          .catch(() => undefined);

        throw error;
      }
    }

    if (shouldExposeDevCode) {
      console.info('[Auth v0] request-sms-code', {
        phoneNumber,
        purpose,
        code,
        expiresAt: expiresAt.toISOString(),
      });
    }

    return {
      ok: true,
      expiresAt: expiresAt.toISOString(),
      ...(shouldExposeDevCode ? { devCode: code } : {}),
    };
  }

  async verifyCode(
    email: string,
    code: string,
    password?: string,
    surface?: string
  ): Promise<VerifyCodeResponse> {
    const latestCode = await this.prisma.authCode.findFirst({
      where: {
        email,
        consumedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!latestCode) {
      this.authSharedService.throwInvalidCode();
    }

    const now = new Date();
    if (latestCode.expiresAt.getTime() <= now.getTime()) {
      throw new UnauthorizedException({
        message: 'Code is expired.',
        errorCode: ErrorCode.ExpiredCode,
      });
    }

    const hashedCode = this.authSharedService.hashCode(code, latestCode.salt);
    if (!this.authSharedService.isHashEqual(hashedCode, latestCode.codeHash)) {
      this.authSharedService.throwInvalidCode();
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.authCode.updateMany({
        where: {
          id: latestCode.id,
          consumedAt: null,
        },
        data: {
          consumedAt: now,
        },
      });

      if (consumed.count !== 1) {
        this.authSharedService.throwInvalidCode();
      }

      const existingUser = await tx.user.findUnique({
        where: {
          email,
        },
      });

      if (!existingUser) {
        throw new UnauthorizedException({
          message: 'Email code login is only available for existing accounts.',
          errorCode: ErrorCode.Unauthorized,
        });
      }

      this.authSharedService.assertAdminSurfaceAccess(existingUser, surface);

      if (!password) {
        return existingUser;
      }

      return tx.user.update({
        where: {
          id: existingUser.id,
        },
        data: {
          passwordHash: this.authSharedService.hashPassword(password),
          passwordUpdatedAt: now,
        },
      });
    });

    const tenantId = await this.authSharedService.resolveDefaultTenantId(user.id);
    const accessToken = this.authSharedService.issueAccessToken(
      {
        id: user.id,
        email: user.email,
      },
      tenantId,
    );

    if (tenantId) {
      await this.recordLoginEvent(this.prisma, tenantId, user.id, 'email_code', surface);
    }

    return {
      accessToken,
      user: this.authSharedService.toAuthUser(user),
    };
  }

  async passwordLogin(
    login: string,
    password: string,
    surface?: string
  ): Promise<PasswordLoginResponse> {
    const loginIdentifier = login.trim().toLowerCase();
    let user = null;

    if (/^1\d{10}$/.test(loginIdentifier)) {
      const binding = await this.prisma.userPhoneBinding.findUnique({
        where: {
          phoneNumber: loginIdentifier,
        },
        include: {
          user: true,
        },
      });

      user = binding?.user ?? null;
    }

    if (!user && !loginIdentifier.includes('@')) {
      user = await this.authSharedService.findUserByAccountName(loginIdentifier);
    }

    if (!user && loginIdentifier.includes('@')) {
      user = await this.prisma.user.findUnique({
        where: {
          email: loginIdentifier,
        },
      });
    }

    if (!user && !loginIdentifier.includes('@')) {
      const ownerMembership = await this.prisma.tenantMember.findFirst({
        where: {
          role: TenantMemberRole.OWNER,
          tenant: {
            slug: loginIdentifier,
          },
          user: {
            passwordHash: {
              not: null,
            },
          },
        },
        include: {
          user: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      user = ownerMembership?.user ?? null;
    }

    if (!user?.passwordHash) {
      this.authSharedService.throwInvalidCredentials();
    }

    if (!this.authSharedService.verifyPassword(password, user.passwordHash)) {
      this.authSharedService.throwInvalidCredentials();
    }

    this.authSharedService.assertAdminSurfaceAccess(user, surface);

    const tenantId = await this.authSharedService.resolveDefaultTenantId(user.id);
    const accessToken = this.authSharedService.issueAccessToken(
      {
        id: user.id,
        email: user.email,
      },
      tenantId,
    );

    if (tenantId) {
      await this.recordLoginEvent(this.prisma, tenantId, user.id, 'password', surface);
    }

    return {
      accessToken,
      user: this.authSharedService.toAuthUser(user),
    };
  }

  async phoneLogin(
    phoneNumber: string,
    code: string,
    surface?: string
  ): Promise<PhoneLoginResponse> {
    const now = new Date();

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.authSharedService.consumeSmsCodeOrThrow(tx, phoneNumber, code, now);

        const { boundPhone, user } = await this.authSharedService.loadPhoneIdentity(tx, phoneNumber);

        if (!user) {
          throw new UnauthorizedException({
            message: 'Phone number is not registered.',
            errorCode: ErrorCode.Unauthorized,
          });
        }

        this.authSharedService.assertAdminSurfaceAccess(user, surface);

        if (!boundPhone) {
          const existingBinding = await tx.userPhoneBinding.findUnique({
            where: {
              userId: user.id,
            },
            select: {
              phoneNumber: true,
            },
          });

          if (existingBinding && existingBinding.phoneNumber !== phoneNumber) {
            throw new UnauthorizedException({
              message: 'Phone number is not allowed for this account.',
              errorCode: ErrorCode.Unauthorized,
            });
          }
        }

        await tx.userPhoneBinding.upsert({
          where: {
            userId: user.id,
          },
          update: {
            phoneNumber,
            updatedAt: now,
          },
          create: {
            userId: user.id,
            phoneNumber,
            createdAt: now,
            updatedAt: now,
          },
        });

        let membership = await tx.tenantMember.findFirst({
          where: {
            userId: user.id,
          },
          orderBy: {
            createdAt: 'asc',
          },
          include: {
            tenant: {
              select: {
                id: true,
                slug: true,
                name: true,
              },
            },
          },
        });

        if (!membership) {
          const tenant = await tx.tenant.create({
            data: {
              slug: this.authSharedService.buildFallbackPhoneTenantSlug(phoneNumber),
              name: `手机用户${phoneNumber.slice(-4)}`,
            },
          });

          membership = await tx.tenantMember.create({
            data: {
              tenantId: tenant.id,
              userId: user.id,
              role: TenantMemberRole.OWNER,
            },
            include: {
              tenant: {
                select: {
                  id: true,
                  slug: true,
                  name: true,
                },
              },
            },
          });

          await tx.tenantSubscription.create({
            data: {
              tenantId: tenant.id,
              plan: 'FREE',
              startsAt: now,
              expiresAt: null,
              disabledAt: null,
            },
          });
        }

        const accessToken = this.authSharedService.issueAccessToken(
          {
            id: user.id,
            email: user.email,
          },
          membership.tenantId,
        );

        await this.recordLoginEvent(tx, membership.tenantId, user.id, 'phone_code', surface);

        return {
          accessToken,
          user: this.authSharedService.toAuthUser(user),
          tenant: {
            id: membership.tenant.id,
            slug: membership.tenant.slug,
            name: membership.tenant.name,
          },
          isNewUser: false,
        };
      });
    } catch (error) {
      if (this.authSharedService.isUserPhoneBindingConflict(error)) {
        throw new ConflictException({
          message: 'Phone number is already bound to another account.',
          errorCode: ErrorCode.InvalidRequestPayload,
        });
      }

      throw error;
    }
  }

  async switchTenant(user: AuthUser, payload: SwitchTenantRequest): Promise<SwitchTenantResponse> {
    const tenant = payload.tenantId
      ? await this.prisma.tenant.findUnique({
          where: {
            id: payload.tenantId,
          },
        })
      : await this.prisma.tenant.findUnique({
          where: {
            slug: payload.slug!,
          },
        });

    if (!tenant) {
      throw new NotFoundException({
        message: 'Tenant not found.',
        errorCode: ErrorCode.TenantNotFound,
      });
    }

    const membership = await this.prisma.tenantMember.findUnique({
      where: {
        tenantId_userId: {
          tenantId: tenant.id,
          userId: user.id,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException({
        message: 'User is not a member of this tenant.',
        errorCode: ErrorCode.NotTenantMember,
      });
    }

    return {
      accessToken: this.authSharedService.issueAccessToken(user, tenant.id),
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
      },
      role: membership.role,
    };
  }

  async register(payload: RegisterRequest): Promise<RegisterResponse> {
    const latestCode = await this.prisma.authCode.findFirst({
      where: {
        email: this.authSharedService.toSmsCodeKey(payload.phoneNumber),
        consumedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!latestCode) {
      this.authSharedService.throwInvalidCode();
    }

    const now = new Date();
    if (latestCode.expiresAt.getTime() <= now.getTime()) {
      throw new UnauthorizedException({
        message: 'Code is expired.',
        errorCode: ErrorCode.ExpiredCode,
      });
    }

    const hashedCode = this.authSharedService.hashCode(payload.code, latestCode.salt);
    if (!this.authSharedService.isHashEqual(hashedCode, latestCode.codeHash)) {
      this.authSharedService.throwInvalidCode();
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const consumed = await tx.authCode.updateMany({
          where: {
            id: latestCode.id,
            consumedAt: null,
          },
          data: {
            consumedAt: now,
          },
        });

        if (consumed.count !== 1) {
          this.authSharedService.throwInvalidCode();
        }

        const accountEmail = this.authSharedService.toAccountEmail(payload.account);
        const accountCollision = await this.authSharedService.findUserByAccountName(payload.account, tx);
        const { shadowEmail, user: existingPhoneUser } = await this.authSharedService.loadPhoneIdentity(
          tx,
          payload.phoneNumber,
        );

        let user = existingPhoneUser;

        if (accountCollision && accountCollision.id !== user?.id) {
          throw new ConflictException({
            message: 'Account is already taken.',
            errorCode: ErrorCode.InvalidRequestPayload,
          });
        }

        if (user && this.authSharedService.isRegisteredPhoneAccount(user, shadowEmail)) {
          throw new ConflictException({
            message: 'Phone number is already registered.',
            errorCode: ErrorCode.InvalidRequestPayload,
          });
        }

        const passwordHash = this.authSharedService.hashPassword(payload.password);

        if (user) {
          user = await tx.user.update({
            where: {
              id: user.id,
            },
            data: {
              email: accountEmail,
              account: payload.account,
              name: user.name,
              referralCode: user.referralCode ?? (await this.generateUniqueReferralCode(tx)),
              passwordHash,
              passwordUpdatedAt: now,
            },
          });
        } else {
          user = await tx.user.create({
            data: {
              email: accountEmail,
              account: payload.account,
              name: null,
              referralCode: await this.generateUniqueReferralCode(tx),
              passwordHash,
              passwordUpdatedAt: now,
            },
          });
        }

        await tx.userPhoneBinding.upsert({
          where: {
            userId: user.id,
          },
          update: {
            phoneNumber: payload.phoneNumber,
            updatedAt: now,
          },
          create: {
            userId: user.id,
            phoneNumber: payload.phoneNumber,
            createdAt: now,
            updatedAt: now,
          },
        });

        let membership = await tx.tenantMember.findFirst({
          where: {
            userId: user.id,
          },
          orderBy: {
            createdAt: 'asc',
          },
          include: {
            tenant: {
              select: {
                id: true,
                slug: true,
                name: true,
              },
            },
          },
        });

        if (!membership) {
          const tenant = await tx.tenant.create({
            data: {
              slug: await this.authSharedService.buildUniqueTenantSlug(tx, payload.account),
              name: this.authSharedService.buildRegisterTenantName(payload.account),
            },
          });

          membership = await tx.tenantMember.create({
            data: {
              tenantId: tenant.id,
              userId: user.id,
              role: TenantMemberRole.OWNER,
            },
            include: {
              tenant: {
                select: {
                  id: true,
                  slug: true,
                  name: true,
                },
              },
            },
          });

          await tx.tenantSubscription.create({
            data: {
              tenantId: tenant.id,
              plan: 'FREE',
              startsAt: now,
              expiresAt: null,
              disabledAt: null,
            },
          });
        }

        const accessToken = this.authSharedService.issueAccessToken(
          {
            id: user.id,
            email: user.email,
          },
          membership.tenantId,
        );


        return {
          accessToken,
          user: this.authSharedService.toAuthUser(user),
          tenant: {
            id: membership.tenant.id,
            slug: membership.tenant.slug,
            name: membership.tenant.name,
          },
          role: membership.role,
        };
      });
    } catch (error) {
      if (this.authSharedService.isTenantSlugConflict(error)) {
        throw new ConflictException({
          message: 'Tenant slug already exists.',
          errorCode: ErrorCode.TenantSlugConflict,
        });
      }

      if (this.authSharedService.isTenantMemberUserConflict(error)) {
        throw new ConflictException({
          message: 'User is already bound to a tenant.',
          errorCode: ErrorCode.InvalidRequestPayload,
        });
      }

      if (this.authSharedService.isUserPhoneBindingConflict(error)) {
        throw new ConflictException({
          message: 'Phone number is already bound to another account.',
          errorCode: ErrorCode.InvalidRequestPayload,
        });
      }

      throw error;
    }
  }

  private normalizeLoginSurface(surface?: string) {
    if (surface === 'admin' || surface === 'web') {
      return surface;
    }

    return 'unknown';
  }

  private async generateUniqueReferralCode(db: Prisma.TransactionClient): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const referralCode = this.generateReferralCode();
      const existing = await db.user.findUnique({
        where: {
          referralCode,
        },
        select: {
          id: true,
        },
      });

      if (!existing) {
        return referralCode;
      }
    }

    throw new ConflictException({
      message: 'Failed to generate a unique referral code.',
      errorCode: ErrorCode.InvalidRequestPayload,
    });
  }

  private generateReferralCode(): string {
    const bytes = randomBytes(REFERRAL_CODE_LENGTH);
    let value = '';

    for (let index = 0; index < REFERRAL_CODE_LENGTH; index += 1) {
      value += REFERRAL_CODE_ALPHABET[bytes[index] % REFERRAL_CODE_ALPHABET.length];
    }

    return value;
  }

  private async recordLoginEvent(
    db: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    actorUserId: string,
    loginMethod: 'password' | 'email_code' | 'phone_code',
    surface?: string
  ) {
    await db.auditLog.create({
      data: {
        tenantId,
        actorUserId,
        action: AuditAction.AuthLogin,
        resourceType: 'auth',
        resourceId: actorUserId,
        metadata: {
          loginMethod,
          surface: this.normalizeLoginSurface(surface)
        }
      }
    });
  }

}
