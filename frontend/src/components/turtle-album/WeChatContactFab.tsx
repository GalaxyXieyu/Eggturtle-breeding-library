import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QrCode, Copy } from 'lucide-react';

type WeChatContactFabProps = {
  wechat1Id: string;
  wechat2Id: string;
  wechat1QrUrl: string;
  wechat2QrUrl: string;
};

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const WeChatCard: React.FC<{ label: string; wechatId: string; qrUrl: string }> = ({ label, wechatId, qrUrl }) => {
  const [copied, setCopied] = React.useState(false);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-neutral-900">{label}</div>
          <div className="mt-1 text-sm text-neutral-700">微信号：{wechatId}</div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0 rounded-full"
          onClick={async () => {
            const ok = await copyText(wechatId);
            setCopied(ok);
            setTimeout(() => setCopied(false), 1200);
          }}
        >
          <Copy className="mr-2 h-4 w-4" />
          {copied ? '已复制' : '复制'}
        </Button>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl bg-neutral-50">
        <img src={qrUrl} alt={`${label} 二维码`} className="h-auto w-full object-contain" />
      </div>

      <div className="mt-3 text-xs text-neutral-500">微信内置浏览器：长按二维码识别，或复制微信号搜索添加。</div>
    </div>
  );
};

const WeChatContactFab: React.FC<WeChatContactFabProps> = ({ wechat1Id, wechat2Id, wechat1QrUrl, wechat2QrUrl }) => {
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<'1' | '2'>('1');

  return (
    <>
      <button
        type="button"
        aria-label="联系微信"
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+16px)] right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-neutral-900/80 text-white shadow-[0_10px_26px_rgba(0,0,0,0.28)] ring-1 ring-[#FFD400]/70 backdrop-blur transition hover:bg-neutral-900/90"
      >
        <QrCode className="h-5 w-5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base">联系微信</DialogTitle>
          </DialogHeader>

          <div className="mt-2">
            <div className="mb-3 text-sm text-neutral-600">长期专注果核繁殖选育</div>

            <div className="mb-3 grid grid-cols-2 gap-2 rounded-full bg-neutral-100 p-1">
              <button
                type="button"
                onClick={() => setTab('1')}
                className={`h-9 rounded-full text-sm ${tab === '1' ? 'bg-white text-black shadow-sm' : 'text-neutral-600'}`}
              >
                微信号①
              </button>
              <button
                type="button"
                onClick={() => setTab('2')}
                className={`h-9 rounded-full text-sm ${tab === '2' ? 'bg-white text-black shadow-sm' : 'text-neutral-600'}`}
              >
                微信号②
              </button>
            </div>

            {tab === '1' ? (
              <WeChatCard label="微信号①（满人加2号）" wechatId={wechat1Id} qrUrl={wechat1QrUrl} />
            ) : (
              <WeChatCard label="微信号②" wechatId={wechat2Id} qrUrl={wechat2QrUrl} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WeChatContactFab;
