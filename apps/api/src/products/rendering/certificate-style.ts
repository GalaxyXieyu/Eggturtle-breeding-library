export const CERTIFICATE_CANVAS = {
  width: 1024,
  height: 1536
} as const;

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const PAGE_LAYOUT = {
  outerFrame: { x: 24, y: 24, width: CERTIFICATE_CANVAS.width - 48, height: CERTIFICATE_CANVAS.height - 48 },
  innerFrame: { x: 48, y: 48, width: CERTIFICATE_CANVAS.width - 96, height: CERTIFICATE_CANVAS.height - 96 },
  content: { x: 92, y: 92, width: CERTIFICATE_CANVAS.width - 184, height: CERTIFICATE_CANVAS.height - 184 },
  topDividerY: 352
} as const;

function splitHorizontal(container: Rect, columnCount: number, gap: number): Rect[] {
  const totalGap = gap * (columnCount - 1);
  const available = container.width - totalGap;
  const baseWidth = Math.floor(available / columnCount);
  const remainder = available - baseWidth * columnCount;

  const columns: Rect[] = [];
  let cursor = container.x;

  for (let index = 0; index < columnCount; index += 1) {
    const width = baseWidth + (index < remainder ? 1 : 0);
    columns.push({
      x: cursor,
      y: container.y,
      width,
      height: container.height
    });
    cursor += width + gap;
  }

  return columns;
}

const SUMMARY_ROW: Rect = { x: 118, y: 398, width: CERTIFICATE_CANVAS.width - 236, height: 132 };
const SUMMARY_COLS = splitHorizontal(SUMMARY_ROW, 2, 220);

const SUBJECT_SLOT: Rect = { x: 427, y: 452, width: 170, height: 170 };
const SIRE_SLOT: Rect = { x: 109, y: 688, width: 224, height: 224 };
const DAM_SLOT: Rect = { x: 691, y: 688, width: 224, height: 224 };

const LINEAGE_ROW: Rect = { x: 118, y: 1082, width: CERTIFICATE_CANVAS.width - 236, height: 62 };
const LINEAGE_COLS = splitHorizontal(LINEAGE_ROW, 2, 48);

const BOTTOM_ROW: Rect = { x: 110, y: 1152, width: CERTIFICATE_CANVAS.width - 220, height: 208 };
const QR_SLOT: Rect = { x: 724, y: 1188, width: 166, height: 166 };
const STAMP_CENTER = { x: 272, y: 1262 };

const FOOTER = {
  lineY: 1388,
  watermarkY: 1418,
  verifyY: 1448
} as const;

export const CERTIFICATE_SLOTS = {
  subject: SUBJECT_SLOT,
  sire: SIRE_SLOT,
  dam: DAM_SLOT,
  qr: QR_SLOT
} as const;

export const CERTIFICATE_BACKGROUND_SLOTS = {
  bottom: { x: 100, y: 1018, width: 824, height: 470 }
} as const;

type DebugBox = {
  rect: Rect;
  label: string;
  color: string;
};

const DEBUG_BOXES: DebugBox[] = [
  { rect: PAGE_LAYOUT.content, label: 'content', color: '#3b82f6' },
  { rect: SUMMARY_ROW, label: 'summary-row', color: '#16a34a' },
  { rect: SUMMARY_COLS[0], label: 'summary-left', color: '#16a34a' },
  { rect: SUMMARY_COLS[1], label: 'summary-right', color: '#16a34a' },
  { rect: CERTIFICATE_SLOTS.subject, label: 'slot-subject', color: '#ef4444' },
  { rect: CERTIFICATE_SLOTS.sire, label: 'slot-sire', color: '#ef4444' },
  { rect: CERTIFICATE_SLOTS.dam, label: 'slot-dam', color: '#ef4444' },
  { rect: LINEAGE_ROW, label: 'lineage-row', color: '#f59e0b' },
  { rect: LINEAGE_COLS[0], label: 'lineage-left', color: '#f59e0b' },
  { rect: LINEAGE_COLS[1], label: 'lineage-right', color: '#f59e0b' },
  { rect: BOTTOM_ROW, label: 'bottom-row', color: '#7c3aed' },
  { rect: CERTIFICATE_SLOTS.qr, label: 'slot-qr', color: '#7c3aed' }
];

export type CertificateStyleInput = {
  brandTitleZh: string;
  brandTitleEn: string;
  brandEyebrowZh: string;
  brandEyebrowEn: string;
  verificationStatementZh: string;
  certNo: string;
  issuedOnText: string;
  issuedOnChineseText: string;
  lineName: string;
  lineCode: string;
  lineFamily: string;
  damName: string;
  damCode: string;
  sireCode: string;
  damCodeValue: string;
  sireSireCode: string;
  sireDamCode: string;
  damSireCode: string;
  damDamCode: string;
  buyerName: string;
  buyerAccountId: string;
  sellerName: string;
  sellerAccountId: string;
  verifyId: string;
  watermarkText: string;
  debugGuides?: boolean;
  useExternalBackground?: boolean;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildDebugGuidesSvg(width: number, height: number): string {
  const step = 32;
  const lines: string[] = [];

  for (let x = step; x < width; x += step) {
    const major = x % 128 === 0;
    lines.push(
      `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="${
        major ? 'rgba(29,78,216,0.30)' : 'rgba(29,78,216,0.16)'
      }" stroke-width="${major ? '1.4' : '1'}"/>`
    );
    if (major) {
      lines.push(
        `<text x="${x + 3}" y="15" font-size="10" fill="rgba(30,64,175,0.82)" font-family="monospace">${x}</text>`
      );
    }
  }

  for (let y = step; y < height; y += step) {
    const major = y % 128 === 0;
    lines.push(
      `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${
        major ? 'rgba(29,78,216,0.30)' : 'rgba(29,78,216,0.16)'
      }" stroke-width="${major ? '1.4' : '1'}"/>`
    );
    if (major) {
      lines.push(
        `<text x="4" y="${y - 3}" font-size="10" fill="rgba(30,64,175,0.82)" font-family="monospace">${y}</text>`
      );
    }
  }

  return lines.join('');
}

function buildDebugBoxesSvg(boxes: DebugBox[]): string {
  return boxes
    .map(({ rect, label, color }) => {
      const textX = rect.x + 4;
      const textY = rect.y > 16 ? rect.y - 4 : rect.y + 12;
      return [
        `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" fill="none" stroke="${color}" stroke-width="1.4" stroke-dasharray="6 4"/>`,
        `<rect x="${textX - 2}" y="${textY - 10}" width="${label.length * 8 + 8}" height="12" fill="rgba(255,255,255,0.72)"/>`,
        `<text x="${textX}" y="${textY}" font-size="10" fill="${color}" font-family="monospace">${label} (${rect.x},${rect.y},${rect.width},${rect.height})</text>`
      ].join('');
    })
    .join('');
}

type PhotoFrameOptions = {
  margin: number;
  radius: number;
  strongShadow?: boolean;
};

function buildPhotoFrameSvg(slot: Rect, options: PhotoFrameOptions): string {
  const frameX = slot.x - options.margin;
  const frameY = slot.y - options.margin;
  const frameWidth = slot.width + options.margin * 2;
  const frameHeight = slot.height + options.margin * 2;
  const innerGap = options.strongShadow ? 5 : 4;
  const innerX = frameX + innerGap;
  const innerY = frameY + innerGap;
  const innerWidth = frameWidth - innerGap * 2;
  const innerHeight = frameHeight - innerGap * 2;
  const cornerSpan = options.strongShadow ? 18 : 14;
  const shadowFilter = options.strongShadow ? 'url(#photoShadowStrong)' : 'url(#photoShadowSoft)';
  const matGradient = options.strongShadow ? 'url(#frameMatStrong)' : 'url(#frameMatSoft)';
  const accent = options.strongShadow ? '#6e4b2a' : '#7a5a35';
  const highlight = options.strongShadow ? 'rgba(255,247,232,0.82)' : 'rgba(255,247,232,0.72)';
  const cornerX2 = frameX + frameWidth;
  const cornerY2 = frameY + frameHeight;
  const frameRadius = options.radius;
  const innerRadius = Math.max(6, options.radius - 2);
  const cornerOffset = 4;

  return `
  <g filter="${shadowFilter}">
    <rect x="${frameX}" y="${frameY}" width="${frameWidth}" height="${frameHeight}" rx="${frameRadius}" fill="${matGradient}" stroke="#8b6a44" stroke-width="2.6"/>
  </g>
  <rect x="${frameX + 1.5}" y="${frameY + 1.5}" width="${frameWidth - 3}" height="${frameHeight - 3}" rx="${Math.max(5, frameRadius - 1.5)}" fill="none" stroke="rgba(58,38,20,0.26)" stroke-width="1.2"/>
  <rect x="${innerX}" y="${innerY}" width="${innerWidth}" height="${innerHeight}" rx="${innerRadius}" fill="none" stroke="${highlight}" stroke-width="1.4"/>
  <path d="
    M ${frameX + cornerOffset} ${frameY + cornerOffset + cornerSpan} V ${frameY + cornerOffset} H ${frameX + cornerOffset + cornerSpan}
    M ${cornerX2 - cornerOffset - cornerSpan} ${frameY + cornerOffset} H ${cornerX2 - cornerOffset} V ${frameY + cornerOffset + cornerSpan}
    M ${frameX + cornerOffset} ${cornerY2 - cornerOffset - cornerSpan} V ${cornerY2 - cornerOffset} H ${frameX + cornerOffset + cornerSpan}
    M ${cornerX2 - cornerOffset - cornerSpan} ${cornerY2 - cornerOffset} H ${cornerX2 - cornerOffset} V ${cornerY2 - cornerOffset - cornerSpan}
  " fill="none" stroke="${accent}" stroke-width="1.6" stroke-linecap="round" opacity="0.62"/>
`;
}

export function buildCertificateDebugOverlaySvg(): string {
  const w = CERTIFICATE_CANVAS.width;
  const h = CERTIFICATE_CANVAS.height;
  const stampLabelX = STAMP_CENTER.x + 8;
  const stampLabelY = STAMP_CENTER.y - 10;

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <g id="debug-guides">
    ${buildDebugGuidesSvg(w, h)}
    ${buildDebugBoxesSvg(DEBUG_BOXES)}
    <line x1="${STAMP_CENTER.x}" y1="${STAMP_CENTER.y - 108}" x2="${STAMP_CENTER.x}" y2="${STAMP_CENTER.y + 108}" stroke="#dc2626" stroke-width="1.4" stroke-dasharray="5 3"/>
    <line x1="${STAMP_CENTER.x - 108}" y1="${STAMP_CENTER.y}" x2="${STAMP_CENTER.x + 108}" y2="${STAMP_CENTER.y}" stroke="#dc2626" stroke-width="1.4" stroke-dasharray="5 3"/>
    <text x="${stampLabelX}" y="${stampLabelY}" font-size="10" fill="#dc2626" font-family="monospace">stamp-center (${STAMP_CENTER.x},${STAMP_CENTER.y})</text>
    <line x1="0" y1="${FOOTER.lineY}" x2="${w}" y2="${FOOTER.lineY}" stroke="#dc2626" stroke-width="1.2" stroke-dasharray="5 3"/>
    <text x="8" y="${FOOTER.lineY - 4}" font-size="10" fill="#dc2626" font-family="monospace">footer-line y=${FOOTER.lineY}</text>
  </g>
</svg>`;
}

export function buildCertificateStyleSvg(input: CertificateStyleInput): string {
  const w = CERTIFICATE_CANVAS.width;
  const esc = (value: string) => escapeXml(value);
  const useExternalBackground = input.useExternalBackground === true;
  const fontTitle = "'STZhongsong','Songti SC','Noto Serif CJK SC','Source Han Serif SC','SimSun',serif";
  const fontMain = "'Songti SC','STSong','Noto Serif CJK SC','Source Han Serif SC','SimSun',serif";
  const fontLabel = "'Kaiti SC','STKaiti','KaiTi','Noto Serif CJK SC','Source Han Serif SC',serif";
  const fontCode = "'Baskerville','Palatino Linotype','Times New Roman','Georgia',serif";
  const panelFill = useExternalBackground ? 'none' : 'rgba(248,239,226,0.68)';

  const certNoY = useExternalBackground ? 304 : 236;
  const certNoFontSize = useExternalBackground ? 44 : 50;
  const issuedOnY = useExternalBackground ? 338 : 282;
  const issuedOnChineseY = useExternalBackground ? 362 : 314;
  const issuedOnFontSize = useExternalBackground ? 23 : 25;
  const issuedOnChineseFontSize = useExternalBackground ? 21 : 23;
  const topDividerY = useExternalBackground ? 388 : PAGE_LAYOUT.topDividerY;
  const lineageDividerY = 1138;

  const leftSummaryCenterX = SUMMARY_COLS[0].x + SUMMARY_COLS[0].width / 2;
  const rightSummaryCenterX = SUMMARY_COLS[1].x + SUMMARY_COLS[1].width / 2;
  const lineageLeftCenterX = LINEAGE_COLS[0].x + LINEAGE_COLS[0].width / 2;
  const lineageRightCenterX = LINEAGE_COLS[1].x + LINEAGE_COLS[1].width / 2;
  const summaryTitleY = SUMMARY_ROW.y + 28;
  const summaryNameY = SUMMARY_ROW.y + 64;
  const summaryCodeY = SUMMARY_ROW.y + 96;
  const summaryFamilyY = SUMMARY_ROW.y + 126;
  const subjectLabelY = SUBJECT_SLOT.y - 30;
  const subjectLabelBoxWidth = 110;
  const subjectLabelBoxHeight = 26;
  const subjectLabelBoxX = SUBJECT_SLOT.x + SUBJECT_SLOT.width / 2 - subjectLabelBoxWidth / 2;
  const subjectLabelBoxY = subjectLabelY - 19;
  const qrLabelY = QR_SLOT.y - 26;
  const lineageTitleY = LINEAGE_ROW.y - 18;
  const lineageLine1Y = LINEAGE_ROW.y + 18;
  const lineageLine2Y = LINEAGE_ROW.y + 46;
  const parentCodeY = SIRE_SLOT.y + SIRE_SLOT.height + 30;
  const buyerInfoY = BOTTOM_ROW.y + 112;
  const sellerInfoY = BOTTOM_ROW.y + 172;

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${CERTIFICATE_CANVAS.height}" viewBox="0 0 ${w} ${CERTIFICATE_CANVAS.height}">
  <style>
    .font-title { font-family: ${fontTitle}; }
    .font-main { font-family: ${fontMain}; }
    .font-label { font-family: ${fontLabel}; }
    .font-code { font-family: ${fontCode}; }
  </style>
  <defs>
    <linearGradient id="paper" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f6f0e4"/>
      <stop offset="100%" stop-color="#efe5d3"/>
    </linearGradient>
    <linearGradient id="frameMatSoft" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="rgba(252,247,236,0.86)"/>
      <stop offset="100%" stop-color="rgba(227,210,184,0.84)"/>
    </linearGradient>
    <linearGradient id="frameMatStrong" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="rgba(253,249,240,0.92)"/>
      <stop offset="100%" stop-color="rgba(221,196,161,0.90)"/>
    </linearGradient>
    <filter id="photoShadowSoft" x="-30%" y="-30%" width="180%" height="200%">
      <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#2f1f12" flood-opacity="0.22"/>
      <feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-color="#fffbf2" flood-opacity="0.48"/>
    </filter>
    <filter id="photoShadowStrong" x="-34%" y="-34%" width="188%" height="208%">
      <feDropShadow dx="0" dy="7" stdDeviation="6" flood-color="#2b1c10" flood-opacity="0.27"/>
      <feDropShadow dx="0" dy="1.4" stdDeviation="1.4" flood-color="#fff8ea" flood-opacity="0.56"/>
    </filter>
    <pattern id="grain" width="120" height="120" patternUnits="userSpaceOnUse">
      <circle cx="20" cy="16" r="1.2" fill="#e9dcc7" />
      <circle cx="78" cy="50" r="1" fill="#e6d7bf" />
      <circle cx="44" cy="95" r="1.1" fill="#e3d3ba" />
    </pattern>
  </defs>
  ${
    useExternalBackground
      ? ''
      : `
  <rect x="0" y="0" width="${w}" height="${CERTIFICATE_CANVAS.height}" fill="url(#paper)" />
  <rect x="0" y="0" width="${w}" height="${CERTIFICATE_CANVAS.height}" fill="url(#grain)" opacity="0.45" />

  <rect x="${PAGE_LAYOUT.outerFrame.x}" y="${PAGE_LAYOUT.outerFrame.y}" width="${PAGE_LAYOUT.outerFrame.width}" height="${PAGE_LAYOUT.outerFrame.height}" fill="none" stroke="#7c6240" stroke-width="2.6" rx="8"/>
  <rect x="${PAGE_LAYOUT.innerFrame.x}" y="${PAGE_LAYOUT.innerFrame.y}" width="${PAGE_LAYOUT.innerFrame.width}" height="${PAGE_LAYOUT.innerFrame.height}" fill="none" stroke="#b59872" stroke-width="1.8" rx="8"/>`
  }

  ${
    useExternalBackground
      ? ''
      : `<text x="${w / 2}" y="126" text-anchor="middle" font-size="64" font-weight="700" fill="#22170f" class="font-title">${esc(input.brandTitleZh)}</text>
  <text x="${w / 2}" y="172" text-anchor="middle" font-size="22" fill="#3d2f21" letter-spacing="1.1" class="font-code">${esc(input.brandEyebrowZh || input.brandTitleEn)}</text>`
  }

  <text x="${w / 2}" y="${certNoY}" text-anchor="middle" font-size="${certNoFontSize}" font-weight="700" fill="#2c2118" class="font-code">${esc(input.certNo)}</text>
  <text x="${w / 2}" y="${issuedOnY}" text-anchor="middle" font-size="${issuedOnFontSize}" fill="#4c3a2a" class="font-code">${esc(input.issuedOnText)}</text>
  <text x="${w / 2}" y="${issuedOnChineseY}" text-anchor="middle" font-size="${issuedOnChineseFontSize}" fill="#5b4934" class="font-label">${esc(input.issuedOnChineseText)}</text>

  <line x1="${PAGE_LAYOUT.content.x}" y1="${topDividerY}" x2="${PAGE_LAYOUT.content.x + PAGE_LAYOUT.content.width}" y2="${topDividerY}" stroke="#b79b74" stroke-width="1.6"/>
  <line x1="${PAGE_LAYOUT.content.x}" y1="${lineageDividerY}" x2="${PAGE_LAYOUT.content.x + PAGE_LAYOUT.content.width}" y2="${lineageDividerY}" stroke="#b79b74" stroke-width="1.3"/>

  <text x="${leftSummaryCenterX}" y="${summaryTitleY}" text-anchor="middle" font-size="24" font-weight="600" fill="#2d2318" class="font-label">系别 (Line):</text>
  <text x="${leftSummaryCenterX}" y="${summaryNameY}" text-anchor="middle" font-size="40" font-weight="700" fill="#2d2318" class="font-main">${esc(input.lineName)}</text>
  <text x="${leftSummaryCenterX}" y="${summaryCodeY}" text-anchor="middle" font-size="24" fill="#564531" class="font-code">编号: ${esc(input.lineCode)}</text>
  <text x="${leftSummaryCenterX}" y="${summaryFamilyY}" text-anchor="middle" font-size="24" fill="#564531" class="font-label">系别: ${esc(input.lineFamily)}</text>

  <text x="${rightSummaryCenterX}" y="${summaryTitleY}" text-anchor="middle" font-size="24" font-weight="600" fill="#2d2318" class="font-label">母系 (Dam):</text>
  <text x="${rightSummaryCenterX}" y="${summaryNameY}" text-anchor="middle" font-size="40" font-weight="700" fill="#2d2318" class="font-main">${esc(input.damName)}</text>
  <text x="${rightSummaryCenterX}" y="${summaryCodeY}" text-anchor="middle" font-size="24" fill="#564531" class="font-code">编号: ${esc(input.damCode)}</text>
  <text x="${rightSummaryCenterX}" y="${summaryFamilyY}" text-anchor="middle" font-size="24" fill="#564531" class="font-label">系别: ${esc(input.lineFamily)}</text>

  <rect x="${subjectLabelBoxX}" y="${subjectLabelBoxY}" width="${subjectLabelBoxWidth}" height="${subjectLabelBoxHeight}" rx="10" fill="rgba(250,244,233,0.92)" stroke="#b79b74" stroke-width="1.2"/>
  <text x="${SIRE_SLOT.x + SIRE_SLOT.width / 2}" y="${SIRE_SLOT.y - 18}" text-anchor="middle" font-size="22" fill="#4b3a28" class="font-label">父龟影像</text>
  <text x="${DAM_SLOT.x + DAM_SLOT.width / 2}" y="${DAM_SLOT.y - 18}" text-anchor="middle" font-size="22" fill="#4b3a28" class="font-label">母龟影像</text>
  <text x="${SUBJECT_SLOT.x + SUBJECT_SLOT.width / 2}" y="${subjectLabelY}" text-anchor="middle" font-size="20" fill="#4b3a28" class="font-label">主体个体</text>

  ${buildPhotoFrameSvg(CERTIFICATE_SLOTS.subject, { margin: 12, radius: 14, strongShadow: true })}
  ${buildPhotoFrameSvg(CERTIFICATE_SLOTS.sire, { margin: 11, radius: 12 })}
  ${buildPhotoFrameSvg(CERTIFICATE_SLOTS.dam, { margin: 11, radius: 12 })}
  <rect x="${CERTIFICATE_SLOTS.sire.x}" y="${CERTIFICATE_SLOTS.sire.y}" width="${CERTIFICATE_SLOTS.sire.width}" height="${CERTIFICATE_SLOTS.sire.height}" fill="${panelFill}" stroke="none" rx="9"/>
  <rect x="${CERTIFICATE_SLOTS.dam.x}" y="${CERTIFICATE_SLOTS.dam.y}" width="${CERTIFICATE_SLOTS.dam.width}" height="${CERTIFICATE_SLOTS.dam.height}" fill="${panelFill}" stroke="none" rx="9"/>

  <text x="${SIRE_SLOT.x + SIRE_SLOT.width / 2}" y="${parentCodeY}" text-anchor="middle" font-size="21" fill="#3f3122" class="font-code">公龟编号: ${esc(input.sireCode)}</text>
  <text x="${DAM_SLOT.x + DAM_SLOT.width / 2}" y="${parentCodeY}" text-anchor="middle" font-size="21" fill="#3f3122" class="font-code">母龟编号: ${esc(input.damCodeValue)}</text>

  <text x="${w / 2}" y="${lineageTitleY}" text-anchor="middle" font-size="32" font-weight="600" fill="#2c2117" class="font-title">祖代信息</text>
  <text x="${lineageLeftCenterX}" y="${lineageLine1Y}" text-anchor="middle" font-size="20" fill="#4f3f2d" class="font-code">祖父 (Sire&apos;s Sire): ${esc(input.sireSireCode)}</text>
  <text x="${lineageLeftCenterX}" y="${lineageLine2Y}" text-anchor="middle" font-size="20" fill="#4f3f2d" class="font-code">祖母 (Sire&apos;s Dam): ${esc(input.sireDamCode)}</text>
  <text x="${lineageRightCenterX}" y="${lineageLine1Y}" text-anchor="middle" font-size="20" fill="#4f3f2d" class="font-code">外祖父 (Dam&apos;s Sire): ${esc(input.damSireCode)}</text>
  <text x="${lineageRightCenterX}" y="${lineageLine2Y}" text-anchor="middle" font-size="20" fill="#4f3f2d" class="font-code">外祖母 (Dam&apos;s Dam): ${esc(input.damDamCode)}</text>

  <text x="${QR_SLOT.x + QR_SLOT.width / 2}" y="${qrLabelY}" text-anchor="middle" font-size="20" fill="#4b3a28" class="font-label">验真二维码</text>
  <rect x="${CERTIFICATE_SLOTS.qr.x - 6}" y="${CERTIFICATE_SLOTS.qr.y - 6}" width="${CERTIFICATE_SLOTS.qr.width + 12}" height="${CERTIFICATE_SLOTS.qr.height + 12}" fill="none" stroke="#8f7451" stroke-width="2" rx="8"/>

  <g transform="translate(${STAMP_CENTER.x},${STAMP_CENTER.y})">
    <circle cx="0" cy="0" r="82" fill="none" stroke="#8f2f28" stroke-width="7.6"/>
    <circle cx="0" cy="0" r="61" fill="none" stroke="#8f2f28" stroke-width="3.3"/>
    <text x="0" y="-10" text-anchor="middle" font-size="22" font-weight="700" fill="#8f2f28" class="font-title">${esc(input.brandTitleZh)}</text>
    <text x="0" y="34" text-anchor="middle" font-size="40" font-weight="700" fill="#8f2f28" class="font-title">认证</text>
  </g>

  <text x="${w / 2}" y="${buyerInfoY}" text-anchor="middle" font-size="23" font-weight="600" fill="#2d2318" class="font-label">购买人: ${esc(input.buyerName)}</text>
  <text x="${w / 2}" y="${buyerInfoY + 24}" text-anchor="middle" font-size="18" fill="#4f3f2d" class="font-code">账号ID: ${esc(input.buyerAccountId)}</text>
  <text x="${w / 2}" y="${sellerInfoY}" text-anchor="middle" font-size="23" font-weight="600" fill="#2d2318" class="font-label">出售人: ${esc(input.sellerName)}</text>
  <text x="${w / 2}" y="${sellerInfoY + 24}" text-anchor="middle" font-size="18" fill="#4f3f2d" class="font-code">账号ID: ${esc(input.sellerAccountId)}</text>

  <line x1="${PAGE_LAYOUT.content.x + 28}" y1="${FOOTER.lineY}" x2="${PAGE_LAYOUT.content.x + PAGE_LAYOUT.content.width - 28}" y2="${FOOTER.lineY}" stroke="#c7b294" stroke-width="1.2"/>
  <text x="${w / 2}" y="${FOOTER.watermarkY}" text-anchor="middle" font-size="21" fill="#4d3c2b" class="font-label">${esc(input.verificationStatementZh)}</text>
  <text x="${w / 2}" y="${FOOTER.verifyY}" text-anchor="middle" font-size="19" fill="#5f4d38" class="font-code">Verify ID: ${esc(input.verifyId)}</text>
</svg>`;
}
