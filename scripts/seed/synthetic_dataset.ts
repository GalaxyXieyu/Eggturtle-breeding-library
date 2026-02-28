#!/usr/bin/env ts-node
// @ts-nocheck

import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function loadPrismaRuntime() {
  try {
    return require('@prisma/client');
  } catch {
    return require('../../apps/api/node_modules/@prisma/client');
  }
}

const { PrismaClient, TenantMemberRole } = loadPrismaRuntime();

type CliArgs = {
  confirm: boolean;
  forceProd: boolean;
  dedupe: boolean;
  ownerEmail: string;
  tenantSlug: string;
  tenantName: string;
  mirrorTenantSlug: string;
  mirrorTenantName: string;
};

type ProductImagePlan = {
  url: string;
  contentType: string | null;
};

type ProductPlan = {
  code: string;
  name: string;
  description: string | null;
  images: ProductImagePlan[];
  feature?: boolean;
  share?: boolean;
};

type SeriesPlan = {
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

type BreederEventPlan = {
  eventDate: string;
  eventType: string;
  note: string;
};

type BreederPlan = {
  code: string;
  seriesCode: string;
  name: string | null;
  sex: string | null;
  description: string | null;
  sireCode: string | null;
  damCode: string | null;
  mateCode: string | null;
  isActive: boolean;
  events: BreederEventPlan[];
};

type BreederDatasetPlan = {
  series: SeriesPlan[];
  breeders: BreederPlan[];
};

type SkipReason =
  | 'planned-near-collision'
  | 'existing-near-collision'
  | 'existing-exact-code-and-collision';

type PlanSkip = {
  code: string;
  reason: SkipReason;
  detail: string;
};

type ApplyStats = {
  productsCreated: number;
  productsUpdated: number;
  productsSkipped: number;
  imagesCreated: number;
  imagesUpdated: number;
  imagesDeleted: number;
  imagesDeduped: number;
  featuredCreated: number;
  featuredUpdated: number;
  sharesCreated: number;
  sharesUpdated: number;
  seriesCreated: number;
  seriesUpdated: number;
  breedersCreated: number;
  breedersUpdated: number;
  breederEventsCreated: number;
  breederEventsDeleted: number;
};

type DatasetApplyResult = {
  tenantId: string;
  productIdsByCode: Map<string, string>;
  skips: PlanSkip[];
  stats: ApplyStats;
};

const DEFAULT_TENANT_SLUG = 'ux-sandbox';
const DEFAULT_TENANT_NAME = 'UX Sandbox';
const DEFAULT_MIRROR_TENANT_SLUG = 'ux-sandbox-shadow';
const DEFAULT_MIRROR_TENANT_NAME = 'UX Sandbox Shadow';
const DEFAULT_OWNER_EMAIL = 'synthetic.owner@ux-sandbox.local';

const SHARED_CODE = 'SYN-COMMON-001';
const SYNTHETIC_EVENT_NOTE_PREFIX = 'SYNTHETIC:';

function parseArgs(argv: string[]): CliArgs {
  let confirm = false;
  let forceProd = false;
  let dedupe = false;
  let ownerEmail = DEFAULT_OWNER_EMAIL;
  let tenantSlug = DEFAULT_TENANT_SLUG;
  let tenantName = DEFAULT_TENANT_NAME;
  let mirrorTenantSlug = DEFAULT_MIRROR_TENANT_SLUG;
  let mirrorTenantName = DEFAULT_MIRROR_TENANT_NAME;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--confirm') {
      confirm = true;
      continue;
    }

    if (arg === '--i-know-what-im-doing') {
      forceProd = true;
      continue;
    }

    if (arg === '--dedupe') {
      dedupe = true;
      continue;
    }

    if (arg === '--owner-email') {
      ownerEmail = requireValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--tenant-slug') {
      tenantSlug = requireValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--tenant-name') {
      tenantName = requireValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--mirror-tenant-slug') {
      mirrorTenantSlug = requireValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--mirror-tenant-name') {
      mirrorTenantName = requireValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelpAndExit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!ownerEmail.includes('@')) {
    throw new Error('--owner-email must be a valid email.');
  }

  if (!tenantSlug.trim()) {
    throw new Error('--tenant-slug cannot be empty.');
  }

  if (!tenantName.trim()) {
    throw new Error('--tenant-name cannot be empty.');
  }

  if (!mirrorTenantSlug.trim()) {
    throw new Error('--mirror-tenant-slug cannot be empty.');
  }

  if (!mirrorTenantName.trim()) {
    throw new Error('--mirror-tenant-name cannot be empty.');
  }

  return {
    confirm,
    forceProd,
    dedupe,
    ownerEmail: ownerEmail.trim().toLowerCase(),
    tenantSlug: tenantSlug.trim(),
    tenantName: tenantName.trim(),
    mirrorTenantSlug: mirrorTenantSlug.trim(),
    mirrorTenantName: mirrorTenantName.trim()
  };
}

function requireValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function printHelpAndExit(code: number): never {
  const lines = [
    'Usage: ts-node scripts/seed/synthetic_dataset.ts [options]',
    '',
    'Options:',
    `  --tenant-slug <slug>        Primary synthetic tenant slug (default: ${DEFAULT_TENANT_SLUG})`,
    `  --tenant-name <name>        Primary synthetic tenant name (default: ${DEFAULT_TENANT_NAME})`,
    `  --mirror-tenant-slug <slug> Mirror tenant slug for isolation checks (default: ${DEFAULT_MIRROR_TENANT_SLUG})`,
    `  --mirror-tenant-name <name> Mirror tenant name (default: ${DEFAULT_MIRROR_TENANT_NAME})`,
    `  --owner-email <email>       Owner account used for memberships and shares (default: ${DEFAULT_OWNER_EMAIL})`,
    '  --dedupe                    Clean duplicate synthetic images by key and remove stale synthetic keys',
    '  --confirm                   Execute write operations (default is dry-run)',
    '  --i-know-what-im-doing      Override prod URL safety check',
    '  -h, --help                  Show help'
  ];

  if (code === 0) {
    console.info(lines.join('\n'));
  } else {
    console.error(lines.join('\n'));
  }

  process.exit(code);
}

function looksLikeProductionDatabaseUrl(databaseUrl: string): boolean {
  const lower = databaseUrl.toLowerCase();
  const prodKeywordHit = ['prod', 'production', 'primary', 'master'].some((keyword) =>
    lower.includes(keyword)
  );

  let hostname = '';
  try {
    hostname = new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    // Ignore parse errors and fall back to keyword-only detection.
  }

  const isLocalHost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.local');

  const riskyHostHit = [
    'rds.amazonaws.com',
    'neon.tech',
    'supabase.co',
    'render.com',
    'railway.app',
    'aliyuncs.com'
  ].some((domain) => hostname.includes(domain));

  if (riskyHostHit) {
    return true;
  }

  if (!hostname) {
    return prodKeywordHit;
  }

  return prodKeywordHit && !isLocalHost;
}

function redactDatabaseUrlForLog(url: string): string {
  try {
    const parsed = new URL(url);
    // Keep host/path for troubleshooting while avoiding credential/token leakage in logs.
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return '<redacted>';
  }
}

function buildLongDescription(): string {
  return [
    'This synthetic record intentionally carries a very long description to exercise overflow and truncation behavior.',
    'The content includes repeated-but-meaningful segments so list cards, detail panels, share views, and audit logs can be inspected consistently.',
    'Line 01: Texture notes include warm amber shell, subtle radial marbling, and high-contrast edge veins.',
    'Line 02: Hatch metadata includes a mixed lineage sample, uncertain incubation humidity logs, and timeline placeholders for UI badges.',
    'Line 03: Feeding notes mention intermittent appetite and staged supplements, useful for filters that scan long text chunks.',
    'Line 04: QA expects this text to stay deterministic so snapshots remain stable when rerunning synthetic seeding.',
    'Line 05: A second paragraph repeats intent with varied wording to increase payload size without introducing randomness.',
    'Line 06: The final sentence confirms this data is test-only and should never appear in customer-facing production datasets.'
  ].join(' ');
}

function primaryProductCandidates(): ProductPlan[] {
  return [
    {
      code: 'SYN-LONG-DESC-001',
      name: 'Long Description Turtle',
      description: buildLongDescription(),
      images: [
        {
          url: 'https://picsum.photos/seed/syn-long-desc-001/1200/800',
          contentType: 'image/jpeg'
        }
      ],
      feature: true
    },
    {
      code: 'SYN-EMPTY-DESC-001',
      name: 'Empty Description Turtle',
      description: '',
      images: [
        {
          url: 'https://picsum.photos/seed/syn-empty-desc-001/1200/800',
          contentType: 'image/jpeg'
        }
      ],
      share: true
    },
    {
      code: 'SYN-NO-IMAGE-001',
      name: 'No Image Turtle',
      description: 'Synthetic product with no image rows to validate optional image handling.',
      images: []
    },
    {
      code: 'SYN-MULTI-IMAGE-001',
      name: 'Multi Image Turtle',
      description: 'Synthetic product with multiple images and deterministic ordering.',
      images: [
        {
          url: 'https://picsum.photos/seed/syn-multi-image-001-main/1200/800',
          contentType: 'image/jpeg'
        },
        {
          url: 'https://picsum.photos/seed/syn-multi-image-001-alt-a/1200/800',
          contentType: 'image/jpeg'
        },
        {
          url: 'https://picsum.photos/seed/syn-multi-image-001-alt-b/1200/800',
          contentType: 'image/jpeg'
        }
      ],
      feature: true,
      share: true
    },
    {
      code: SHARED_CODE,
      name: 'Cross Tenant Common Code',
      description: 'This code intentionally exists in two tenants to validate tenant-scoped uniqueness.',
      images: [
        {
          url: 'https://picsum.photos/seed/syn-common-001/1200/800',
          contentType: 'image/jpeg'
        }
      ],
      share: true
    },
    {
      code: 'SYN-COLLIDE-001',
      name: 'Near Collision Canonical',
      description: 'Canonical code kept when near-collision variants are detected.',
      images: [
        {
          url: 'https://picsum.photos/seed/syn-collide-001/1200/800',
          contentType: 'image/jpeg'
        }
      ]
    },
    {
      code: 'syn collide 001',
      name: 'Near Collision Variant A',
      description: 'This record should be skipped because it collides with SYN-COLLIDE-001 after normalization.',
      images: []
    },
    {
      code: 'SYN_COLLIDE_001',
      name: 'Near Collision Variant B',
      description: 'This record should be skipped because it collides with SYN-COLLIDE-001 after normalization.',
      images: []
    }
  ];
}

function mirrorTenantProducts(): ProductPlan[] {
  return [
    {
      code: SHARED_CODE,
      name: 'Cross Tenant Common Code (Mirror)',
      description: 'Same code as primary tenant by design. Should be allowed due to tenant scope.',
      images: [
        {
          url: 'https://picsum.photos/seed/syn-common-001-mirror/1200/800',
          contentType: 'image/jpeg'
        }
      ],
      share: true
    }
  ];
}

function primaryBreederDataset(): BreederDatasetPlan {
  return {
    series: [
      {
        code: 'SYN-SERIES-ALPHA',
        name: 'Synthetic Alpha Line',
        description: 'Primary synthetic series used for breeder pages and filtering screenshots.',
        sortOrder: 10,
        isActive: true
      },
      {
        code: 'SYN-SERIES-BETA',
        name: 'Synthetic Beta Line',
        description: 'Secondary synthetic series to validate cross-series filtering.',
        sortOrder: 20,
        isActive: true
      },
      {
        code: 'SYN-SERIES-LEGACY',
        name: 'Synthetic Legacy Line',
        description: 'Inactive synthetic series to verify status rendering in list pages.',
        sortOrder: 30,
        isActive: false
      }
    ],
    breeders: [
      {
        code: 'SYN-BRD-ALPHA-SIRE',
        seriesCode: 'SYN-SERIES-ALPHA',
        name: 'Alpha Sire',
        sex: 'M',
        description: 'Synthetic sire record for family-tree checks.',
        sireCode: null,
        damCode: null,
        mateCode: null,
        isActive: true,
        events: [
          {
            eventType: 'HATCHED',
            eventDate: '2022-03-01T00:00:00.000Z',
            note: `${SYNTHETIC_EVENT_NOTE_PREFIX} Hatch baseline record.`
          },
          {
            eventType: 'HEALTH_CHECK',
            eventDate: '2025-02-10T08:30:00.000Z',
            note: `${SYNTHETIC_EVENT_NOTE_PREFIX} Periodic synthetic health check.`
          }
        ]
      },
      {
        code: 'SYN-BRD-ALPHA-DAM',
        seriesCode: 'SYN-SERIES-ALPHA',
        name: 'Alpha Dam',
        sex: 'F',
        description: 'Synthetic dam record for family-tree checks.',
        sireCode: null,
        damCode: null,
        mateCode: null,
        isActive: true,
        events: [
          {
            eventType: 'HATCHED',
            eventDate: '2022-03-04T00:00:00.000Z',
            note: `${SYNTHETIC_EVENT_NOTE_PREFIX} Hatch baseline record.`
          },
          {
            eventType: 'HEALTH_CHECK',
            eventDate: '2025-02-12T08:30:00.000Z',
            note: `${SYNTHETIC_EVENT_NOTE_PREFIX} Periodic synthetic health check.`
          }
        ]
      },
      {
        code: 'SYN-BRD-ALPHA-MATE',
        seriesCode: 'SYN-SERIES-ALPHA',
        name: 'Alpha Mate',
        sex: 'M',
        description: 'Synthetic mate linked to SYN-BRD-ALPHA-001.',
        sireCode: null,
        damCode: null,
        mateCode: 'SYN-BRD-ALPHA-001',
        isActive: true,
        events: [
          {
            eventType: 'HATCHED',
            eventDate: '2022-04-01T00:00:00.000Z',
            note: `${SYNTHETIC_EVENT_NOTE_PREFIX} Hatch baseline record.`
          },
          {
            eventType: 'PAIRING',
            eventDate: '2025-01-06T09:00:00.000Z',
            note: `${SYNTHETIC_EVENT_NOTE_PREFIX} Paired with SYN-BRD-ALPHA-001.`
          }
        ]
      },
      {
        code: 'SYN-BRD-ALPHA-001',
        seriesCode: 'SYN-SERIES-ALPHA',
        name: 'Alpha Featured Breeder',
        sex: 'F',
        description: 'Synthetic breeder used in detail page screenshots.',
        sireCode: 'SYN-BRD-ALPHA-SIRE',
        damCode: 'SYN-BRD-ALPHA-DAM',
        mateCode: 'SYN-BRD-ALPHA-MATE',
        isActive: true,
        events: [
          {
            eventType: 'HATCHED',
            eventDate: '2023-03-15T00:00:00.000Z',
            note: `${SYNTHETIC_EVENT_NOTE_PREFIX} Hatch baseline record.`
          },
          {
            eventType: 'PAIRING',
            eventDate: '2025-01-08T09:30:00.000Z',
            note: `${SYNTHETIC_EVENT_NOTE_PREFIX} Paired with SYN-BRD-ALPHA-MATE.`
          },
          {
            eventType: 'HEALTH_CHECK',
            eventDate: '2025-02-20T08:00:00.000Z',
            note: `${SYNTHETIC_EVENT_NOTE_PREFIX} Demo health-check event.`
          }
        ]
      },
      {
        code: 'SYN-BRD-ALPHA-CHILD-01',
        seriesCode: 'SYN-SERIES-ALPHA',
        name: 'Alpha Child 01',
        sex: 'M',
        description: 'Synthetic direct child for family-tree child rendering.',
        sireCode: 'SYN-BRD-ALPHA-MATE',
        damCode: 'SYN-BRD-ALPHA-001',
        mateCode: null,
        isActive: true,
        events: [
          {
            eventType: 'HATCHED',
            eventDate: '2025-01-18T00:00:00.000Z',
            note: `${SYNTHETIC_EVENT_NOTE_PREFIX} Hatch baseline record.`
          },
          {
            eventType: 'HEALTH_CHECK',
            eventDate: '2025-02-23T08:15:00.000Z',
            note: `${SYNTHETIC_EVENT_NOTE_PREFIX} Juvenile synthetic check.`
          }
        ]
      },
      {
        code: 'SYN-BRD-BETA-001',
        seriesCode: 'SYN-SERIES-BETA',
        name: 'Beta Baseline Breeder',
        sex: 'F',
        description: 'Synthetic breeder in a second active series for filter coverage.',
        sireCode: null,
        damCode: null,
        mateCode: null,
        isActive: true,
        events: [
          {
            eventType: 'HATCHED',
            eventDate: '2024-05-02T00:00:00.000Z',
            note: `${SYNTHETIC_EVENT_NOTE_PREFIX} Hatch baseline record.`
          },
          {
            eventType: 'TRANSFERRED',
            eventDate: '2025-01-25T10:00:00.000Z',
            note: `${SYNTHETIC_EVENT_NOTE_PREFIX} Transfer event for timeline visualization.`
          }
        ]
      },
      {
        code: 'SYN-BRD-LEGACY-001',
        seriesCode: 'SYN-SERIES-LEGACY',
        name: 'Legacy Archived Breeder',
        sex: 'U',
        description: 'Inactive synthetic breeder in inactive series for status checks.',
        sireCode: null,
        damCode: null,
        mateCode: null,
        isActive: false,
        events: [
          {
            eventType: 'HATCHED',
            eventDate: '2021-09-10T00:00:00.000Z',
            note: `${SYNTHETIC_EVENT_NOTE_PREFIX} Hatch baseline record.`
          },
          {
            eventType: 'RETIRED',
            eventDate: '2024-12-01T00:00:00.000Z',
            note: `${SYNTHETIC_EVENT_NOTE_PREFIX} Synthetic retirement event.`
          }
        ]
      }
    ]
  };
}

function mirrorBreederDataset(): BreederDatasetPlan {
  return {
    series: [
      {
        code: 'SYN-SERIES-MIRROR',
        name: 'Synthetic Mirror Line',
        description: 'Mirror tenant demo series used for isolation checks.',
        sortOrder: 10,
        isActive: true
      }
    ],
    breeders: [
      {
        code: 'SYN-BRD-MIRROR-001',
        seriesCode: 'SYN-SERIES-MIRROR',
        name: 'Mirror Baseline Breeder',
        sex: 'F',
        description: 'Synthetic mirror breeder to keep mirror tenant non-empty.',
        sireCode: null,
        damCode: null,
        mateCode: null,
        isActive: true,
        events: [
          {
            eventType: 'HATCHED',
            eventDate: '2024-01-10T00:00:00.000Z',
            note: `${SYNTHETIC_EVENT_NOTE_PREFIX} Hatch baseline record.`
          },
          {
            eventType: 'HEALTH_CHECK',
            eventDate: '2025-02-05T08:00:00.000Z',
            note: `${SYNTHETIC_EVENT_NOTE_PREFIX} Periodic synthetic health check.`
          }
        ]
      }
    ]
  };
}

function normalizeCodeForCollision(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeCodeForKey(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function resolvePlanNearCollisions(candidates: ProductPlan[]): {
  accepted: ProductPlan[];
  skipped: PlanSkip[];
} {
  const accepted: ProductPlan[] = [];
  const skipped: PlanSkip[] = [];
  const seen = new Map<string, string>();

  for (const candidate of candidates) {
    const normalized = normalizeCodeForCollision(candidate.code);
    const canonical = seen.get(normalized);

    if (canonical && canonical !== candidate.code) {
      skipped.push({
        code: candidate.code,
        reason: 'planned-near-collision',
        detail: `Normalized collision with planned code ${canonical}.`
      });
      continue;
    }

    seen.set(normalized, candidate.code);
    accepted.push(candidate);
  }

  return { accepted, skipped };
}

function stableShareToken(tenantSlug: string, code: string): string {
  const digest = createHash('sha1').update(`${tenantSlug}:${code}`).digest('hex').slice(0, 32);
  return `shr_syn_${digest}`;
}

function imageKeyFor(code: string, index: number): string {
  return `synthetic/${normalizeCodeForKey(code)}/${String(index).padStart(2, '0')}`;
}

function emptyApplyStats(): ApplyStats {
  return {
    productsCreated: 0,
    productsUpdated: 0,
    productsSkipped: 0,
    imagesCreated: 0,
    imagesUpdated: 0,
    imagesDeleted: 0,
    imagesDeduped: 0,
    featuredCreated: 0,
    featuredUpdated: 0,
    sharesCreated: 0,
    sharesUpdated: 0,
    seriesCreated: 0,
    seriesUpdated: 0,
    breedersCreated: 0,
    breedersUpdated: 0,
    breederEventsCreated: 0,
    breederEventsDeleted: 0
  };
}

async function ensureTenantWithOwner(
  tx: InstanceType<typeof PrismaClient>,
  args: CliArgs,
  tenantSlug: string,
  tenantName: string
): Promise<{ tenantId: string; userId: string }> {
  const owner = await tx.user.upsert({
    where: { email: args.ownerEmail },
    update: { name: 'Synthetic Dataset Owner' },
    create: {
      email: args.ownerEmail,
      name: 'Synthetic Dataset Owner'
    }
  });

  const tenant = await tx.tenant.upsert({
    where: { slug: tenantSlug },
    update: { name: tenantName },
    create: {
      slug: tenantSlug,
      name: tenantName
    }
  });

  await tx.tenantMember.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: owner.id
      }
    },
    update: {
      role: TenantMemberRole.OWNER
    },
    create: {
      tenantId: tenant.id,
      userId: owner.id,
      role: TenantMemberRole.OWNER
    }
  });

  return {
    tenantId: tenant.id,
    userId: owner.id
  };
}

function buildExistingCollisionMap(codes: string[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const code of codes) {
    const normalized = normalizeCodeForCollision(code);
    const set = map.get(normalized) ?? new Set<string>();
    set.add(code);
    map.set(normalized, set);
  }
  return map;
}

function hasCollision(existingSet: Set<string> | undefined, candidateCode: string): boolean {
  if (!existingSet || existingSet.size === 0) {
    return false;
  }

  if (existingSet.has(candidateCode)) {
    return existingSet.size > 1;
  }

  return true;
}

async function upsertSyntheticImages(
  tx: InstanceType<typeof PrismaClient>,
  tenantId: string,
  productId: string,
  code: string,
  imagePlans: ProductImagePlan[],
  dedupe: boolean,
  stats: ApplyStats
): Promise<void> {
  const keyPrefix = `synthetic/${normalizeCodeForKey(code)}/`;
  const existingSyntheticImages = await tx.productImage.findMany({
    where: {
      tenantId,
      productId,
      key: {
        startsWith: keyPrefix
      }
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
  });

  const existingByKey = new Map<string, Array<(typeof existingSyntheticImages)[number]>>();
  for (const image of existingSyntheticImages) {
    const list = existingByKey.get(image.key) ?? [];
    list.push(image);
    existingByKey.set(image.key, list);
  }

  const expectedKeys: string[] = [];

  for (let index = 0; index < imagePlans.length; index += 1) {
    const plan = imagePlans[index];
    const key = imageKeyFor(code, index + 1);
    expectedKeys.push(key);

    const matches = existingByKey.get(key) ?? [];

    if (matches.length > 0) {
      const target = matches[0];
      await tx.productImage.update({
        where: {
          id: target.id
        },
        data: {
          key,
          url: plan.url,
          contentType: plan.contentType,
          sortOrder: index,
          isMain: false
        }
      });
      stats.imagesUpdated += 1;

      if (dedupe && matches.length > 1) {
        const duplicateIds = matches.slice(1).map((item) => item.id);
        await tx.productImage.deleteMany({
          where: {
            id: {
              in: duplicateIds
            }
          }
        });
        stats.imagesDeduped += duplicateIds.length;
      }
      continue;
    }

    await tx.productImage.create({
      data: {
        tenantId,
        productId,
        key,
        url: plan.url,
        contentType: plan.contentType,
        sortOrder: index,
        isMain: false
      }
    });
    stats.imagesCreated += 1;
  }

  if (imagePlans.length > 0) {
    await tx.productImage.updateMany({
      where: {
        tenantId,
        productId,
        key: {
          in: expectedKeys
        }
      },
      data: {
        isMain: false
      }
    });

    await tx.productImage.updateMany({
      where: {
        tenantId,
        productId,
        key: imageKeyFor(code, 1)
      },
      data: {
        isMain: true
      }
    });
  }

  if (!dedupe) {
    return;
  }

  const staleIds = existingSyntheticImages
    .filter((item) => !expectedKeys.includes(item.key))
    .map((item) => item.id);

  if (staleIds.length > 0) {
    await tx.productImage.deleteMany({
      where: {
        id: {
          in: staleIds
        }
      }
    });
    stats.imagesDeleted += staleIds.length;
  }
}

async function upsertSyntheticBreeders(
  tx: InstanceType<typeof PrismaClient>,
  tenantId: string,
  dataset: BreederDatasetPlan,
  stats: ApplyStats
): Promise<void> {
  const seriesByCode = new Map<string, string>();

  for (const plan of dataset.series) {
    const existing = await tx.series.findUnique({
      where: {
        tenantId_code: {
          tenantId,
          code: plan.code
        }
      },
      select: {
        id: true
      }
    });

    const series = await tx.series.upsert({
      where: {
        tenantId_code: {
          tenantId,
          code: plan.code
        }
      },
      update: {
        name: plan.name,
        description: plan.description,
        sortOrder: plan.sortOrder,
        isActive: plan.isActive
      },
      create: {
        tenantId,
        code: plan.code,
        name: plan.name,
        description: plan.description,
        sortOrder: plan.sortOrder,
        isActive: plan.isActive
      }
    });

    seriesByCode.set(plan.code, series.id);

    if (existing) {
      stats.seriesUpdated += 1;
    } else {
      stats.seriesCreated += 1;
    }
  }

  const breederByCode = new Map<string, string>();

  for (const plan of dataset.breeders) {
    const seriesId = seriesByCode.get(plan.seriesCode);
    if (!seriesId) {
      throw new Error(
        `Series code ${plan.seriesCode} is missing for breeder ${plan.code}. Check synthetic breeder dataset plan.`
      );
    }

    const existing = await tx.breeder.findUnique({
      where: {
        tenantId_code: {
          tenantId,
          code: plan.code
        }
      },
      select: {
        id: true
      }
    });

    const breeder = await tx.breeder.upsert({
      where: {
        tenantId_code: {
          tenantId,
          code: plan.code
        }
      },
      update: {
        seriesId,
        name: plan.name,
        sex: plan.sex,
        description: plan.description,
        sireCode: plan.sireCode,
        damCode: plan.damCode,
        mateCode: plan.mateCode,
        isActive: plan.isActive
      },
      create: {
        tenantId,
        seriesId,
        code: plan.code,
        name: plan.name,
        sex: plan.sex,
        description: plan.description,
        sireCode: plan.sireCode,
        damCode: plan.damCode,
        mateCode: plan.mateCode,
        isActive: plan.isActive
      }
    });

    breederByCode.set(plan.code, breeder.id);

    if (existing) {
      stats.breedersUpdated += 1;
    } else {
      stats.breedersCreated += 1;
    }
  }

  for (const plan of dataset.breeders) {
    const breederId = breederByCode.get(plan.code);
    if (!breederId) {
      continue;
    }

    const deleted = await tx.breederEvent.deleteMany({
      where: {
        tenantId,
        breederId,
        note: {
          startsWith: SYNTHETIC_EVENT_NOTE_PREFIX
        }
      }
    });

    stats.breederEventsDeleted += deleted.count;

    if (plan.events.length === 0) {
      continue;
    }

    await tx.breederEvent.createMany({
      data: plan.events.map((event) => ({
        tenantId,
        breederId,
        eventType: event.eventType,
        eventDate: new Date(event.eventDate),
        note: event.note
      }))
    });

    stats.breederEventsCreated += plan.events.length;
  }
}

async function applyTenantDataset(
  tx: InstanceType<typeof PrismaClient>,
  tenantId: string,
  tenantSlug: string,
  ownerUserId: string,
  productPlans: ProductPlan[],
  breederDataset: BreederDatasetPlan,
  dedupe: boolean
): Promise<DatasetApplyResult> {
  const stats = emptyApplyStats();
  const skips: PlanSkip[] = [];
  const productIdsByCode = new Map<string, string>();

  const existingProducts = await tx.product.findMany({
    where: {
      tenantId
    },
    select: {
      id: true,
      code: true
    }
  });

  const existingByCollision = buildExistingCollisionMap(existingProducts.map((item) => item.code));

  const featuredCodesInOrder = productPlans.filter((item) => item.feature).map((item) => item.code);
  const featuredSortOrder = new Map<string, number>();
  for (let index = 0; index < featuredCodesInOrder.length; index += 1) {
    featuredSortOrder.set(featuredCodesInOrder[index], index);
  }

  for (const plan of productPlans) {
    const normalized = normalizeCodeForCollision(plan.code);
    const existingSet = existingByCollision.get(normalized);

    if (hasCollision(existingSet, plan.code)) {
      const exactMatchExists = Boolean(existingSet && existingSet.has(plan.code));
      skips.push({
        code: plan.code,
        reason: exactMatchExists ? 'existing-exact-code-and-collision' : 'existing-near-collision',
        detail: `Existing codes with normalized key ${normalized}: ${Array.from(existingSet ?? []).join(', ')}`
      });
      stats.productsSkipped += 1;
      continue;
    }

    const existing = await tx.product.findUnique({
      where: {
        tenantId_code: {
          tenantId,
          code: plan.code
        }
      },
      select: {
        id: true
      }
    });

    const product = await tx.product.upsert({
      where: {
        tenantId_code: {
          tenantId,
          code: plan.code
        }
      },
      update: {
        name: plan.name,
        description: plan.description
      },
      create: {
        tenantId,
        code: plan.code,
        name: plan.name,
        description: plan.description
      }
    });

    if (existing) {
      stats.productsUpdated += 1;
    } else {
      stats.productsCreated += 1;
      const set = existingByCollision.get(normalized) ?? new Set<string>();
      set.add(plan.code);
      existingByCollision.set(normalized, set);
    }

    productIdsByCode.set(plan.code, product.id);

    await upsertSyntheticImages(tx, tenantId, product.id, plan.code, plan.images, dedupe, stats);

    if (plan.feature) {
      const sortOrder = featuredSortOrder.get(plan.code) ?? 0;
      const existingFeatured = await tx.featuredProduct.findUnique({
        where: {
          tenantId_productId: {
            tenantId,
            productId: product.id
          }
        },
        select: {
          id: true
        }
      });

      await tx.featuredProduct.upsert({
        where: {
          tenantId_productId: {
            tenantId,
            productId: product.id
          }
        },
        update: {
          sortOrder
        },
        create: {
          tenantId,
          productId: product.id,
          sortOrder
        }
      });

      if (existingFeatured) {
        stats.featuredUpdated += 1;
      } else {
        stats.featuredCreated += 1;
      }
    }

    if (plan.share) {
      const shareToken = stableShareToken(tenantSlug, plan.code);
      const existingShare = await tx.publicShare.findUnique({
        where: {
          tenantId_productId: {
            tenantId,
            productId: product.id
          }
        },
        select: {
          id: true
        }
      });

      await tx.publicShare.upsert({
        where: {
          tenantId_productId: {
            tenantId,
            productId: product.id
          }
        },
        update: {
          shareToken,
          createdByUserId: ownerUserId
        },
        create: {
          tenantId,
          productId: product.id,
          shareToken,
          createdByUserId: ownerUserId
        }
      });

      if (existingShare) {
        stats.sharesUpdated += 1;
      } else {
        stats.sharesCreated += 1;
      }
    }
  }

  await upsertSyntheticBreeders(tx, tenantId, breederDataset, stats);

  return {
    tenantId,
    productIdsByCode,
    skips,
    stats
  };
}

async function runIsolationChecks(
  prisma: InstanceType<typeof PrismaClient>,
  primaryTenantId: string,
  mirrorTenantId: string
): Promise<{
  primarySharedCodeCount: number;
  mirrorSharedCodeCount: number;
  primaryFeaturedCount: number;
  mirrorFeaturedCount: number;
  primaryShareCount: number;
  mirrorShareCount: number;
  featuredTenantMismatchCount: number;
  shareTenantMismatchCount: number;
}> {
  const [
    primarySharedCodeCount,
    mirrorSharedCodeCount,
    primaryFeaturedCount,
    mirrorFeaturedCount,
    primaryShareCount,
    mirrorShareCount,
    featuredTenantMismatchRaw,
    shareTenantMismatchRaw
  ] = await Promise.all([
    prisma.product.count({
      where: {
        tenantId: primaryTenantId,
        code: SHARED_CODE
      }
    }),
    prisma.product.count({
      where: {
        tenantId: mirrorTenantId,
        code: SHARED_CODE
      }
    }),
    prisma.featuredProduct.count({
      where: {
        tenantId: primaryTenantId
      }
    }),
    prisma.featuredProduct.count({
      where: {
        tenantId: mirrorTenantId
      }
    }),
    prisma.publicShare.count({
      where: {
        tenantId: primaryTenantId
      }
    }),
    prisma.publicShare.count({
      where: {
        tenantId: mirrorTenantId
      }
    }),
    prisma.$queryRaw<Array<{ count: bigint | number }>>`
      SELECT COUNT(*)::bigint AS count
      FROM featured_products fp
      INNER JOIN products p ON p.id = fp.product_id
      WHERE fp.tenant_id <> p.tenant_id
    `,
    prisma.$queryRaw<Array<{ count: bigint | number }>>`
      SELECT COUNT(*)::bigint AS count
      FROM public_shares ps
      INNER JOIN products p ON p.id = ps.product_id
      WHERE ps.tenant_id <> p.tenant_id
    `
  ]);

  return {
    primarySharedCodeCount,
    mirrorSharedCodeCount,
    primaryFeaturedCount,
    mirrorFeaturedCount,
    primaryShareCount,
    mirrorShareCount,
    featuredTenantMismatchCount: Number(featuredTenantMismatchRaw[0]?.count ?? 0),
    shareTenantMismatchCount: Number(shareTenantMismatchRaw[0]?.count ?? 0)
  };
}

function printPlan(
  args: CliArgs,
  databaseUrl: string,
  plannedPrimaryProducts: ProductPlan[],
  plannedMirrorProducts: ProductPlan[],
  plannedPrimaryBreeders: BreederDatasetPlan,
  plannedMirrorBreeders: BreederDatasetPlan
) {
  console.info('Synthetic dataset seed plan:');
  console.info(`- mode: ${args.confirm ? 'WRITE' : 'DRY-RUN (default)'}`);
  console.info(`- database: ${redactDatabaseUrlForLog(databaseUrl)}`);
  console.info(`- owner email: ${args.ownerEmail}`);
  console.info(`- primary tenant: ${args.tenantSlug} (${args.tenantName})`);
  console.info(`- mirror tenant: ${args.mirrorTenantSlug} (${args.mirrorTenantName})`);
  console.info(`- dedupe synthetic images: ${args.dedupe ? 'enabled' : 'disabled'}`);
  console.info(`- planned primary products: ${plannedPrimaryProducts.length}`);
  console.info(`- planned mirror products: ${plannedMirrorProducts.length}`);
  console.info(`- planned primary series: ${plannedPrimaryBreeders.series.length}`);
  console.info(`- planned primary breeders: ${plannedPrimaryBreeders.breeders.length}`);
  console.info(`- planned mirror series: ${plannedMirrorBreeders.series.length}`);
  console.info(`- planned mirror breeders: ${plannedMirrorBreeders.breeders.length}`);
  console.info(`- shared code across tenants: ${SHARED_CODE}`);
}

function printSkips(title: string, skips: PlanSkip[]): void {
  if (skips.length === 0) {
    console.info(`${title}: none`);
    return;
  }

  console.info(`${title}: ${skips.length}`);
  for (const skip of skips) {
    console.info(`  - ${skip.code} [${skip.reason}] ${skip.detail}`);
  }
}

function printStats(label: string, stats: ApplyStats): void {
  console.info(`${label}:`);
  console.info(`  - products created: ${stats.productsCreated}`);
  console.info(`  - products updated: ${stats.productsUpdated}`);
  console.info(`  - products skipped: ${stats.productsSkipped}`);
  console.info(`  - images created: ${stats.imagesCreated}`);
  console.info(`  - images updated: ${stats.imagesUpdated}`);
  console.info(`  - images deleted: ${stats.imagesDeleted}`);
  console.info(`  - images deduped: ${stats.imagesDeduped}`);
  console.info(`  - featured created: ${stats.featuredCreated}`);
  console.info(`  - featured updated: ${stats.featuredUpdated}`);
  console.info(`  - shares created: ${stats.sharesCreated}`);
  console.info(`  - shares updated: ${stats.sharesUpdated}`);
  console.info(`  - series created: ${stats.seriesCreated}`);
  console.info(`  - series updated: ${stats.seriesUpdated}`);
  console.info(`  - breeders created: ${stats.breedersCreated}`);
  console.info(`  - breeders updated: ${stats.breedersUpdated}`);
  console.info(`  - breeder events created: ${stats.breederEventsCreated}`);
  console.info(`  - breeder events deleted: ${stats.breederEventsDeleted}`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  if (looksLikeProductionDatabaseUrl(databaseUrl) && !args.forceProd) {
    throw new Error(
      'Refusing to run because DATABASE_URL looks like production. Use --i-know-what-im-doing to override.'
    );
  }

  const primaryResolution = resolvePlanNearCollisions(primaryProductCandidates());
  const mirrorResolution = resolvePlanNearCollisions(mirrorTenantProducts());
  const primaryBreeders = primaryBreederDataset();
  const mirrorBreeders = mirrorBreederDataset();

  printPlan(
    args,
    databaseUrl,
    primaryResolution.accepted,
    mirrorResolution.accepted,
    primaryBreeders,
    mirrorBreeders
  );
  printSkips('Planned near-collision skips (pre-write)', primaryResolution.skipped);

  const prisma = new PrismaClient();

  try {
    if (!args.confirm) {
      const existingPrimaryTenant = await prisma.tenant.findUnique({
        where: { slug: args.tenantSlug },
        select: { id: true }
      });

      const existingMirrorTenant = await prisma.tenant.findUnique({
        where: { slug: args.mirrorTenantSlug },
        select: { id: true }
      });

      const existingOwner = await prisma.user.findUnique({
        where: { email: args.ownerEmail },
        select: { id: true }
      });

      console.info('Dry-run summary:');
      console.info(`- owner user exists: ${existingOwner ? 'yes' : 'no'}`);
      console.info(`- primary tenant exists: ${existingPrimaryTenant ? 'yes' : 'no'}`);
      console.info(`- mirror tenant exists: ${existingMirrorTenant ? 'yes' : 'no'}`);
      console.info(
        `- planned writes (primary): ${primaryResolution.accepted.length} products, ${primaryBreeders.series.length} series, ${primaryBreeders.breeders.length} breeders`
      );
      console.info(
        `- planned writes (mirror): ${mirrorResolution.accepted.length} products, ${mirrorBreeders.series.length} series, ${mirrorBreeders.breeders.length} breeders`
      );
      console.info('- no rows written (default dry-run behavior).');
      console.info('Re-run with --confirm to write synthetic dataset.');
      return;
    }

    const writeResult = await prisma.$transaction(async (tx) => {
      const primaryOwner = await ensureTenantWithOwner(tx, args, args.tenantSlug, args.tenantName);
      const mirrorOwner = await ensureTenantWithOwner(
        tx,
        args,
        args.mirrorTenantSlug,
        args.mirrorTenantName
      );

      const primaryApply = await applyTenantDataset(
        tx,
        primaryOwner.tenantId,
        args.tenantSlug,
        primaryOwner.userId,
        primaryResolution.accepted,
        primaryBreeders,
        args.dedupe
      );

      const mirrorApply = await applyTenantDataset(
        tx,
        mirrorOwner.tenantId,
        args.mirrorTenantSlug,
        mirrorOwner.userId,
        mirrorResolution.accepted,
        mirrorBreeders,
        args.dedupe
      );

      return {
        primaryTenantId: primaryOwner.tenantId,
        mirrorTenantId: mirrorOwner.tenantId,
        primaryApply,
        mirrorApply
      };
    });

    printStats('Primary tenant write stats', writeResult.primaryApply.stats);
    printStats('Mirror tenant write stats', writeResult.mirrorApply.stats);
    printSkips('Write-time collision skips (primary tenant)', writeResult.primaryApply.skips);
    printSkips('Write-time collision skips (mirror tenant)', writeResult.mirrorApply.skips);

    const checks = await runIsolationChecks(
      prisma,
      writeResult.primaryTenantId,
      writeResult.mirrorTenantId
    );

    console.info('Cross-tenant isolation checks:');
    console.info(`- ${SHARED_CODE} in primary tenant: ${checks.primarySharedCodeCount}`);
    console.info(`- ${SHARED_CODE} in mirror tenant: ${checks.mirrorSharedCodeCount}`);
    console.info(`- featured count (primary): ${checks.primaryFeaturedCount}`);
    console.info(`- featured count (mirror): ${checks.mirrorFeaturedCount}`);
    console.info(`- public share count (primary): ${checks.primaryShareCount}`);
    console.info(`- public share count (mirror): ${checks.mirrorShareCount}`);
    console.info(
      `- tenant mismatch rows (featured_products -> products): ${checks.featuredTenantMismatchCount}`
    );
    console.info(`- tenant mismatch rows (public_shares -> products): ${checks.shareTenantMismatchCount}`);

    if (checks.primarySharedCodeCount !== 1 || checks.mirrorSharedCodeCount !== 1) {
      throw new Error(
        `Isolation check failed for ${SHARED_CODE}: primary=${checks.primarySharedCodeCount}, mirror=${checks.mirrorSharedCodeCount}`
      );
    }

    if (checks.featuredTenantMismatchCount !== 0 || checks.shareTenantMismatchCount !== 0) {
      throw new Error('Isolation check failed: found cross-tenant foreign key mismatches.');
    }

    console.info('Synthetic dataset seed complete.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Synthetic dataset seed failed');
  console.error(error);
  process.exitCode = 1;
});
