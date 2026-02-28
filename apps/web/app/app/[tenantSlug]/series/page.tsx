'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  listSeriesResponseSchema,
  type ListSeriesQuery,
  type Series
} from '@eggturtle/shared';

import { ApiError, apiRequest, getAccessToken } from '../../../../lib/api-client';
import { switchTenantBySlug } from '../../../../lib/tenant-session';

type ListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export default function SeriesListPage() {
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = useMemo(() => params.tenantSlug ?? '', [params.tenantSlug]);

  const [series, setSeries] = useState<Series[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<ListMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1
  });

  const loadSeries = useCallback(async (query: Pick<ListSeriesQuery, 'search'>) => {
    setLoading(true);

    const params = new URLSearchParams();
    params.set('page', '1');
    params.set('pageSize', '50');

    if (query.search) {
      params.set('search', query.search);
    }

    const path = `/series?${params.toString()}`;
    const response = await apiRequest(path, {
      responseSchema: listSeriesResponseSchema
    });

    setSeries(response.items);
    setMeta({
      page: response.page,
      pageSize: response.pageSize,
      total: response.total,
      totalPages: response.totalPages
    });
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }

    if (!tenantSlug) {
      setError('Missing tenantSlug in route.');
      setLoading(false);
      return;
    }

    let isCancelled = false;

    void (async () => {
      try {
        await switchTenantBySlug(tenantSlug);
        await loadSeries({ search: '' });
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
  }, [loadSeries, router, tenantSlug]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await loadSeries({ search: search.trim() || undefined });
    } catch (requestError) {
      setError(formatError(requestError));
      setLoading(false);
    }
  }

  async function handleResetSearch() {
    setSearch('');

    try {
      await loadSeries({ search: undefined });
    } catch (requestError) {
      setError(formatError(requestError));
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>Series</h1>
      <p>Tenant: {tenantSlug || '(unknown)'}</p>

      <section className="card stack">
        <h2>Search</h2>
        <form className="row" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search by code or name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Loading...' : 'Apply'}
          </button>
          <button
            type="button"
            disabled={loading && search.length === 0}
            onClick={() => {
              void handleResetSearch();
            }}
          >
            Reset
          </button>
        </form>
      </section>

      <section className="card stack">
        <h2>Series list</h2>
        {loading ? <p>Loading series...</p> : null}
        {!loading ? (
          <p>
            Showing {series.length} of {meta.total} item(s). Page {meta.page}/{meta.totalPages}.
          </p>
        ) : null}

        {!loading && series.length === 0 ? (
          <p>No series found. Try another keyword or seed demo data first.</p>
        ) : null}

        <ul className="stack list">
          {series.map((item) => (
            <li key={item.id} className="card stack">
              <p>
                <strong>{item.code}</strong> / {item.name}
              </p>
              <p>{item.description || 'No description'}</p>
              <p>
                sortOrder={item.sortOrder} / status={item.isActive ? 'active' : 'inactive'}
              </p>
              <div className="row">
                <button
                  type="button"
                  onClick={() => router.push(`/app/${tenantSlug}/breeders?seriesId=${item.id}`)}
                >
                  View breeders in this series
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
        <button type="button" onClick={() => router.push(`/app/${tenantSlug}/breeders`)}>
          Open breeders
        </button>
      </div>

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
