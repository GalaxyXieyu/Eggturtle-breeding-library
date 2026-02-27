'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  createAdminTenantRequestSchema,
  createAdminTenantResponseSchema,
  listAdminTenantsResponseSchema,
  type Tenant
} from '@eggturtle/shared';

import { ApiError, apiRequest } from '../../../lib/api-client';

type PageState = {
  loading: boolean;
  error: string | null;
  actionMessage: string | null;
};

export default function DashboardTenantsPage() {
  const [status, setStatus] = useState<PageState>({
    loading: true,
    error: null,
    actionMessage: null
  });
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [newTenantSlug, setNewTenantSlug] = useState('');
  const [newTenantName, setNewTenantName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await apiRequest('/admin/tenants', {
          responseSchema: listAdminTenantsResponseSchema
        });

        if (cancelled) {
          return;
        }

        setTenants(response.tenants);
        setStatus({ loading: false, error: null, actionMessage: null });
      } catch (error) {
        if (!cancelled) {
          setStatus({ loading: false, error: formatError(error), actionMessage: null });
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreateTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateLoading(true);
    setStatus((previous) => ({ ...previous, error: null, actionMessage: null }));

    try {
      const payload = createAdminTenantRequestSchema.parse({
        slug: newTenantSlug,
        name: newTenantName
      });

      const response = await apiRequest('/admin/tenants', {
        method: 'POST',
        body: payload,
        requestSchema: createAdminTenantRequestSchema,
        responseSchema: createAdminTenantResponseSchema
      });

      setTenants((previous) => [response.tenant, ...previous]);
      setNewTenantSlug('');
      setNewTenantName('');
      setStatus((previous) => ({
        ...previous,
        actionMessage: `Tenant ${response.tenant.slug} created.`
      }));
    } catch (error) {
      setStatus((previous) => ({ ...previous, error: formatError(error) }));
    } finally {
      setCreateLoading(false);
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <h2>Tenants</h2>
        <p>List and create tenants from the super-admin API.</p>
      </header>

      <div className="grid">
        <article className="card stack">
          <h3>Tenant list</h3>
          {tenants.length === 0 ? <p className="muted">No tenants found.</p> : null}
          {tenants.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Tenant ID</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr key={tenant.id}>
                    <td>{tenant.name}</td>
                    <td className="mono">{tenant.slug}</td>
                    <td className="mono">{tenant.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </article>

        <form className="card stack" onSubmit={handleCreateTenant}>
          <h3>Create tenant</h3>
          <div className="form-grid">
            <label htmlFor="new-tenant-slug">Slug</label>
            <input
              id="new-tenant-slug"
              value={newTenantSlug}
              placeholder="tenant-slug"
              onChange={(event) => setNewTenantSlug(event.target.value)}
              required
            />
            <label htmlFor="new-tenant-name">Name</label>
            <input
              id="new-tenant-name"
              value={newTenantName}
              placeholder="Tenant Name"
              onChange={(event) => setNewTenantName(event.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={createLoading}>
            {createLoading ? 'Creating...' : 'Create tenant'}
          </button>
        </form>
      </div>

      {status.loading ? <p className="muted">Loading tenants...</p> : null}
      {status.error ? <p className="error">{status.error}</p> : null}
      {status.actionMessage ? <p className="success">{status.actionMessage}</p> : null}
    </section>
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
