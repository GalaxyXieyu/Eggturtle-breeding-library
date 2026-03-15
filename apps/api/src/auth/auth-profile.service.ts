import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ErrorCode } from '@eggturtle/shared';
import type {
  DeleteMyAvatarResponse,
  MeProfile,
  MyPhoneBindingResponse,
  MySecurityProfileResponse,
  UploadMyAvatarResponse,
  UpdateMeProfileRequest,
  UpdateMyPasswordRequest,
  UpsertMyPhoneBindingRequest,
  UpsertMySecurityProfileRequest,
} from '@eggturtle/shared';
import { randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';

import { PrismaService } from '../prisma.service';
import { STORAGE_PROVIDER_TOKEN } from '../storage/storage.constants';
import type { StorageProvider } from '../storage/storage.provider';

import { AuthSharedService } from './auth-shared.service';

type UploadedBinaryFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

@Injectable()
export class AuthProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authSharedService: AuthSharedService,
    @Inject(STORAGE_PROVIDER_TOKEN) private readonly storageProvider: StorageProvider,
  ) {}

  async getMyProfile(userId: string): Promise<MeProfile> {
    const user = await this.authSharedService.findUserOrThrow(userId);
    return this.authSharedService.toMeProfile(user);
  }

  async updateMyProfile(userId: string, payload: UpdateMeProfileRequest): Promise<MeProfile> {
    const name = this.authSharedService.normalizeOptionalName(payload.name);
    const updated = await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        name,
      },
    });

    return this.authSharedService.toMeProfile(updated);
  }

  async uploadMyAvatar(
    userId: string,
    file: UploadedBinaryFile,
  ): Promise<UploadMyAvatarResponse['profile']> {
    await this.authSharedService.findUserOrThrow(userId);

    const contentType = file.mimetype?.trim() || 'application/octet-stream';
    if (!contentType.startsWith('image/')) {
      throw new BadRequestException('Only image files are supported.');
    }

    const previousAvatarUrl = await this.loadCurrentAvatarUrl(userId);
    const extension = this.resolveImageExtension(file.originalname, contentType);
    const key = `${userId}/user-avatar/${Date.now()}-${randomUUID()}${extension}`;
    const uploadResult = await this.storageProvider.putObject({
      key,
      body: file.buffer,
      contentType,
      metadata: {
        userId,
        source: 'me.avatar.upload',
      },
    });

    const avatarUrl = /^https?:\/\//i.test(uploadResult.url.trim())
      ? uploadResult.url.trim()
      : `/me/avatar/assets?key=${encodeURIComponent(uploadResult.key)}`;

    const updated = await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        avatarUrl,
      },
    });

    await this.deleteManagedAvatarIfOwned(userId, previousAvatarUrl).catch(() => undefined);
    return this.authSharedService.toMeProfile(updated);
  }

  async deleteMyAvatar(userId: string): Promise<DeleteMyAvatarResponse['profile']> {
    await this.authSharedService.findUserOrThrow(userId);
    const previousAvatarUrl = await this.loadCurrentAvatarUrl(userId);
    const updated = await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        avatarUrl: null,
      },
    });

    await this.deleteManagedAvatarIfOwned(userId, previousAvatarUrl).catch(() => undefined);
    return this.authSharedService.toMeProfile(updated);
  }

  async updateMyPassword(
    userId: string,
    payload: UpdateMyPasswordRequest,
  ): Promise<{ passwordUpdatedAt: string }> {
    const user = await this.authSharedService.findUserOrThrow(userId);
    const currentPassword = payload.currentPassword?.trim();

    if (user.passwordHash) {
      if (
        !currentPassword ||
        !this.authSharedService.verifyPassword(currentPassword, user.passwordHash)
      ) {
        throw new UnauthorizedException({
          message: 'Authentication failed.',
          errorCode: ErrorCode.AuthCurrentPasswordIncorrect,
        });
      }

      if (this.authSharedService.verifyPassword(payload.newPassword, user.passwordHash)) {
        throw new BadRequestException({
          message: 'Invalid password.',
          errorCode: ErrorCode.AuthPasswordSameAsCurrent,
        });
      }
    }

    const passwordUpdatedAt = new Date();
    await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        passwordHash: this.authSharedService.hashPassword(payload.newPassword),
        passwordUpdatedAt,
      },
    });

    return {
      passwordUpdatedAt: passwordUpdatedAt.toISOString(),
    };
  }

  async getMySecurityProfile(userId: string): Promise<MySecurityProfileResponse['profile']> {
    await this.authSharedService.findUserOrThrow(userId);

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
    await this.authSharedService.findUserOrThrow(userId);

    const now = new Date();
    const salt = randomBytes(16).toString('hex');
    const answerHash = this.authSharedService.hashSecurityAnswer(payload.answer, salt);

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
    await this.authSharedService.findUserOrThrow(userId);

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
    await this.authSharedService.findUserOrThrow(userId);
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
              message: 'Verification required.',
              errorCode: ErrorCode.AuthOldPhoneCodeRequired,
            });
          }

          if (!currentBoundPhone) {
            throw new BadRequestException({
              message: 'Verification required.',
              errorCode: ErrorCode.AuthCurrentPhoneMissing,
            });
          }

          await this.authSharedService.consumeSmsCodeOrThrow(
            tx,
            currentBoundPhone,
            payload.oldCode,
            now,
          );
        }

        await this.authSharedService.consumeSmsCodeOrThrow(
          tx,
          payload.phoneNumber,
          payload.code,
          now,
        );

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
            message: 'Request failed.',
            errorCode: ErrorCode.AuthPhoneBound,
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
      if (this.authSharedService.isUserPhoneBindingConflict(error)) {
        throw new ConflictException({
          message: 'Request failed.',
          errorCode: ErrorCode.AuthPhoneBound,
        });
      }

      throw error;
    }
  }

  private async loadCurrentAvatarUrl(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        avatarUrl: true,
      },
    });

    return user?.avatarUrl?.trim() || null;
  }

  private async deleteManagedAvatarIfOwned(userId: string, avatarUrl: string | null) {
    const key = this.extractManagedAvatarKey(avatarUrl);
    if (!key || !key.startsWith(`${userId}/user-avatar/`)) {
      return;
    }

    await this.storageProvider.deleteObject(key);
  }

  private extractManagedAvatarKey(avatarUrl: string | null | undefined): string | null {
    const normalized = avatarUrl?.trim();
    if (!normalized) {
      return null;
    }

    try {
      const parsed = new URL(normalized, 'http://localhost');
      if (parsed.pathname === '/me/avatar/assets') {
        return this.normalizeStorageKey(parsed.searchParams.get('key'));
      }

      const uploadPublicBaseUrl = (process.env.UPLOAD_PUBLIC_BASE_URL ?? '/uploads').replace(
        /\/+$/,
        '',
      );
      if (
        parsed.pathname === uploadPublicBaseUrl ||
        !parsed.pathname.startsWith(`${uploadPublicBaseUrl}/`)
      ) {
        return null;
      }

      return this.normalizeStorageKey(
        decodeURIComponent(parsed.pathname.slice(uploadPublicBaseUrl.length + 1)),
      );
    } catch {
      return null;
    }
  }

  private normalizeStorageKey(rawKey: string | null | undefined): string | null {
    const key = rawKey?.replace(/\\/g, '/').replace(/^\/+/, '').trim();
    if (!key) {
      return null;
    }

    const segments = key.split('/').filter((segment) => segment.length > 0);
    if (segments.length < 2 || segments.some((segment) => segment === '..')) {
      return null;
    }

    return segments.join('/');
  }

  private resolveImageExtension(originalName: string, mimeType: string): string {
    const extensionFromName = path.extname(originalName).trim();
    if (extensionFromName) {
      return extensionFromName.toLowerCase();
    }

    const extensionMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'image/svg+xml': '.svg',
    };

    return extensionMap[mimeType] ?? '.bin';
  }
}
