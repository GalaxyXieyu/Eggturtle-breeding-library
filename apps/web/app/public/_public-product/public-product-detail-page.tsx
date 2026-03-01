'use client';

import Link from 'next/link';
import type { PublicSharePresentation } from '@eggturtle/shared';

import type { Breeder, BreederEventItem, FamilyTree, MaleMateLoadItem, Series } from './types';
import {
  BreederCarousel,
  BreederEventTimeline,
  BreederStatusSummary,
  DemoHint,
  FamilyTreeSection,
  MaleMateLoadCard,
  ShareContactCard
} from './components';
import { resolvePublicSharePresentation } from './presentation';

function withDemo(path: string, demo: boolean, shareQuery?: string) {
  const withQuery = shareQuery ? `${path}${path.includes('?') ? '&' : '?'}${shareQuery}` : path;
  return demo ? `${withQuery}${withQuery.includes('?') ? '&' : '?'}demo=1` : withQuery;
}

type Props = {
  breeder: Breeder | null;
  series: Series | null;
  events: BreederEventItem[];
  familyTree: FamilyTree | null;
  maleMateLoad: MaleMateLoadItem[];
  fallbackBreeders: Breeder[];
  demo: boolean;
  shareToken: string;
  shareQuery?: string;
  breederId: string;
  homeHref?: string;
  presentation?: PublicSharePresentation | null;
};

export default function PublicProductDetailPage({
  breeder,
  series,
  events,
  familyTree,
  maleMateLoad,
  fallbackBreeders,
  demo,
  shareToken,
  shareQuery,
  breederId,
  homeHref,
  presentation
}: Props) {
  const isNotFound = !breeder;
  const resolvedHomeHref = withDemo(homeHref ?? `/public/s/${shareToken}`, demo, shareQuery);
  const resolvedPresentation = resolvePublicSharePresentation(presentation);
  const brandPrimary = resolvedPresentation.theme.brandPrimary;

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 via-white to-amber-50/40 text-black">
      <div className="w-full px-0 pb-8 pt-[env(safe-area-inset-top)] sm:px-0 lg:px-0 2xl:px-0">
        <div className="px-3 sm:px-4 lg:px-5 2xl:px-6">
          <DemoHint demo={demo} />
        </div>

        {isNotFound ? (
          <div className="px-3 sm:px-4 lg:px-5 2xl:px-6">
            <div className="space-y-4 rounded-3xl border border-black/5 bg-white/85 p-5 shadow-[0_12px_36px_rgba(0,0,0,0.08)] backdrop-blur sm:p-6">
              <div>
                <div className="text-lg font-semibold text-neutral-900">该详情不存在或已迁移</div>
                <div className="mt-1 text-sm text-neutral-600">
                  当前 ID：<span className="font-mono text-xs sm:text-sm">{breederId}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link href={resolvedHomeHref} className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-800 transition hover:border-neutral-400 hover:shadow-sm">
                  返回首页
                </Link>
              </div>

              {fallbackBreeders.length > 0 ? (
                <div>
                  <div className="mb-2 text-sm font-medium text-neutral-800">你可以先看这些记录：</div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
                    {fallbackBreeders.map((item) => (
                      <Link
                        key={item.id}
                        href={withDemo(`/public/s/${shareToken}/products/${item.id}`, demo, shareQuery)}
                        className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.12)]"
                      >
                        <div className="relative aspect-[4/5] bg-neutral-100">
                          <img src={item.images[0]?.url || '/images/mg_01.jpg'} alt={item.code} className="h-full w-full object-cover" />
                        </div>
                        <div className="p-2.5">
                          <div className="text-sm font-semibold text-neutral-900">{item.code}</div>
                          <div className="text-xs text-neutral-500">{item.name}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {breeder ? (
          <>
            <div className="grid items-stretch gap-4 px-3 sm:px-4 lg:grid-cols-[minmax(340px,420px)_1fr] lg:px-5 xl:gap-5 2xl:px-6">
              <BreederCarousel
                breeder={breeder}
                series={series}
                demo={demo}
                shareToken={shareToken}
                shareQuery={shareQuery}
                homeHref={resolvedHomeHref}
              />

              <div className="flex flex-col space-y-4">
                <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-black/5 bg-white/90 shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
                  <div className="p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">{breeder.name}</div>
                        {breeder.code !== breeder.name ? <div className="mt-1 text-sm text-neutral-500 sm:text-base">{breeder.code}</div> : null}
                      </div>
                      {typeof breeder.offspringUnitPrice === 'number' ? (
                        <div
                          className="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-bold text-neutral-900 shadow-[0_4px_12px_rgba(251,191,36,0.4)] sm:text-base"
                          style={{ backgroundColor: brandPrimary }}
                        >
                          子代 ¥ {breeder.offspringUnitPrice}
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 flex w-full flex-nowrap items-center gap-2">
                      <ParentPill label="父本" code={breeder.sireCode} />
                      <ParentPill label="母本" code={breeder.damCode} />
                      {breeder.sex === 'female' && breeder.currentMateCode ? <ParentPill label="当前配偶" code={breeder.currentMateCode} /> : null}
                    </div>

                    {breeder.sex === 'female' ? <BreederStatusSummary breeder={breeder} /> : null}

                    {breeder.description ? (
                      <div
                        className="mt-4 rounded-2xl border p-3"
                        style={{
                          borderColor: `${brandPrimary}66`,
                          background: `linear-gradient(135deg, ${brandPrimary}22, #fff8d6)`
                        }}
                      >
                        <div className="whitespace-pre-wrap text-sm leading-relaxed text-amber-900">{breeder.description}</div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {breeder.sex === 'female' ? <BreederEventTimeline events={events} breeder={breeder} /> : null}
            {breeder.sex === 'male' ? <MaleMateLoadCard items={maleMateLoad} demo={demo} shareToken={shareToken} shareQuery={shareQuery} /> : null}
            <FamilyTreeSection familyTree={familyTree} demo={demo} shareToken={shareToken} shareQuery={shareQuery} />

            <div className="px-3 pt-4 sm:px-4 lg:px-5 2xl:px-6">
              <ShareContactCard presentation={resolvedPresentation} />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function ParentPill({ label, code }: { label: string; code?: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50/70 px-2 py-0.5 text-[11px] font-semibold text-neutral-700">
      <span className="shrink-0 tracking-wide">{label}</span>
      <span className="truncate">{code || '未知'}</span>
    </span>
  );
}
