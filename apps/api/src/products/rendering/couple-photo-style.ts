export const COUPLE_PHOTO_CANVAS = {
  width: 1080,
  height: 1536
} as const;

export const COUPLE_PHOTO_SLOTS = {
  // Keep a 48px center gutter, with male on the left and female on the right.
  male: { x: 136, y: 356, width: 380, height: 380 },
  female: { x: 564, y: 356, width: 380, height: 380 },
  qr: { x: 104, y: 1298, width: 152, height: 152 }
} as const;

export type CouplePhotoStyleInput = {
  femaleCode: string;
  maleCode: string;
  femaleSeriesName: string;
  femaleSeriesDescription: string;
  maleSeriesName: string;
  maleSeriesDescription: string;
  femaleShortDescription: string;
  maleShortDescription: string;
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

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function truncateText(value: string, maxChars: number, fallback: string): string {
  const normalized = normalizeText(value);
  if (!normalized) {
    return fallback;
  }

  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxChars - 1))}…`;
}

function wrapText(value: string, maxCharsPerLine: number, maxLines: number, fallback: string): string[] {
  const normalized = normalizeText(value) || fallback;
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

  const femaleSeriesName = normalizeText(input.femaleSeriesName) || '未设置系列';
  const maleSeriesName = normalizeText(input.maleSeriesName) || '未设置系列';
  const isSameSeries = femaleSeriesName === maleSeriesName;
  const headerPairLabel = `${input.maleCode} × ${input.femaleCode}`;

  const femaleShortDescription = truncateText(input.femaleShortDescription, 20, '暂无描述');
  const maleShortDescription = truncateText(input.maleShortDescription, 20, '暂无描述');
  const femaleDescriptionLines = wrapText(input.femaleSeriesDescription, 15, 6, '暂无系列介绍');
  const maleDescriptionLines = wrapText(input.maleSeriesDescription, 13, 6, '暂无系列介绍');
  const sharedDescriptionLines = wrapText(input.femaleSeriesDescription, 30, 5, '暂无系列介绍');

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1536" viewBox="0 0 1080 1536">
  <defs>
    <linearGradient id="photoFrame" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="rgba(255,251,244,0.98)"/>
      <stop offset="58%" stop-color="rgba(238,223,198,0.97)"/>
      <stop offset="100%" stop-color="rgba(214,189,151,0.95)"/>
    </linearGradient>
    <filter id="shadowSoft" x="-20%" y="-20%" width="160%" height="160%">
      <feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#5d4326" flood-opacity="0.16"/>
      <feDropShadow dx="0" dy="22" stdDeviation="18" flood-color="#3f2b16" flood-opacity="0.11"/>
    </filter>
    <style>
      .font-title { font-family: 'STZhongsong','Songti SC','Noto Serif CJK SC','SimSun',serif; }
      .font-main { font-family: 'Songti SC','STSong','Noto Serif CJK SC','SimSun',serif; }
      .font-label { font-family: 'Kaiti SC','STKaiti','KaiTi','Noto Serif CJK SC',serif; }
      .font-sans { font-family: 'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif; }
    </style>
  </defs>

  <text x="540" y="244" text-anchor="middle" font-size="30" fill="#5f4c39" class="font-label">配偶</text>
  <text x="540" y="304" text-anchor="middle" font-size="44" font-weight="700" fill="#2d2218" class="font-title">${escapeXml(headerPairLabel)}</text>
  <line x1="216" y1="336" x2="864" y2="336" stroke="rgba(135,105,70,0.72)" stroke-width="1.15"/>

  <g filter="url(#shadowSoft)">
    <rect x="${COUPLE_PHOTO_SLOTS.female.x - 8}" y="${COUPLE_PHOTO_SLOTS.female.y - 8}" width="${COUPLE_PHOTO_SLOTS.female.width + 16}" height="${COUPLE_PHOTO_SLOTS.female.height + 16}" rx="20" fill="url(#photoFrame)" stroke="rgba(142,108,69,0.62)" stroke-width="1.4"/>
    <rect x="${COUPLE_PHOTO_SLOTS.male.x - 8}" y="${COUPLE_PHOTO_SLOTS.male.y - 8}" width="${COUPLE_PHOTO_SLOTS.male.width + 16}" height="${COUPLE_PHOTO_SLOTS.male.height + 16}" rx="20" fill="url(#photoFrame)" stroke="rgba(142,108,69,0.62)" stroke-width="1.4"/>
  </g>

  <rect x="${COUPLE_PHOTO_SLOTS.female.x - 1}" y="${COUPLE_PHOTO_SLOTS.female.y - 1}" width="${COUPLE_PHOTO_SLOTS.female.width + 2}" height="${COUPLE_PHOTO_SLOTS.female.height + 2}" rx="16" fill="none" stroke="rgba(255,252,247,0.92)" stroke-width="1"/>
  <rect x="${COUPLE_PHOTO_SLOTS.female.x + 10}" y="${COUPLE_PHOTO_SLOTS.female.y + 10}" width="${COUPLE_PHOTO_SLOTS.female.width - 20}" height="${COUPLE_PHOTO_SLOTS.female.height - 20}" rx="12" fill="none" stroke="rgba(255,244,227,0.55)" stroke-width="0.9"/>
  <rect x="${COUPLE_PHOTO_SLOTS.male.x - 1}" y="${COUPLE_PHOTO_SLOTS.male.y - 1}" width="${COUPLE_PHOTO_SLOTS.male.width + 2}" height="${COUPLE_PHOTO_SLOTS.male.height + 2}" rx="16" fill="none" stroke="rgba(255,252,247,0.92)" stroke-width="1"/>
  <rect x="${COUPLE_PHOTO_SLOTS.male.x + 10}" y="${COUPLE_PHOTO_SLOTS.male.y + 10}" width="${COUPLE_PHOTO_SLOTS.male.width - 20}" height="${COUPLE_PHOTO_SLOTS.male.height - 20}" rx="12" fill="none" stroke="rgba(255,244,227,0.55)" stroke-width="0.9"/>

  <text x="${femaleCenterX}" y="778" text-anchor="middle" font-size="22" fill="#6a533c" class="font-label">母龟</text>
  <text x="${femaleCenterX}" y="818" text-anchor="middle" font-size="34" font-weight="700" fill="#312216" class="font-main">${escapeXml(input.femaleCode)}</text>
  <text x="${femaleCenterX}" y="854" text-anchor="middle" font-size="18" fill="#4f3d2d" class="font-sans">${escapeXml(femaleShortDescription)}</text>
  <text x="${femaleCenterX}" y="888" text-anchor="middle" font-size="18" fill="#73593d" class="font-sans">系列 ${escapeXml(femaleSeriesName)}</text>

  <text x="${maleCenterX}" y="778" text-anchor="middle" font-size="22" fill="#6a533c" class="font-label">公龟</text>
  <text x="${maleCenterX}" y="818" text-anchor="middle" font-size="34" font-weight="700" fill="#312216" class="font-main">${escapeXml(input.maleCode)}</text>
  <text x="${maleCenterX}" y="854" text-anchor="middle" font-size="18" fill="#4f3d2d" class="font-sans">${escapeXml(maleShortDescription)}</text>
  <text x="${maleCenterX}" y="888" text-anchor="middle" font-size="18" fill="#73593d" class="font-sans">系列 ${escapeXml(maleSeriesName)}</text>

  <line x1="96" y1="938" x2="960" y2="938" stroke="rgba(135,105,70,0.58)" stroke-width="1.05"/>

  ${isSameSeries ? `
  <text x="96" y="982" font-size="25" fill="#6a533c" class="font-label">系列介绍</text>
  <text x="96" y="1030" font-size="42" font-weight="700" fill="#2d2218" class="font-main">${escapeXml(femaleSeriesName)}</text>
  <text x="96" y="1080" font-size="23" fill="#5b4733" class="font-sans">${buildTspans(sharedDescriptionLines, 96, 1080, 31)}</text>
  ` : `
  <text x="96" y="982" font-size="25" fill="#6a533c" class="font-label">父系系列介绍</text>
  <text x="560" y="982" font-size="25" fill="#6a533c" class="font-label">母系系列介绍</text>
  <text x="96" y="1030" font-size="40" font-weight="700" fill="#2d2218" class="font-main">${escapeXml(maleSeriesName)}</text>
  <text x="560" y="1030" font-size="40" font-weight="700" fill="#2d2218" class="font-main">${escapeXml(femaleSeriesName)}</text>
  <text x="96" y="1078" font-size="22" fill="#5b4733" class="font-sans">${buildTspans(maleDescriptionLines, 96, 1078, 31)}</text>
  <text x="560" y="1078" font-size="23" fill="#5b4733" class="font-sans">${buildTspans(femaleDescriptionLines, 560, 1078, 31)}</text>
  `}

  <text x="638" y="1298" font-size="28" fill="#6a533c" class="font-label">子代参考价</text>
  <text x="638" y="1392" font-size="76" font-weight="700" fill="#2d2218" class="font-main">${escapeXml(input.priceLabel)}</text>
  <text x="640" y="1432" font-size="22" fill="#6a533c" class="font-label">${escapeXml(input.generatedAtLabel)}</text>

  <text x="${qrCenterX}" y="1280" text-anchor="middle" font-size="18" fill="#4b3a28" class="font-label">验真二维码</text>
  <rect x="${COUPLE_PHOTO_SLOTS.qr.x - 8}" y="${COUPLE_PHOTO_SLOTS.qr.y - 8}" width="${COUPLE_PHOTO_SLOTS.qr.width + 16}" height="${COUPLE_PHOTO_SLOTS.qr.height + 16}" fill="rgba(255,255,255,0.95)" rx="10"/>
  <rect x="${COUPLE_PHOTO_SLOTS.qr.x - 8}" y="${COUPLE_PHOTO_SLOTS.qr.y - 8}" width="${COUPLE_PHOTO_SLOTS.qr.width + 16}" height="${COUPLE_PHOTO_SLOTS.qr.height + 16}" fill="none" stroke="#8f7451" stroke-width="2" rx="10"/>
</svg>`;
}
