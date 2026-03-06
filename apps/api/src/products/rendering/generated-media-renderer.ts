import { createHash } from 'node:crypto';

import sharp from 'sharp';

import {
  buildCertificateStyleSvg,
  buildCertificateDebugOverlaySvg,
  CERTIFICATE_BACKGROUND_SLOTS,
  CERTIFICATE_CANVAS,
  CERTIFICATE_SLOTS,
  type CertificateStyleInput
} from './certificate-style';
import {
  buildCouplePhotoStyleSvg,
  COUPLE_PHOTO_CANVAS,
  COUPLE_PHOTO_SLOTS,
  type CouplePhotoStyleInput
} from './couple-photo-style';

type SlotRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CertificateRenderInput = {
  style: CertificateStyleInput;
  verifyUrl: string;
  backgroundImage?: Buffer | null;
  backgroundMode?: 'full' | 'bottom' | 'tiled';
  subjectImage?: Buffer | null;
  sireImage?: Buffer | null;
  damImage?: Buffer | null;
};

type CouplePhotoRenderInput = {
  style: CouplePhotoStyleInput;
  femaleImage?: Buffer | null;
  maleImage?: Buffer | null;
};

async function buildImageLayer(image: Buffer | null | undefined, slot: SlotRect) {
  if (!image) {
    return null;
  }

  const buffer = await sharp(image)
    .rotate()
    .resize(slot.width, slot.height, {
      fit: 'cover'
    })
    .png()
    .toBuffer();

  return {
    input: buffer,
    left: slot.x,
    top: slot.y
  };
}

async function buildCanvasBackgroundLayer(
  image: Buffer | null | undefined,
  width: number,
  height: number
): Promise<sharp.OverlayOptions | null> {
  if (!image) {
    return null;
  }

  const buffer = await sharp(image)
    .rotate()
    .resize(width, height, {
      fit: 'cover',
      position: 'centre'
    })
    .png()
    .toBuffer();

  return {
    input: buffer,
    left: 0,
    top: 0
  };
}

async function buildBottomDecorationLayer(image: Buffer | null | undefined): Promise<sharp.OverlayOptions | null> {
  if (!image) {
    return null;
  }

  const slot = CERTIFICATE_BACKGROUND_SLOTS.bottom;
  const tileWidth = Math.max(180, Math.round(slot.width / 3.6));
  const tileHeight = Math.round((tileWidth * 3) / 2);
  const tileBuffer = await sharp(image)
    .rotate()
    .resize(tileWidth, tileHeight, {
      fit: 'cover',
      position: 'centre'
    })
    .png()
    .toBuffer();

  const rows = Math.ceil(slot.height / tileHeight) + 1;
  const cols = Math.ceil(slot.width / tileWidth) + 2;
  const tileComposites: sharp.OverlayOptions[] = [];

  for (let row = 0; row < rows; row += 1) {
    const rowOffsetX = row % 2 === 0 ? 0 : -Math.round(tileWidth / 2);
    for (let col = 0; col < cols; col += 1) {
      const left = rowOffsetX + col * tileWidth;
      const top = row * tileHeight;
      if (left >= slot.width || left + tileWidth <= 0 || top >= slot.height) {
        continue;
      }

      tileComposites.push({
        input: tileBuffer,
        left,
        top
      });
    }
  }

  const buffer = await sharp({
    create: {
      width: slot.width,
      height: slot.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite(tileComposites)
    .png()
    .toBuffer();

  return {
    input: buffer,
    left: slot.x,
    top: slot.y,
    blend: 'multiply'
  };
}

async function buildTiledBackgroundLayer(
  image: Buffer | null | undefined,
  width: number,
  height: number
): Promise<sharp.OverlayOptions | null> {
  if (!image) {
    return null;
  }

  const tileWidth = Math.max(260, Math.round(width / 2.9));
  const tileHeight = Math.round((tileWidth * 3) / 2);
  const tileBuffer = await sharp(image)
    .rotate()
    .resize(tileWidth, tileHeight, {
      fit: 'cover',
      position: 'centre'
    })
    .modulate({
      brightness: 1.08,
      saturation: 0.52
    })
    .blur(0.5)
    .ensureAlpha(0.26)
    .png()
    .toBuffer();

  const rows = Math.ceil(height / tileHeight) + 1;
  const cols = Math.ceil(width / tileWidth) + 2;
  const composites: sharp.OverlayOptions[] = [];

  for (let row = 0; row < rows; row += 1) {
    const offsetX = row % 2 === 0 ? 0 : -Math.round(tileWidth / 2);
    for (let col = 0; col < cols; col += 1) {
      const left = offsetX + col * tileWidth;
      const top = row * tileHeight;
      if (left >= width || left + tileWidth <= 0 || top >= height) {
        continue;
      }

      composites.push({
        input: tileBuffer,
        left,
        top
      });
    }
  }

  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite(composites)
    .png()
    .toBuffer();

  return {
    input: buffer,
    left: 0,
    top: 0,
    blend: 'multiply'
  };
}

function buildPseudoQrSvg(payload: string, size: number): string {
  const modules = 33;
  const seed = createHash('sha256').update(payload).digest();
  const bits: number[] = [];
  for (const byte of seed.values()) {
    for (let index = 0; index < 8; index += 1) {
      bits.push((byte >> index) & 1);
    }
  }

  const finderOrigins = [
    [0, 0],
    [modules - 7, 0],
    [0, modules - 7]
  ];

  const rects: string[] = [];

  const drawFinder = (ox: number, oy: number) => {
    rects.push(`<rect x="${ox}" y="${oy}" width="7" height="7" fill="#111"/>`);
    rects.push(`<rect x="${ox + 1}" y="${oy + 1}" width="5" height="5" fill="#fff"/>`);
    rects.push(`<rect x="${ox + 2}" y="${oy + 2}" width="3" height="3" fill="#111"/>`);
  };
  for (const [ox, oy] of finderOrigins) {
    drawFinder(ox, oy);
  }

  let bitIndex = 0;
  for (let y = 0; y < modules; y += 1) {
    for (let x = 0; x < modules; x += 1) {
      const inFinder = finderOrigins.some(([ox, oy]) => x >= ox && x <= ox + 6 && y >= oy && y <= oy + 6);
      if (inFinder || x === 6 || y === 6) {
        continue;
      }

      if (bits[bitIndex % bits.length] === 1) {
        rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="#111"/>`);
      }
      bitIndex += 1;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${modules} ${modules}">${rects.join('')}</svg>`;
}

async function createQrBuffer(payload: string, size: number): Promise<Buffer> {
  try {
    // Prefer real QR code generation when dependency exists.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const qrCode = require('qrcode') as {
      toBuffer: (value: string, options?: Record<string, unknown>) => Promise<Buffer>;
    };
    return await qrCode.toBuffer(payload, {
      type: 'png',
      width: size,
      margin: 0,
      color: {
        dark: '#1a120bff',
        light: '#00000000'
      }
    });
  } catch {
    const pseudoSvg = buildPseudoQrSvg(payload, size);
    return sharp(Buffer.from(pseudoSvg)).png().toBuffer();
  }
}

export async function renderCertificatePng(input: CertificateRenderInput): Promise<Buffer> {
  const backgroundMode = input.backgroundMode ?? 'full';
  const useExternalBackground = Boolean(input.backgroundImage);
  const styleSvg = Buffer.from(
    buildCertificateStyleSvg({
      ...input.style,
      useExternalBackground
    })
  );
  const debugOverlay = input.style.debugGuides ? Buffer.from(buildCertificateDebugOverlaySvg()) : null;
  const qrBuffer = await createQrBuffer(input.verifyUrl, CERTIFICATE_SLOTS.qr.width);

  const [backgroundLayer, bottomDecorationLayer, subjectLayer, sireLayer, damLayer] = await Promise.all([
    backgroundMode === 'full'
      ? buildCanvasBackgroundLayer(input.backgroundImage, CERTIFICATE_CANVAS.width, CERTIFICATE_CANVAS.height)
      : backgroundMode === 'tiled'
        ? buildTiledBackgroundLayer(input.backgroundImage, CERTIFICATE_CANVAS.width, CERTIFICATE_CANVAS.height)
      : Promise.resolve(null),
    backgroundMode === 'bottom' ? buildBottomDecorationLayer(input.backgroundImage) : Promise.resolve(null),
    buildImageLayer(input.subjectImage, CERTIFICATE_SLOTS.subject),
    buildImageLayer(input.sireImage, CERTIFICATE_SLOTS.sire),
    buildImageLayer(input.damImage, CERTIFICATE_SLOTS.dam)
  ]);

  const composites: Array<sharp.OverlayOptions | null> = [
    backgroundLayer,
    { input: styleSvg, top: 0, left: 0 },
    bottomDecorationLayer,
    subjectLayer,
    sireLayer,
    damLayer,
    {
      input: qrBuffer,
      left: CERTIFICATE_SLOTS.qr.x,
      top: CERTIFICATE_SLOTS.qr.y
    },
    debugOverlay ? { input: debugOverlay, top: 0, left: 0 } : null
  ];

  return sharp({
    create: {
      width: CERTIFICATE_CANVAS.width,
      height: CERTIFICATE_CANVAS.height,
      channels: 4,
      background: '#f6f0e4'
    }
  })
    .composite(composites.filter((item): item is sharp.OverlayOptions => Boolean(item)))
    .png()
    .toBuffer();
}

export async function renderCouplePhotoPng(input: CouplePhotoRenderInput): Promise<Buffer> {
  const styleSvg = Buffer.from(buildCouplePhotoStyleSvg(input.style));
  const qrPayload = `couple:${input.style.femaleCode}:${input.style.maleCode}:${input.style.generatedAtLabel}`;

  const [femaleLayer, maleLayer, qrBuffer] = await Promise.all([
    buildImageLayer(input.femaleImage, COUPLE_PHOTO_SLOTS.female),
    buildImageLayer(input.maleImage, COUPLE_PHOTO_SLOTS.male),
    createQrBuffer(qrPayload, COUPLE_PHOTO_SLOTS.qr.width)
  ]);

  const composites: Array<sharp.OverlayOptions | null> = [
    { input: styleSvg, top: 0, left: 0 },
    femaleLayer,
    maleLayer,
    {
      input: qrBuffer,
      left: COUPLE_PHOTO_SLOTS.qr.x,
      top: COUPLE_PHOTO_SLOTS.qr.y
    }
  ];

  return sharp({
    create: {
      width: COUPLE_PHOTO_CANVAS.width,
      height: COUPLE_PHOTO_CANVAS.height,
      channels: 4,
      background: '#1f2b35'
    }
  })
    .composite(composites.filter((item): item is sharp.OverlayOptions => Boolean(item)))
    .png()
    .toBuffer();
}
