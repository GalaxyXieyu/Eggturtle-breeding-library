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
    <main>
      <h1>Featured products</h1>
      <p>Tenant: {tenantSlug || '(unknown)'}</p>

      <section className="card stack">
        <h2>Add featured product</h2>
        <form className="row" onSubmit={handleAdd}>
          <input
            type="text"
            placeholder="productId"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            required
          />
          <button type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : 'Add'}
          </button>
        </form>
      </section>

      <section className="card stack">
        <h2>Current featured list</h2>
        {loading ? <p>Loading...</p> : null}
        {!loading && items.length === 0 ? <p>No featured products yet.</p> : null}

        <ul className="stack list">
          {items.map((item, index) => (
            <li key={item.id} className="row between">
              <span>
                #{index + 1} {item.productId}
                {item.product.code ? ` / ${item.product.code}` : ''}
                {item.product.name ? ` / ${item.product.name}` : ''}
              </span>

              <div className="row">
                <button
                  type="button"
                  disabled={submitting || index === 0}
                  onClick={() => {
                    void handleMove(index, -1);
                  }}
                >
                  Up
                </button>
                <button
                  type="button"
                  disabled={submitting || index === items.length - 1}
                  onClick={() => {
                    void handleMove(index, 1);
                  }}
                >
                  Down
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    void handleDelete(item.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="row">
        <button type="button" onClick={() => router.push(`/app/${tenantSlug}`)}>
          Back to dashboard
        </button>
      </div>

      {message ? <p>{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
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

  return 'Unknown error';
}
