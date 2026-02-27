'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  listAdminTenantMembersResponseSchema,
  listAdminTenantsResponseSchema,
  upsertTenantMemberRequestSchema,
  upsertTenantMemberResponseSchema,
  type AdminTenant,
  type AdminTenantMember,
  type TenantRole
} from '@eggturtle/shared';

import { ApiError, apiRequest } from '../../../lib/api-client';

type PageState = {
  loadingTenants: boolean;
  loadingMembers: boolean;
  saving: boolean;
  error: string | null;
  actionMessage: string | null;
};

const tenantRoleOptions: TenantRole[] = ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER'];

export default function DashboardMembershipsPage() {
  const searchParams = useSearchParams();
  const presetTenantId = searchParams.get('tenantId');

  const [status, setStatus] = useState<PageState>({
    loadingTenants: true,
    loadingMembers: false,
    saving: false,
    error: null,
    actionMessage: null
  });
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [members, setMembers] = useState<AdminTenantMember[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<TenantRole>('VIEWER');

  useEffect(() => {
    let cancelled = false;

    async function loadTenants() {
      setStatus((previous) => ({ ...previous, loadingTenants: true, error: null }));

      try {
        const response = await apiRequest('/admin/tenants', {
          responseSchema: listAdminTenantsResponseSchema
        });

        if (cancelled) {
          return;
        }

        setTenants(response.tenants);
        const fallbackTenantId = response.tenants[0]?.id ?? '';
        const initialTenantId =
          presetTenantId && response.tenants.some((tenant) => tenant.id === presetTenantId)
            ? presetTenantId
            : fallbackTenantId;

        setSelectedTenantId(initialTenantId);
        setStatus((previous) => ({ ...previous, loadingTenants: false }));
      } catch (error) {
        if (!cancelled) {
          setStatus((previous) => ({
            ...previous,
            loadingTenants: false,
            error: formatError(error)
          }));
        }
      }
    }

    void loadTenants();

    return () => {
      cancelled = true;
    };
  }, [presetTenantId]);

  useEffect(() => {
    if (!selectedTenantId) {
      setMembers([]);
      return;
    }

    let cancelled = false;

    async function loadMembers() {
      setStatus((previous) => ({ ...previous, loadingMembers: true, error: null }));

      try {
        const query = new URLSearchParams();
        if (memberSearch.trim()) {
          query.set('search', memberSearch.trim());
        }

        const response = await apiRequest(
          `/admin/tenants/${selectedTenantId}/members${query.size ? `?${query.toString()}` : ''}`,
          {
            responseSchema: listAdminTenantMembersResponseSchema
          }
        );

        if (cancelled) {
          return;
        }

        setMembers(response.members);
        setStatus((previous) => ({ ...previous, loadingMembers: false }));
      } catch (error) {
        if (!cancelled) {
          setStatus((previous) => ({
            ...previous,
            loadingMembers: false,
            error: formatError(error)
          }));
        }
      }
    }

    void loadMembers();

    return () => {
      cancelled = true;
    };
  }, [memberSearch, selectedTenantId]);

  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === selectedTenantId) ?? null,
    [selectedTenantId, tenants]
  );

  async function applyRoleChange(email: string, role: TenantRole) {
    if (!selectedTenantId) {
      return;
    }

    setStatus((previous) => ({ ...previous, saving: true, error: null, actionMessage: null }));

    try {
      const payload = upsertTenantMemberRequestSchema.parse({ email, role });
      const response = await apiRequest(`/admin/tenants/${selectedTenantId}/members`, {
        method: 'POST',
        body: payload,
        requestSchema: upsertTenantMemberRequestSchema,
        responseSchema: upsertTenantMemberResponseSchema
      });

      setMembers((previous) => {
        const index = previous.findIndex(
          (member) => member.user.email.toLowerCase() === response.user.email.toLowerCase()
        );

        const nextMember: AdminTenantMember = {
          tenantId: selectedTenantId,
          user: response.user,
          role: response.role,
          joinedAt: response.joinedAt
        };

        if (index < 0) {
          return [nextMember, ...previous];
        }

        const next = [...previous];
        next[index] = {
          ...previous[index],
          role: response.role
        };
        return next;
      });

      setStatus((previous) => ({
        ...previous,
        saving: false,
        actionMessage: buildActionMessage(response)
      }));
    } catch (error) {
      setStatus((previous) => ({
        ...previous,
        saving: false,
        error: formatError(error)
      }));
    }
  }

  async function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newMemberEmail.trim()) {
      return;
    }

    await applyRoleChange(newMemberEmail.trim(), newMemberRole);
    setNewMemberEmail('');
    setNewMemberRole('VIEWER');
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMemberSearch(searchInput.trim());
  }

  return (
    <section className="page">
      <header className="page-header">
        <h2>Tenant memberships</h2>
        <p>View tenant members and update roles with auditable server-side writes.</p>
      </header>

      <article className="card stack">
        <h3>Tenant scope</h3>
        {status.loadingTenants ? <p className="muted">Loading tenants...</p> : null}
        {!status.loadingTenants && tenants.length === 0 ? (
          <p className="muted">No tenants available yet.</p>
        ) : null}

        <div className="inline-actions">
          <label htmlFor="membership-tenant">Tenant</label>
          <select
            id="membership-tenant"
            value={selectedTenantId}
            onChange={(event) => setSelectedTenantId(event.target.value)}
            disabled={tenants.length === 0}
          >
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name} ({tenant.slug})
              </option>
            ))}
          </select>
          {selectedTenant ? (
            <Link className="nav-link" href={`/dashboard/tenants/${selectedTenant.id}`}>
              Open tenant detail
            </Link>
          ) : null}
        </div>
      </article>

      <form className="card stack" onSubmit={handleAddMember}>
        <h3>Add member / update by email</h3>
        <div className="inline-actions">
          <input
            type="email"
            value={newMemberEmail}
            placeholder="member@example.com"
            onChange={(event) => setNewMemberEmail(event.target.value)}
            required
          />
          <select value={newMemberRole} onChange={(event) => setNewMemberRole(event.target.value as TenantRole)}>
            {tenantRoleOptions.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <button type="submit" disabled={!selectedTenantId || status.saving}>
            {status.saving ? 'Saving...' : 'Apply role'}
          </button>
        </div>
      </form>

      <article className="card stack">
        <h3>Members</h3>
        <form className="inline-actions" onSubmit={handleSearchSubmit}>
          <input
            type="search"
            value={searchInput}
            placeholder="Search members by email"
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <button type="submit">Apply</button>
          <button
            className="secondary"
            type="button"
            onClick={() => {
              setSearchInput('');
              setMemberSearch('');
            }}
          >
            Reset
          </button>
        </form>

        {status.loadingMembers ? <p className="muted">Loading members...</p> : null}
        {!status.loadingMembers && members.length === 0 ? (
          <p className="muted">No members found for this tenant.</p>
        ) : null}

        {members.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Role</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={`${member.tenantId}:${member.user.id}`}>
                  <td>{member.user.email}</td>
                  <td>{member.user.name ?? '-'}</td>
                  <td>
                    <select
                      value={member.role}
                      onChange={(event) =>
                        void applyRoleChange(member.user.email, event.target.value as TenantRole)
                      }
                      disabled={status.saving}
                    >
                      {tenantRoleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{formatDate(member.joinedAt)}</td>
                  <td className="muted">Updated via audit log</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </article>

      {status.error ? <p className="error">{status.error}</p> : null}
      {status.actionMessage ? <p className="success">{status.actionMessage}</p> : null}
    </section>
  );
}

function buildActionMessage(response: {
  user: { email: string };
  role: TenantRole;
  created: boolean;
  previousRole: TenantRole | null;
  auditLogId: string;
}) {
  if (response.created) {
    return `Added ${response.user.email} as ${response.role}. Audit: ${response.auditLogId}`;
  }

  const previousRoleLabel = response.previousRole ?? 'UNKNOWN';
  return `Updated ${response.user.email} from ${previousRoleLabel} to ${response.role}. Audit: ${response.auditLogId}`;
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
