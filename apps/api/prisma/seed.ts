import { PrismaClient, TenantMemberRole } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const prisma = new PrismaClient();

const DEFAULT_SUPER_ADMIN_EMAIL = 'admin@local.test';
const DEFAULT_SUPER_ADMIN_PASSWORD = 'Siri@2026';

function hashPassword(password: string) {
  const pepper = process.env.AUTH_PASSWORD_PEPPER ?? process.env.AUTH_CODE_PEPPER ?? '';
  const salt = randomBytes(16);
  const derived = scryptSync(`${password}:${pepper}`, salt, 64);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

async function main() {
  const ownerEmail = 'owner@eggturtle.local';
  const tenantSlug = 'eggturtle-demo';
  const now = new Date();

  const owner = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: { name: 'Breeding Traceability Record Owner' },
    create: {
      email: ownerEmail,
      name: 'Breeding Traceability Record Owner'
    }
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: tenantSlug },
    update: { name: 'Breeding Traceability Record Demo Tenant' },
    create: {
      slug: tenantSlug,
      name: 'Breeding Traceability Record Demo Tenant'
    }
  });

  await prisma.tenantMember.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: owner.id
      }
    },
    update: { role: TenantMemberRole.OWNER },
    create: {
      tenantId: tenant.id,
      userId: owner.id,
      role: TenantMemberRole.OWNER
    }
  });

  const superAdmin = await prisma.user.upsert({
    where: { email: DEFAULT_SUPER_ADMIN_EMAIL },
    update: {
      name: 'Platform Admin',
      passwordHash: hashPassword(DEFAULT_SUPER_ADMIN_PASSWORD),
      passwordUpdatedAt: now
    },
    create: {
      email: DEFAULT_SUPER_ADMIN_EMAIL,
      name: 'Platform Admin',
      passwordHash: hashPassword(DEFAULT_SUPER_ADMIN_PASSWORD),
      passwordUpdatedAt: now
    }
  });

  console.info('Seed complete:', {
    ownerEmail,
    tenantSlug,
    ownerId: owner.id,
    tenantId: tenant.id,
    superAdminEmail: superAdmin.email,
    superAdminPassword: DEFAULT_SUPER_ADMIN_PASSWORD
  });
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
