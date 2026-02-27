'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createTenantRequestSchema,
  createTenantResponseSchema,
  myTenantsResponseSchema,
  switchTenantRequestSchema,
  switchTenantResponseSchema,
  type TenantMembership
} from '@eggturtle/shared/tenant';

import { ApiError, apiRequest, getAccessToken, setAccessToken } from '../../../lib/api-client';

export default function TenantManagementPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantMembership[]>([]);
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [switchingSlug, setSwitchingSlug] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTenants = useCallback(async () => {
    try {
      const response = await apiRequest('/tenants/me', {
        responseSchema: myTenantsResponseSchema
      });

      setTenants(response.tenants);
      setError(null);
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }

    void loadTenants();
  }, [loadTenants, router]);

  async function handleCreateTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const payload = createTenantRequestSchema.parse({
        slug,
        name
      });

      const response = await apiRequest('/tenants', {
        method: 'POST',
        body: payload,
        requestSchema: createTenantRequestSchema,
        responseSchema: createTenantResponseSchema
      });

      setMessage(`Created tenant ${response.tenant.slug}`);
      setSlug('');
      setName('');
      setLoading(true);
      await loadTenants();
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function handleSwitchTenant(targetSlug: string) {
    setSwitchingSlug(targetSlug);
    setMessage(null);
    setError(null);

    try {
      const payload = switchTenantRequestSchema.parse({ slug: targetSlug });
      const response = await apiRequest('/auth/switch-tenant', {
        method: 'POST',
        body: payload,
        requestSchema: switchTenantRequestSchema,
        responseSchema: switchTenantResponseSchema
      });

      setAccessToken(response.accessToken);
      router.push('/app');
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setSwitchingSlug(null);
    }
  }

  return (
    <main>
      <h1>Tenant management</h1>
      <p>Create a tenant, then switch current tenant context.</p>

      <section className="card stack">
        <h2>My tenants</h2>
        {loading ? <p>Loading tenants...</p> : null}
        {!loading && tenants.length === 0 ? <p>No tenants yet.</p> : null}

        <ul className="stack list">
          {tenants.map((membership) => (
            <li key={membership.tenant.id} className="row between">
              <span>
                <strong>{membership.tenant.slug}</strong> / {membership.tenant.name} ({membership.role})
              </span>
              <button
                type="button"
                disabled={switchingSlug === membership.tenant.slug}
                onClick={() => {
                  void handleSwitchTenant(membership.tenant.slug);
                }}
              >
                {switchingSlug === membership.tenant.slug ? 'Switching...' : 'Switch'}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <form className="card stack" onSubmit={handleCreateTenant}>
        <h2>Create tenant</h2>
        <label htmlFor="tenant-slug">Slug</label>
        <input
          id="tenant-slug"
          type="text"
          value={slug}
          placeholder="my-first-tenant"
          onChange={(event) => setSlug(event.target.value)}
          required
        />

        <label htmlFor="tenant-name">Name</label>
        <input
          id="tenant-name"
          type="text"
          value={name}
          placeholder="My First Tenant"
          onChange={(event) => setName(event.target.value)}
          required
        />

        <button type="submit" disabled={saving}>
          {saving ? 'Creating...' : 'Create tenant'}
        </button>
      </form>

      <div className="row">
        <button type="button" onClick={() => router.push('/app')}>
          Back to /app
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
