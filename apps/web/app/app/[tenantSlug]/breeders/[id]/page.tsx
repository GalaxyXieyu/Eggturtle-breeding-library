'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  getBreederFamilyTreeResponseSchema,
  getBreederResponseSchema,
  listBreederEventsResponseSchema,
  type Breeder,
  type BreederEvent,
  type BreederFamilyTree
} from '@eggturtle/shared';

import { ApiError, apiRequest, getAccessToken } from '../../../../../lib/api-client';
import { switchTenantBySlug } from '../../../../../lib/tenant-session';

type DetailState = {
  breeder: Breeder | null;
  events: BreederEvent[];
  tree: BreederFamilyTree | null;
};

type FamilyTreeNode = BreederFamilyTree['self'];
type RouterLike = {
  push: (href: string) => void;
};

export default function BreederDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string; tenantSlug: string }>();
  const breederId = useMemo(() => params.id ?? '', [params.id]);
  const tenantSlug = useMemo(() => params.tenantSlug ?? '', [params.tenantSlug]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DetailState>({
    breeder: null,
    events: [],
    tree: null
  });

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }

    if (!tenantSlug || !breederId) {
      setError('Missing tenantSlug or breeder id in route.');
      setLoading(false);
      return;
    }

    let isCancelled = false;

    void (async () => {
      try {
        await switchTenantBySlug(tenantSlug);

        const [breederResponse, eventsResponse, treeResponse] = await Promise.all([
          apiRequest(`/breeders/${breederId}`, {
            responseSchema: getBreederResponseSchema
          }),
          apiRequest(`/breeders/${breederId}/events`, {
            responseSchema: listBreederEventsResponseSchema
          }),
          apiRequest(`/breeders/${breederId}/family-tree`, {
            responseSchema: getBreederFamilyTreeResponseSchema
          })
        ]);

        if (!isCancelled) {
          setData({
            breeder: breederResponse.breeder,
            events: eventsResponse.events,
            tree: treeResponse.tree
          });
          setError(null);
          setLoading(false);
        }
      } catch (requestError) {
        if (!isCancelled) {
          setError(formatError(requestError));
          setLoading(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [breederId, router, tenantSlug]);

  return (
    <main className="workspace-shell">
      <header className="workspace-head">
        <div className="stack">
          <h1>种龟详情</h1>
          <p className="muted">租户：{tenantSlug || '(unknown)'}</p>
        </div>
        <div className="row">
          <button
            type="button"
            className="secondary"
            onClick={() => {
              const nextPath = data.breeder
                ? `/app/${tenantSlug}/breeders?seriesId=${data.breeder.seriesId}`
                : `/app/${tenantSlug}/breeders`;
              router.push(nextPath);
            }}
          >
            返回种龟列表
          </button>
          <button type="button" onClick={() => router.push(`/app/${tenantSlug}/series`)}>
            打开系列管理
          </button>
        </div>
      </header>

      {loading ? <p className="notice notice-info">正在加载种龟、事件和家族树数据...</p> : null}

      {!loading && data.breeder ? (
        <section className="card panel stack">
          <h2>{data.breeder.code}</h2>
          <p className="muted">{data.breeder.name ?? '未命名种龟'}</p>

          <div className="kv-grid">
            <p>
              <span className="muted">系列</span>
              <strong>{data.breeder.series?.code ?? '未关联'} / {data.breeder.series?.name ?? '未关联'}</strong>
            </p>
            <p>
              <span className="muted">性别</span>
              <strong>{data.breeder.sex ?? '未知'}</strong>
            </p>
            <p>
              <span className="muted">状态</span>
              <strong>{data.breeder.isActive ? '启用' : '停用'}</strong>
            </p>
            <p>
              <span className="muted">父本 / 母本 / 配偶</span>
              <strong>
                {data.breeder.sireCode ?? 'N/A'} / {data.breeder.damCode ?? 'N/A'} / {data.breeder.mateCode ?? 'N/A'}
              </strong>
            </p>
          </div>

          <p>{data.breeder.description ?? '暂无描述'}</p>
        </section>
      ) : null}

      {!loading && data.tree ? (
        <section className="card panel stack">
          <h2>家族关系</h2>
          <p className="muted">{data.tree.limitations}</p>

          <div className="form-grid form-grid-2">
            <div className="card stack">
              <h3>当前个体</h3>
              {renderTreeNode(data.tree.self, tenantSlug, router)}
            </div>

            <div className="card stack">
              <h3>父本</h3>
              {data.tree.sire ? renderTreeNode(data.tree.sire, tenantSlug, router) : <p className="muted">未关联</p>}
              {data.tree.links.sire && !data.tree.links.sire.breeder ? (
                <p className="notice notice-error">记录存在编码，但未找到目标种龟：{data.tree.links.sire.code}</p>
              ) : null}
            </div>

            <div className="card stack">
              <h3>母本</h3>
              {data.tree.dam ? renderTreeNode(data.tree.dam, tenantSlug, router) : <p className="muted">未关联</p>}
              {data.tree.links.dam && !data.tree.links.dam.breeder ? (
                <p className="notice notice-error">记录存在编码，但未找到目标种龟：{data.tree.links.dam.code}</p>
              ) : null}
            </div>

            <div className="card stack">
              <h3>配偶</h3>
              {data.tree.mate ? renderTreeNode(data.tree.mate, tenantSlug, router) : <p className="muted">未关联</p>}
              {data.tree.links.mate && !data.tree.links.mate.breeder ? (
                <p className="notice notice-error">记录存在编码，但未找到目标种龟：{data.tree.links.mate.code}</p>
              ) : null}
            </div>
          </div>

          <div className="stack">
            <h3>子代</h3>
            {data.tree.children.length === 0 ? <p className="muted">未找到直系子代。</p> : null}
            {data.tree.children.length > 0 ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>编码</th>
                      <th>名称</th>
                      <th>性别</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tree.children.map((child) => (
                      <tr key={child.id}>
                        <td>{child.code}</td>
                        <td>{child.name ?? '未命名种龟'}</td>
                        <td>{child.sex ?? '未知'}</td>
                        <td>
                          <button
                            type="button"
                            className="btn-compact"
                            onClick={() => {
                              router.push(`/app/${tenantSlug}/breeders/${child.id}`);
                            }}
                          >
                            打开
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {!loading && !error ? (
        <section className="card panel stack">
          <h2>事件记录</h2>
          {data.events.length === 0 ? <p className="muted">暂无事件记录。</p> : null}

          {data.events.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>事件类型</th>
                    <th>时间</th>
                    <th>备注</th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.map((event) => (
                    <tr key={event.id}>
                      <td>{event.eventType}</td>
                      <td>{new Date(event.eventDate).toLocaleString('zh-CN')}</td>
                      <td>{event.note ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {error ? <p className="notice notice-error">{error}</p> : null}
    </main>
  );
}

function renderTreeNode(node: FamilyTreeNode, tenantSlug: string, router: RouterLike) {
  return (
    <div className="row between">
      <span>
        <strong>{node.code}</strong> / {node.name ?? '未命名种龟'} ({node.sex ?? '未知'})
      </span>
      <button type="button" className="btn-compact" onClick={() => router.push(`/app/${tenantSlug}/breeders/${node.id}`)}>
        打开
      </button>
    </div>
  );
}

function formatError(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '未知错误';
}
