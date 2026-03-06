import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ErrorCode, tenantSlugSchema } from '@eggturtle/shared';
import type {
  AuthUser,
  MeProfile,
  MyPhoneBindingResponse,
  MySecurityProfileResponse,
  PasswordLoginResponse,
  PhoneLoginResponse,
  RegisterRequest,
  RegisterResponse,
  RequestCodeResponse,
  RequestSmsCodeResponse,
  SwitchTenantRequest,
  SwitchTenantResponse,
  UpdateMeProfileRequest,
  UpsertMyPhoneBindingRequest,
  UpsertMySecurityProfileRequest,
  UpdateMyPasswordRequest,
  VerifyCodeResponse,
} from '@eggturtle/shared';
import { Prisma, TenantMemberRole } from '@prisma/client';
import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';

import { PrismaService } from '../prisma.service';

import { JwtTokenService } from './jwt-token.service';
import { SmsVerificationService } from './sms-verification.service';

export type AuthContext = {
  user: AuthUser;
  tenantId?: string;
};

type SmsCodePurpose = 'register' | 'login' | 'binding' | 'replace';

@Injectable()
export class AuthService {
  private static readonly SMS_CODE_KEY_PREFIX = 'sms:';
  private static readonly ACCOUNT_EMAIL_DOMAIN = 'account.eggturtle.local';
  private static readonly PHONE_SHADOW_EMAIL_DOMAIN = 'phone.eggturtle.local';
  private static readonly ACCOUNT_NAME_PATTERN = /^[a-z][a-z0-9_-]{2,30}[a-z0-9]$/;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtTokenService: JwtTokenService,
    private readonly smsVerificationService: SmsVerificationService,
  ) {}

  async requestCode(email: string): Promise<RequestCodeResponse> {
    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException({
        message: 'Email code login is only available for existing accounts.',
        errorCode: ErrorCode.Unauthorized,
      });
    }

    const code = this.generateCode();
    const salt = randomBytes(16).toString('hex');
    const codeHash = this.hashCode(code, salt);
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

    const shouldExposeDevCode = this.isDevCodeEnabled();
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
  ): Promise<RequestSmsCodeResponse> {
    const { shadowEmail, user } = await this.loadPhoneIdentity(this.prisma, phoneNumber);

    if (purpose === 'login' && !user) {
      throw new UnauthorizedException({
        message: 'Phone number is not registered.',
        errorCode: ErrorCode.Unauthorized,
      });
    }

    if (purpose === 'register' && user && this.isRegisteredPhoneAccount(user, shadowEmail)) {
      throw new ConflictException({
        message: 'Phone number is already registered.',
        errorCode: ErrorCode.InvalidRequestPayload,
      });
    }

    const code = this.generateCode();
    const salt = randomBytes(16).toString('hex');
    const codeHash = this.hashCode(code, salt);
    const ttlMinutes = Number(process.env.AUTH_CODE_TTL_MINUTES ?? 10);
    const validTimeSeconds = ttlMinutes * 60;
    const expiresAt = new Date(Date.now() + validTimeSeconds * 1000);
    const now = new Date();

    const authCode = await this.prisma.authCode.create({
      data: {
        email: this.toSmsCodeKey(phoneNumber),
        codeHash,
        salt,
        expiresAt,
      },
    });

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

    const shouldExposeDevCode = this.isDevCodeEnabled();
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

  async verifyCode(email: string, code: string, password?: string): Promise<VerifyCodeResponse> {
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
      this.throwInvalidCode();
    }

    const now = new Date();
    if (latestCode.expiresAt.getTime() <= now.getTime()) {
      throw new UnauthorizedException({
        message: 'Code is expired.',
        errorCode: ErrorCode.ExpiredCode,
      });
    }

    const hashedCode = this.hashCode(code, latestCode.salt);
    if (!this.isHashEqual(hashedCode, latestCode.codeHash)) {
      this.throwInvalidCode();
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
        this.throwInvalidCode();
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

      if (!password) {
        return existingUser;
      }

      return tx.user.update({
        where: {
          id: existingUser.id,
        },
        data: {
          passwordHash: this.hashPassword(password),
          passwordUpdatedAt: now,
        },
      });
    });

    const tenantId = await this.resolveDefaultTenantId(user.id);
    const accessToken = this.issueAccessToken(
      {
        id: user.id,
        email: user.email,
      },
      tenantId,
    );

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        account: this.resolveUserAccount(user),
        name: user.name,
      },
    };
  }

  async passwordLogin(login: string, password: string): Promise<PasswordLoginResponse> {
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
      user = await this.findUserByAccountName(loginIdentifier);
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
      this.throwInvalidCredentials();
    }

    if (!this.verifyPassword(password, user.passwordHash)) {
      this.throwInvalidCredentials();
    }

    const tenantId = await this.resolveDefaultTenantId(user.id);
    const accessToken = this.issueAccessToken(
      {
        id: user.id,
        email: user.email,
      },
      tenantId,
    );

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        account: this.resolveUserAccount(user),
        name: user.name,
      },
    };
  }

  async phoneLogin(phoneNumber: string, code: string): Promise<PhoneLoginResponse> {
    const now = new Date();

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.consumeSmsCodeOrThrow(tx, phoneNumber, code, now);

        const { boundPhone, user } = await this.loadPhoneIdentity(tx, phoneNumber);

        if (!user) {
          throw new UnauthorizedException({
            message: 'Phone number is not registered.',
            errorCode: ErrorCode.Unauthorized,
          });
        }

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
              slug: this.buildFallbackPhoneTenantSlug(phoneNumber),
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

        const accessToken = this.issueAccessToken(
          {
            id: user.id,
            email: user.email,
          },
          membership.tenantId,
        );

        return {
          accessToken,
          user: {
            id: user.id,
            email: user.email,
            account: this.resolveUserAccount(user),
            name: user.name,
          },
          tenant: {
            id: membership.tenant.id,
            slug: membership.tenant.slug,
            name: membership.tenant.name,
          },
          isNewUser: false,
        };
      });
    } catch (error) {
      if (this.isUserPhoneBindingConflict(error)) {
        throw new ConflictException({
          message: 'Phone number is already bound to another account.',
          errorCode: ErrorCode.InvalidRequestPayload,
        });
      }

      throw error;
    }
  }

  private async findUserByAccountName(
    accountName: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const normalizedAccount = this.normalizeAccountName(accountName);

    const directMatch = await client.user.findUnique({
      where: {
        account: normalizedAccount,
      },
    });

    if (directMatch) {
      return directMatch;
    }

    return client.user.findUnique({
      where: {
        email: this.toAccountEmail(normalizedAccount),
      },
    });
  }

  private async resolveDefaultTenantId(userId: string): Promise<string | undefined> {
    const membership = await this.prisma.tenantMember.findFirst({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        tenantId: true,
      },
    });

    return membership?.tenantId;
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
      accessToken: this.issueAccessToken(user, tenant.id),
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
        email: this.toSmsCodeKey(payload.phoneNumber),
        consumedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!latestCode) {
      this.throwInvalidCode();
    }

    const now = new Date();
    if (latestCode.expiresAt.getTime() <= now.getTime()) {
      throw new UnauthorizedException({
        message: 'Code is expired.',
        errorCode: ErrorCode.ExpiredCode,
      });
    }

    const hashedCode = this.hashCode(payload.code, latestCode.salt);
    if (!this.isHashEqual(hashedCode, latestCode.codeHash)) {
      this.throwInvalidCode();
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
          this.throwInvalidCode();
        }

        const accountEmail = this.toAccountEmail(payload.account);
        const accountCollision = await this.findUserByAccountName(payload.account, tx);
        const { shadowEmail, user: existingPhoneUser } = await this.loadPhoneIdentity(
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

        if (user && this.isRegisteredPhoneAccount(user, shadowEmail)) {
          throw new ConflictException({
            message: 'Phone number is already registered.',
            errorCode: ErrorCode.InvalidRequestPayload,
          });
        }

        const passwordHash = this.hashPassword(payload.password);

        if (user) {
          user = await tx.user.update({
            where: {
              id: user.id,
            },
            data: {
              email: accountEmail,
              account: payload.account,
              name: user.name,
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
              slug: await this.buildUniqueTenantSlug(tx, payload.account),
              name: this.buildRegisterTenantName(payload.account),
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

        const accessToken = this.issueAccessToken(
          {
            id: user.id,
            email: user.email,
          },
          membership.tenantId,
        );

        return {
          accessToken,
          user: {
            id: user.id,
            email: user.email,
            account: this.resolveUserAccount(user),
            name: user.name,
          },
          tenant: {
            id: membership.tenant.id,
            slug: membership.tenant.slug,
            name: membership.tenant.name,
          },
          role: membership.role,
        };
      });
    } catch (error) {
      if (this.isTenantSlugConflict(error)) {
        throw new ConflictException({
          message: 'Tenant slug already exists.',
          errorCode: ErrorCode.TenantSlugConflict,
        });
      }

      if (this.isTenantMemberUserConflict(error)) {
        throw new ConflictException({
          message: 'User is already bound to a tenant.',
          errorCode: ErrorCode.InvalidRequestPayload,
        });
      }

      if (this.isUserPhoneBindingConflict(error)) {
        throw new ConflictException({
          message: 'Phone number is already bound to another account.',
          errorCode: ErrorCode.InvalidRequestPayload,
        });
      }

      throw error;
    }
  }

  async getAuthContextFromAccessToken(token: string): Promise<AuthContext | null> {
    const payload = this.jwtTokenService.verify(token);
    if (!payload) {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: payload.sub,
      },
    });

    if (!user) {
      return null;
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        account: this.resolveUserAccount(user),
        name: user.name,
      },
      tenantId: payload.tenantId,
    };
  }

  async getUserFromAccessToken(token: string): Promise<AuthUser | null> {
    const context = await this.getAuthContextFromAccessToken(token);
    return context?.user ?? null;
  }

  async getMyProfile(userId: string): Promise<MeProfile> {
    const user = await this.findUserOrThrow(userId);
    return this.toMeProfile(user);
  }

  async updateMyProfile(userId: string, payload: UpdateMeProfileRequest): Promise<MeProfile> {
    const name = this.normalizeOptionalName(payload.name);
    const updated = await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        name,
      },
    });

    return this.toMeProfile(updated);
  }

  async updateMyPassword(
    userId: string,
    payload: UpdateMyPasswordRequest,
  ): Promise<{ passwordUpdatedAt: string }> {
    const user = await this.findUserOrThrow(userId);
    const currentPassword = payload.currentPassword?.trim();

    if (user.passwordHash) {
      if (!currentPassword || !this.verifyPassword(currentPassword, user.passwordHash)) {
        throw new UnauthorizedException({
          message: 'Current password is incorrect.',
          errorCode: ErrorCode.Unauthorized,
        });
      }

      if (this.verifyPassword(payload.newPassword, user.passwordHash)) {
        throw new BadRequestException({
          message: 'New password must be different from current password.',
          errorCode: ErrorCode.InvalidRequestPayload,
        });
      }
    }

    const passwordUpdatedAt = new Date();
    await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        passwordHash: this.hashPassword(payload.newPassword),
        passwordUpdatedAt,
      },
    });

    return {
      passwordUpdatedAt: passwordUpdatedAt.toISOString(),
    };
  }

  async getMySecurityProfile(userId: string): Promise<MySecurityProfileResponse['profile']> {
    await this.findUserOrThrow(userId);

    const profile = await this.prisma.userSecurityProfile.findUnique({
      where: {
        userId,
      },
      select: {
        question: true,
        updatedAt: true,
      },
    });

    if (!profile) {
      return null;
    }

    return {
      question: profile.question,
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  async upsertMySecurityProfile(
    userId: string,
    payload: UpsertMySecurityProfileRequest,
  ): Promise<{ updatedAt: string }> {
    await this.findUserOrThrow(userId);

    const now = new Date();
    const salt = randomBytes(16).toString('hex');
    const answerHash = this.hashSecurityAnswer(payload.answer, salt);

    const updated = await this.prisma.userSecurityProfile.upsert({
      where: {
        userId,
      },
      update: {
        question: payload.question.trim(),
        answerHash,
        salt,
        updatedAt: now,
      },
      create: {
        userId,
        question: payload.question.trim(),
        answerHash,
        salt,
        createdAt: now,
        updatedAt: now,
      },
      select: {
        updatedAt: true,
      },
    });

    return {
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async getMyPhoneBinding(userId: string): Promise<MyPhoneBindingResponse['binding']> {
    await this.findUserOrThrow(userId);

    const binding = await this.prisma.userPhoneBinding.findUnique({
      where: {
        userId,
      },
      select: {
        phoneNumber: true,
        updatedAt: true,
      },
    });

    if (!binding) {
      return null;
    }

    return {
      phoneNumber: binding.phoneNumber,
      updatedAt: binding.updatedAt.toISOString(),
    };
  }

  async upsertMyPhoneBinding(
    userId: string,
    payload: UpsertMyPhoneBindingRequest,
  ): Promise<{ phoneNumber: string; updatedAt: string }> {
    await this.findUserOrThrow(userId);
    const now = new Date();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const currentBinding = await tx.userPhoneBinding.findUnique({
          where: {
            userId,
          },
          select: {
            phoneNumber: true,
          },
        });

        const currentBoundPhone = currentBinding?.phoneNumber ?? null;
        const isReplacingBoundPhone = Boolean(
          currentBoundPhone && currentBoundPhone !== payload.phoneNumber,
        );

        if (isReplacingBoundPhone) {
          if (!payload.oldCode) {
            throw new BadRequestException({
              message: 'Old phone verification code is required.',
              errorCode: ErrorCode.InvalidRequestPayload,
            });
          }

          if (!currentBoundPhone) {
            throw new BadRequestException({
              message: 'Current bound phone is missing.',
              errorCode: ErrorCode.InvalidRequestPayload,
            });
          }

          await this.consumeSmsCodeOrThrow(tx, currentBoundPhone, payload.oldCode, now);
        }

        await this.consumeSmsCodeOrThrow(tx, payload.phoneNumber, payload.code, now);

        const existingPhoneBinding = await tx.userPhoneBinding.findUnique({
          where: {
            phoneNumber: payload.phoneNumber,
          },
          select: {
            userId: true,
          },
        });

        if (existingPhoneBinding && existingPhoneBinding.userId !== userId) {
          throw new ConflictException({
            message: 'Phone number is already bound to another account.',
            errorCode: ErrorCode.InvalidRequestPayload,
          });
        }

        const binding = await tx.userPhoneBinding.upsert({
          where: {
            userId,
          },
          update: {
            phoneNumber: payload.phoneNumber,
            updatedAt: now,
          },
          create: {
            userId,
            phoneNumber: payload.phoneNumber,
            createdAt: now,
            updatedAt: now,
          },
          select: {
            phoneNumber: true,
            updatedAt: true,
          },
        });

        return {
          phoneNumber: binding.phoneNumber,
          updatedAt: binding.updatedAt.toISOString(),
        };
      });
    } catch (error) {
      if (this.isUserPhoneBindingConflict(error)) {
        throw new ConflictException({
          message: 'Phone number is already bound to another account.',
          errorCode: ErrorCode.InvalidRequestPayload,
        });
      }

      throw error;
    }
  }

  private isDevCodeEnabled(): boolean {
    return process.env.NODE_ENV === 'development' && process.env.AUTH_DEV_CODE_ENABLED === 'true';
  }

  private async findUserOrThrow(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new UnauthorizedException({
        message: 'User not found.',
        errorCode: ErrorCode.Unauthorized,
      });
    }

    return user;
  }

  private toMeProfile(user: {
    id: string;
    email: string;
    account: string | null;
    name: string | null;
    createdAt: Date;
    passwordUpdatedAt: Date | null;
  }): MeProfile {
    return {
      id: user.id,
      email: user.email,
      account: this.resolveUserAccount(user),
      name: user.name,
      createdAt: user.createdAt.toISOString(),
      passwordUpdatedAt: user.passwordUpdatedAt ? user.passwordUpdatedAt.toISOString() : null,
    };
  }

  private normalizeOptionalName(value: string | null | undefined) {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private issueAccessToken(user: Pick<AuthUser, 'id' | 'email'>, tenantId?: string): string {
    const tokenExpiresInSeconds = Number(process.env.JWT_EXPIRES_IN_SECONDS ?? 7 * 24 * 60 * 60);

    return this.jwtTokenService.sign(
      {
        sub: user.id,
        email: user.email,
        tenantId,
      },
      tokenExpiresInSeconds,
    );
  }

  private generateCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  private async consumeSmsCodeOrThrow(
    tx: Prisma.TransactionClient,
    phoneNumber: string,
    code: string,
    now: Date,
  ): Promise<void> {
    const latestCode = await tx.authCode.findFirst({
      where: {
        email: this.toSmsCodeKey(phoneNumber),
        consumedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!latestCode) {
      this.throwInvalidCode();
    }

    if (latestCode.expiresAt.getTime() <= now.getTime()) {
      throw new UnauthorizedException({
        message: 'Code is expired.',
        errorCode: ErrorCode.ExpiredCode,
      });
    }

    const hashedCode = this.hashCode(code, latestCode.salt);
    if (!this.isHashEqual(hashedCode, latestCode.codeHash)) {
      this.throwInvalidCode();
    }

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
      this.throwInvalidCode();
    }
  }

  private hashCode(code: string, salt: string): string {
    const pepper = process.env.AUTH_CODE_PEPPER ?? '';
    return createHash('sha256').update(`${salt}:${code}:${pepper}`).digest('hex');
  }

  private hashPassword(password: string): string {
    const salt = randomBytes(16);
    const derived = scryptSync(`${password}:${this.getPasswordPepper()}`, salt, 64);
    return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
  }

  private verifyPassword(password: string, storedHash: string): boolean {
    const parts = storedHash.split('$');
    if (parts.length !== 3) {
      return false;
    }

    const [algorithm, saltHex, expectedHex] = parts;
    if (algorithm !== 'scrypt') {
      return false;
    }

    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(expectedHex, 'hex');

    if (expected.length === 0) {
      return false;
    }

    const peppers = [this.getPasswordPepper()];
    if (peppers[0] !== '') {
      peppers.push('');
    }

    for (const pepper of peppers) {
      const candidate = scryptSync(`${password}:${pepper}`, salt, expected.length);
      if (this.isHashEqual(candidate, expected)) {
        return true;
      }
    }

    return false;
  }

  private getPasswordPepper() {
    return process.env.AUTH_PASSWORD_PEPPER ?? process.env.AUTH_CODE_PEPPER ?? '';
  }

  private hashSecurityAnswer(answer: string, salt: string): string {
    const pepper = process.env.AUTH_SECURITY_PEPPER ?? process.env.AUTH_CODE_PEPPER ?? '';
    return createHash('sha256').update(`${salt}:${answer.trim()}:${pepper}`).digest('hex');
  }

  private isHashEqual(left: string | Buffer, right: string | Buffer): boolean {
    const leftBuffer = typeof left === 'string' ? Buffer.from(left, 'utf8') : left;
    const rightBuffer = typeof right === 'string' ? Buffer.from(right, 'utf8') : right;

    if (leftBuffer.byteLength !== rightBuffer.byteLength) {
      return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
  }

  private throwInvalidCode(): never {
    throw new UnauthorizedException({
      message: 'Code is invalid.',
      errorCode: ErrorCode.InvalidCode,
    });
  }

  private throwInvalidCredentials(): never {
    throw new UnauthorizedException({
      message: 'Login identifier or password is incorrect.',
      errorCode: ErrorCode.Unauthorized,
    });
  }

  private toSmsCodeKey(phoneNumber: string): string {
    return `${AuthService.SMS_CODE_KEY_PREFIX}${phoneNumber}`;
  }

  private toPhoneShadowEmail(phoneNumber: string): string {
    return `p${phoneNumber}@${AuthService.PHONE_SHADOW_EMAIL_DOMAIN}`;
  }

  private toAccountEmail(account: string): string {
    return `${account}@${AuthService.ACCOUNT_EMAIL_DOMAIN}`;
  }

  private async loadPhoneIdentity(
    client: Prisma.TransactionClient | PrismaService,
    phoneNumber: string,
  ) {
    const shadowEmail = this.toPhoneShadowEmail(phoneNumber);
    const boundPhone = await client.userPhoneBinding.findUnique({
      where: {
        phoneNumber,
      },
      include: {
        user: true,
      },
    });

    const shadowUser = boundPhone
      ? null
      : await client.user.findUnique({
          where: {
            email: shadowEmail,
          },
        });

    return {
      shadowEmail,
      boundPhone,
      user: boundPhone?.user ?? shadowUser,
    };
  }

  private isRegisteredPhoneAccount(
    user: { email: string; account?: string | null; passwordHash: string | null },
    shadowEmail: string,
  ): boolean {
    return user.email !== shadowEmail || Boolean(user.account) || Boolean(user.passwordHash);
  }

  private normalizeAccountName(value: string): string {
    return value.trim().toLowerCase();
  }

  private normalizeValidAccount(value: string | null | undefined): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = this.normalizeAccountName(value);
    return AuthService.ACCOUNT_NAME_PATTERN.test(normalized) ? normalized : null;
  }

  private extractEmailLocalPart(email: string): string {
    const separatorIndex = email.indexOf('@');
    return separatorIndex === -1 ? email : email.slice(0, separatorIndex);
  }

  private resolveUserAccount(user: {
    email: string;
    account?: string | null;
  }): string | null {
    const persistedAccount = this.normalizeValidAccount(user.account);
    if (persistedAccount) {
      return persistedAccount;
    }

    if (user.email.endsWith(`@${AuthService.ACCOUNT_EMAIL_DOMAIN}`)) {
      return this.normalizeValidAccount(this.extractEmailLocalPart(user.email));
    }

    return null;
  }

  private buildRegisterTenantName(account: string): string {
    return `${account} 的空间`;
  }

  private normalizeAccountTenantSlugBase(account: string): string {
    const normalized = account
      .toLowerCase()
      .replace(/_/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

    return tenantSlugSchema.parse(normalized);
  }

  private async buildUniqueTenantSlug(
    tx: Prisma.TransactionClient,
    account: string,
  ): Promise<string> {
    const baseSlug = this.normalizeAccountTenantSlugBase(account);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${randomInt(1000, 10_000)}`;
      const existing = await tx.tenant.findUnique({
        where: {
          slug: candidate,
        },
        select: {
          id: true,
        },
      });

      if (!existing) {
        return candidate;
      }
    }

    return `${baseSlug}-${Date.now().toString(36).slice(-4)}`;
  }

  private buildFallbackPhoneTenantSlug(phoneNumber: string): string {
    const suffix = `${phoneNumber.slice(-4)}${randomInt(1000, 10_000)}`;
    return `u-${suffix}`.toLowerCase();
  }

  private isTenantSlugConflict(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    const target = Array.isArray(error.meta?.target) ? error.meta.target : [];
    return target.includes('slug');
  }

  private isTenantMemberUserConflict(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    const target = Array.isArray(error.meta?.target) ? error.meta.target : [];
    const normalized = new Set(target.map((value) => String(value)));

    return (
      normalized.has('userId') ||
      normalized.has('user_id') ||
      normalized.has('tenant_members_user_id_key')
    );
  }

  private isUserPhoneBindingConflict(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    const target = Array.isArray(error.meta?.target) ? error.meta.target : [];
    const normalized = new Set(target.map((value) => String(value)));
    return (
      normalized.has('phoneNumber') ||
      normalized.has('phone_number') ||
      normalized.has('user_phone_bindings_phone_number_key')
    );
  }
}
