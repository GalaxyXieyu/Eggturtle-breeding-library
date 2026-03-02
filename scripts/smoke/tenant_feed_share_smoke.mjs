#!/usr/bin/env node
// Tenant feed public-share E2E (API-only) smoke.
//
// Goals:
// - Create a tenant + product fixture
// - Create a tenant_feed share and assert `share.entryUrl` exists
// - Verify `/s/:shareToken` returns 302 to `/public/s/...` with signed query
// - Verify signed public payload endpoint returns 200
//
// Constraints:
// - Do not print shareToken/devCode/sig/sid to stdout (easy to leak in logs).

import { mkdir, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const DEFAULT_API_BASE = 'http://localhost:30011';
const DEFAULT_WEB_BASE = 'http://localhost:30010';

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '').replace('T', '-').replace('Z', 'Z');
}

function redactUrl(input) {
  return String(input)
    .replace(/\/public\/s\/[^/?]+/g, '/public/s/<shareToken>')
    .replace(/\/products\/[^/?]+/g, '/products/<productId>')
    .replace(/([?&]sig=)[^&]+/g, '$1<redacted>')
    .replace(/([?&]sid=)[^&]+/g, '$1<redacted>')
    .replace(/([?&]exp=)[^&]+/g, '$1<redacted>')
    .replace(/([?&]tenantId=)[^&]+/g, '$1<redacted>')
    .replace(/([?&]resourceId=)[^&]+/g, '$1<redacted>');
}

function parseArgs(argv) {
  const args = {
    apiBase: DEFAULT_API_BASE,
    webBase: DEFAULT_WEB_BASE,
    outDir: null,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === '--api-base') {
      args.apiBase = value;
      i += 1;
      continue;
    }
    if (key === '--web-base') {
      args.webBase = value;
      i += 1;
      continue;
    }
    if (key === '--out') {
      args.outDir = value;
      i += 1;
      continue;
    }
    if (key === '-h' || key === '--help') {
      printHelpAndExit(0);
    }

    throw new Error(`Unknown arg: ${key}`);
  }

  return args;
}

function printHelpAndExit(code) {
  console.log(`Usage: ${basename(process.argv[1])} [options]\n\nOptions:\n  --api-base <url>   API base URL (default: ${DEFAULT_API_BASE})\n  --web-base <url>   Web base URL (default: ${DEFAULT_WEB_BASE})\n  --out <dir>        Write evidence JSON to <dir> (recommended: out/...)\n  -h, --help         Show help\n\nNotes:\n- Requires API dev mode with AUTH_DEV_CODE_ENABLED=true so /auth/request-code returns devCode.\n- This script avoids printing secrets (devCode/shareToken/sig/sid).\n`);
  process.exit(code);
}

async function main() {
  const { apiBase, webBase, outDir } = parseArgs(process.argv);

  const email = `smoke-${Date.now()}@example.com`;

  const reqJson = async (path, { method = 'GET', token, json, redirect = 'follow' } = {}) => {
    const headers = {};
    if (json) headers['content-type'] = 'application/json';
    if (token) headers.authorization = `Bearer ${token}`;

    const res = await fetch(`${apiBase}${path}`, {
      method,
      headers,
      body: json ? JSON.stringify(json) : undefined,
      redirect,
    });

    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }

    return { status: res.status, headers: res.headers, body };
  };

  const is2xx = (status) => status >= 200 && status < 300;

  const expect = (ok, msg) => {
    if (!ok) throw new Error(msg);
  };

  console.log(`[1/9] health`);
  {
    const health = await reqJson('/health');
    expect(health.status === 200, `health expected 200, got ${health.status}`);
  }

  console.log(`[2/9] auth.request-code`);
  const requestCode = await reqJson('/auth/request-code', {
    method: 'POST',
    json: { email },
  });
  // Some environments might override HttpCode; accept 200/201.
  expect(is2xx(requestCode.status), `request-code expected 2xx, got ${requestCode.status}`);
  const devCode = requestCode.body?.devCode;
  expect(typeof devCode === 'string' && devCode.length > 0, 'missing devCode (enable AUTH_DEV_CODE_ENABLED=true)');

  console.log(`[3/9] auth.verify-code`);
  const verifyCode = await reqJson('/auth/verify-code', {
    method: 'POST',
    json: { email, code: devCode },
  });
  expect(is2xx(verifyCode.status), `verify-code expected 2xx, got ${verifyCode.status}`);
  let token = verifyCode.body?.accessToken;
  expect(typeof token === 'string' && token.length > 0, 'missing accessToken');

  console.log(`[4/9] tenants.me`);
  const tenantsMe = await reqJson('/tenants/me', { token });
  expect(tenantsMe.status === 200, `tenants/me expected 200, got ${tenantsMe.status}`);

  let tenant = Array.isArray(tenantsMe.body?.items) ? tenantsMe.body.items[0] : null;
  if (!tenant) {
    console.log(`[4.1/9] tenants.create`);
    const slug = `smoke-${Date.now()}`;
    const createTenant = await reqJson('/tenants', {
      method: 'POST',
      token,
      json: { name: `Smoke ${slug}`, slug },
    });
    expect(createTenant.status === 201 || createTenant.status === 200, `create tenant expected 200/201, got ${createTenant.status}`);
    tenant = createTenant.body?.tenant;
  }

  expect(tenant && typeof tenant.id === 'string' && typeof tenant.slug === 'string', 'missing tenant info');

  console.log(`[5/9] auth.switch-tenant`);
  const switchTenant = await reqJson('/auth/switch-tenant', {
    method: 'POST',
    token,
    json: { tenantId: tenant.id },
  });
  expect(is2xx(switchTenant.status), `switch-tenant expected 2xx, got ${switchTenant.status}`);
  token = switchTenant.body?.accessToken;
  expect(typeof token === 'string' && token.length > 0, 'missing switched token');

  console.log(`[6/9] products.create`);
  const productCode = `SMK${String(Date.now()).slice(-8)}`;
  const createProduct = await reqJson('/products', {
    method: 'POST',
    token,
    json: { code: productCode, name: `Smoke Product ${Date.now()}`, description: 'tenant feed smoke' },
  });
  expect(createProduct.status === 201, `create product expected 201, got ${createProduct.status}`);
  const productId = createProduct.body?.product?.id;
  expect(typeof productId === 'string' && productId.length > 0, 'missing productId');

  console.log(`[7/9] products.upload-image`);
  {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2Z0AAAAASUVORK5CYII=',
      'base64',
    );
    const fd = new FormData();
    fd.append('file', new Blob([png], { type: 'image/png' }), 'tiny.png');

    const upload = await fetch(`${apiBase}/products/${productId}/images`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: fd,
    });
    expect(upload.status === 201, `upload image expected 201, got ${upload.status}`);
  }

  console.log(`[8/9] shares.create (tenant_feed)`);
  const createShare = await reqJson('/shares', {
    method: 'POST',
    token,
    json: { resourceType: 'tenant_feed', resourceId: tenant.id },
  });
  expect(createShare.status === 201, `create share expected 201, got ${createShare.status}`);

  const share = createShare.body?.share;
  expect(share && typeof share.id === 'string', 'missing share.id');
  expect(typeof share.shareToken === 'string' && share.shareToken.length > 0, 'missing share.shareToken');
  expect(typeof share.entryUrl === 'string' && /^https?:\/\//.test(share.entryUrl), 'missing share.entryUrl');

  console.log(`[9/9] shares.redirect + public payload`);
  const redirect = await fetch(`${apiBase}/s/${share.shareToken}`, { redirect: 'manual' });
  expect(redirect.status === 302, `redirect expected 302, got ${redirect.status}`);

  const location = redirect.headers.get('location');
  expect(typeof location === 'string' && location.includes('/public/s/'), 'redirect location invalid');

  const locationUrl = new URL(location, webBase);
  const sid = locationUrl.searchParams.get('sid');
  const tenantId = locationUrl.searchParams.get('tenantId');
  const resourceType = locationUrl.searchParams.get('resourceType');
  const resourceId = locationUrl.searchParams.get('resourceId');
  const exp = locationUrl.searchParams.get('exp');
  const sig = locationUrl.searchParams.get('sig');

  expect(sid && tenantId && resourceType && resourceId && exp && sig, 'signed query missing');

  const publicPath = `/shares/${encodeURIComponent(sid)}/public`;
  const publicQuery = new URLSearchParams({
    tenantId,
    resourceType,
    resourceId,
    exp,
    sig,
    productId,
  });

  const publicPayload = await reqJson(`${publicPath}?${publicQuery.toString()}`);
  expect(publicPayload.status === 200, `public payload expected 200, got ${publicPayload.status}`);

  const feedUrl = `${webBase}${locationUrl.pathname}${locationUrl.search}`;
  const detailUrl = `${webBase}/public/s/${share.shareToken}/products/${productId}${locationUrl.search}`;

  const result = {
    tenantSlug: tenant.slug,
    shareId: share.id,
    productId,
    entryUrlPresent: true,
    redirectOk: true,
    // WARNING: feedUrl/detailUrl contain sensitive query params (sig/sid/etc) and shareToken.
    // Do not paste them in chat logs. Use the redacted variants for reports.
    feedUrl,
    detailUrl,
    redactedFeedUrl: redactUrl(feedUrl),
    redactedDetailUrl: redactUrl(detailUrl),
  };

  if (outDir) {
    const abs = resolve(outDir);
    await mkdir(abs, { recursive: true });
    await writeFile(resolve(abs, 'tenant-feed-share-smoke.result.json'), JSON.stringify(result, null, 2), 'utf8');
    await writeFile(
      resolve(abs, 'tenant-feed-share-smoke.result.redacted.json'),
      JSON.stringify(
        {
          ...result,
          feedUrl: '<sensitive>',
          detailUrl: '<sensitive>',
        },
        null,
        2,
      ),
      'utf8',
    );
  }

  // Print only the safe bits.
  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        tenantSlug: tenant.slug,
        shareId: share.id,
        productId,
        entryUrlPresent: true,
        redirectOk: true,
        redactedFeedUrl: result.redactedFeedUrl,
        redactedDetailUrl: result.redactedDetailUrl,
        outDir: outDir ? resolve(outDir) : null,
      },
      null,
      2,
    ) + '\n',
  );
}

main().catch((err) => {
  console.error(String(err?.stack ?? err));
  process.exit(1);
});
