'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  listBreedersResponseSchema,
  listSeriesResponseSchema,
  type Breeder,
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

type Filters = {
  code: string;
  search: string;
  seriesId: string;
};

export default function BreedersListPage() {
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const searchParams = useSearchParams();
  const tenantSlug = useMemo(() => params.tenantSlug ?? '', [params.tenantSlug]);

  const filterQueryKey = searchParams.toString();
  const initialFilters = useMemo<Filters>(() => {
    const query = new URLSearchParams(filterQueryKey);

    return {
      seriesId: query.get('seriesId') ?? '',
      search: query.get('search') ?? '',
      code: query.get('code') ?? ''
    };
  }, [filterQueryKey]);

  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [seriesOptions, setSeriesOptions] = useState<Series[]>([]);
  const [items, setItems] = useState<Breeder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<ListMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1
  });

  const loadSeriesOptions = useCallback(async () => {
    const response = await apiRequest('/series?page=1&pageSize=100', {
      responseSchema: listSeriesResponseSchema
    });

    setSeriesOptions(response.items);
  }, []);

  const loadBreeders = useCallback(async (query: Filters) => {
    setLoading(true);

    const params = new URLSearchParams();
    params.set('page', '1');
    params.set('pageSize', '50');

    if (query.seriesId) {
      params.set('seriesId', query.seriesId);
    }

    if (query.search) {
      params.set('search', query.search);
    }

    if (query.code) {
      params.set('code', query.code);
    }

    const response = await apiRequest(`/breeders?${params.toString()}`, {
      responseSchema: listBreedersResponseSchema
    });

    setItems(response.items);
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
    setFilters(initialFilters);
  }, [initialFilters]);

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
        await Promise.all([loadSeriesOptions(), loadBreeders(initialFilters)]);
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
  }, [initialFilters, loadBreeders, loadSeriesOptions, router, tenantSlug]);

  async function handleApplyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const query: Filters = {
        seriesId: filters.seriesId,
        search: filters.search.trim(),
        code: filters.code.trim()
      };

      const nextUrl = new URLSearchParams();
      if (query.seriesId) {
        nextUrl.set('seriesId', query.seriesId);
      }
      if (query.search) {
        nextUrl.set('search', query.search);
      }
      if (query.code) {
        nextUrl.set('code', query.code);
      }

      const suffix = nextUrl.toString();
      router.replace(suffix ? `/app/${tenantSlug}/breeders?${suffix}` : `/app/${tenantSlug}/breeders`);

      await loadBreeders(query);
    } catch (requestError) {
      setError(formatError(requestError));
      setLoading(false);
    }
  }

  async function handleResetFilters() {
    const resetValue = {
      seriesId: '',
      search: '',
      code: ''
    };

    setFilters(resetValue);
    router.replace(`/app/${tenantSlug}/breeders`);

    try {
      await loadBreeders(resetValue);
    } catch (requestError) {
      setError(formatError(requestError));
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>Breeders</h1>
      <p>Tenant: {tenantSlug || '(unknown)'}</p>

      <section className="card stack">
        <h2>Filters</h2>
        <form className="stack" onSubmit={handleApplyFilters}>
          <label htmlFor="series-filter">Series</label>
          <select
            id="series-filter"
            value={filters.seriesId}
            onChange={(event) => {
              setFilters((current) => ({ ...current, seriesId: event.target.value }));
            }}
          >
            <option value="">All series</option>
            {seriesOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.code} / {option.name}
              </option>
            ))}
          </select>

          <label htmlFor="search-filter">Search</label>
          <input
            id="search-filter"
            type="text"
            placeholder="Search by code or name"
            value={filters.search}
            onChange={(event) => {
              setFilters((current) => ({ ...current, search: event.target.value }));
            }}
          />

          <label htmlFor="code-filter">Exact code</label>
          <input
            id="code-filter"
            type="text"
            placeholder="BRD-ALPHA-001"
            value={filters.code}
            onChange={(event) => {
              setFilters((current) => ({ ...current, code: event.target.value }));
            }}
          />

          <div className="row">
            <button type="submit" disabled={loading}>
              {loading ? 'Loading...' : 'Apply filters'}
            </button>
            <button
              type="button"
              disabled={loading && !filters.seriesId && !filters.search && !filters.code}
              onClick={() => {
                void handleResetFilters();
              }}
            >
              Reset
            </button>
          </div>
        </form>
      </section>

      <section className="card stack">
        <h2>Breeder list</h2>
        {loading ? <p>Loading breeders...</p> : null}

        {!loading ? (
          <p>
            Showing {items.length} of {meta.total} item(s). Page {meta.page}/{meta.totalPages}.
          </p>
        ) : null}

        {!loading && items.length === 0 ? <p>No breeders found with current filters.</p> : null}

        <ul className="stack list">
          {items.map((item) => (
            <li key={item.id} className="card stack">
              <p>
                <strong>{item.code}</strong> / {item.name ?? 'Unnamed breeder'}
              </p>
              <p>
                Series: {item.series?.code ?? 'Unknown'} / {item.series?.name ?? 'Unknown'}
              </p>
              <p>
                sex={item.sex ?? 'unknown'} / status={item.isActive ? 'active' : 'inactive'}
              </p>
              <p>{item.description ?? 'No description'}</p>

              <div className="row">
                <button type="button" onClick={() => router.push(`/app/${tenantSlug}/breeders/${item.id}`)}>
                  Open detail
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/app/${tenantSlug}/series?search=${encodeURIComponent(item.series?.code ?? '')}`)}
                >
                  Open related series
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
        <button type="button" onClick={() => router.push(`/app/${tenantSlug}/series`)}>
          Open series
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
