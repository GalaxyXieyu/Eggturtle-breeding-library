import { PrismaClient, TenantMemberRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const ownerEmail = 'owner@eggturtle.local';
  const tenantSlug = 'eggturtle-demo';

  const owner = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: { name: 'Eggturtle Owner' },
    create: {
      email: ownerEmail,
      name: 'Eggturtle Owner'
    }
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: tenantSlug },
    update: { name: 'Eggturtle Demo Tenant' },
    create: {
      slug: tenantSlug,
      name: 'Eggturtle Demo Tenant'
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

  console.info('Seed complete:', {
    ownerEmail,
    tenantSlug,
    ownerId: owner.id,
    tenantId: tenant.id
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
