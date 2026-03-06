import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ErrorCode } from '@eggturtle/shared';
import type {
  MeProfile,
  MyPhoneBindingResponse,
  MySecurityProfileResponse,
  UpdateMeProfileRequest,
  UpdateMyPasswordRequest,
  UpsertMyPhoneBindingRequest,
  UpsertMySecurityProfileRequest,
} from '@eggturtle/shared';
import { randomBytes } from 'node:crypto';

import { PrismaService } from '../prisma.service';

import { AuthSharedService } from './auth-shared.service';

@Injectable()
export class AuthProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authSharedService: AuthSharedService,
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

  async updateMyPassword(
    userId: string,
    payload: UpdateMyPasswordRequest,
  ): Promise<{ passwordUpdatedAt: string }> {
    const user = await this.authSharedService.findUserOrThrow(userId);
    const currentPassword = payload.currentPassword?.trim();

    if (user.passwordHash) {
      if (!currentPassword || !this.authSharedService.verifyPassword(currentPassword, user.passwordHash)) {
        throw new UnauthorizedException({
          message: 'Current password is incorrect.',
          errorCode: ErrorCode.Unauthorized,
        });
      }

      if (this.authSharedService.verifyPassword(payload.newPassword, user.passwordHash)) {
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

          await this.authSharedService.consumeSmsCodeOrThrow(tx, currentBoundPhone, payload.oldCode, now);
        }

        await this.authSharedService.consumeSmsCodeOrThrow(tx, payload.phoneNumber, payload.code, now);

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
      if (this.authSharedService.isUserPhoneBindingConflict(error)) {
        throw new ConflictException({
          message: 'Phone number is already bound to another account.',
          errorCode: ErrorCode.InvalidRequestPayload,
        });
      }

      throw error;
    }
  }
}
