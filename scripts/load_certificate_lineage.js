#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const args = { code: null };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--code") {
      args.code = argv[i + 1] || null;
      i += 1;
      continue;
    }
  }
  return args;
}

function loadApiEnv() {
  const envPath = path.resolve(__dirname, "../apps/api/.env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }
    const key = trimmed.slice(0, equalsIndex).trim();
    if (!key || process.env[key]) {
      continue;
    }
    let value = trimmed.slice(equalsIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function scoreCandidate(product, sire, dam) {
  let score = 0;
  if (product.sireCode) score += 1;
  if (product.damCode) score += 1;
  if (sire) score += 2;
  if (dam) score += 2;
  if (sire && sire.sireCode) score += 1;
  if (sire && sire.damCode) score += 1;
  if (dam && dam.sireCode) score += 1;
  if (dam && dam.damCode) score += 1;
  return score;
}

function inferFamilyCode(code) {
  if (!code) return "UNKNOWN";
  const tokens = String(code).toUpperCase().split("-").filter(Boolean);
  if (tokens.length === 0) return "UNKNOWN";
  return tokens.slice(0, 2).join("-");
}

function scoreImageUrl(url) {
  if (!url) return 0;
  let score = 2;
  if (/sealoshzh\.site/i.test(url)) {
    score += 4;
  }
  if (/imgdb\.cn|superbed\.cn/i.test(url)) {
    score -= 1;
  }
  return score;
}

async function findByCode(prisma, tenantId, code) {
  if (!code) {
    return null;
  }

  return prisma.product.findFirst({
    where: {
      tenantId,
      code: {
        equals: code,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      code: true,
      name: true,
      sireCode: true,
      damCode: true,
    },
  });
}

async function findPrimaryImageUrl(prisma, productId) {
  if (!productId) {
    return null;
  }

  const images = await prisma.productImage.findMany({
    where: { productId },
    orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    select: { url: true },
    take: 5,
  });

  const absolute = images.find((item) => /^https?:\/\//i.test(item.url || ""));
  if (absolute && absolute.url) {
    return absolute.url;
  }

  return null;
}

async function chooseProduct(prisma, explicitCode) {
  if (explicitCode) {
    const exact = await prisma.product.findFirst({
      where: {
        code: {
          equals: explicitCode,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        tenantId: true,
        code: true,
        name: true,
        seriesId: true,
        sex: true,
        sireCode: true,
        damCode: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!exact) {
      throw new Error(`Product not found by code: ${explicitCode}`);
    }
    const [sire, dam] = await Promise.all([
      findByCode(prisma, exact.tenantId, exact.sireCode),
      findByCode(prisma, exact.tenantId, exact.damCode),
    ]);
    const [subjectImageUrl, sireImageUrl, damImageUrl] = await Promise.all([
      findPrimaryImageUrl(prisma, exact.id),
      findPrimaryImageUrl(prisma, sire ? sire.id : null),
      findPrimaryImageUrl(prisma, dam ? dam.id : null),
    ]);
    return {
      product: exact,
      sire,
      dam,
      subjectImageUrl,
      sireImageUrl,
      damImageUrl,
      score: scoreCandidate(exact, sire, dam) + scoreImageUrl(subjectImageUrl) + scoreImageUrl(sireImageUrl) + scoreImageUrl(damImageUrl),
    };
  }

  const candidates = await prisma.product.findMany({
    where: {
      sireCode: { not: null },
      damCode: { not: null },
    },
    select: {
      id: true,
      tenantId: true,
      code: true,
      name: true,
      seriesId: true,
      sex: true,
      sireCode: true,
      damCode: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 500,
  });

  if (candidates.length === 0) {
    throw new Error("No products with sireCode/damCode found in local DB.");
  }

  let best = null;
  for (const product of candidates) {
    const [sire, dam] = await Promise.all([
      findByCode(prisma, product.tenantId, product.sireCode),
      findByCode(prisma, product.tenantId, product.damCode),
    ]);
    const [subjectImageUrl, sireImageUrl, damImageUrl] = await Promise.all([
      findPrimaryImageUrl(prisma, product.id),
      findPrimaryImageUrl(prisma, sire ? sire.id : null),
      findPrimaryImageUrl(prisma, dam ? dam.id : null),
    ]);

    const score =
      scoreCandidate(product, sire, dam) +
      scoreImageUrl(subjectImageUrl) +
      scoreImageUrl(sireImageUrl) +
      scoreImageUrl(damImageUrl);

    if (!best || score > best.score) {
      best = { product, sire, dam, subjectImageUrl, sireImageUrl, damImageUrl, score };
      if (score >= 18) {
        break;
      }
    }
  }

  if (!best) {
    throw new Error("Unable to pick a product for certificate rendering.");
  }
  return best;
}

async function main() {
  loadApiEnv();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. Please set apps/api/.env first.");
  }

  let PrismaClient;
  try {
    ({ PrismaClient } = require(path.resolve(__dirname, "../apps/api/node_modules/@prisma/client")));
  } catch {
    ({ PrismaClient } = require("@prisma/client"));
  }

  const args = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  try {
    const chosen = await chooseProduct(prisma, args.code);
    const product = chosen.product;
    const sire = chosen.sire;
    const dam = chosen.dam;
    const subjectImageUrl = chosen.subjectImageUrl;
    const sireImageUrl = chosen.sireImageUrl;
    const damImageUrl = chosen.damImageUrl;

    const output = {
      source: "local-db",
      tenantId: product.tenantId,
      productId: product.id,
      subjectCode: product.code,
      subjectName: product.name || null,
      sex: product.sex || null,
      seriesId: product.seriesId || null,
      lineName: product.seriesId || inferFamilyCode(product.code),
      lineCode: product.seriesId || product.code,
      lineFamily: inferFamilyCode(product.code),
      sire: product.sireCode || null,
      dam: product.damCode || null,
      sireSire: sire ? sire.sireCode || null : null,
      sireDam: sire ? sire.damCode || null : null,
      damSire: dam ? dam.sireCode || null : null,
      damDam: dam ? dam.damCode || null : null,
      subjectImageUrl,
      sireImageUrl,
      damImageUrl,
      createdAt: product.createdAt ? product.createdAt.toISOString() : null,
      updatedAt: product.updatedAt ? product.updatedAt.toISOString() : null,
    };

    process.stdout.write(`${JSON.stringify(output)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(`load_certificate_lineage failed: ${error.message}\n`);
  process.exit(1);
});
