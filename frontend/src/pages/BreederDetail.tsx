import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { turtleAlbumService } from '@/services/turtleAlbumService';

const fmt = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
};

const BreederDetail: React.FC = () => {
  const { id } = useParams();
  const breederId = id || '';

  const breederQ = useQuery({
    queryKey: ['turtle-album', 'breeder', breederId],
    queryFn: () => turtleAlbumService.getBreeder(breederId),
    enabled: !!breederId,
  });

  const recordsQ = useQuery({
    queryKey: ['turtle-album', 'breeder-records', breederId],
    queryFn: () => turtleAlbumService.getBreederRecords(breederId),
    enabled: !!breederId,
  });

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-[calc(env(safe-area-inset-top)+32px)]">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="text-sm text-neutral-600 hover:underline">← 返回</Link>
          <div className="text-right">
            <div className="text-xs uppercase tracking-widest text-neutral-500">turtle album</div>
            <div className="mt-1 text-sm font-medium text-neutral-800 whitespace-pre-wrap">
              {'西瑞 · 果核选育溯源记录\n长期专注果核繁殖选育\n微信号①：Siri08888  满人加2号\n微信号②：Awen02222'}
            </div>
          </div>
        </div>

        {breederQ.isLoading ? <div className="text-sm text-neutral-600">loading...</div> : null}
        {breederQ.isError ? (
          <div className="text-sm text-red-600">{(breederQ.error as Error).message}</div>
        ) : null}

        {breederQ.data ? (
          <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
            {(() => {
              const mainImage = (breederQ.data.images || []).find((i) => i.type === 'main') || (breederQ.data.images || [])[0];
              if (!mainImage?.url) return null;
              return (
                <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)]">
                  <div className="relative aspect-square bg-neutral-100">
                    <img src={mainImage.url} alt={mainImage.alt || breederQ.data.code} className="h-full w-full object-cover" />
                    <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs text-black">
                      {breederQ.data.sex === 'female' ? '母' : breederQ.data.sex === 'male' ? '公' : '-'}
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)]">
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-2xl font-semibold text-neutral-900 sm:text-xl">{breederQ.data.name}</div>
                    <div className="mt-1 text-base text-neutral-500 sm:text-sm">{breederQ.data.code}</div>
                  </div>
                  {typeof breederQ.data.offspringUnitPrice === 'number' ? (
                    <div className="shrink-0 text-xl font-semibold text-[#D9A516] sm:text-lg">子代 ¥ {breederQ.data.offspringUnitPrice}</div>
                  ) : null}
                </div>

                {breederQ.data.description ? (
                  <div className="mt-3 text-base leading-relaxed text-neutral-800 whitespace-pre-wrap sm:text-sm">
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
            <div className="text-sm text-red-600">{(recordsQ.error as Error).message}</div>
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
                          <div className="absolute -left-[7px] top-3 h-2 w-2 rounded-full bg-[#F5C542]" />
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
                          <div className="absolute -left-[7px] top-3 h-2 w-2 rounded-full bg-[#F5C542]" />
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
                            <div className="absolute -left-[7px] top-3 h-2 w-2 rounded-full bg-[#F5C542]" />
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
