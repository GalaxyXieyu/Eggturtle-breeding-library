'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { PublicSharePresentation } from '@eggturtle/shared';
import { ArrowRight, CheckCircle2, Link2, Palette, PencilRuler, Sparkles, type LucideIcon } from 'lucide-react';

import { getAccessToken } from '@/lib/api-client';
import { resolvePublicSharePresentation } from '@/app/public/_public-product/presentation';
import PublicBottomDock from '@/app/public/_shared/public-bottom-dock';
import PublicFloatingActions from '@/app/public/_shared/public-floating-actions';
import { appendPublicShareQuery } from '@/app/public/_shared/public-share-api';

type PublicShareMePageProps = {
  shareToken: string;
  shareQuery?: string;
  presentation?: PublicSharePresentation | null;
};

const SHARE_SOURCE_NEXT = '/app?intent=dashboard&source=share';
const FREE_PLAN_LIMIT = 10;

const COLLAGE_FALLBACK_IMAGES = ['/images/mg_01.jpg', '/images/mg_02.jpg', '/images/mg_03.jpg', '/images/mg_04.jpg', '/images/mg_05.jpg'];

const HERO_TAGS = ['零门槛开始', '分享即展示', '后续可升级'];

const CAPABILITY_CARDS: Array<{ title: string; desc: string; icon: LucideIcon }> = [
  {
    title: '档案与系列管理',
    desc: '先把核心信息整理清楚，宠物、系列和基础资料都能快速维护。',
    icon: PencilRuler
  },
  {
    title: '交配与产蛋基础记录',
    desc: '从日常关键节点开始沉淀记录，后续查看和复盘都更清晰。',
    icon: Sparkles
  },
  {
    title: '一键生成分享页',
    desc: '把你的图鉴内容直接公开展示，便于对外浏览和持续更新。',
    icon: Link2
  }
];

const ONBOARDING_STEPS = ['先浏览公开图鉴，确认你喜欢的展示方式', '注册并开通免费版，建立自己的图鉴空间', '上传内容并生成分享页，持续展示与迭代'];

const FREE_PLAN_BENEFITS = [
  `免费版可管理 ${FREE_PLAN_LIMIT} 只宠物，适合先启动与试运营`,
  '包含基础档案、系列管理和公开分享能力',
  '后续升级套餐不影响已有数据与展示链接'
];

export default function PublicShareMePage({ shareToken, shareQuery, presentation }: PublicShareMePageProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const resolvedPresentation = resolvePublicSharePresentation(presentation);
  const brandPrimary = resolvedPresentation.theme.brandPrimary;
  const brandSecondary = resolvedPresentation.theme.brandSecondary;
  const contactQrImageUrl = resolvedPresentation.contact.showWechatBlock ? resolvedPresentation.contact.wechatQrImageUrl : null;
  const contactWechatId = resolvedPresentation.contact.showWechatBlock ? resolvedPresentation.contact.wechatId : null;
  const collageImages = useMemo(() => buildCollageImages(resolvedPresentation.hero.images), [resolvedPresentation.hero.images]);
  const permalink = useMemo(
    () =>
      typeof window !== 'undefined' && window.location?.origin
        ? `${window.location.origin}/public/s/${shareToken}/me`
        : `/public/s/${shareToken}/me`,
    [shareToken]
  );

  useEffect(() => {
    setIsLoggedIn(Boolean(getAccessToken()));
  }, []);

  const registerHref = `/login?view=register&source=share&next=${encodeURIComponent(SHARE_SOURCE_NEXT)}`;
  const loginHref = `/login?source=share&next=${encodeURIComponent(SHARE_SOURCE_NEXT)}`;
  const backToPetsHref = appendPublicShareQuery(`/public/s/${shareToken}`, shareQuery);

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 via-white to-amber-50/40 text-black dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900/40 dark:text-neutral-100">
      <main className="mx-auto w-full max-w-5xl px-4 pb-[calc(env(safe-area-inset-bottom)+94px)] pt-[calc(env(safe-area-inset-top)+14px)] sm:px-5">
        <section className="rounded-3xl border border-black/10 bg-white/92 p-5 shadow-[0_16px_36px_rgba(0,0,0,0.08)] backdrop-blur dark:border-white/10 dark:bg-neutral-900/75 sm:p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-neutral-500 dark:text-neutral-400">My</p>
          <h1 className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100 sm:text-[30px]">免费开始你的图鉴</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-300 sm:text-[15px]">
            先看别人，再决定是否开始。注册后可管理宠物与系列、记录关键节点，并持续维护你的专属分享页。
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
        </section>

        <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="order-1 rounded-3xl border border-black/10 bg-white/92 p-5 shadow-[0_14px_30px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-neutral-900/75 lg:order-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              <Sparkles size={16} className="text-[#d3a600]" />
              功能与优势
            </div>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
              当前公开主题为“{resolvedPresentation.feedTitle}”，注册后即可在后台编辑标题、封面图、主题色与联系信息。
            </p>

            <div className="mt-4 space-y-3">
              {CAPABILITY_CARDS.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-2xl border border-black/10 bg-white px-3 py-3 shadow-[0_5px_14px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-neutral-900/70">
                    <div className="flex items-start gap-2">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FFF8D9] text-[#8a6400] dark:bg-[#2b2410] dark:text-[#ffd96a]">
                        <Icon size={14} />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{item.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">{item.desc}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="order-2 relative overflow-hidden rounded-3xl border border-black/10 bg-white/92 p-4 shadow-[0_14px_30px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-neutral-900/75 sm:p-5 lg:order-1">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {collageImages.map((imageUrl, index) => (
                <div
                  key={`${imageUrl}-${index}`}
                  className={`group relative overflow-hidden rounded-2xl border border-black/10 shadow-[0_8px_18px_rgba(0,0,0,0.12)] dark:border-white/10 ${
                    index === 0
                      ? 'aspect-[4/5]'
                      : index === 1
                        ? 'mt-3 aspect-[4/3]'
                        : index === 2
                          ? '-mt-3 aspect-[4/3]'
                          : 'aspect-[4/5]'
                  }`}
                >
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-[1.04]"
                    style={{ backgroundImage: `url(${imageUrl})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/10 to-transparent" />
                </div>
              ))}
            </div>

            <div className="pointer-events-none absolute bottom-6 left-6 max-w-[220px] rounded-2xl border border-black/10 bg-white/90 px-3 py-2 backdrop-blur dark:border-white/15 dark:bg-neutral-900/80">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">可配置展示</p>
              <p className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">封面图、主题色、联系方式都可自定义</p>
            </div>
          </article>
        </section>

        <section className="mt-4 rounded-3xl border border-black/10 bg-white/92 p-5 shadow-[0_12px_28px_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-neutral-900/75">
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            <Palette size={16} className="text-[#d3a600]" />
            3 步开通你的公开图鉴
          </div>
          <ol className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {ONBOARDING_STEPS.map((item, index) => (
              <li key={item} className="rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm text-neutral-700 shadow-[0_5px_14px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-neutral-900/70 dark:text-neutral-200">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white dark:bg-[#FFD400] dark:text-neutral-900">
                  {index + 1}
                </span>
                <p className="mt-2 leading-relaxed">{item}</p>
              </li>
            ))}
          </ol>
        </section>

        <section
          id="free-plan"
          className="mt-4 rounded-3xl border border-[#FFD400]/55 bg-[#FFF8D9]/92 p-5 shadow-[0_14px_32px_rgba(255,212,0,0.18)] dark:border-[#FFD400]/35 dark:bg-[#2b2410]/75"
        >
          <div className="flex items-center gap-2 text-[#8a6400] dark:text-[#ffd96a]">
            <CheckCircle2 size={18} />
            <p className="text-sm font-semibold uppercase tracking-[0.2em]">免费版权益</p>
          </div>

          <ul className="mt-3 space-y-2 text-sm text-neutral-700 dark:text-neutral-200">
            {FREE_PLAN_BENEFITS.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap gap-2">
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

          <Link
            href={backToPetsHref}
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-neutral-900 underline decoration-[#FFD400]/80 underline-offset-2 dark:text-[#FFD400]"
          >
            继续浏览宠物与系列
            <ArrowRight size={14} />
          </Link>
        </section>
      </main>

      <PublicFloatingActions
        permalink={permalink}
        showHomeButton={false}
        tenantQrImageUrl={contactQrImageUrl}
        tenantWechatId={contactWechatId}
        shareCardTitle={resolvedPresentation.feedTitle}
        shareCardSubtitle={resolvedPresentation.feedSubtitle}
        shareCardPrimaryColor={brandPrimary}
        shareCardSecondaryColor={brandSecondary}
        shareCardHeroImageUrl={collageImages[0] ?? null}
      />
      <PublicBottomDock shareToken={shareToken} shareQuery={shareQuery} activeTab="me" />
    </div>
  );
}

function buildCollageImages(heroImages: string[]): string[] {
  const seen = new Set<string>();
  const images: string[] = [];

  for (const candidate of [...heroImages, ...COLLAGE_FALLBACK_IMAGES]) {
    const normalized = candidate.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    images.push(normalized);

    if (images.length >= 4) {
      break;
    }
  }

  if (images.length >= 4) {
    return images;
  }

  let cursor = 0;
  while (images.length < 4) {
    images.push(COLLAGE_FALLBACK_IMAGES[cursor % COLLAGE_FALLBACK_IMAGES.length]);
    cursor += 1;
  }

  return images;
}
