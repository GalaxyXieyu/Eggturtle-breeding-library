import crypto from 'node:crypto';

import { PrismaClient } from '@prisma/client';

function randomCode(length: number): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function main() {
  const count = Number(process.env.COUNT ?? 10);
  const codeLabel = String(process.env.LABEL ?? 'BATCH');
  const durationDays = process.env.DAYS ? Number(process.env.DAYS) : 30;
  const redeemLimit = process.env.REDEEM_LIMIT ? Number(process.env.REDEEM_LIMIT) : 1;
  const expiresAt = process.env.EXPIRES_AT ? new Date(process.env.EXPIRES_AT) : null;
  const createdByUserId = process.env.CREATED_BY_USER_ID;

  if (!createdByUserId) {
    throw new Error('CREATED_BY_USER_ID is required (an existing users.id).');
  }

  const prisma = new PrismaClient();
  const created: Array<{ code: string; id: string }> = [];

  for (let i = 0; i < count; i += 1) {
    // best-effort retry on digest collisions
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = randomCode(12);
      const codeDigest = sha256Hex(code);
      try {
        const row = await prisma.subscriptionActivationCode.create({
          data: {
            codeDigest,
            codeLabel,
            plan: 'PRO',
            durationDays,
            redeemLimit,
            redeemedCount: 0,
            expiresAt,
            createdByUserId,
          },
          select: { id: true },
        });
        created.push({ code, id: row.id });
        break;
      } catch {
        if (attempt === 7) throw new Error('Failed to create activation code after retries.');
      }
    }
  }

  for (const item of created) {
    // stdout for ops copy
    console.log(`${item.code}\t${item.id}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
