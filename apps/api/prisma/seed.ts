import { PrismaClient, TenantMemberRole } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const prisma = new PrismaClient();

const DEFAULT_SUPER_ADMIN_ACCOUNT = 'admin';
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
  const shouldSeedBootstrapAdmin = process.env.NODE_ENV !== 'production';

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

  let superAdmin:
    | {
        account: string | null;
        email: string;
      }
    | null = null;
  let superAdminPassword: string | null = null;

  if (shouldSeedBootstrapAdmin) {
    const existingSuperAdmin = await prisma.user.findUnique({
      where: { email: DEFAULT_SUPER_ADMIN_EMAIL },
      select: { id: true }
    });

    superAdmin = await prisma.user.upsert({
      where: { email: DEFAULT_SUPER_ADMIN_EMAIL },
      update: {
        account: DEFAULT_SUPER_ADMIN_ACCOUNT,
        isSuperAdmin: true,
        name: 'Platform Admin'
      },
      create: {
        email: DEFAULT_SUPER_ADMIN_EMAIL,
        account: DEFAULT_SUPER_ADMIN_ACCOUNT,
        isSuperAdmin: true,
        name: 'Platform Admin',
        passwordHash: hashPassword(DEFAULT_SUPER_ADMIN_PASSWORD),
        passwordUpdatedAt: null
      }
    });

    superAdminPassword = existingSuperAdmin ? '(unchanged)' : DEFAULT_SUPER_ADMIN_PASSWORD;
  }

  console.info('Seed complete:', {
    ownerEmail,
    tenantSlug,
    ownerId: owner.id,
    tenantId: tenant.id,
    bootstrapAdminSeeded: shouldSeedBootstrapAdmin,
    superAdminAccount: superAdmin?.account ?? null,
    superAdminEmail: superAdmin?.email ?? null,
    superAdminPassword
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
