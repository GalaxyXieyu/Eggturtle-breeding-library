#!/usr/bin/env node
/**
 * 快速本地渲染测试 — 直接调用 Node 渲染器，不依赖 API 服务。
 * 用法：node scripts/render_certificate_test.mjs [--out outbound/cert-test.png]
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// 解析 --out 参数
const outIdx = process.argv.indexOf('--out');
const outPath = outIdx !== -1
  ? resolve(process.cwd(), process.argv[outIdx + 1])
  : resolve(repoRoot, 'outbound/cert-test.png');

// 动态 import 编译后的渲染器（需要先 build，或用 tsx/ts-node）
// 这里直接用 sharp + SVG 方式，复用渲染器源码逻辑
import sharp from 'sharp';

// ---- 内联 mock 数据 ----
const MOCK = {
  brandTitleZh: '选育溯源档案',
  brandTitleEn: 'Breeding Traceability Record',
  brandEyebrowZh: '选育溯源档案',
  brandEyebrowEn: 'Breeding Traceability Record',
  verificationStatementZh: '本证书内容由选育溯源档案生成，扫码可查验档案真实性。',
  certNo: 'CERT-20260315-白化-1-TEST',
  issuedOnText: '2026-03-15',
  issuedOnChineseText: '2026年3月15日',
  lineName: '白化-1',
  lineCode: '白化-1',
  lineFamily: '白化',
  damName: '白化母龟',
  damCode: '白化-母',
  sireCode: '白化-A',
  damCodeValue: '白化-母',
  sireSireCode: '未登记',
  sireDamCode: '未登记',
  damSireCode: '种龟-F',
  damDamCode: '未登记',
  buyerName: '测试买家',
  buyerAccountId: 'test-buyer-001',
  sellerName: '西瑞的果核',
  sellerAccountId: 'seller-001',
  verifyId: 'TEST-VERIFY-ID',
  watermarkText: '',
  useExternalBackground: true,
};

// ---- 读取背景图 ----
const bgCandidates = [
  resolve(repoRoot, 'apps/api/src/products/rendering/assets/certificate-background.png'),
  resolve(repoRoot, 'src/products/rendering/assets/certificate-background.png'),
];

async function loadBg() {
  for (const p of bgCandidates) {
    try { return await readFile(p); } catch { /* try next */ }
  }
  return null;
}

// ---- 简化版 SVG 构建（复用 certificate-style.ts 的核心逻辑）----
// 直接 import 编译产物；如果没有 dist，用 tsx 运行
async function buildSvg(input) {
  // 尝试动态 import tsx 版本
  try {
    const { buildCertificateStyleSvg } = await import(
      resolve(repoRoot, 'apps/api/src/products/rendering/certificate-style.ts')
    );
    return buildCertificateStyleSvg(input);
  } catch {
    // fallback: 用 tsx
    return null;
  }
}

async function main() {
  const bg = await loadBg();
  if (!bg) {
    console.error('❌ 找不到背景图 certificate-background.png');
    process.exit(1);
  }
  console.log('✅ 背景图已加载，大小:', bg.length, 'bytes');

  // 用 tsx 调用 TS 渲染器
  const { spawnSync } = await import('node:child_process');
  const tscript = `
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderCertificatePng } from './apps/api/src/products/rendering/generated-media-renderer';

const out = process.argv[2] || 'outbound/cert-test.png';

const style = ${JSON.stringify(MOCK)};

async function run() {
  const png = await renderCertificatePng({ style, qrPayloadUrl: 'https://eggturtle.cn/verify/TEST' });
  const outPath = resolve(process.cwd(), out);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, png);
  console.log('✅ 证书已生成:', outPath);
}
run().catch(e => { console.error(e); process.exit(1); });
`;

  const tmpScript = resolve(repoRoot, 'outbound/.cert-render-tmp.ts');
  await mkdir(resolve(repoRoot, 'outbound'), { recursive: true });
  await writeFile(tmpScript, tscript);

  const result = spawnSync(
    'npx', ['tsx', tmpScript, outPath],
    { cwd: repoRoot, stdio: 'inherit', encoding: 'utf8' }
  );

  // cleanup
  try { await import('node:fs').then(fs => fs.promises.unlink(tmpScript)); } catch {}

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
