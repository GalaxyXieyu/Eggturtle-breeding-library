import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import WeChatContactFab from '@/components/turtle-album/WeChatContactFab';

import { createImageUrl } from '@/lib/api';

import { ApiRequestError, turtleAlbumService } from '@/services/turtleAlbumService';

const fmt = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
};

const isBreederNotFoundError = (error: unknown) => {
  if (error instanceof ApiRequestError && error.status === 404) return true;
  if (error instanceof Error && /not\s*found/i.test(error.message)) return true;
  return false;
};

const BreederDetail: React.FC = () => {
  const { id } = useParams();
  const breederId = id || '';

  const breederQ = useQuery({
    queryKey: ['turtle-album', 'breeder', breederId],
    queryFn: () => turtleAlbumService.getBreeder(breederId),
    enabled: !!breederId,
    retry: false,
  });

  const isBreederNotFound = breederQ.isError && isBreederNotFoundError(breederQ.error);

  const recordsQ = useQuery({
    queryKey: ['turtle-album', 'breeder-records', breederId],
    queryFn: () => turtleAlbumService.getBreederRecords(breederId),
    enabled: !!breederId && breederQ.isSuccess,
    retry: false,
  });

  const fallbackBreedersQ = useQuery({
    queryKey: ['turtle-album', 'fallback-breeders'],
    queryFn: () => turtleAlbumService.listBreeders({ limit: 8 }),
    enabled: isBreederNotFound,
    retry: false,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 via-white to-amber-50/40 text-black">
      <WeChatContactFab
        wechat1Id="Siri08888"
        wechat2Id="Awen02222"
        wechat1QrUrl="https://api3.superbed.cn/static/images/2026/0218/d6/6995ae51556e27f1c93a2fd6.jpg"
        wechat2QrUrl="https://api3.superbed.cn/static/images/2026/0218/04/6995afba556e27f1c93a3004.jpg"
      />
      <div className="w-full px-1 pb-8 pt-[calc(env(safe-area-inset-top)+18px)] sm:px-3 lg:px-5 2xl:px-6">
        <div className="mb-5 flex items-center justify-between rounded-2xl border border-black/5 bg-white/75 px-4 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.06)] backdrop-blur">
          <Link to="/" className="text-sm text-neutral-600 hover:underline">← 返回</Link>
          <div className="text-right">
            <div className="text-xs uppercase tracking-widest text-neutral-500">turtle album</div>
            <div className="mt-1 text-sm font-medium text-neutral-800">西瑞 · 果核选育溯源记录</div>
            <div className="mt-1 text-xs text-neutral-500">长期专注果核繁殖选育</div>
          </div>
        </div>

        {breederQ.isLoading ? (
          <div className="rounded-2xl border border-neutral-200 bg-white/80 p-5 text-sm text-neutral-600 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">加载中...</div>
        ) : null}

        {breederQ.isError && !isBreederNotFound ? (
          <div className="rounded-2xl border border-red-200 bg-red-50/80 p-5 text-sm text-red-700">
            {(breederQ.error as Error).message}
          </div>
        ) : null}

        {isBreederNotFound ? (
          <div className="space-y-4 rounded-3xl border border-black/5 bg-white/85 p-5 shadow-[0_12px_36px_rgba(0,0,0,0.08)] backdrop-blur sm:p-6">
            <div>
              <div className="text-lg font-semibold text-neutral-900">该详情不存在或已迁移</div>
              <div className="mt-1 text-sm text-neutral-600">
                当前 ID：<span className="font-mono text-xs sm:text-sm">{breederId}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                to="/"
                className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-800 transition hover:border-neutral-400 hover:shadow-sm"
              >
                返回首页
              </Link>
            </div>

            {(fallbackBreedersQ.data || []).length > 0 ? (
              <div>
                <div className="mb-2 text-sm font-medium text-neutral-800">你可以先看这些记录：</div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
                  {(fallbackBreedersQ.data || []).map((b) => {
                    const mainImage = (b.images || []).find((i) => i.type === 'main') || (b.images || [])[0];
                    return (
                      <Link
                        key={b.id}
                        to={`/breeder/${b.id}`}
                        className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.12)]"
                      >
                        <div className="relative aspect-[4/5] bg-neutral-100">
                          {mainImage?.url ? (
                            <img src={createImageUrl(mainImage.url)} alt={mainImage.alt || b.code} className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="p-2.5">
                          <div className="text-sm font-semibold text-neutral-900">{b.code}</div>
                          <div className="text-xs text-neutral-500">{b.name}</div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {breederQ.data ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(420px,500px)_1fr]">
            {(() => {
              const mainImage = (breederQ.data.images || []).find((i) => i.type === 'main') || (breederQ.data.images || [])[0];
              if (!mainImage?.url) return null;
              return (
                <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
                  <div className="relative aspect-square bg-neutral-100">
                    <img src={createImageUrl(mainImage.url)} alt={mainImage.alt || breederQ.data.code} className="h-full w-full object-cover" />
                    <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs text-black">
                      {breederQ.data.sex === 'female' ? '母' : breederQ.data.sex === 'male' ? '公' : '-'}
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-xl font-semibold text-neutral-900 sm:text-2xl">{breederQ.data.name}</div>
                    <div className="mt-1 text-sm text-neutral-500 sm:text-base">{breederQ.data.code}</div>
                  </div>
                  {typeof breederQ.data.offspringUnitPrice === 'number' ? (
                    <div className="shrink-0 text-lg font-semibold text-[#FFD400] sm:text-xl">子代 ¥ {breederQ.data.offspringUnitPrice}</div>
                  ) : null}
                </div>

                {breederQ.data.description ? (
                  <div className="mt-3 text-sm leading-relaxed text-neutral-800 whitespace-pre-wrap sm:text-base">
                    {breederQ.data.description}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-700 sm:text-[11px]">
                  {breederQ.data.sireCode ? (
                    <span className="rounded-full bg-neutral-100 px-2 py-1">父 {breederQ.data.sireCode}</span>
                  ) : null}
                  {breederQ.data.damCode ? (
                    <span className="rounded-full bg-neutral-100 px-2 py-1">母 {breederQ.data.damCode}</span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-6">
          <div className="mb-2 text-sm font-medium">记录</div>
          {recordsQ.isLoading ? <div className="text-sm text-neutral-600">loading...</div> : null}
          {recordsQ.isError ? (
            <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-600">
              {(recordsQ.error as Error).message}
            </div>
          ) : null}

          {recordsQ.data ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-medium">交配</div>
                  <div className="text-xs text-neutral-500">
                    {(recordsQ.data.matingRecordsAsFemale || []).length + (recordsQ.data.matingRecordsAsMale || []).length} 条
                  </div>
                </div>

                {(recordsQ.data.matingRecordsAsFemale || []).length === 0 &&
                (recordsQ.data.matingRecordsAsMale || []).length === 0 ? (
                  <div className="text-sm text-neutral-600">暂无交配记录</div>
                ) : (
                  <div className="relative pl-4">
                    <div className="absolute left-1 top-0 h-full w-px bg-neutral-200" />

                    <div className="space-y-3">
                      {(recordsQ.data.matingRecordsAsFemale || []).map((r) => (
                        <div key={r.id} className="relative">
                          <div className="absolute -left-[7px] top-3 h-2 w-2 rounded-full bg-[#FFD400]" />
                          <div className="rounded-xl border border-neutral-200 bg-white p-3">
                            <div className="text-xs text-neutral-500">{fmt(r.matedAt)}</div>
                            <div className="mt-1 text-sm">
                              配对：母 {r.femaleId.slice(0, 6)} / 公{' '}
                              {r.male ? (
                                <Link
                                  to={`/breeder/${r.male.id}`}
                                  className="font-medium underline decoration-neutral-300 hover:decoration-neutral-600"
                                >
                                  {r.male.code} · {r.male.name}
                                </Link>
                              ) : (
                                r.maleId.slice(0, 6)
                              )}
                            </div>
                            {r.notes ? <div className="mt-1 text-sm text-neutral-700">{r.notes}</div> : null}
                          </div>
                        </div>
                      ))}

                      {(recordsQ.data.matingRecordsAsMale || []).map((r) => (
                        <div key={r.id} className="relative">
                          <div className="absolute -left-[7px] top-3 h-2 w-2 rounded-full bg-[#FFD400]" />
                          <div className="rounded-xl border border-neutral-200 bg-white p-3">
                            <div className="text-xs text-neutral-500">{fmt(r.matedAt)}</div>
                            <div className="mt-1 text-sm">
                              配对：母{' '}
                              {r.female ? (
                                <Link
                                  to={`/breeder/${r.female.id}`}
                                  className="font-medium underline decoration-neutral-300 hover:decoration-neutral-600"
                                >
                                  {r.female.code} · {r.female.name}
                                </Link>
                              ) : (
                                r.femaleId.slice(0, 6)
                              )}{' '}
                              / 公 {r.maleId.slice(0, 6)}
                            </div>
                            {r.notes ? <div className="mt-1 text-sm text-neutral-700">{r.notes}</div> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {recordsQ.data.sex === 'female' ? (
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-medium">下蛋</div>
                    <div className="text-xs text-neutral-500">{(recordsQ.data.eggRecords || []).length} 条</div>
                  </div>

                  {(recordsQ.data.eggRecords || []).length === 0 ? (
                    <div className="text-sm text-neutral-600">暂无下蛋记录</div>
                  ) : (
                    <div className="relative pl-4">
                      <div className="absolute left-1 top-0 h-full w-px bg-neutral-200" />

                      <div className="space-y-3">
                        {(recordsQ.data.eggRecords || []).map((r) => (
                          <div key={r.id} className="relative">
                            <div className="absolute -left-[7px] top-3 h-2 w-2 rounded-full bg-[#FFD400]" />
                            <div className="rounded-xl border border-neutral-200 bg-white p-3">
                              <div className="text-xs text-neutral-500">{fmt(r.laidAt)}</div>
                              <div className="mt-1 text-sm">数量：{typeof r.count === 'number' ? r.count : '-'}</div>
                              {r.notes ? <div className="mt-1 text-sm text-neutral-700">{r.notes}</div> : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default BreederDetail;
