#!/usr/bin/env tsx
/**
 * 快速本地渲染测试
 * 用法：npx tsx scripts/render_certificate_test.ts [outbound/cert-test.png]
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { renderCertificatePng } from '../apps/api/src/products/rendering/generated-media-renderer';

const outPath = resolve(process.cwd(), process.argv[2] ?? 'outbound/cert-test.png');

const style = {
  brandTitleZh: '选育溯源档案',
  brandTitleEn: 'Breeding Traceability Record',
  brandEyebrowZh: '选育溯源档案',
  brandEyebrowEn: 'Breeding Traceability Record',
  verificationStatementZh: '本证书内容由选育溯源档案生成，扫码可查验档案真实性。',
  certNo: 'CERT-20260315-白化-1-TEST',
  issuedOnText: '2026-03-15',
  issuedOnChineseText: '2026年3月15日',
  // 父系 (Sire) - 左侧
  sireName: '白化公龟',
  sireCode: 'BATCH-20260218-1-C6A',
  sireFamily: '白化',
  // 母系 (Dam) - 右侧
  damName: '白化母龟',
  damCode: '白化-1',
  damFamily: '白化',
  // 祖代
  sireSireCode: '未登记',
  sireDamCode: '未登记',
  damSireCode: '种龟-F',
  damDamCode: '未登记',
  // 交易信息
  buyerName: '测试买家',
  buyerAccountId: 'test-buyer-001',
  sellerName: '西瑞的果核',
  sellerAccountId: 'seller-001',
  verifyId: 'A02F5E395CEE49E1A0942C288B10FFF6',
  watermarkText: '',
};

async function main() {
  console.log('渲染中...');
  const png = await renderCertificatePng({
    style,
    qrPayloadUrl: 'https://eggturtle.cn/verify/A02F5E395CEE49E1A0942C288B10FFF6',
  });
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, png);
  console.log('✅ 已生成:', outPath);
}

main().catch(e => { console.error(e); process.exit(1); });
