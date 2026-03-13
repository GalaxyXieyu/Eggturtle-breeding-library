'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  SUBSCRIPTION_PLAN_MONTHLY_PRICE_CENTS,
  SUBSCRIPTION_PLAN_PRODUCT_LIMITS,
  type PublicSharePresentation,
} from '@eggturtle/shared';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

import { getAccessToken } from '@/lib/api-client';
import { resolvePublicSharePresentation } from '@/app/public/_public-product/presentation';
import PublicBottomDock from '@/app/public/_shared/public-bottom-dock';
import PublicFloatingActions from '@/app/public/_shared/public-floating-actions';
import { withPublicImageMaxEdge } from '@/app/public/_shared/public-image';
import { appendPublicShareQuery } from '@/app/public/_shared/public-share-api';

type PublicShareMePageProps = {
  shareToken: string;
  shareQuery?: string;
  presentation?: PublicSharePresentation | null;
  embedded?: boolean;
};

type PlanTier = 'FREE' | 'BASIC' | 'PRO';

const SHARE_SOURCE_NEXT = '/app?intent=dashboard&source=share';

const HERO_TAGS = ['先免费开始', '后续可升级', '公开链接不中断'];

const PLAN_META: Array<{
  plan: PlanTier;
  name: string;
  badge: string;
  summary: string;
  perks: string[];
}> = [
  {
    plan: 'FREE',
    name: '免费版',
    badge: '起步',
    summary: '适合刚开始建档、想先把公开图鉴跑起来的个人或小规模龟场。',
    perks: ['基础档案管理', '交配 / 产蛋记录', '基础分享能力'],
  },
  {
    plan: 'BASIC',
    name: '基础版',
    badge: '常用',
    summary: '适合稳定经营、需要完整溯源和更强对外展示的团队。',
    perks: ['完整血统溯源', '图册展示 + 二维码', '更高图片与分享额度'],
  },
  {
    plan: 'PRO',
    name: '专业版',
    badge: '推荐',
    summary: '适合高频上新、品牌化展示和更高配额的运营场景。',
    perks: ['证书能力', '图片水印能力', '高配额与品牌化展示'],
  },
];

const DECISION_POINTS = [
  '先从免费版开始，确认适合自己的展示方式。',
  '后续升级不影响已有宠物档案、分享链接与公开页。',
  '访客先在公开页看到能力，再进入后台会更顺。',
];

export default function PublicShareMePage({
  shareToken,
  shareQuery,
  presentation,
  embedded = false,
}: PublicShareMePageProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const resolvedPresentation = resolvePublicSharePresentation(presentation);
  const brandPrimary = resolvedPresentation.theme.brandPrimary;
  const brandSecondary = resolvedPresentation.theme.brandSecondary;
  const contactQrImageUrl = resolvedPresentation.contact.showWechatBlock
    ? withPublicImageMaxEdge(resolvedPresentation.contact.wechatQrImageUrl, 480)
    : null;
  const contactWechatId = resolvedPresentation.contact.showWechatBlock
    ? resolvedPresentation.contact.wechatId
    : null;
  const heroImageUrl = useMemo(
    () => withPublicImageMaxEdge(resolvedPresentation.hero.images[0], 960) ?? '/images/mg_04.jpg',
    [resolvedPresentation.hero.images],
  );
  const permalink = useMemo(
    () =>
      typeof window !== 'undefined' && window.location?.origin
        ? `${window.location.origin}/public/s/${shareToken}/me`
        : `/public/s/${shareToken}/me`,
    [shareToken],
  );

  useEffect(() => {
    setIsLoggedIn(Boolean(getAccessToken()));
  }, []);

  const registerHref = `/login?view=register&source=share&next=${encodeURIComponent(SHARE_SOURCE_NEXT)}`;
  const loginHref = `/login?source=share&next=${encodeURIComponent(SHARE_SOURCE_NEXT)}`;
  const backToPetsHref = appendPublicShareQuery(`/public/s/${shareToken}`, shareQuery);

  const mainContent = (
    <main
      className={`mx-auto w-full max-w-5xl px-4 ${embedded ? 'pb-6 pt-4' : 'pb-[calc(env(safe-area-inset-bottom)+94px)] pt-[calc(env(safe-area-inset-top)+14px)]'} sm:px-5`}
    >
        <section className="grid gap-4 rounded-3xl border border-black/10 bg-white/92 p-5 shadow-[0_16px_36px_rgba(0,0,0,0.08)] backdrop-blur dark:border-white/10 dark:bg-neutral-900/75 sm:p-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.95fr)] lg:items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-neutral-500 dark:text-neutral-400">My</p>
            <h1 className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100 sm:text-[30px]">
              我的套餐方案
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-300 sm:text-[15px]">
              “我的”页不再放杂项入口，而是直接把套餐讲清楚：免费版先启动，后续按经营规模升级到基础版或专业版。
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {HERO_TAGS.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center rounded-full border border-[#FFD400]/55 bg-[#FFF8D9] px-3 py-1 text-xs font-semibold text-neutral-800 dark:border-[#FFD400]/35 dark:bg-[#2b2410]/70 dark:text-[#ffe8a6]"
                >
                  {item}
                </span>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {isLoggedIn ? (
                <Link
                  href={SHARE_SOURCE_NEXT}
                  className="inline-flex min-h-10 items-center justify-center gap-1 rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 dark:bg-[#FFD400] dark:text-neutral-900 dark:hover:bg-[#f1ca00]"
                >
                  进入我的后台
                  <ArrowRight size={15} />
                </Link>
              ) : (
                <>
                  <Link
                    href={registerHref}
                    className="inline-flex min-h-10 items-center justify-center rounded-full border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 dark:border-[#FFD400] dark:bg-[#FFD400] dark:text-neutral-900 dark:hover:bg-[#f1ca00]"
                  >
                    注册并开始
                  </Link>
                  <Link
                    href={loginHref}
                    className="inline-flex min-h-10 items-center justify-center rounded-full border border-neutral-900 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-100 dark:border-white/30 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
                  >
                    已有账号登录
                  </Link>
                </>
              )}
            </div>
          </div>

          <article className="relative overflow-hidden rounded-3xl border border-black/10 bg-neutral-900 shadow-[0_16px_32px_rgba(0,0,0,0.18)] dark:border-white/10">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${heroImageUrl})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-br from-black/72 via-black/55 to-black/30" />
            <div className="relative flex min-h-[18rem] flex-col justify-end p-5 text-white sm:min-h-[20rem]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70">品牌化展示</p>
              <h2 className="mt-2 text-xl font-semibold">公开页也能像自己的品牌页</h2>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/82">
                标题、副标题、主题色、封面图、轮播图和微信信息都能在后台统一配置。
              </p>
              <div className="mt-4 inline-flex w-fit rounded-2xl border border-white/15 bg-white/12 px-3 py-2 text-xs text-white/90 backdrop-blur-sm">
                当前公开主题：{resolvedPresentation.feedTitle}
              </div>
            </div>
          </article>
        </section>

        <section
          id="free-plan"
          className="mt-4 rounded-3xl border border-black/10 bg-white/92 p-5 shadow-[0_12px_28px_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-neutral-900/75 sm:p-6"
        >
          <p className="text-xs uppercase tracking-[0.26em] text-neutral-500 dark:text-neutral-400">Package</p>
          <h2 className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">简单看套餐</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-300 sm:text-[15px]">
            先用免费版跑通建档和公开分享，再根据展示深度与运营规模升级到更合适的方案。
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {PLAN_META.map((plan) => {
              const limit = SUBSCRIPTION_PLAN_PRODUCT_LIMITS[plan.plan];
              const monthlyPriceCents = SUBSCRIPTION_PLAN_MONTHLY_PRICE_CENTS[plan.plan];
              const isFeatured = plan.plan === 'PRO';
              return (
                <article
                  key={plan.plan}
                  className={`rounded-3xl border p-4 shadow-[0_10px_24px_rgba(0,0,0,0.05)] ${
                    isFeatured
                      ? 'border-[#FFD400]/55 bg-[#FFF8D9]/92 dark:border-[#FFD400]/35 dark:bg-[#2b2410]/72'
                      : 'border-black/8 bg-white/95 dark:border-white/10 dark:bg-neutral-950/45'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{plan.name}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
                        {plan.summary}
                      </p>
                    </div>
                    <span className="rounded-full border border-black/10 bg-white/80 px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:border-white/10 dark:bg-neutral-900/70 dark:text-neutral-200">
                      {plan.badge}
                    </span>
                  </div>

                  <div className="mt-4">
                    <p className="text-3xl font-black text-neutral-900 dark:text-neutral-100">
                      {formatPlanPrice(monthlyPriceCents)}
                    </p>
                    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">可管理 {limit} 只宠物</p>
                  </div>

                  <ul className="mt-4 space-y-2 text-sm text-neutral-700 dark:text-neutral-200">
                    {plan.perks.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-[#FFD400]/45 bg-[#FFFBE7]/88 p-5 shadow-[0_14px_30px_rgba(255,212,0,0.14)] dark:border-[#FFD400]/25 dark:bg-[#2b2410]/72 sm:p-6">
          <p className="text-xs uppercase tracking-[0.26em] text-[#9c7400] dark:text-[#ffd96a]">Upgrade</p>
          <h2 className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">升级不折腾</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {DECISION_POINTS.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-black/8 bg-white/92 px-4 py-3 text-sm text-neutral-700 shadow-[0_8px_18px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-neutral-950/55 dark:text-neutral-200"
              >
                {item}
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {isLoggedIn ? (
              <Link
                href={SHARE_SOURCE_NEXT}
                className="inline-flex min-h-10 items-center justify-center gap-1 rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 dark:bg-[#FFD400] dark:text-neutral-900 dark:hover:bg-[#f1ca00]"
              >
                进入后台
                <ArrowRight size={15} />
              </Link>
            ) : (
              <>
                <Link
                  href={registerHref}
                  className="inline-flex min-h-10 items-center justify-center rounded-full border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 dark:border-[#FFD400] dark:bg-[#FFD400] dark:text-neutral-900 dark:hover:bg-[#f1ca00]"
                >
                  先免费开始
                </Link>
                <Link
                  href={loginHref}
                  className="inline-flex min-h-10 items-center justify-center rounded-full border border-neutral-900 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-100 dark:border-white/30 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
                >
                  登录继续
                </Link>
              </>
            )}
          </div>

          <Link
            href={backToPetsHref}
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-neutral-900 underline decoration-[#FFD400]/80 underline-offset-2 dark:text-[#FFD400]"
          >
            继续浏览公开图鉴
            <ArrowRight size={14} />
          </Link>
        </section>
    </main>
  );

  if (embedded) {
    return <div className="min-h-full bg-transparent text-black dark:text-neutral-100">{mainContent}</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 via-white to-amber-50/40 text-black dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900/40 dark:text-neutral-100">
      {mainContent}

      <PublicFloatingActions
        permalink={permalink}
        showHomeButton={false}
        tenantQrImageUrl={contactQrImageUrl}
        tenantWechatId={contactWechatId}
        shareCardTitle={resolvedPresentation.feedTitle}
        shareCardSubtitle={resolvedPresentation.feedSubtitle}
        shareCardPrimaryColor={brandPrimary}
        shareCardSecondaryColor={brandSecondary}
        shareCardHeroImageUrl={heroImageUrl}
      />
      <PublicBottomDock shareToken={shareToken} shareQuery={shareQuery} activeTab="me" />
    </div>
  );
}

function formatPlanPrice(monthlyPriceCents: number) {
  if (monthlyPriceCents <= 0) {
    return '免费';
  }

  return `¥${monthlyPriceCents / 100}/月`;
}
