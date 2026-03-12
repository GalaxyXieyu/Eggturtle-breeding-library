import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ErrorCode, tenantSlugSchema } from '@eggturtle/shared';
import type { AuthUser, MeProfile } from '@eggturtle/shared';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';

import { PrismaService } from '../prisma.service';

import { JwtTokenService } from './jwt-token.service';

const SMS_CODE_KEY_PREFIX = 'sms:';
const ACCOUNT_EMAIL_DOMAIN = 'account.eggturtle.local';
const PHONE_SHADOW_EMAIL_DOMAIN = 'phone.eggturtle.local';
const ACCOUNT_NAME_PATTERN = /^[a-z][a-z0-9_-]{2,30}[a-z0-9]$/;

@Injectable()
export class AuthSharedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  isDevCodeEnabled(): boolean {
    return process.env.NODE_ENV === 'development' && process.env.AUTH_DEV_CODE_ENABLED === 'true';
  }

  async findUserOrThrow(userId: string) {
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

  toMeProfile(user: {
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

  toAuthUser(user: {
    id: string;
    email: string;
    account?: string | null;
    name: string | null;
    isSuperAdmin: boolean;
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      account: this.resolveUserAccount(user),
      name: user.name,
      isSuperAdmin: user.isSuperAdmin,
    };
  }

  normalizeOptionalName(value: string | null | undefined) {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  issueAccessToken(user: Pick<AuthUser, 'id' | 'email'>, tenantId?: string): string {
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

  generateCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  assertAdminSurfaceAccess(
    user: {
      isSuperAdmin: boolean;
    },
    surface?: string,
  ): void {
    if (surface !== 'admin' || user.isSuperAdmin) {
      return;
    }

    throw new ForbiddenException({
      message: 'Admin access denied.',
      errorCode: ErrorCode.Forbidden,
    });
  }

  async consumeSmsCodeOrThrow(
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

  hashCode(code: string, salt: string): string {
    const pepper = process.env.AUTH_CODE_PEPPER ?? '';
    return createHash('sha256').update(`${salt}:${code}:${pepper}`).digest('hex');
  }

  hashPassword(password: string): string {
    const salt = randomBytes(16);
    const derived = scryptSync(`${password}:${this.getPasswordPepper()}`, salt, 64);
    return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
  }

  verifyPassword(password: string, storedHash: string): boolean {
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

  hashSecurityAnswer(answer: string, salt: string): string {
    const pepper = process.env.AUTH_SECURITY_PEPPER ?? process.env.AUTH_CODE_PEPPER ?? '';
    return createHash('sha256').update(`${salt}:${answer.trim()}:${pepper}`).digest('hex');
  }

  throwInvalidCode(): never {
    throw new UnauthorizedException({
      message: 'Code is invalid.',
      errorCode: ErrorCode.InvalidCode,
    });
  }

  throwInvalidCredentials(): never {
    throw new UnauthorizedException({
      message: 'Authentication failed.',
      errorCode: ErrorCode.AuthInvalidCredentials,
    });
  }

  toSmsCodeKey(phoneNumber: string): string {
    return `${SMS_CODE_KEY_PREFIX}${phoneNumber}`;
  }

  toPhoneShadowEmail(phoneNumber: string): string {
    return `p${phoneNumber}@${PHONE_SHADOW_EMAIL_DOMAIN}`;
  }

  toAccountEmail(account: string): string {
    return `${account}@${ACCOUNT_EMAIL_DOMAIN}`;
  }

  async loadPhoneIdentity(
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

  isRegisteredPhoneAccount(
    user: { email: string; account?: string | null; passwordHash: string | null },
    shadowEmail: string,
  ): boolean {
    return user.email !== shadowEmail || Boolean(user.account) || Boolean(user.passwordHash);
  }

  normalizeAccountName(value: string): string {
    return value.trim().toLowerCase();
  }

  normalizeValidAccount(value: string | null | undefined): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = this.normalizeAccountName(value);
    return ACCOUNT_NAME_PATTERN.test(normalized) ? normalized : null;
  }

  extractEmailLocalPart(email: string): string {
    const separatorIndex = email.indexOf('@');
    return separatorIndex === -1 ? email : email.slice(0, separatorIndex);
  }

  resolveUserAccount(user: {
    email: string;
    account?: string | null;
  }): string | null {
    const persistedAccount = this.normalizeValidAccount(user.account);
    if (persistedAccount) {
      return persistedAccount;
    }

    if (user.email.endsWith(`@${ACCOUNT_EMAIL_DOMAIN}`)) {
      return this.normalizeValidAccount(this.extractEmailLocalPart(user.email));
    }

    return null;
  }

  buildRegisterTenantName(account: string): string {
    return `${account} 的空间`;
  }

  normalizeAccountTenantSlugBase(account: string): string {
    const normalized = account
      .toLowerCase()
      .replace(/_/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

    return tenantSlugSchema.parse(normalized);
  }

  async buildUniqueTenantSlug(
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

  buildFallbackPhoneTenantSlug(phoneNumber: string): string {
    const suffix = `${phoneNumber.slice(-4)}${randomInt(1000, 10_000)}`;
    return `u-${suffix}`.toLowerCase();
  }

  async findUserByAccountName(
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

  async resolveDefaultTenantId(userId: string): Promise<string | undefined> {
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

  isTenantSlugConflict(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    const target = Array.isArray(error.meta?.target) ? error.meta.target : [];
    return target.includes('slug');
  }

  isTenantMemberUserConflict(error: unknown): boolean {
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

  isUserPhoneBindingConflict(error: unknown): boolean {
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

  private getPasswordPepper() {
    return process.env.AUTH_PASSWORD_PEPPER ?? process.env.AUTH_CODE_PEPPER ?? '';
  }

  isHashEqual(left: string | Buffer, right: string | Buffer): boolean {
    const leftBuffer = typeof left === 'string' ? Buffer.from(left, 'utf8') : left;
    const rightBuffer = typeof right === 'string' ? Buffer.from(right, 'utf8') : right;

    if (leftBuffer.byteLength !== rightBuffer.byteLength) {
      return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
  }
}
