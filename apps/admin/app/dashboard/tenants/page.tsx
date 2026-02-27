'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { listAdminTenantsResponseSchema, type AdminTenant } from '@eggturtle/shared';

import { ApiError, apiRequest } from '../../../lib/api-client';

type PageState = {
  loading: boolean;
  error: string | null;
};

export default function DashboardTenantsPage() {
  const [status, setStatus] = useState<PageState>({
    loading: true,
    error: null
  });
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus({ loading: true, error: null });

      try {
        const query = new URLSearchParams();
        if (appliedSearch.trim()) {
          query.set('search', appliedSearch.trim());
        }

        const response = await apiRequest(`/admin/tenants${query.size ? `?${query.toString()}` : ''}`, {
          responseSchema: listAdminTenantsResponseSchema
        });

        if (cancelled) {
          return;
        }

        setTenants(response.tenants);
        setStatus({ loading: false, error: null });
      } catch (error) {
        if (!cancelled) {
          setStatus({ loading: false, error: formatError(error) });
          setTenants([]);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [appliedSearch]);

  const totalMembers = useMemo(
    () => tenants.reduce((sum, tenant) => sum + tenant.memberCount, 0),
    [tenants]
  );

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedSearch(searchInput.trim());
  }

  return (
    <section className="page">
      <header className="page-header">
        <h2>Tenants</h2>
        <p>Read-only tenant directory with quick search by slug or name.</p>
      </header>

      <div className="grid metrics-grid">
        <article className="card stack">
          <h3>Total tenants</h3>
          <p>
            <span className="badge">{tenants.length}</span>
          </p>
        </article>
        <article className="card stack">
          <h3>Total memberships</h3>
          <p>
            <span className="badge">{totalMembers}</span>
          </p>
        </article>
      </div>

      <form className="card stack" onSubmit={handleSearchSubmit}>
        <h3>Search</h3>
        <div className="inline-actions">
          <input
            type="search"
            value={searchInput}
            placeholder="Search by tenant slug or name"
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <button type="submit">Apply</button>
          <button
            className="secondary"
            type="button"
            onClick={() => {
              setSearchInput('');
              setAppliedSearch('');
            }}
          >
            Reset
          </button>
        </div>
      </form>

      <article className="card stack">
        <h3>Tenant list</h3>
        {status.loading ? <p className="muted">Loading tenants...</p> : null}
        {!status.loading && tenants.length === 0 ? (
          <p className="muted">No tenants found for the current search.</p>
        ) : null}
        {tenants.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Members</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr key={tenant.id}>
                  <td>{tenant.name}</td>
                  <td className="mono">{tenant.slug}</td>
                  <td>{tenant.memberCount}</td>
                  <td>{formatDate(tenant.createdAt)}</td>
                  <td>
                    <Link className="nav-link" href={`/dashboard/tenants/${tenant.id}`}>
                      View details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </article>

      {status.error ? <p className="error">{status.error}</p> : null}
    </section>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
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
