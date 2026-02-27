'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  createAdminTenantRequestSchema,
  createAdminTenantResponseSchema,
  listAdminTenantsResponseSchema,
  meResponseSchema,
  upsertTenantMemberRequestSchema,
  upsertTenantMemberResponseSchema,
  type Tenant,
  type TenantRole
} from '@eggturtle/shared';
import { useRouter } from 'next/navigation';

import { ApiError, apiRequest, getAccessToken } from '../../lib/api-client';

type PageStatus = {
  error: string | null;
  loading: boolean;
};

const tenantRoleOptions: TenantRole[] = ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER'];

const webSuperAdminEnabled = process.env.NEXT_PUBLIC_SUPER_ADMIN_ENABLED === 'true';

export default function SuperAdminPage() {
  const router = useRouter();
  const [status, setStatus] = useState<PageStatus>({ loading: true, error: null });
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');

  const [newTenantSlug, setNewTenantSlug] = useState('');
  const [newTenantName, setNewTenantName] = useState('');
  const [createTenantLoading, setCreateTenantLoading] = useState(false);

  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<TenantRole>('VIEWER');
  const [upsertMemberLoading, setUpsertMemberLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      try {
        const [meResponse, tenantResponse] = await Promise.all([
          apiRequest('/me', {
            responseSchema: meResponseSchema
          }),
          apiRequest('/admin/tenants', {
            responseSchema: listAdminTenantsResponseSchema
          })
        ]);

        if (cancelled) {
          return;
        }

        setCurrentUserEmail(meResponse.user.email);
        setTenants(tenantResponse.tenants);
        setSelectedTenantId((current) => current || tenantResponse.tenants[0]?.id || '');
        setStatus({ loading: false, error: null });
      } catch (error) {
        if (!cancelled) {
          setStatus({ loading: false, error: formatError(error) });
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === selectedTenantId) ?? null,
    [selectedTenantId, tenants]
  );

  async function handleCreateTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateTenantLoading(true);
    setActionMessage(null);
    setStatus((previous) => ({ ...previous, error: null }));

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
      setSelectedTenantId(response.tenant.id);
      setNewTenantSlug('');
      setNewTenantName('');
      setActionMessage(`Tenant ${response.tenant.slug} created.`);
    } catch (error) {
      setStatus((previous) => ({ ...previous, error: formatError(error) }));
    } finally {
      setCreateTenantLoading(false);
    }
  }

  async function handleUpsertMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTenantId) {
      setStatus((previous) => ({ ...previous, error: 'Select a tenant first.' }));
      return;
    }

    setUpsertMemberLoading(true);
    setActionMessage(null);
    setStatus((previous) => ({ ...previous, error: null }));

    try {
      const payload = upsertTenantMemberRequestSchema.parse({
        email: memberEmail,
        role: memberRole
      });

      const response = await apiRequest(`/admin/tenants/${selectedTenantId}/members`, {
        method: 'POST',
        body: payload,
        requestSchema: upsertTenantMemberRequestSchema,
        responseSchema: upsertTenantMemberResponseSchema
      });

      setMemberEmail('');
      setActionMessage(
        `${response.created ? 'Added' : 'Updated'} ${response.user.email} as ${response.role} for ${selectedTenant?.slug ?? response.tenantId}.`
      );
    } catch (error) {
      setStatus((previous) => ({ ...previous, error: formatError(error) }));
    } finally {
      setUpsertMemberLoading(false);
    }
  }

  return (
    <main>
      <p className="super-admin-banner">Super Admin</p>
      <h1>Global backoffice</h1>
      <p>Cross-tenant operations for privileged operators only.</p>
      <p className={webSuperAdminEnabled ? 'env-warning ok' : 'env-warning'}>
        Environment warning: API access is blocked unless <code>SUPER_ADMIN_ENABLED=true</code> and your
        email is in <code>SUPER_ADMIN_EMAILS</code>. Web hint flag:{' '}
        <strong>{webSuperAdminEnabled ? 'enabled' : 'disabled'}</strong>
      </p>

      <div className="card stack">
        <p>
          Signed in as: <strong>{currentUserEmail ?? 'loading...'}</strong>
        </p>
        <p>
          Admin API path: <code>/admin</code>
        </p>
      </div>

      <section className="card stack">
        <h2>Tenants</h2>
        {tenants.length === 0 ? <p>No tenants found.</p> : null}
        <ul className="list stack">
          {tenants.map((tenant) => (
            <li key={tenant.id} className="row between">
              <div>
                <strong>{tenant.name}</strong>
                <p>
                  <code>{tenant.slug}</code>
                </p>
              </div>
              <button type="button" onClick={() => setSelectedTenantId(tenant.id)}>
                {selectedTenantId === tenant.id ? 'Selected' : 'Select'}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <form className="card stack" onSubmit={handleCreateTenant}>
        <h2>Create tenant</h2>
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
        <button type="submit" disabled={createTenantLoading}>
          {createTenantLoading ? 'Creating...' : 'Create tenant'}
        </button>
      </form>

      <form className="card stack" onSubmit={handleUpsertMember}>
        <h2>Grant tenant membership</h2>
        <label htmlFor="member-tenant">Tenant</label>
        <select
          id="member-tenant"
          value={selectedTenantId}
          onChange={(event) => setSelectedTenantId(event.target.value)}
          required
        >
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.name} ({tenant.slug})
            </option>
          ))}
        </select>
        <label htmlFor="member-email">User email</label>
        <input
          id="member-email"
          type="email"
          value={memberEmail}
          placeholder="member@example.com"
          onChange={(event) => setMemberEmail(event.target.value)}
          required
        />
        <label htmlFor="member-role">Role</label>
        <select
          id="member-role"
          value={memberRole}
          onChange={(event) => setMemberRole(event.target.value as TenantRole)}
        >
          {tenantRoleOptions.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <button type="submit" disabled={upsertMemberLoading}>
          {upsertMemberLoading ? 'Saving...' : 'Grant membership'}
        </button>
      </form>

      {status.loading ? <p>Loading admin workspace...</p> : null}
      {status.error ? <p className="error">{status.error}</p> : null}
      {actionMessage ? <p>{actionMessage}</p> : null}
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
