'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Product, ProductFamilyTree } from '@eggturtle/shared';

import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

type CertificateForm = {
  certNo: string;
  issuedOn: string;
  species: string;
  chineseName: string;
  sex: string;
  line: string;
  sireCode: string;
  damCode: string;
  sireSireCode: string;
  sireDamCode: string;
  damSireCode: string;
  damDamCode: string;
  verifyId: string;
  verifyNote: string;
};

type Props = {
  breeder: Product | null;
  tree: ProductFamilyTree | null;
};

const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 1536;

export function TurtleCertificateGenerator({ breeder, tree }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [templateDataUrl, setTemplateDataUrl] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [renderError, setRenderError] = useState<string | null>(null);
  const [form, setForm] = useState<CertificateForm>(() => buildDefaultForm(null, null));

  useEffect(() => {
    setForm((current) => {
      const next = buildDefaultForm(breeder, tree);
      return {
        ...next,
        certNo: current.certNo || next.certNo,
        issuedOn: current.issuedOn || next.issuedOn,
        species: current.species || next.species,
        chineseName: current.chineseName || next.chineseName,
        sex: current.sex || next.sex,
        line: current.line || next.line,
        sireCode: current.sireCode || next.sireCode,
        damCode: current.damCode || next.damCode,
        sireSireCode: current.sireSireCode || next.sireSireCode,
        sireDamCode: current.sireDamCode || next.sireDamCode,
        damSireCode: current.damSireCode || next.damSireCode,
        damDamCode: current.damDamCode || next.damDamCode,
        verifyId: current.verifyId || next.verifyId,
        verifyNote: current.verifyNote || next.verifyNote
      };
    });
  }, [breeder, tree]);

  const canRender = useMemo(() => Boolean(templateDataUrl), [templateDataUrl]);

  const redraw = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setRenderError('无法初始化 Canvas。');
      return;
    }

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (templateDataUrl) {
      try {
        const bg = await loadImage(templateDataUrl);
        ctx.drawImage(bg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      } catch {
        drawFallbackBackground(ctx);
      }
    } else {
      drawFallbackBackground(ctx);
    }

    if (qrDataUrl) {
      try {
        const qr = await loadImage(qrDataUrl);
        ctx.drawImage(qr, 810, 1110, 170, 170);
      } catch {
        drawQrPlaceholder(ctx);
      }
    } else {
      drawQrPlaceholder(ctx);
    }

    drawCertificateText(ctx, form);
    setRenderError(null);
  }, [form, qrDataUrl, templateDataUrl]);

  useEffect(() => {
    void redraw();
  }, [redraw]);

  async function handleTemplateUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setTemplateDataUrl(await readFileAsDataUrl(file));
  }

  async function handleQrUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setQrDataUrl(await readFileAsDataUrl(file));
  }

  function handleFormChange<K extends keyof CertificateForm>(key: K, value: CertificateForm[K]) {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  function handleResetFromCurrent() {
    setForm(buildDefaultForm(breeder, tree));
  }

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const link = document.createElement('a');
    const code = (form.certNo || breeder?.code || 'certificate').replace(/[^a-zA-Z0-9_-]/g, '-');
    link.download = `${code}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  return (
    <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
      <CardHeader>
        <CardTitle className="text-2xl">血统证书生成</CardTitle>
        <CardDescription>上传证书底图后，在前端填写字段即可排版并下载 PNG。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-neutral-800">证书模板底图</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleTemplateUpload}
              className="block w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-neutral-800">二维码图片（可选）</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleQrUpload}
              className="block w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Field label="证书编号" value={form.certNo} onChange={(value) => handleFormChange('certNo', value)} />
          <Field label="签发日期" value={form.issuedOn} onChange={(value) => handleFormChange('issuedOn', value)} />
          <Field label="物种" value={form.species} onChange={(value) => handleFormChange('species', value)} />
          <Field label="中文名" value={form.chineseName} onChange={(value) => handleFormChange('chineseName', value)} />
          <Field label="性别" value={form.sex} onChange={(value) => handleFormChange('sex', value)} />
          <Field label="系别" value={form.line} onChange={(value) => handleFormChange('line', value)} />
          <Field label="父本 (Sire)" value={form.sireCode} onChange={(value) => handleFormChange('sireCode', value)} />
          <Field label="母本 (Dam)" value={form.damCode} onChange={(value) => handleFormChange('damCode', value)} />
          <Field
            label="祖父 (Sire's Sire)"
            value={form.sireSireCode}
            onChange={(value) => handleFormChange('sireSireCode', value)}
          />
          <Field
            label="祖母 (Sire's Dam)"
            value={form.sireDamCode}
            onChange={(value) => handleFormChange('sireDamCode', value)}
          />
          <Field
            label="外祖父 (Dam's Sire)"
            value={form.damSireCode}
            onChange={(value) => handleFormChange('damSireCode', value)}
          />
          <Field
            label="外祖母 (Dam's Dam)"
            value={form.damDamCode}
            onChange={(value) => handleFormChange('damDamCode', value)}
          />
          <Field label="验真 ID" value={form.verifyId} onChange={(value) => handleFormChange('verifyId', value)} />
          <Field
            label="验真提示文案"
            value={form.verifyNote}
            onChange={(value) => handleFormChange('verifyNote', value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={handleResetFromCurrent}>
            用当前种龟数据重置字段
          </Button>
          <Button type="button" variant="primary" onClick={handleDownload} disabled={!canRender}>
            下载证书 PNG
          </Button>
        </div>

        {renderError ? <p className="text-sm font-medium text-red-600">{renderError}</p> : null}
        {!canRender ? <p className="text-sm text-amber-700">请先上传一张证书模板底图。</p> : null}

        <div className="overflow-auto rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
          <canvas ref={canvasRef} className="mx-auto h-auto max-w-full rounded-md border border-neutral-200 bg-white" />
        </div>
      </CardContent>
    </Card>
  );
}

function Field(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium text-neutral-700">{props.label}</span>
      <input
        type="text"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="block w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
      />
    </label>
  );
}

function buildDefaultForm(breeder: Product | null, tree: ProductFamilyTree | null): CertificateForm {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const shortCode = (breeder?.code || 'XT').replace(/[^A-Za-z0-9-]/g, '').slice(0, 12) || 'XT';
  return {
    certNo: `EG-${y}${m}${d}-${shortCode}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    issuedOn: `${y}-${m}-${d}`,
    species: 'Claudius angustatus',
    chineseName: breeder?.name || '窄桥蛋龟',
    sex: mapSex(breeder?.sex),
    line: breeder?.seriesId || '未设置',
    sireCode: breeder?.sireCode || tree?.links.sire?.code || '未登记',
    damCode: breeder?.damCode || tree?.links.dam?.code || '未登记',
    sireSireCode: '未登记',
    sireDamCode: '未登记',
    damSireCode: '未登记',
    damDamCode: '未登记',
    verifyId: Math.random().toString(36).slice(2, 10).toUpperCase(),
    verifyNote: '扫码溯源'
  };
}

function mapSex(raw: string | null | undefined) {
  if (raw === 'male') {
    return '雄性 / Male';
  }
  if (raw === 'female') {
    return '雌性 / Female';
  }
  return '未知 / Unknown';
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片加载失败'));
    image.src = src;
  });
}

function drawFallbackBackground(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#f2ebdc';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.strokeStyle = '#b79f6d';
  ctx.lineWidth = 2;
  ctx.strokeRect(22, 22, CANVAS_WIDTH - 44, CANVAS_HEIGHT - 44);
}

function drawQrPlaceholder(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.strokeStyle = '#8b7a55';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(810, 1110, 170, 170);
  ctx.font = '600 20px serif';
  ctx.fillStyle = '#6f6042';
  ctx.textAlign = 'center';
  ctx.fillText('扫码溯源', 895, 1305);
  ctx.restore();
}

function drawCertificateText(ctx: CanvasRenderingContext2D, form: CertificateForm) {
  drawCenter(ctx, '蛋龟选育库', 120, 62, true);
  drawCenter(ctx, 'TURTLE BREEDING ARCHIVE', 168, 36, false);
  drawCenter(ctx, '选育溯源档案', 218, 38, true);
  drawCenter(ctx, 'BREEDING TRACEABILITY RECORD', 256, 26, false);

  drawCenter(ctx, form.certNo, 355, 46, true);
  drawCenter(ctx, `Issued on ${form.issuedOn}`, 402, 28, false);

  drawKV(ctx, '物种 Species', form.species, 110, 470);
  drawKV(ctx, '中文名 Name', form.chineseName, 110, 540);
  drawKV(ctx, '性别 Sex', form.sex, 110, 610);
  drawKV(ctx, '系别 Line', form.line, 110, 680);

  drawKV(ctx, '父本 (Sire)', form.sireCode, 110, 810);
  drawKV(ctx, '母本 (Dam)', form.damCode, 550, 810);
  drawKV(ctx, "祖父 (Sire's Sire)", form.sireSireCode, 110, 900);
  drawKV(ctx, "祖母 (Sire's Dam)", form.sireDamCode, 110, 980);
  drawKV(ctx, "外祖父 (Dam's Sire)", form.damSireCode, 550, 900);
  drawKV(ctx, "外祖母 (Dam's Dam)", form.damDamCode, 550, 980);

  drawCenter(ctx, '本证书内容由蛋龟选育库生成，扫码可查验档案真实性。', 1390, 24, false);

  ctx.save();
  ctx.fillStyle = '#574a31';
  ctx.font = '500 24px serif';
  ctx.textAlign = 'center';
  ctx.fillText(form.verifyNote, 895, 1328);
  ctx.font = '600 22px serif';
  ctx.fillText(form.verifyId, 895, 1360);
  ctx.restore();
}

function drawCenter(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  size: number,
  bold: boolean
) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#3f3323';
  ctx.font = `${bold ? 700 : 500} ${size}px serif`;
  ctx.fillText(text, CANVAS_WIDTH / 2, y);
  ctx.restore();
}

function drawKV(ctx: CanvasRenderingContext2D, label: string, value: string, x: number, y: number) {
  ctx.save();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#62553d';
  ctx.font = '500 24px serif';
  ctx.fillText(label, x, y);
  ctx.fillStyle = '#2e2416';
  ctx.font = '700 30px serif';
  ctx.fillText(value || '未登记', x, y + 40);
  ctx.restore();
}
