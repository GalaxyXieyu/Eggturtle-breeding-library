'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  createFeaturedProductRequestSchema,
  createFeaturedProductResponseSchema,
  deleteFeaturedProductResponseSchema,
  listFeaturedProductsResponseSchema,
  reorderFeaturedProductsRequestSchema,
  reorderFeaturedProductsResponseSchema,
  type FeaturedProductItem
} from '@eggturtle/shared/featured';
import { ApiError, apiRequest, getAccessToken } from '../../../../lib/api-client';
import { switchTenantBySlug } from '../../../../lib/tenant-session';

export default function FeaturedProductsPage() {
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = useMemo(() => params.tenantSlug ?? '', [params.tenantSlug]);

  const [items, setItems] = useState<FeaturedProductItem[]>([]);
  const [productId, setProductId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    try {
      const response = await apiRequest('/featured-products', {
        responseSchema: listFeaturedProductsResponseSchema
      });
      setItems(response.items);
      setError(null);
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    if (!tenantSlug) {
      setError('Missing tenantSlug in route.');
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        await switchTenantBySlug(tenantSlug);
      } catch (requestError) {
        setError(formatError(requestError));
        setLoading(false);
        return;
      }

      await loadItems();
    })();
  }, [loadItems, router, tenantSlug]);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const payload = createFeaturedProductRequestSchema.parse({
        productId
      });

      const response = await apiRequest('/featured-products', {
        method: 'POST',
        body: payload,
        requestSchema: createFeaturedProductRequestSchema,
        responseSchema: createFeaturedProductResponseSchema
      });

      setMessage(`Added featured product ${response.item.productId}`);
      setProductId('');
      await loadItems();
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await apiRequest(`/featured-products/${id}`, {
        method: 'DELETE',
        responseSchema: deleteFeaturedProductResponseSchema
      });

      setMessage(`Removed featured item ${response.id}`);
      await loadItems();
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= items.length) {
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setError(null);

    const reordered = [...items];
    const [movedItem] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, movedItem);

    try {
      const payload = reorderFeaturedProductsRequestSchema.parse({
        ids: reordered.map((item) => item.id)
      });

      const response = await apiRequest('/featured-products/reorder', {
        method: 'PUT',
        body: payload,
        requestSchema: reorderFeaturedProductsRequestSchema,
        responseSchema: reorderFeaturedProductsResponseSchema
      });

      setItems(response.items);
      setMessage('Featured order updated.');
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="workspace-shell">
      <section className="card panel stack">
        <h2>新增推荐产品</h2>
        <form className="row" onSubmit={handleAdd}>
          <input
            type="text"
            placeholder="输入 productId"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            required
          />
          <button type="submit" disabled={submitting}>
            {submitting ? '保存中...' : '添加'}
          </button>
        </form>
      </section>

      <section className="card panel stack">
        <div className="row between">
          <h2>当前推荐列表</h2>
          {!loading ? <p className="muted">共 {items.length} 项</p> : null}
        </div>
        {loading ? <p className="notice notice-info">正在加载推荐列表...</p> : null}
        {!loading && items.length === 0 ? <p className="notice notice-warning">尚未配置推荐产品。</p> : null}

        {!loading && items.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>排序</th>
                  <th>Product ID</th>
                  <th>编码</th>
                  <th>名称</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id}>
                    <td>#{index + 1}</td>
                    <td>{item.productId}</td>
                    <td>{item.product.code || '-'}</td>
                    <td>{item.product.name || '-'}</td>
                    <td>
                      <div className="row">
                        <button
                          type="button"
                          className="btn-compact secondary"
                          disabled={submitting || index === 0}
                          onClick={() => {
                            void handleMove(index, -1);
                          }}
                        >
                          上移
                        </button>
                        <button
                          type="button"
                          className="btn-compact secondary"
                          disabled={submitting || index === items.length - 1}
                          onClick={() => {
                            void handleMove(index, 1);
                          }}
                        >
                          下移
                        </button>
                        <button
                          type="button"
                          className="btn-compact"
                          disabled={submitting}
                          onClick={() => {
                            void handleDelete(item.id);
                          }}
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {message ? <p className="notice notice-success">{message}</p> : null}
      {error ? <p className="notice notice-error">{error}</p> : null}
    </main>
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
