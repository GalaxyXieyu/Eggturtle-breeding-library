import { Injectable } from '@nestjs/common';
import type { AuthUser } from '@eggturtle/shared';

import { PrismaService } from '../prisma.service';

import { JwtTokenService } from './jwt-token.service';
import { AuthSharedService } from './auth-shared.service';

export type AuthContext = {
  user: AuthUser;
  tenantId?: string;
};

@Injectable()
export class AuthAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtTokenService: JwtTokenService,
    private readonly authSharedService: AuthSharedService,
  ) {}

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
        account: this.authSharedService.resolveUserAccount(user),
        name: user.name,
      },
      tenantId: payload.tenantId,
    };
  }

  async getUserFromAccessToken(token: string): Promise<AuthUser | null> {
    const context = await this.getAuthContextFromAccessToken(token);
    return context?.user ?? null;
  }
}
