import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

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
  qrPayloadUrl: string;
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
  backgroundImage?: Buffer | null;
  qrPayload?: string;
};

type CouplePhotoRenderLayout = {
  canvasWidth: number;
  canvasHeight: number;
  contentTopOffset: number;
};

let couplePhotoBackgroundCache: Buffer | null | undefined;
let certificateBackgroundCache: Buffer | null | undefined;

async function loadDefaultCertificateBackground(): Promise<Buffer | null> {
  if (certificateBackgroundCache !== undefined) {
    return certificateBackgroundCache;
  }

  const candidates = [
    resolve(process.cwd(), 'apps/api/src/products/rendering/assets/certificate-background.png'),
    resolve(process.cwd(), 'src/products/rendering/assets/certificate-background.png'),
    resolve(__dirname, 'assets/certificate-background.png')
  ];

  for (const candidate of candidates) {
    try {
      const buffer = await readFile(candidate);
      certificateBackgroundCache = buffer;
      return buffer;
    } catch {
      continue;
    }
  }

  certificateBackgroundCache = null;
  return null;
}

async function loadDefaultCouplePhotoBackground(): Promise<Buffer | null> {
  if (couplePhotoBackgroundCache !== undefined) {
    return couplePhotoBackgroundCache;
  }

  const candidates = [
    resolve(process.cwd(), 'apps/api/src/products/rendering/assets/couple-photo-background.png'),
    resolve(process.cwd(), 'src/products/rendering/assets/couple-photo-background.png'),
    resolve(__dirname, 'assets/couple-photo-background.png')
  ];

  for (const candidate of candidates) {
    try {
      const buffer = await readFile(candidate);
      couplePhotoBackgroundCache = buffer;
      return buffer;
    } catch {
      continue;
    }
  }

  couplePhotoBackgroundCache = null;
  return null;
}

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

async function resolveCouplePhotoRenderLayout(
  backgroundImage: Buffer | null | undefined
): Promise<CouplePhotoRenderLayout> {
  const canvasWidth = COUPLE_PHOTO_CANVAS.width;
  const baseCanvasHeight = COUPLE_PHOTO_CANVAS.height;
  if (!backgroundImage) {
    return {
      canvasWidth,
      canvasHeight: baseCanvasHeight,
      contentTopOffset: 0
    };
  }

  try {
    const metadata = await sharp(backgroundImage).rotate().metadata();
    if (!metadata.width || !metadata.height || metadata.width <= 0 || metadata.height <= 0) {
      return {
        canvasWidth,
        canvasHeight: baseCanvasHeight,
        contentTopOffset: 0
      };
    }

    const computedHeight = Math.round((canvasWidth * metadata.height) / metadata.width);
    const canvasHeight = Math.max(baseCanvasHeight, computedHeight);
    return {
      canvasWidth,
      canvasHeight,
      contentTopOffset: Math.max(0, Math.round((canvasHeight - baseCanvasHeight) / 2))
    };
  } catch {
    return {
      canvasWidth,
      canvasHeight: baseCanvasHeight,
      contentTopOffset: 0
    };
  }
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

async function createQrBuffer(payload: string, size: number): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const qrCode = require('qrcode') as {
    toBuffer: (value: string, options?: Record<string, unknown>) => Promise<Buffer>;
  };

  return await qrCode.toBuffer(payload, {
    type: 'png',
    width: size,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#1a120bff',
      light: '#ffffffff'
    }
  });
}

export async function renderCertificatePng(input: CertificateRenderInput): Promise<Buffer> {
  const backgroundImage = await (
    input.backgroundImage !== undefined
      ? Promise.resolve(input.backgroundImage)
      : loadDefaultCertificateBackground()
  );
  const backgroundMode = input.backgroundMode ?? 'full';
  const useExternalBackground = Boolean(backgroundImage);
  const styleSvg = Buffer.from(
    buildCertificateStyleSvg({
      ...input.style,
      useExternalBackground
    })
  );
  const debugOverlay = input.style.debugGuides ? Buffer.from(buildCertificateDebugOverlaySvg()) : null;
  const qrBuffer = await createQrBuffer(input.qrPayloadUrl, CERTIFICATE_SLOTS.qr.width);

  const [backgroundLayer, bottomDecorationLayer, subjectLayer, sireLayer, damLayer] = await Promise.all([
    backgroundMode === 'full'
      ? buildCanvasBackgroundLayer(backgroundImage, CERTIFICATE_CANVAS.width, CERTIFICATE_CANVAS.height)
      : backgroundMode === 'tiled'
        ? buildTiledBackgroundLayer(backgroundImage, CERTIFICATE_CANVAS.width, CERTIFICATE_CANVAS.height)
      : Promise.resolve(null),
    backgroundMode === 'bottom' ? buildBottomDecorationLayer(backgroundImage) : Promise.resolve(null),
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
  const backgroundImage = await (
    input.backgroundImage !== undefined
      ? Promise.resolve(input.backgroundImage)
      : loadDefaultCouplePhotoBackground()
  );
  const layout = await resolveCouplePhotoRenderLayout(backgroundImage);
  const styleSvg = Buffer.from(buildCouplePhotoStyleSvg(input.style));
  const qrPayload =
    input.qrPayload?.trim() ||
    `couple:${input.style.femaleCode}:${input.style.maleCode}:${input.style.generatedAtLabel}`;

  const femaleSlot = {
    ...COUPLE_PHOTO_SLOTS.female,
    y: COUPLE_PHOTO_SLOTS.female.y + layout.contentTopOffset
  };
  const maleSlot = {
    ...COUPLE_PHOTO_SLOTS.male,
    y: COUPLE_PHOTO_SLOTS.male.y + layout.contentTopOffset
  };
  const qrSlot = {
    ...COUPLE_PHOTO_SLOTS.qr,
    y: COUPLE_PHOTO_SLOTS.qr.y + layout.contentTopOffset
  };

  const [backgroundLayer, femaleLayer, maleLayer, qrBuffer] = await Promise.all([
    buildCanvasBackgroundLayer(
      backgroundImage,
      layout.canvasWidth,
      layout.canvasHeight
    ),
    buildImageLayer(input.femaleImage, femaleSlot),
    buildImageLayer(input.maleImage, maleSlot),
    createQrBuffer(qrPayload, qrSlot.width)
  ]);

  const composites: Array<sharp.OverlayOptions | null> = [
    backgroundLayer,
    { input: styleSvg, top: layout.contentTopOffset, left: 0 },
    femaleLayer,
    maleLayer,
    {
      input: qrBuffer,
      left: qrSlot.x,
      top: qrSlot.y
    }
  ];

  return sharp({
    create: {
      width: layout.canvasWidth,
      height: layout.canvasHeight,
      channels: 4,
      background: '#f6f0e4'
    }
  })
    .composite(composites.filter((item): item is sharp.OverlayOptions => Boolean(item)))
    .png()
    .toBuffer();
}
