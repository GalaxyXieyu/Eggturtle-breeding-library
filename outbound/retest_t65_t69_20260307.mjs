import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const repo = '/Users/apple/coding/Eggturtle-breeding-library';
const outbound = path.join(repo, 'outbound');
fs.mkdirSync(outbound, { recursive: true });

function readEnv(filePath) {
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const env = readEnv(path.join(repo, '.env'));
const account = env.TENANT_LOGIN_ACCOUNT;
const password = env.TENANT_LOGIN_PASSWORD;
const baseUrl = 'http://127.0.0.1:30010';
const apiBase = 'http://127.0.0.1:30011';
const code = `QA-${Date.now().toString().slice(-6)}`;

const result = {
  startedAt: new Date().toISOString(),
  tenantSlug: null,
  productId: null,
  shareToken: null,
  screenshots: [],
  consoleErrors: [],
  pageErrors: [],
  checks: [],
};

function add(level, title, detail) {
  result.checks.push({ level, title, detail });
}

async function shot(page, name) {
  const file = path.join(outbound, name);
  await page.screenshot({ path: file, fullPage: true });
  result.screenshots.push(path.relative(repo, file));
}

async function loginViaApi(request) {
  const resp = await request.post(`${apiBase}/auth/password-login`, { data: { login: account, password } });
  if (!resp.ok()) throw new Error(`password-login failed: ${resp.status()} ${await resp.text()}`);
  const json = await resp.json();
  const accessToken = json.accessToken;
  const meResp = await request.get(`${apiBase}/tenants/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!meResp.ok()) throw new Error(`tenants/me failed: ${meResp.status()} ${await meResp.text()}`);
  const me = await meResp.json();
  const tenantSlug = me.tenants?.[0]?.tenant?.slug;
  if (!tenantSlug) throw new Error('No tenant slug found');
  const switchResp = await request.post(`${apiBase}/auth/switch-tenant`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { slug: tenantSlug },
  });
  if (!switchResp.ok()) throw new Error(`switch-tenant failed: ${switchResp.status()} ${await switchResp.text()}`);
  const switched = await switchResp.json();
  return { tenantSlug, accessToken: switched.accessToken };
}

function parseHexColor(value) {
  const input = (value || '').trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(input)) return input;
  const match = input.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return input;
  return '#' + match.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, '0')).join('');
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
const page = await context.newPage();
page.on('console', (msg) => { if (msg.type() === 'error') result.consoleErrors.push(msg.text()); });
page.on('pageerror', (err) => { result.pageErrors.push(String(err)); });

try {
  const auth = await loginViaApi(context.request);
  result.tenantSlug = auth.tenantSlug;

  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.evaluate((token) => window.localStorage.setItem('eggturtle.accessToken', token), auth.accessToken);

  await page.goto(`${baseUrl}/app/${auth.tenantSlug}/products`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '新建乌龟' }).click();
  await page.waitForTimeout(600);
  await shot(page, 'retest-t65-create-drawer-default.png');

  const seriesSelect = page.locator('#create-drawer-series');
  const newSeriesButton = page.getByRole('button', { name: '新建系列' });
  const seriesVisible = await seriesSelect.isVisible();
  const buttonVisible = await newSeriesButton.isVisible();
  const selectBox = await seriesSelect.boundingBox();
  const buttonBox = await newSeriesButton.boundingBox();
  add(seriesVisible && buttonVisible ? 'PASS' : 'FAIL', '新建乌龟抽屉系列区可用', `seriesVisible=${seriesVisible}; buttonVisible=${buttonVisible}; selectBox=${JSON.stringify(selectBox)}; buttonBox=${JSON.stringify(buttonBox)}`);

  await newSeriesButton.click();
  await page.waitForTimeout(300);
  await shot(page, 'retest-t65-create-drawer-new-series.png');
  await page.getByPlaceholder('系列名称（必填）').fill('白化');
  await page.getByLabel('产品编码（必填）').fill(code);
  await page.getByRole('button', { name: /^确认创建/ }).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
  await shot(page, 'retest-t65-product-list-after-create.png');

  const card = page.getByText(code).first();
  await card.waitFor({ timeout: 10000 });
  const cardContainer = card.locator('xpath=ancestor::*[self::article or self::a][1]');
  const cardText = await cardContainer.innerText().catch(async () => await page.locator('body').innerText());
  add(/白化/.test(cardText) ? 'PASS' : 'FAIL', '列表页显示新系列名称', `code=${code}; cardText=${cardText.slice(0, 500)}`);
  add(/NEW-SERIES|\bNEW\b/.test(cardText) ? 'FAIL' : 'PASS', '列表页未暴露 NEW-SERIES/NEW', `code=${code}; cardText=${cardText.slice(0, 500)}`);

  const productResp = await context.request.get(`${apiBase}/products?keyword=${encodeURIComponent(code)}`, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  });
  if (!productResp.ok()) throw new Error(`product lookup failed: ${productResp.status()} ${await productResp.text()}`);
  const productJson = await productResp.json();
  const created = (productJson.items || []).find((item) => item.code === code) || productJson.items?.[0];
  if (!created?.id) throw new Error('Created product not found via API');
  result.productId = created.id;

  const meResp = await context.request.get(`${apiBase}/me`, { headers: { Authorization: `Bearer ${auth.accessToken}` } });
  if (!meResp.ok()) throw new Error(`me failed: ${meResp.status()} ${await meResp.text()}`);
  const meJson = await meResp.json();
  const tenantId = meJson.tenantId;
  if (!tenantId) throw new Error('No tenantId in /me response');

  const shareResp = await context.request.post(`${apiBase}/shares`, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
    data: { resourceType: 'tenant_feed', resourceId: tenantId },
  });
  if (!shareResp.ok()) throw new Error(`share create failed: ${shareResp.status()} ${await shareResp.text()}`);
  const shareJson = await shareResp.json();
  result.shareToken = shareJson.share.shareToken;

  await page.goto(`${baseUrl}/public/s/${result.shareToken}/products/${created.id}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await shot(page, 'retest-t65-public-product-detail.png');
  const detailText = await page.locator('body').innerText();
  add(/白化/.test(detailText) ? 'PASS' : 'FAIL', '详情页显示新系列名称', detailText.slice(0, 800));
  add(/NEW-SERIES|\bNEW\b/.test(detailText) ? 'FAIL' : 'PASS', '详情页未暴露 NEW-SERIES/NEW', detailText.slice(0, 800));

  await page.goto(`${baseUrl}/app/${auth.tenantSlug}/share-presentation`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await shot(page, 'retest-t69-share-presentation-initial.png');

  const customColorLabelCount = await page.getByText('自定义颜色', { exact: true }).count();
  add(customColorLabelCount > 0 ? 'FAIL' : 'PASS', '分享配置不应再暴露自定义颜色入口', `customColorLabelCount=${customColorLabelCount}`);

  const colorButtons = page.locator('button[aria-pressed]');
  const pressedCount = await colorButtons.count();
  const pressedSummaries = [];
  for (let i = 0; i < pressedCount; i += 1) {
    const btn = colorButtons.nth(i);
    const pressed = await btn.getAttribute('aria-pressed');
    if (pressed === 'true') {
      const text = (await btn.innerText()).trim();
      const borderColor = parseHexColor(await btn.evaluate((el) => getComputedStyle(el).borderColor));
      const bgColor = parseHexColor(await btn.evaluate((el) => getComputedStyle(el).backgroundColor));
      pressedSummaries.push({ text, borderColor, bgColor });
    }
  }
  const hasYellowSelected = pressedSummaries.some((item) => item.text.includes('金黄') || item.borderColor === '#ffd400' || item.bgColor === '#fff7d0');
  add(hasYellowSelected ? 'PASS' : 'FAIL', '默认选中态应为黄色', JSON.stringify(pressedSummaries));

  const colorInput = page.locator('input[aria-label="主题主色 自定义颜色"]');
  if (await colorInput.count()) {
    await colorInput.fill('#06b6d4');
    await page.getByRole('button', { name: '保存并立即生效' }).click();
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: '金黄' }).click();
    await page.getByRole('button', { name: '保存并立即生效' }).click();
    await page.waitForTimeout(1200);
    await shot(page, 'retest-t69-share-presentation-after-reset-to-yellow.png');
    const currentColorTextCount = await page.getByText('当前色', { exact: true }).count();
    add(currentColorTextCount > 0 ? 'FAIL' : 'PASS', '取消历史自定义颜色后不应残留“当前色”', `currentColorTextCount=${currentColorTextCount}`);
  }
} finally {
  await browser.close();
}

result.finishedAt = new Date().toISOString();
result.conclusion = result.checks.some((item) => item.level === 'FAIL') ? '不可 push' : '可 push';
fs.writeFileSync(path.join(outbound, 'retest-t65-t69-20260307-result.json'), JSON.stringify(result, null, 2));
const lines = [
  '# Retest T65/T69',
  '',
  `- time: ${result.finishedAt}`,
  `- tenant: ${result.tenantSlug}`,
  `- productId: ${result.productId ?? 'n/a'}`,
  `- shareToken: ${result.shareToken ?? 'n/a'}`,
  `- conclusion: ${result.conclusion}`,
  '',
  '## Screenshots',
  ...result.screenshots.map((item) => `- ${item}`),
  '',
  '## Checks',
  ...result.checks.map((item) => `- [${item.level}] ${item.title}: ${item.detail}`),
  '',
  `- consoleErrors: ${result.consoleErrors.length}`,
  `- pageErrors: ${result.pageErrors.length}`,
  '',
];
fs.writeFileSync(path.join(outbound, 'retest-t65-t69-20260307-report.md'), lines.join('\n'));
console.log(lines.join('\n'));
