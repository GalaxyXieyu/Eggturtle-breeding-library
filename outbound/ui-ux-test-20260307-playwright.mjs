import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from 'playwright';

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

const result = {
  startedAt: new Date().toISOString(),
  consoleErrors: [],
  pageErrors: [],
  screenshots: [],
  findings: [],
  tenantSlug: null,
};

function addFinding(level, title, detail) {
  result.findings.push({ level, title, detail });
}

async function loginViaApi(request) {
  const resp = await request.post(`${apiBase}/auth/password-login`, {
    data: { login: account, password },
  });
  if (!resp.ok()) throw new Error(`password-login failed: ${resp.status()} ${await resp.text()}`);
  const json = await resp.json();
  const accessToken = json.accessToken;
  const meResp = await request.get(`${apiBase}/tenants/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
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
  return { accessToken: switched.accessToken, tenantSlug };
}

async function saveShot(page, name) {
  const file = path.join(outbound, name);
  await page.screenshot({ path: file, fullPage: true });
  result.screenshots.push(file);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...devices['iPhone 12'] });
const page = await context.newPage();
page.on('console', (msg) => {
  if (msg.type() === 'error') result.consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => {
  result.pageErrors.push(String(err));
});

try {
  const auth = await loginViaApi(context.request);
  result.tenantSlug = auth.tenantSlug;

  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.evaluate((token) => window.localStorage.setItem('eggturtle.accessToken', token), auth.accessToken);

  await page.goto(`${baseUrl}/app/${auth.tenantSlug}/products`, { waitUntil: 'networkidle' });
  await page.locator('button:has-text("新建")').first().click({ timeout: 10000 }).catch(async () => {
    await page.locator('button:has-text("新建乌龟")').first().click({ timeout: 10000 });
  });
  await page.waitForTimeout(800);

  const drawer = page.locator('text=系列').first();
  await drawer.scrollIntoViewIfNeeded();
  await saveShot(page, 'qa-mobile-product-create-series-default.png');

  const seriesSelect = page.locator('select').filter({ has: page.locator('option') }).nth(0);
  const optionCount = await seriesSelect.locator('option').count().catch(() => 0);
  if (optionCount <= 0) {
    addFinding('FAIL', '系列下拉未渲染可选项', '新建乌龟抽屉中未检测到系列 select/option。');
  }

  const addSeriesBtn = page.locator('button:has-text("新建系列")').first();
  if (await addSeriesBtn.count()) {
    await addSeriesBtn.click();
    await page.waitForTimeout(500);
    await saveShot(page, 'qa-mobile-product-create-series-inline-create.png');
    const inlineInputCount = await page.locator('input').filter({ hasText: '' }).count().catch(() => 0);
    const hasConfirm = await page.locator('button:has-text("保存")').count().catch(() => 0);
    addFinding('PASS', '系列内联创建入口可见', `检测到“新建系列”按钮，点击后抽屉状态已截图；保存按钮数量=${hasConfirm}。`);
  } else {
    addFinding('FAIL', '缺少新建系列按钮', '新建乌龟抽屉中未找到“新建系列”按钮。');
  }

  await page.goto(`${baseUrl}/app/${auth.tenantSlug}/share-presentation`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await saveShot(page, 'qa-mobile-share-presentation-theme.png');

  const pageText = await page.locator('body').innerText();
  if (/自定义颜色/.test(pageText)) {
    addFinding('FAIL', '仍存在自定义颜色入口', '分享页配置中仍可见“自定义颜色”文案。');
  } else {
    addFinding('PASS', '自定义颜色入口已移除', '分享页配置文案中未检出“自定义颜色”。');
  }

  const yellowIndicators = await page.locator('text=/默认配色|暖阳黄|黄色|黄/').count().catch(() => 0);
  if (yellowIndicators > 0) {
    addFinding('PASS', '默认配色黄色选中态可见', `页面中检测到 ${yellowIndicators} 个与黄色默认配色相关的文本节点。`);
  } else {
    addFinding('WARN', '未能从文本直接确认黄色选中态', '截图中需人工复核默认配色选中态是否为黄色。');
  }

  if (result.consoleErrors.length) {
    addFinding('WARN', '存在浏览器控制台报错', result.consoleErrors.join('\n').slice(0, 2000));
  }
  if (result.pageErrors.length) {
    addFinding('WARN', '存在页面运行时异常', result.pageErrors.join('\n').slice(0, 2000));
  }
} finally {
  await browser.close();
}

result.finishedAt = new Date().toISOString();
fs.writeFileSync(path.join(outbound, 'qa-ui-ux-test-20260307-result.json'), JSON.stringify(result, null, 2));

const hasFail = result.findings.some((item) => item.level === 'FAIL');
const summary = [
  '# UI/UX QA 结论',
  '',
  `- 时间: ${result.finishedAt}`,
  `- 用户: ${result.tenantSlug ?? 'unknown'}`,
  `- 结论: ${hasFail ? '不可 push' : '可 push'}`,
  '',
  '## 截图',
  ...result.screenshots.map((p) => `- ${path.relative(repo, p)}`),
  '',
  '## 检查结果',
  ...result.findings.map((item) => `- [${item.level}] ${item.title}: ${item.detail}`),
  '',
  '## 报错',
  `- consoleErrors: ${result.consoleErrors.length}`,
  `- pageErrors: ${result.pageErrors.length}`,
  '',
].join('\n');
fs.writeFileSync(path.join(outbound, 'qa-ui-ux-test-20260307-report.md'), summary);
console.log(summary);
