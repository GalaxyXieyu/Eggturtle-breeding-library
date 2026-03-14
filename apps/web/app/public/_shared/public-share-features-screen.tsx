/* eslint-disable @next/next/no-img-element */
'use client';

import Link from 'next/link';
import type { PublicSharePresentation } from '@eggturtle/shared';
import { ArrowRight, Check } from 'lucide-react';

import { resolvePublicSharePresentation } from '@/app/public/_public-product/presentation';
import PublicBottomDock from '@/app/public/_shared/public-bottom-dock';
import PublicFloatingActions from '@/app/public/_shared/public-floating-actions';
import { withPublicImageMaxEdge } from '@/app/public/_shared/public-image';

const LOCAL_IMAGES = {
  heroBackground: '/images/feature-showcase/dashboard-ranking.png',
  heroPreview: '/images/feature-showcase/certificate-pair.jpg',
  lineage: '/images/feature-showcase/family-pedigree.png',
  pairing: '/images/feature-showcase/timeline-events.png',
  eggs: '/images/feature-showcase/dashboard-overview.png',
  reminder: '/images/feature-showcase/certificate-single.png',
} as const;

const CORE_FEATURES = [
  {
    title: '血缘记录',
    eyebrow: 'Lineage',
    description: '记录每只种龟的亲本信息，建立完整家族谱系。追溯多代血统，为科学选育提供数据支撑。',
    image: LOCAL_IMAGES.lineage,
    imagePosition: 'left' as const,
    contain: true,
    points: ['多代血统清晰可追溯', '选种与留种更有依据', '避免近亲配对风险'],
    statLabel: '谱系层级',
    statValue: '4+ 代',
    panelClassName: 'border-[#F3E4A3] bg-[linear-gradient(135deg,rgba(255,251,235,0.92),rgba(255,255,255,0.98))]',
  },
  {
    title: '配对管理',
    eyebrow: 'Pairing',
    description: '记录配对组合与时间，追踪每次繁殖周期。科学管理配对频率，提升繁殖成功率。',
    image: LOCAL_IMAGES.eggs,
    imagePosition: 'right' as const,
    contain: true,
    points: ['配对节奏统一留痕', '繁殖周期一眼看清', '历史组合随时回查'],
    statLabel: '配对节奏',
    statValue: '实时',
    panelClassName: 'border-[#E8E8E8] bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))]',
  },
  {
    title: '产蛋追踪',
    eyebrow: 'Egg Flow',
    description: '记录产蛋时间与数量，掌握孵化进度。精确记录每窝数据，优化孵化管理流程。',
    image: LOCAL_IMAGES.pairing,
    imagePosition: 'left' as const,
    contain: true,
    points: ['每窝时间与数量同步记录', '孵化阶段持续跟踪', '批次管理更轻松'],
    statLabel: '窝次记录',
    statValue: '持续',
    panelClassName: 'border-[#F0E3B2] bg-[linear-gradient(135deg,rgba(250,245,230,0.94),rgba(255,255,255,0.98))]',
  },
  {
    title: '血统证书',
    eyebrow: 'Certificate',
    description: '为每只宠物生成可公开展示的血统证书，关键信息清晰呈现。扫码即可核验来源，让展示更专业、成交更有信任感。',
    image: LOCAL_IMAGES.reminder,
    imagePosition: 'right' as const,
    contain: true,
    points: ['关键信息集中展示', '支持公开扫码验真', '提升展示与成交信任'],
    statLabel: '验真方式',
    statValue: '扫码',
    panelClassName: 'border-[#E8E0B0] bg-[linear-gradient(135deg,rgba(255,249,219,0.92),rgba(255,255,255,0.98))]',
  },
] as const;

const ADDITIONAL_FEATURES = [
  { title: '繁育者主页', description: '对外展示种龟信息与子代价格，直接服务客户' },
  { title: '种龟夫妻图', description: '一键生成配对展示图，方便朋友圈/社群推广' },
  { title: '系列管理', description: '按品系/系列分组管理，清晰呈现选育方向' },
  { title: '公开分享', description: '生成专属分享链接，访客无需登录即可浏览' },
] as const;

const HIGHLIGHTS = [
  '完整的血缘谱系追溯',
  '智能配对周期提醒',
  '产蛋孵化数据记录',
  '一键生成推广素材',
  '客户专属展示主页',
  '多品系系列管理',
] as const;

const STATS = [
  { value: '1000+', label: '只种龟' },
  { value: '5000+', label: '条记录' },
  { value: '200+', label: '位繁育者' },
] as const;

type Props = {
  shareToken: string;
  shareQuery?: string;
  presentation?: PublicSharePresentation | null;
  embedded?: boolean;
};

function ScreenshotSurface({
  src,
  alt,
  ratio = '4 / 3',
  contain = false,
}: {
  src: string;
  alt: string;
  ratio?: string;
  contain?: boolean;
}) {
  return (
    <div className="relative overflow-visible rounded-[32px]">
      <div className="pointer-events-none absolute inset-x-[6%] inset-y-[10%] rounded-[32px] bg-[radial-gradient(circle_at_bottom,rgba(255,212,0,0.24),transparent_68%)] blur-3xl" />
      <div
        className="relative h-full overflow-hidden rounded-[28px] border border-[#E9DFAF]/75 bg-[rgba(255,250,236,0.18)] shadow-[0_18px_46px_rgba(169,144,67,0.18)] backdrop-blur-[2px]"
        style={{ aspectRatio: ratio }}
      >
        <img
          src={src}
          alt={alt}
          className={`h-full w-full ${contain ? 'object-contain bg-transparent' : 'object-cover'}`}
          loading="lazy"
        />
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0))]" />
    </div>
  );
}

function HeroPreviewCard() {
  return (
    <div className="relative hidden lg:block">
      <div className="relative">
        <ScreenshotSurface src={LOCAL_IMAGES.heroPreview} alt="Platform Preview" contain ratio="4 / 3" />
        <div className="absolute -bottom-6 -left-6 rounded-2xl bg-white p-6 shadow-2xl" style={{ maxWidth: '200px' }}>
          <div className="mb-2 text-4xl font-black" style={{ fontFamily: 'Playfair Display, serif', color: '#FFD400' }}>
            98%
          </div>
          <div className="text-sm text-gray-600" style={{ fontFamily: 'Inter, sans-serif' }}>
            配对成功率提升
          </div>
        </div>

        <div className="absolute -right-6 -top-6 rounded-2xl bg-white p-6 shadow-2xl" style={{ maxWidth: '180px' }}>
          <div className="mb-2 flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-500" />
            <span className="text-xs font-semibold text-gray-600" style={{ fontFamily: 'Inter, sans-serif' }}>
              实时同步
            </span>
          </div>
          <div className="text-sm text-gray-700" style={{ fontFamily: 'Inter, sans-serif' }}>
            数据云端备份
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PublicShareFeaturesScreen({
  shareToken,
  shareQuery,
  presentation,
  embedded = false,
}: Props) {
  const resolvedPresentation = resolvePublicSharePresentation(presentation);
  const contactQrImageUrl = resolvedPresentation.contact.showWechatBlock
    ? resolvedPresentation.contact.wechatQrImageUrl
    : null;
  const contactWechatId = resolvedPresentation.contact.showWechatBlock
    ? resolvedPresentation.contact.wechatId
    : null;
  const shareCardHeroImageUrl =
    withPublicImageMaxEdge(resolvedPresentation.hero.images[0], 960) ?? LOCAL_IMAGES.heroBackground;
  const workspaceHref = '/app?intent=dashboard&source=share';

  const mainContent = (
    <div className={embedded ? 'min-h-full bg-white' : 'min-h-screen w-full overflow-x-hidden bg-white'}>
      <section className="relative flex items-center overflow-hidden" style={embedded ? undefined : { minHeight: '100vh' }}>
        <div className="absolute inset-0 z-0">
          <img src={LOCAL_IMAGES.heroBackground} alt="Turtle Background" className="h-full w-full object-cover object-center opacity-85" />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to right, rgba(245,245,244,0.97) 0%, rgba(255,255,255,0.92) 38%, rgba(255,251,235,0.76) 100%)',
            }}
          />
          <div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at 15% 50%, rgba(255,212,0,0.22), transparent 52%)' }}
          />
        </div>

        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full blur-3xl md:h-[600px] md:w-[600px]"
             style={{ background: '#FFD400', opacity: 0.12 }} />
        <div className="absolute bottom-1/4 right-1/3 h-96 w-96 rounded-full blur-3xl md:h-[500px] md:w-[500px]"
             style={{ background: '#FFD400', opacity: 0.1 }} />

        <div className={`relative z-10 w-full ${embedded ? 'px-5 py-14' : 'px-6 py-20'}`}>
          <div className="mx-auto max-w-7xl">
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16 xl:gap-20">
              <div className="max-w-[640px]">
                <div
                  className="mb-8 inline-flex items-center gap-2 rounded-full px-4 py-2"
                  style={{ background: 'rgba(255,212,0,0.15)', border: '1px solid rgba(255,212,0,0.3)' }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: '#FFD400' }} />
                  <span
                    className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-800 md:text-sm"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    记录血缘 · 专注选育 · 提升品质
                  </span>
                </div>

                <h1
                  className="mb-6 text-5xl font-bold text-gray-900 md:text-6xl lg:text-7xl xl:text-8xl"
                  style={{ fontFamily: 'Playfair Display, serif', lineHeight: '1.03', letterSpacing: '-0.04em' }}
                >
                  选育溯源
                  <br />
                  <span style={{ color: '#FFD400' }}>档案</span>
                </h1>

                <p
                  className="mb-8 text-lg leading-relaxed text-gray-700 md:text-xl lg:text-2xl"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  专为蛋龟繁育者打造的
                  <br className="hidden sm:block" />
                  血缘记录与选育管理平台
                </p>

                <div className="mb-10 grid grid-cols-2 gap-x-6 gap-y-3 md:max-w-[560px]">
                  {HIGHLIGHTS.map((item) => (
                    <div key={item} className="flex items-center gap-2.5">
                      <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full" style={{ background: '#FFD400' }}>
                        <Check className="h-3 w-3 text-black" strokeWidth={3} />
                      </div>
                      <span className="text-sm text-gray-700 md:text-base" style={{ fontFamily: 'Inter, sans-serif' }}>
                        {item}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-4 sm:flex-row">
                  <Link
                    href={workspaceHref}
                    className="group flex items-center justify-center gap-2 rounded-full px-8 py-5 text-base font-semibold text-black transition-all md:text-lg"
                    style={{
                      background: '#FFD400',
                      fontFamily: 'Inter, sans-serif',
                      boxShadow: '0 8px 30px rgba(255,212,0,0.3)',
                    }}
                  >
                    立即开始记录
                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </Link>

                  <a
                    href="#share-features"
                    className="rounded-full border-2 border-gray-300 bg-white px-8 py-5 text-base font-semibold text-gray-900 transition-all hover:border-gray-900 md:text-lg"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    查看功能演示
                  </a>
                </div>

                <div className="mt-12 flex gap-8 border-t border-gray-200 pt-8 md:gap-10">
                  {STATS.map((stat) => (
                    <div key={stat.label}>
                      <div className="mb-1 text-3xl font-black" style={{ fontFamily: 'Playfair Display, serif', color: '#FFD400' }}>
                        {stat.value}
                      </div>
                      <div className="text-sm text-gray-600" style={{ fontFamily: 'Inter, sans-serif' }}>
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <HeroPreviewCard />
            </div>
          </div>
        </div>

        {!embedded ? (
          <div className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 md:block">
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-gray-500" style={{ fontFamily: 'Inter, sans-serif' }}>
                向下滚动
              </span>
              <div className="flex h-10 w-6 items-start justify-center rounded-full border-2 border-gray-400 p-2">
                <div className="h-1.5 w-1.5 rounded-full bg-gray-400" />
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section id="share-features" className={`py-16 md:py-32 ${embedded ? 'px-5' : 'px-6'}`}>
        <div className="mx-auto max-w-7xl space-y-10 md:space-y-14">
          {CORE_FEATURES.map((feature, index) => {
            const imageFirst = feature.imagePosition === 'left';

            return (
              <article
                key={feature.title}
                className={`overflow-hidden rounded-[32px] border p-5 shadow-[0_24px_72px_rgba(15,23,42,0.08)] md:p-6 lg:grid lg:min-h-[24rem] lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center lg:gap-10 lg:p-8 ${feature.panelClassName}`}
              >
                <div className="space-y-4 lg:hidden">
                  <div className="min-w-0">
                    <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#9C7400]" style={{ fontFamily: 'Inter, sans-serif' }}>
                      <span>{feature.eyebrow}</span>
                      <span className="h-px flex-1 bg-[#E5D9A3]" />
                      <span className="text-[10px] text-[#9C7400]/70">0{index + 1}</span>
                    </div>
                    <h2 className="text-[34px] font-bold leading-[0.98] text-gray-900" style={{ fontFamily: 'Playfair Display, serif', letterSpacing: '-0.03em' }}>
                      {feature.title}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-gray-600" style={{ fontFamily: 'Inter, sans-serif' }}>
                      {feature.description}
                    </p>
                  </div>

                  <div className="relative">
                    <div className="absolute -inset-3 rounded-[28px] bg-[radial-gradient(circle_at_top_right,rgba(255,212,0,0.2),transparent_55%)] blur-2xl" />
                    <div className="relative">
                      <ScreenshotSurface src={feature.image} alt={feature.title} contain={feature.contain} ratio="4 / 3" />
                      <div className="absolute -bottom-3 left-3 rounded-2xl border border-black/5 bg-white/92 px-3 py-2 shadow-[0_12px_28px_rgba(15,23,42,0.12)] backdrop-blur">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500" style={{ fontFamily: 'Inter, sans-serif' }}>
                          {feature.statLabel}
                        </div>
                        <div className="mt-1 text-base font-bold text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>
                          {feature.statValue}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2.5 pt-3">
                    {feature.points.map((point) => (
                      <span
                        key={point}
                        className="inline-flex rounded-full border border-black/8 bg-white/82 px-3.5 py-2 text-[13px] font-medium text-gray-700 shadow-[0_6px_18px_rgba(15,23,42,0.05)]"
                        style={{ fontFamily: 'Inter, sans-serif' }}
                      >
                        {point}
                      </span>
                    ))}
                  </div>
                </div>

                <div className={`${imageFirst ? 'order-1' : 'order-2'} relative hidden self-stretch lg:block`}>
                  <div className="absolute -inset-3 rounded-[28px] bg-[radial-gradient(circle_at_top_right,rgba(255,212,0,0.2),transparent_55%)] blur-2xl" />
                  <div className="relative h-full">
                    <ScreenshotSurface src={feature.image} alt={feature.title} contain={feature.contain} ratio="16 / 11" />
                    <div className="absolute -bottom-4 left-4 rounded-2xl border border-black/5 bg-white/92 px-4 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.12)] backdrop-blur">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500" style={{ fontFamily: 'Inter, sans-serif' }}>
                        {feature.statLabel}
                      </div>
                      <div className="mt-1 text-lg font-bold text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>
                        {feature.statValue}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`${imageFirst ? 'order-2' : 'order-1'} hidden lg:block`}>
                  <div className="mb-5 flex items-center gap-3">
                    <span className="inline-flex rounded-full bg-[#FFF3BF] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#8A6800]" style={{ fontFamily: 'Inter, sans-serif' }}>
                      {feature.eyebrow}
                    </span>
                    <span className="text-sm font-medium text-gray-400" style={{ fontFamily: 'Inter, sans-serif' }}>
                      0{index + 1}
                    </span>
                  </div>

                  <h2 className="max-w-[8ch] text-4xl font-bold leading-[0.98] text-gray-900 xl:text-5xl" style={{ fontFamily: 'Playfair Display, serif', letterSpacing: '-0.04em' }}>
                    {feature.title}
                  </h2>
                  <p className="mt-5 max-w-[24rem] text-lg leading-8 text-gray-600 xl:text-xl" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {feature.description}
                  </p>

                  <div className="mt-7 flex flex-wrap gap-3">
                    {feature.points.map((point) => (
                      <span
                        key={point}
                        className="inline-flex rounded-full border border-black/8 bg-white/80 px-4 py-2 text-sm font-medium text-gray-700 shadow-[0_6px_18px_rgba(15,23,42,0.05)]"
                        style={{ fontFamily: 'Inter, sans-serif' }}
                      >
                        {point}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className={`bg-[#FAFAF9] py-16 md:py-24 ${embedded ? 'px-5' : 'px-6'}`}>
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-gray-900 md:text-5xl" style={{ fontFamily: 'Playfair Display, serif', letterSpacing: '-0.03em' }}>
              更多实用功能
            </h2>
            <p className="text-base text-gray-600 md:text-lg" style={{ fontFamily: 'Inter, sans-serif' }}>
              全方位支持您的繁育工作
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {ADDITIONAL_FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-2xl border border-gray-100 bg-white p-8 transition-all" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
                <h3 className="mb-3 text-lg font-bold text-gray-900 md:text-xl" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-gray-600 md:text-base" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`py-16 md:py-32 ${embedded ? 'px-5' : 'px-6'}`}>
        <div className="mx-auto max-w-4xl">
          <div className="rounded-3xl border border-gray-200 bg-white p-8 md:p-12" style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.06)' }}>
            <h2 className="mb-8 text-2xl font-bold text-gray-900 md:text-4xl" style={{ fontFamily: 'Playfair Display, serif', letterSpacing: '-0.03em' }}>
              专业的繁育管理平台
            </h2>
            <div className="space-y-6 text-base leading-relaxed text-gray-700 md:text-lg" style={{ fontFamily: 'Inter, sans-serif' }}>
              <p>选育溯源档案是一款用于记录与追溯蛋龟血缘信息的繁育管理工具。</p>
              <p>平台支持记录种龟配对、产蛋时间，并提供智能配对提醒，帮助繁育者更高效地管理繁殖周期。</p>
              <p>同时，系统支持展示繁育者主页，可向客户直观展示不同种龟的子代价格，让交易更加便捷；还可一键生成“种龟夫妻图”，方便在朋友圈或社群中展示与推广子代。</p>
            </div>
          </div>
        </div>
      </section>

      <section className={`bg-gray-900 py-16 md:py-24 ${embedded ? 'px-5' : 'px-6'}`}>
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 text-center md:grid-cols-3 md:gap-16">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <div
                  className="mb-4 text-6xl font-black md:text-7xl"
                  style={{ fontFamily: 'Playfair Display, serif', color: '#FFD400', textShadow: '0 4px 20px rgba(255,212,0,0.4)' }}
                >
                  {stat.value}
                </div>
                <p className="text-lg text-gray-300 md:text-xl" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`py-20 md:py-32 ${embedded ? 'px-5' : 'px-6'}`}>
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-8 text-3xl font-bold text-gray-900 md:text-5xl" style={{ fontFamily: 'Playfair Display, serif', letterSpacing: '-0.03em' }}>
            开始您的专业选育之路
          </h2>
          <p className="mx-auto mb-6 max-w-2xl text-base leading-relaxed text-gray-700 md:mb-8 md:text-lg" style={{ fontFamily: 'Inter, sans-serif' }}>
            如今蛋龟市场越来越火，养殖场数量也越来越多。<br className="hidden md:block" />
            <br className="hidden md:block" />
            在数量越来越多的市场环境里，<br className="hidden md:block" />
            只有真正做好选育，提升品质，才是玩家长期走下去的出路。
          </p>

          <Link
            href={workspaceHref}
            className="inline-flex items-center justify-center rounded-full px-10 py-5 text-base font-semibold text-black transition-all md:px-12 md:py-6 md:text-lg"
            style={{ background: '#FFD400', fontFamily: 'Inter, sans-serif', boxShadow: '0 8px 30px rgba(255,212,0,0.3)' }}
          >
            立即免费使用
          </Link>
        </div>
      </section>

      {!embedded ? (
        <footer className="border-t border-gray-200 px-6 py-12">
          <div className="mx-auto max-w-6xl text-center">
            <p className="text-sm text-gray-500" style={{ fontFamily: 'Inter, sans-serif' }}>
              © 2026 选育溯源档案 · 专注蛋龟繁育管理
            </p>
          </div>
        </footer>
      ) : null}
    </div>
  );

  if (embedded) {
    return <div className="min-h-full bg-transparent">{mainContent}</div>;
  }

  return (
    <div className="min-h-screen bg-white pb-[calc(env(safe-area-inset-bottom)+80px)]">
      {mainContent}
      <PublicFloatingActions
        useCurrentUrl
        showHomeButton={false}
        tenantQrImageUrl={contactQrImageUrl}
        tenantWechatId={contactWechatId}
        shareCardTitle={resolvedPresentation.feedTitle}
        shareCardSubtitle={resolvedPresentation.feedSubtitle}
        shareCardPrimaryColor={resolvedPresentation.theme.brandPrimary}
        shareCardSecondaryColor={resolvedPresentation.theme.brandSecondary}
        shareCardHeroImageUrl={shareCardHeroImageUrl}
      />
      <PublicBottomDock shareToken={shareToken} shareQuery={shareQuery} activeTab="features" />
    </div>
  );
}
