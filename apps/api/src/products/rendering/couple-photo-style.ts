export const COUPLE_PHOTO_CANVAS = {
  width: 1080,
  height: 1536
} as const;

export const COUPLE_PHOTO_SLOTS = {
  female: { x: 96, y: 286, width: 888, height: 390 },
  male: { x: 96, y: 810, width: 888, height: 366 },
  qr: { x: 756, y: 1240, width: 228, height: 228 }
} as const;

export type CouplePhotoStyleInput = {
  femaleCode: string;
  maleCode: string;
  lineLabel: string;
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

export function buildCouplePhotoStyleSvg(input: CouplePhotoStyleInput): string {
  const w = COUPLE_PHOTO_CANVAS.width;
  const h = COUPLE_PHOTO_CANVAS.height;
  const esc = (value: string) => escapeXml(value);
  const femaleCenterX = COUPLE_PHOTO_SLOTS.female.x + COUPLE_PHOTO_SLOTS.female.width / 2;
  const maleCenterX = COUPLE_PHOTO_SLOTS.male.x + COUPLE_PHOTO_SLOTS.male.width / 2;
  const qrCenterX = COUPLE_PHOTO_SLOTS.qr.x + COUPLE_PHOTO_SLOTS.qr.width / 2;

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="paper" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f5ebda"/>
      <stop offset="100%" stop-color="#e7d8bd"/>
    </linearGradient>
    <pattern id="grain" width="120" height="120" patternUnits="userSpaceOnUse">
      <circle cx="18" cy="20" r="1.1" fill="#ead8bd" />
      <circle cx="74" cy="56" r="0.9" fill="#ddc7a6" />
      <circle cx="48" cy="96" r="1.0" fill="#e2cfaf" />
    </pattern>
    <linearGradient id="frame" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="rgba(250,243,230,0.96)"/>
      <stop offset="100%" stop-color="rgba(221,197,161,0.92)"/>
    </linearGradient>
    <linearGradient id="infoCard" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="rgba(250,241,225,0.98)"/>
      <stop offset="100%" stop-color="rgba(241,227,204,0.96)"/>
    </linearGradient>
    <filter id="shadowSoft" x="-20%" y="-20%" width="150%" height="170%">
      <feDropShadow dx="0" dy="5" stdDeviation="4.2" flood-color="#4c3821" flood-opacity="0.24"/>
    </filter>
  </defs>

  <rect x="0" y="0" width="${w}" height="${h}" fill="url(#paper)"/>
  <rect x="0" y="0" width="${w}" height="${h}" fill="url(#grain)" opacity="0.42"/>

  <rect x="22" y="22" width="${w - 44}" height="${h - 44}" fill="none" stroke="#7f6544" stroke-width="2.4" rx="14"/>
  <rect x="42" y="42" width="${w - 84}" height="${h - 84}" fill="none" stroke="#b2936a" stroke-width="1.4" rx="12"/>

  <text x="${w / 2}" y="124" text-anchor="middle" font-size="70" font-weight="700" fill="#23180e" font-family="'STZhongsong','Songti SC',serif">母龟夫妻照</text>
  <text x="${w / 2}" y="176" text-anchor="middle" font-size="32" fill="#5a4632" font-family="'Songti SC','STSong',serif">${esc(input.lineLabel)}</text>
  <line x1="136" y1="208" x2="944" y2="208" stroke="#c4a980" stroke-width="1.6"/>

  <text x="${femaleCenterX}" y="266" text-anchor="middle" font-size="44" font-weight="700" fill="#2b2015" font-family="'Songti SC','STSong',serif">母龟 ${esc(input.femaleCode)}</text>
  <g filter="url(#shadowSoft)">
    <rect x="${COUPLE_PHOTO_SLOTS.female.x - 10}" y="${COUPLE_PHOTO_SLOTS.female.y - 10}" width="${COUPLE_PHOTO_SLOTS.female.width + 20}" height="${COUPLE_PHOTO_SLOTS.female.height + 20}" fill="url(#frame)" stroke="#a67f4c" stroke-width="2.2" rx="14"/>
  </g>
  <rect x="${COUPLE_PHOTO_SLOTS.female.x - 2}" y="${COUPLE_PHOTO_SLOTS.female.y - 2}" width="${COUPLE_PHOTO_SLOTS.female.width + 4}" height="${COUPLE_PHOTO_SLOTS.female.height + 4}" fill="none" stroke="rgba(255,249,239,0.78)" stroke-width="1.2" rx="10"/>

  <line x1="124" y1="758" x2="956" y2="758" stroke="#c6ac84" stroke-width="1.4"/>

  <text x="${maleCenterX}" y="798" text-anchor="middle" font-size="44" font-weight="700" fill="#2b2015" font-family="'Songti SC','STSong',serif">公龟 ${esc(input.maleCode)}</text>
  <g filter="url(#shadowSoft)">
    <rect x="${COUPLE_PHOTO_SLOTS.male.x - 10}" y="${COUPLE_PHOTO_SLOTS.male.y - 10}" width="${COUPLE_PHOTO_SLOTS.male.width + 20}" height="${COUPLE_PHOTO_SLOTS.male.height + 20}" fill="url(#frame)" stroke="#a67f4c" stroke-width="2.2" rx="14"/>
  </g>
  <rect x="${COUPLE_PHOTO_SLOTS.male.x - 2}" y="${COUPLE_PHOTO_SLOTS.male.y - 2}" width="${COUPLE_PHOTO_SLOTS.male.width + 4}" height="${COUPLE_PHOTO_SLOTS.male.height + 4}" fill="none" stroke="rgba(255,249,239,0.78)" stroke-width="1.2" rx="10"/>

  <rect x="96" y="1240" width="632" height="228" fill="url(#infoCard)" stroke="#b7996f" stroke-width="1.8" rx="16"/>
  <text x="132" y="1318" font-size="58" font-weight="700" fill="#2c2014" font-family="'Songti SC','STSong',serif">${esc(input.priceLabel)}</text>
  <text x="132" y="1372" font-size="31" fill="#5d4a35" font-family="'Songti SC','STSong',serif">${esc(input.generatedAtLabel)}</text>
  <text x="132" y="1420" font-size="31" fill="#5d4a35" font-family="'Songti SC','STSong',serif">${esc(input.watermarkText)}</text>

  <text x="${qrCenterX}" y="1218" text-anchor="middle" font-size="34" fill="#43311f" font-family="'Songti SC','STSong',serif">配对二维码</text>
  <rect x="${COUPLE_PHOTO_SLOTS.qr.x - 10}" y="${COUPLE_PHOTO_SLOTS.qr.y - 10}" width="${COUPLE_PHOTO_SLOTS.qr.width + 20}" height="${COUPLE_PHOTO_SLOTS.qr.height + 20}" fill="rgba(250,241,225,0.96)" stroke="#b7996f" stroke-width="2" rx="14"/>
</svg>`;
}
