import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

export type TokenPayload = {
  sub: string;
  email: string;
  tenantId?: string;
  iat: number;
  exp: number;
};

const JWT_HEADER = {
  alg: 'HS256',
  typ: 'JWT'
} as const;

@Injectable()
export class JwtTokenService {
  sign(payload: Pick<TokenPayload, 'sub' | 'email' | 'tenantId'>, expiresInSeconds: number): string {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const tokenPayload: TokenPayload = {
      ...payload,
      iat: nowInSeconds,
      exp: nowInSeconds + expiresInSeconds
    };

    const encodedHeader = this.encodeBase64Url(JWT_HEADER);
    const encodedPayload = this.encodeBase64Url(tokenPayload);
    const signature = this.signSegment(`${encodedHeader}.${encodedPayload}`);

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  verify(token: string): TokenPayload | null {
    const segments = token.split('.');

    if (segments.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, signature] = segments;
    const expectedSignature = this.signSegment(`${encodedHeader}.${encodedPayload}`);

    if (!this.safeEqual(signature, expectedSignature)) {
      return null;
    }

    try {
      const header = this.decodeBase64Url<{ alg: string; typ: string }>(encodedHeader);
      const payload = this.decodeBase64Url<TokenPayload>(encodedPayload);

      if (header.alg !== JWT_HEADER.alg || header.typ !== JWT_HEADER.typ) {
        return null;
      }

      const nowInSeconds = Math.floor(Date.now() / 1000);
      if (payload.exp <= nowInSeconds) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  private signSegment(segment: string): string {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new InternalServerErrorException('JWT_SECRET is required.');
    }

    return createHmac('sha256', secret).update(segment).digest('base64url');
  }

  private encodeBase64Url(value: unknown): string {
    return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
  }

  private decodeBase64Url<T>(value: string): T {
    const decoded = Buffer.from(value, 'base64url').toString('utf8');
    return JSON.parse(decoded) as T;
  }

  private safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'utf8');
    const rightBuffer = Buffer.from(right, 'utf8');

    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
  }
}
