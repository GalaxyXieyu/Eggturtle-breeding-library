'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { Home, QrCode, X } from 'lucide-react';
import QRCode from 'qrcode';

import { cn } from '../../../lib/utils';

type PublicFloatingActionsProps = {
  permalink: string;
  homeHref?: string;
  showHomeButton?: boolean;
  className?: string;
};

export default function PublicFloatingActions({
  permalink,
  homeHref = '/app',
  showHomeButton = true,
  className
}: PublicFloatingActionsProps) {
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Generate QR locally to avoid leaking share links to third-party QR services.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const dataUrl = await QRCode.toDataURL(permalink, {
          width: 240,
          margin: 1,
          errorCorrectionLevel: 'M'
        });
        if (!cancelled) {
          setQrDataUrl(dataUrl);
        }
      } catch {
        if (!cancelled) {
          setQrDataUrl(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [permalink]);

  const qrAlt = useMemo(() => '当前页二维码', []);

  return (
    <>
      <div
        className={cn(
          'fixed right-4 z-40 flex flex-col gap-2 sm:right-6',
          showHomeButton ? 'bottom-5 sm:bottom-6' : 'bottom-[calc(env(safe-area-inset-bottom)+68px)] sm:bottom-[calc(env(safe-area-inset-bottom)+76px)]',
          className
        )}
      >
        <button
          type="button"
          aria-label="当前页二维码"
          title="当前页二维码"
          onClick={() => setQrOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/92 text-neutral-800 shadow-[0_8px_24px_rgba(0,0,0,0.16)] backdrop-blur transition hover:scale-[1.03] hover:bg-white dark:border-white/15 dark:bg-neutral-900/88 dark:text-neutral-100"
        >
          <QrCode size={18} />
        </button>

        {showHomeButton ? (
          <a
            href={homeHref}
            aria-label="进入后台"
            title="进入后台"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/92 text-neutral-800 shadow-[0_8px_24px_rgba(0,0,0,0.16)] backdrop-blur transition hover:scale-[1.03] hover:bg-white dark:border-white/15 dark:bg-neutral-900/88 dark:text-neutral-100"
          >
            <Home size={18} />
          </a>
        ) : null}
      </div>

      {qrOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-xs rounded-2xl border border-black/10 bg-white p-4 text-center shadow-2xl dark:border-white/10 dark:bg-neutral-900">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">当前页永久链接二维码</p>
              <button
                type="button"
                aria-label="关闭二维码"
                className="rounded-full p-1 text-neutral-500 transition hover:bg-black/5 hover:text-neutral-800 dark:hover:bg-white/10 dark:hover:text-neutral-100"
                onClick={() => setQrOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            {qrDataUrl ? (
              <Image
                src={qrDataUrl}
                alt={qrAlt}
                width={224}
                height={224}
                className="mx-auto rounded-lg border border-black/5 bg-white p-2"
              />
            ) : (
              <div className="mx-auto flex h-56 w-56 items-center justify-center rounded-lg border border-black/5 bg-white p-2 text-xs text-neutral-500">
                二维码生成中...
              </div>
            )}

            <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">链接已编码为二维码，可直接分享。</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
