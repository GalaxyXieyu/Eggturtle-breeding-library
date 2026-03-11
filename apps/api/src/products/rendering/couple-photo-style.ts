export const COUPLE_PHOTO_CANVAS = {
  width: 1080,
  height: 1536
} as const;

export const COUPLE_PHOTO_SLOTS = {
  female: { x: 196, y: 430, width: 320, height: 320 },
  male: { x: 564, y: 430, width: 320, height: 320 },
  qr: { x: 816, y: 1198, width: 152, height: 152 }
} as const;

export type CouplePhotoStyleInput = {
  femaleCode: string;
  maleCode: string;
  seriesName: string;
  seriesDescription: string;
  priceLabel: string;
  generatedAtLabel: string;
  watermarkText: string;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapText(value: string, maxCharsPerLine: number, maxLines: number): string[] {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return [];
  }

  const lines: string[] = [];
  let cursor = 0;

  while (cursor < normalized.length && lines.length < maxLines) {
    const next = normalized.slice(cursor, cursor + maxCharsPerLine);
    cursor += next.length;
    if (cursor < normalized.length && lines.length === maxLines - 1) {
      lines.push(`${next.slice(0, Math.max(0, maxCharsPerLine - 1))}…`);
      break;
    }
    lines.push(next);
  }

  return lines;
}

function buildTspans(lines: string[], x: number, firstY: number, lineHeight: number): string {
  return lines
    .map((line, index) => `<tspan x="${x}" y="${firstY + index * lineHeight}">${escapeXml(line)}</tspan>`)
    .join('');
}

export function buildCouplePhotoStyleSvg(input: CouplePhotoStyleInput): string {
  const femaleCenterX = COUPLE_PHOTO_SLOTS.female.x + COUPLE_PHOTO_SLOTS.female.width / 2;
  const maleCenterX = COUPLE_PHOTO_SLOTS.male.x + COUPLE_PHOTO_SLOTS.male.width / 2;
  const qrCenterX = COUPLE_PHOTO_SLOTS.qr.x + COUPLE_PHOTO_SLOTS.qr.width / 2;

  const seriesName = input.seriesName.trim() || '未设置系列';
  const descriptionLines = wrapText(input.seriesDescription.trim() || '暂无系列介绍', 24, 3);

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1536" viewBox="0 0 1080 1536">
  <defs>
    <linearGradient id="photoFrame" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="rgba(255,251,244,0.98)"/>
      <stop offset="60%" stop-color="rgba(239,224,198,0.96)"/>
      <stop offset="100%" stop-color="rgba(220,198,163,0.94)"/>
    </linearGradient>
    <filter id="shadowSoft" x="-20%" y="-20%" width="160%" height="160%">
      <feDropShadow dx="0" dy="8" stdDeviation="9" flood-color="#5d4326" flood-opacity="0.14"/>
      <feDropShadow dx="0" dy="18" stdDeviation="16" flood-color="#3f2b16" flood-opacity="0.10"/>
    </filter>
    <style>
      .font-title { font-family: 'STZhongsong','Songti SC','Noto Serif CJK SC','SimSun',serif; }
      .font-main { font-family: 'Songti SC','STSong','Noto Serif CJK SC','SimSun',serif; }
      .font-label { font-family: 'Kaiti SC','STKaiti','KaiTi','Noto Serif CJK SC',serif; }
      .font-sans { font-family: 'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif; }
    </style>
  </defs>

  <text x="540" y="254" text-anchor="middle" font-size="30" fill="#5f4c39" class="font-label">配偶</text>
  <text x="540" y="312" text-anchor="middle" font-size="46" font-weight="700" fill="#2d2218" class="font-title">${escapeXml(seriesName)}</text>
  <line x1="244" y1="340" x2="836" y2="340" stroke="rgba(135,105,70,0.72)" stroke-width="1.15"/>

  <g filter="url(#shadowSoft)">
    <rect x="${COUPLE_PHOTO_SLOTS.female.x - 8}" y="${COUPLE_PHOTO_SLOTS.female.y - 8}" width="${COUPLE_PHOTO_SLOTS.female.width + 16}" height="${COUPLE_PHOTO_SLOTS.female.height + 16}" rx="18" fill="url(#photoFrame)" stroke="rgba(142,108,69,0.55)" stroke-width="1.35"/>
    <rect x="${COUPLE_PHOTO_SLOTS.male.x - 8}" y="${COUPLE_PHOTO_SLOTS.male.y - 8}" width="${COUPLE_PHOTO_SLOTS.male.width + 16}" height="${COUPLE_PHOTO_SLOTS.male.height + 16}" rx="18" fill="url(#photoFrame)" stroke="rgba(142,108,69,0.55)" stroke-width="1.35"/>
  </g>

  <rect x="${COUPLE_PHOTO_SLOTS.female.x - 1}" y="${COUPLE_PHOTO_SLOTS.female.y - 1}" width="${COUPLE_PHOTO_SLOTS.female.width + 2}" height="${COUPLE_PHOTO_SLOTS.female.height + 2}" rx="14" fill="none" stroke="rgba(255,252,247,0.92)" stroke-width="1"/>
  <rect x="${COUPLE_PHOTO_SLOTS.female.x + 10}" y="${COUPLE_PHOTO_SLOTS.female.y + 10}" width="${COUPLE_PHOTO_SLOTS.female.width - 20}" height="${COUPLE_PHOTO_SLOTS.female.height - 20}" rx="10" fill="none" stroke="rgba(255,244,227,0.55)" stroke-width="0.9"/>
  <rect x="${COUPLE_PHOTO_SLOTS.male.x - 1}" y="${COUPLE_PHOTO_SLOTS.male.y - 1}" width="${COUPLE_PHOTO_SLOTS.male.width + 2}" height="${COUPLE_PHOTO_SLOTS.male.height + 2}" rx="14" fill="none" stroke="rgba(255,252,247,0.92)" stroke-width="1"/>
  <rect x="${COUPLE_PHOTO_SLOTS.male.x + 10}" y="${COUPLE_PHOTO_SLOTS.male.y + 10}" width="${COUPLE_PHOTO_SLOTS.male.width - 20}" height="${COUPLE_PHOTO_SLOTS.male.height - 20}" rx="10" fill="none" stroke="rgba(255,244,227,0.55)" stroke-width="0.9"/>

  <text x="${femaleCenterX}" y="786" text-anchor="middle" font-size="22" fill="#6a533c" class="font-label">母龟</text>
  <text x="${femaleCenterX}" y="824" text-anchor="middle" font-size="30" font-weight="700" fill="#312216" class="font-main">${escapeXml(input.femaleCode)}</text>
  <text x="${maleCenterX}" y="786" text-anchor="middle" font-size="22" fill="#6a533c" class="font-label">公龟</text>
  <text x="${maleCenterX}" y="824" text-anchor="middle" font-size="30" font-weight="700" fill="#312216" class="font-main">${escapeXml(input.maleCode)}</text>

  <line x1="196" y1="922" x2="954" y2="922" stroke="rgba(135,105,70,0.58)" stroke-width="1.05"/>
  <text x="196" y="970" font-size="27" fill="#6a533c" class="font-label">系列介绍</text>
  <text x="196" y="1026" font-size="48" font-weight="700" fill="#2d2218" class="font-main">${escapeXml(seriesName)}</text>
  <text x="196" y="1076" font-size="24" fill="#5b4733" class="font-sans">${buildTspans(descriptionLines, 196, 1076, 34)}</text>

  <line x1="196" y1="1178" x2="748" y2="1178" stroke="rgba(135,105,70,0.50)" stroke-width="1"/>
  <text x="196" y="1224" font-size="27" fill="#6a533c" class="font-label">种苗参考价</text>
  <text x="196" y="1280" font-size="50" font-weight="700" fill="#2d2218" class="font-main">${escapeXml(input.priceLabel)}</text>

  <text x="196" y="1344" font-size="27" fill="#6a533c" class="font-label">生成信息</text>
  <text x="196" y="1384" font-size="26" fill="#4f3d2d" class="font-sans">${escapeXml(input.generatedAtLabel)}</text>

  <text x="${qrCenterX}" y="1172" text-anchor="middle" font-size="20" fill="#4b3a28" class="font-label">验真二维码</text>
  <rect x="${COUPLE_PHOTO_SLOTS.qr.x - 6}" y="${COUPLE_PHOTO_SLOTS.qr.y - 6}" width="${COUPLE_PHOTO_SLOTS.qr.width + 12}" height="${COUPLE_PHOTO_SLOTS.qr.height + 12}" fill="none" stroke="#8f7451" stroke-width="2" rx="8"/>
</svg>`;
}
