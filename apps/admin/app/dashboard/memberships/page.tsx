'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  listAdminTenantsResponseSchema,
  upsertTenantMemberRequestSchema,
  upsertTenantMemberResponseSchema,
  type Tenant,
  type TenantRole
} from '@eggturtle/shared';

import { ApiError, apiRequest } from '../../../lib/api-client';

type PageState = {
  loading: boolean;
  error: string | null;
  actionMessage: string | null;
};

const tenantRoleOptions: TenantRole[] = ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER'];

export default function DashboardMembershipsPage() {
  const [status, setStatus] = useState<PageState>({
    loading: true,
    error: null,
    actionMessage: null
  });
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<TenantRole>('VIEWER');
  const [saving, setSaving] = useState(false);

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
        setSelectedTenantId(response.tenants[0]?.id ?? '');
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTenantId) {
      setStatus((previous) => ({ ...previous, error: 'Select a tenant first.' }));
      return;
    }

    setSaving(true);
    setStatus((previous) => ({ ...previous, error: null, actionMessage: null }));

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

      const targetTenant = tenants.find((tenant) => tenant.id === selectedTenantId);
      setMemberEmail('');
      setStatus((previous) => ({
        ...previous,
        actionMessage: `${response.created ? 'Added' : 'Updated'} ${response.user.email} as ${response.role} for ${targetTenant?.slug ?? response.tenantId}.`
      }));
    } catch (error) {
      setStatus((previous) => ({ ...previous, error: formatError(error) }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <h2>Memberships</h2>
        <p>Grant or update tenant membership by user email and role.</p>
      </header>

      <form className="card stack" onSubmit={handleSubmit}>
        <h3>Grant membership</h3>
        <div className="form-grid">
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
        </div>

        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Grant membership'}
        </button>
      </form>

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
