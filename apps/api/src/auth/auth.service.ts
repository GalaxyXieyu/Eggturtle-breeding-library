import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import { ErrorCode } from '@eggturtle/shared';
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
  VerifyCodeResponse
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

@Injectable()
export class AuthService {
  private static readonly SMS_CODE_KEY_PREFIX = 'sms:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtTokenService: JwtTokenService,
    private readonly smsVerificationService: SmsVerificationService
  ) {}

  async requestCode(email: string): Promise<RequestCodeResponse> {
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
        expiresAt
      }
    });

    const shouldExposeDevCode = this.isDevCodeEnabled();
    if (shouldExposeDevCode) {
      console.info('[Auth v0] request-code', {
        email,
        code,
        expiresAt: expiresAt.toISOString()
      });
    }

    return {
      ok: true,
      expiresAt: expiresAt.toISOString(),
      ...(shouldExposeDevCode ? { devCode: code } : {})
    };
  }

  async requestSmsCode(phoneNumber: string): Promise<RequestSmsCodeResponse> {
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
        expiresAt
      }
    });

    try {
      await this.smsVerificationService.sendRegisterSmsCode({
        phoneNumber,
        code,
        validTimeSeconds,
        outId: `register-${Date.now()}-${randomInt(1000, 10_000)}`
      });
    } catch (error) {
      await this.prisma.authCode
        .updateMany({
          where: {
            id: authCode.id,
            consumedAt: null
          },
          data: {
            consumedAt: now
          }
        })
        .catch(() => undefined);

      throw error;
    }

    const shouldExposeDevCode = this.isDevCodeEnabled();
    if (shouldExposeDevCode) {
      console.info('[Auth v0] request-sms-code', {
        phoneNumber,
        code,
        expiresAt: expiresAt.toISOString()
      });
    }

    return {
      ok: true,
      expiresAt: expiresAt.toISOString(),
      ...(shouldExposeDevCode ? { devCode: code } : {})
    };
  }

  async verifyCode(email: string, code: string, password?: string): Promise<VerifyCodeResponse> {
    const latestCode = await this.prisma.authCode.findFirst({
      where: {
        email,
        consumedAt: null
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!latestCode) {
      this.throwInvalidCode();
    }

    const now = new Date();
    if (latestCode.expiresAt.getTime() <= now.getTime()) {
      throw new UnauthorizedException({
        message: 'Code is expired.',
        errorCode: ErrorCode.ExpiredCode
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
          consumedAt: null
        },
        data: {
          consumedAt: now
        }
      });

      if (consumed.count !== 1) {
        this.throwInvalidCode();
      }

      const passwordUpdate = password
        ? {
            passwordHash: this.hashPassword(password),
            passwordUpdatedAt: now
          }
        : {};

      return tx.user.upsert({
        where: { email },
        update: passwordUpdate,
        create: {
          email,
          ...passwordUpdate
        }
      });
    });

    const tenantId = await this.resolveDefaultTenantId(user.id);
    const accessToken = this.issueAccessToken(
      {
        id: user.id,
        email: user.email
      },
      tenantId
    );

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    };
  }

  async passwordLogin(email: string, password: string): Promise<PasswordLoginResponse> {
    const loginIdentifier = email.trim().toLowerCase();
    let user = await this.prisma.user.findUnique({
      where: {
        email: loginIdentifier
      }
    });

    // Support tenant-slug login (e.g. "siri") by resolving to the tenant owner account.
    if (!user && !loginIdentifier.includes('@')) {
      const ownerMembership = await this.prisma.tenantMember.findFirst({
        where: {
          role: TenantMemberRole.OWNER,
          tenant: {
            slug: loginIdentifier
          },
          user: {
            passwordHash: {
              not: null
            }
          }
        },
        include: {
          user: true
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      user = ownerMembership?.user ?? null;
    }

    if (!user && !loginIdentifier.includes('@')) {
      user = await this.findUserByAccountName(loginIdentifier);
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
        email: user.email
      },
      tenantId
    );

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    };
  }

  async phoneLogin(phoneNumber: string, code: string): Promise<PhoneLoginResponse> {
    const now = new Date();
    const shadowEmail = this.toPhoneShadowEmail(phoneNumber);

    return this.prisma.$transaction(async (tx) => {
      await this.consumeSmsCodeOrThrow(tx, phoneNumber, code, now);

      const boundPhone = await tx.userPhoneBinding.findUnique({
        where: {
          phoneNumber
        },
        include: {
          user: true
        }
      });

      let user = boundPhone?.user ?? null;
      let isNewUser = false;

      if (!user) {
        user = await tx.user.findUnique({
          where: {
            email: shadowEmail
          }
        });
      }

      if (!user) {
        user = await tx.user.create({
          data: {
            email: shadowEmail
          }
        });
        isNewUser = true;
      }

      let membership = await tx.tenantMember.findFirst({
        where: {
          userId: user.id
        },
        orderBy: {
          createdAt: 'asc'
        },
        include: {
          tenant: {
            select: {
              id: true,
              slug: true,
              name: true
            }
          }
        }
      });

      if (!membership) {
        const tenant = await tx.tenant.create({
          data: {
            slug: this.buildPhoneTenantSlug(phoneNumber),
            name: `手机用户${phoneNumber.slice(-4)}`
          }
        });

        membership = await tx.tenantMember.create({
          data: {
            tenantId: tenant.id,
            userId: user.id,
            role: TenantMemberRole.OWNER
          },
          include: {
            tenant: {
              select: {
                id: true,
                slug: true,
                name: true
              }
            }
          }
        });

        await tx.tenantSubscription.create({
          data: {
            tenantId: tenant.id,
            plan: 'FREE',
            startsAt: now,
            expiresAt: null,
            disabledAt: null
          }
        });

        isNewUser = true;
      }

      const accessToken = this.issueAccessToken(
        {
          id: user.id,
          email: user.email
        },
        membership.tenantId
      );

      return {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        tenant: {
          id: membership.tenant.id,
          slug: membership.tenant.slug,
          name: membership.tenant.name
        },
        isNewUser
      };
    });
  }

  private async findUserByAccountName(accountName: string) {
    const candidates = await this.prisma.user.findMany({
      where: {
        passwordHash: {
          not: null
        },
        email: {
          startsWith: `${accountName}@`,
          mode: 'insensitive'
        }
      },
      orderBy: {
        createdAt: 'asc'
      },
      take: 2
    });

    if (candidates.length !== 1) {
      return null;
    }

    return candidates[0];
  }

  private async resolveDefaultTenantId(userId: string): Promise<string | undefined> {
    const membership = await this.prisma.tenantMember.findFirst({
      where: {
        userId
      },
      orderBy: {
        createdAt: 'asc'
      },
      select: {
        tenantId: true
      }
    });

    return membership?.tenantId;
  }

  async switchTenant(user: AuthUser, payload: SwitchTenantRequest): Promise<SwitchTenantResponse> {
    const tenant = payload.tenantId
      ? await this.prisma.tenant.findUnique({
          where: {
            id: payload.tenantId
          }
        })
      : await this.prisma.tenant.findUnique({
          where: {
            slug: payload.slug!
          }
        });

    if (!tenant) {
      throw new NotFoundException({
        message: 'Tenant not found.',
        errorCode: ErrorCode.TenantNotFound
      });
    }

    const membership = await this.prisma.tenantMember.findUnique({
      where: {
        tenantId_userId: {
          tenantId: tenant.id,
          userId: user.id
        }
      }
    });

    if (!membership) {
      throw new ForbiddenException({
        message: 'User is not a member of this tenant.',
        errorCode: ErrorCode.NotTenantMember
      });
    }

    return {
      accessToken: this.issueAccessToken(user, tenant.id),
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name
      },
      role: membership.role
    };
  }

  async register(payload: RegisterRequest): Promise<RegisterResponse> {
    const authCodeTarget = payload.phoneNumber ? this.toSmsCodeKey(payload.phoneNumber) : payload.email;
    const latestCode = await this.prisma.authCode.findFirst({
      where: {
        email: authCodeTarget,
        consumedAt: null
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!latestCode) {
      this.throwInvalidCode();
    }

    const now = new Date();
    if (latestCode.expiresAt.getTime() <= now.getTime()) {
      throw new UnauthorizedException({
        message: 'Code is expired.',
        errorCode: ErrorCode.ExpiredCode
      });
    }

    const hashedCode = this.hashCode(payload.code, latestCode.salt);
    if (!this.isHashEqual(hashedCode, latestCode.codeHash)) {
      this.throwInvalidCode();
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Consume the auth code
        const consumed = await tx.authCode.updateMany({
          where: {
            id: latestCode.id,
            consumedAt: null
          },
          data: {
            consumedAt: now
          }
        });

        if (consumed.count !== 1) {
          this.throwInvalidCode();
        }

        // Create or update user with password
        const user = await tx.user.upsert({
          where: { email: payload.email },
          update: {
            passwordHash: this.hashPassword(payload.password),
            passwordUpdatedAt: now
          },
          create: {
            email: payload.email,
            passwordHash: this.hashPassword(payload.password),
            passwordUpdatedAt: now
          }
        });

        const existingMembership = await tx.tenantMember.findFirst({
          where: {
            userId: user.id
          },
          include: {
            tenant: {
              select: {
                slug: true
              }
            }
          }
        });

        if (existingMembership) {
          throw new ConflictException({
            message: `User is already bound to tenant "${existingMembership.tenant.slug}".`,
            errorCode: ErrorCode.InvalidRequestPayload
          });
        }

        // Create tenant
        const tenant = await tx.tenant.create({
          data: {
            slug: payload.tenantSlug,
            name: payload.tenantName
          }
        });

        // Create tenant membership as OWNER
        const membership = await tx.tenantMember.create({
          data: {
            tenantId: tenant.id,
            userId: user.id,
            role: TenantMemberRole.OWNER
          }
        });

        // Create FREE subscription for new tenant
        await tx.tenantSubscription.create({
          data: {
            tenantId: tenant.id,
            plan: 'FREE',
            startsAt: now,
            expiresAt: null,
            disabledAt: null
          }
        });

        // Issue access token with tenant context
        const accessToken = this.issueAccessToken(
          {
            id: user.id,
            email: user.email
          },
          tenant.id
        );

        return {
          accessToken,
          user: {
            id: user.id,
            email: user.email,
            name: user.name
          },
          tenant: {
            id: tenant.id,
            slug: tenant.slug,
            name: tenant.name
          },
          role: membership.role
        };
      });
    } catch (error) {
      if (this.isTenantSlugConflict(error)) {
        throw new ConflictException({
          message: 'Tenant slug already exists.',
          errorCode: ErrorCode.TenantSlugConflict
        });
      }

      if (this.isTenantMemberUserConflict(error)) {
        throw new ConflictException({
          message: 'User is already bound to a tenant.',
          errorCode: ErrorCode.InvalidRequestPayload
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
        id: payload.sub
      }
    });

    if (!user) {
      return null;
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      tenantId: payload.tenantId
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
        id: userId
      },
      data: {
        name
      }
    });

    return this.toMeProfile(updated);
  }

  async updateMyPassword(userId: string, payload: UpdateMyPasswordRequest): Promise<{ passwordUpdatedAt: string }> {
    const user = await this.findUserOrThrow(userId);
    const currentPassword = payload.currentPassword?.trim();

    if (user.passwordHash) {
      if (!currentPassword || !this.verifyPassword(currentPassword, user.passwordHash)) {
        throw new UnauthorizedException({
          message: 'Current password is incorrect.',
          errorCode: ErrorCode.Unauthorized
        });
      }

      if (this.verifyPassword(payload.newPassword, user.passwordHash)) {
        throw new BadRequestException({
          message: 'New password must be different from current password.',
          errorCode: ErrorCode.InvalidRequestPayload
        });
      }
    }

    const passwordUpdatedAt = new Date();
    await this.prisma.user.update({
      where: {
        id: userId
      },
      data: {
        passwordHash: this.hashPassword(payload.newPassword),
        passwordUpdatedAt
      }
    });

    return {
      passwordUpdatedAt: passwordUpdatedAt.toISOString()
    };
  }

  async getMySecurityProfile(userId: string): Promise<MySecurityProfileResponse['profile']> {
    await this.findUserOrThrow(userId);

    const profile = await this.prisma.userSecurityProfile.findUnique({
      where: {
        userId
      },
      select: {
        question: true,
        updatedAt: true
      }
    });

    if (!profile) {
      return null;
    }

    return {
      question: profile.question,
      updatedAt: profile.updatedAt.toISOString()
    };
  }

  async upsertMySecurityProfile(userId: string, payload: UpsertMySecurityProfileRequest): Promise<{ updatedAt: string }> {
    await this.findUserOrThrow(userId);

    const now = new Date();
    const salt = randomBytes(16).toString('hex');
    const answerHash = this.hashSecurityAnswer(payload.answer, salt);

    const updated = await this.prisma.userSecurityProfile.upsert({
      where: {
        userId
      },
      update: {
        question: payload.question.trim(),
        answerHash,
        salt,
        updatedAt: now
      },
      create: {
        userId,
        question: payload.question.trim(),
        answerHash,
        salt,
        createdAt: now,
        updatedAt: now
      },
      select: {
        updatedAt: true
      }
    });

    return {
      updatedAt: updated.updatedAt.toISOString()
    };
  }

  async getMyPhoneBinding(userId: string): Promise<MyPhoneBindingResponse['binding']> {
    await this.findUserOrThrow(userId);

    const binding = await this.prisma.userPhoneBinding.findUnique({
      where: {
        userId
      },
      select: {
        phoneNumber: true,
        updatedAt: true
      }
    });

    if (!binding) {
      return null;
    }

    return {
      phoneNumber: binding.phoneNumber,
      updatedAt: binding.updatedAt.toISOString()
    };
  }

  async upsertMyPhoneBinding(
    userId: string,
    payload: UpsertMyPhoneBindingRequest
  ): Promise<{ phoneNumber: string; updatedAt: string }> {
    await this.findUserOrThrow(userId);
    const now = new Date();

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.consumeSmsCodeOrThrow(tx, payload.phoneNumber, payload.code, now);

        const existingPhoneBinding = await tx.userPhoneBinding.findUnique({
          where: {
            phoneNumber: payload.phoneNumber
          },
          select: {
            userId: true
          }
        });

        if (existingPhoneBinding && existingPhoneBinding.userId !== userId) {
          throw new ConflictException({
            message: 'Phone number is already bound to another account.',
            errorCode: ErrorCode.InvalidRequestPayload
          });
        }

        const binding = await tx.userPhoneBinding.upsert({
          where: {
            userId
          },
          update: {
            phoneNumber: payload.phoneNumber,
            updatedAt: now
          },
          create: {
            userId,
            phoneNumber: payload.phoneNumber,
            createdAt: now,
            updatedAt: now
          },
          select: {
            phoneNumber: true,
            updatedAt: true
          }
        });

        return {
          phoneNumber: binding.phoneNumber,
          updatedAt: binding.updatedAt.toISOString()
        };
      });
    } catch (error) {
      if (this.isUserPhoneBindingConflict(error)) {
        throw new ConflictException({
          message: 'Phone number is already bound to another account.',
          errorCode: ErrorCode.InvalidRequestPayload
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
        id: userId
      }
    });

    if (!user) {
      throw new UnauthorizedException({
        message: 'User not found.',
        errorCode: ErrorCode.Unauthorized
      });
    }

    return user;
  }

  private toMeProfile(user: {
    id: string;
    email: string;
    name: string | null;
    createdAt: Date;
    passwordUpdatedAt: Date | null;
  }): MeProfile {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
      passwordUpdatedAt: user.passwordUpdatedAt ? user.passwordUpdatedAt.toISOString() : null
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
        tenantId
      },
      tokenExpiresInSeconds
    );
  }

  private generateCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  private async consumeSmsCodeOrThrow(
    tx: Prisma.TransactionClient,
    phoneNumber: string,
    code: string,
    now: Date
  ): Promise<void> {
    const latestCode = await tx.authCode.findFirst({
      where: {
        email: this.toSmsCodeKey(phoneNumber),
        consumedAt: null
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!latestCode) {
      this.throwInvalidCode();
    }

    if (latestCode.expiresAt.getTime() <= now.getTime()) {
      throw new UnauthorizedException({
        message: 'Code is expired.',
        errorCode: ErrorCode.ExpiredCode
      });
    }

    const hashedCode = this.hashCode(code, latestCode.salt);
    if (!this.isHashEqual(hashedCode, latestCode.codeHash)) {
      this.throwInvalidCode();
    }

    const consumed = await tx.authCode.updateMany({
      where: {
        id: latestCode.id,
        consumedAt: null
      },
      data: {
        consumedAt: now
      }
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
    const candidate = scryptSync(`${password}:${this.getPasswordPepper()}`, salt, expected.length);

    return this.isHashEqual(candidate, expected);
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
      errorCode: ErrorCode.InvalidCode
    });
  }

  private throwInvalidCredentials(): never {
    throw new UnauthorizedException({
      message: 'Login identifier or password is incorrect.',
      errorCode: ErrorCode.Unauthorized
    });
  }

  private toSmsCodeKey(phoneNumber: string): string {
    return `${AuthService.SMS_CODE_KEY_PREFIX}${phoneNumber}`;
  }

  private toPhoneShadowEmail(phoneNumber: string): string {
    return `p${phoneNumber}@phone.eggturtle.local`;
  }

  private buildPhoneTenantSlug(phoneNumber: string): string {
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
    return normalized.has('phoneNumber') || normalized.has('phone_number') || normalized.has('user_phone_bindings_phone_number_key');
  }
}
