'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  getAdminTenantResponseSchema,
  listAdminTenantMembersResponseSchema,
  listSuperAdminAuditLogsResponseSchema,
  type AdminTenant,
  type AdminTenantMember,
  type SuperAdminAuditLog
} from '@eggturtle/shared';

import { ApiError, apiRequest } from '../../../../lib/api-client';

type DetailState = {
  loading: boolean;
  error: string | null;
  tenant: AdminTenant | null;
  members: AdminTenantMember[];
  recentLogs: SuperAdminAuditLog[];
};

export default function TenantDetailPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;

  const [state, setState] = useState<DetailState>({
    loading: true,
    error: null,
    tenant: null,
    members: [],
    recentLogs: []
  });
  const [memberSearchInput, setMemberSearchInput] = useState('');
  const [memberSearch, setMemberSearch] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState((previous) => ({ ...previous, loading: true, error: null }));

      try {
        const memberQuery = new URLSearchParams();
        if (memberSearch.trim()) {
          memberQuery.set('search', memberSearch.trim());
        }

        const [tenantResponse, memberResponse, logResponse] = await Promise.all([
          apiRequest(`/admin/tenants/${tenantId}`, {
            responseSchema: getAdminTenantResponseSchema
          }),
          apiRequest(
            `/admin/tenants/${tenantId}/members${memberQuery.size ? `?${memberQuery.toString()}` : ''}`,
            {
              responseSchema: listAdminTenantMembersResponseSchema
            }
          ),
          apiRequest(`/admin/audit-logs?tenantId=${tenantId}&page=1&pageSize=8`, {
            responseSchema: listSuperAdminAuditLogsResponseSchema
          })
        ]);

        if (cancelled) {
          return;
        }

        setState({
          loading: false,
          error: null,
          tenant: tenantResponse.tenant,
          members: memberResponse.members,
          recentLogs: logResponse.logs
        });
      } catch (error) {
        if (!cancelled) {
          setState((previous) => ({
            ...previous,
            loading: false,
            error: formatError(error)
          }));
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [memberSearch, tenantId]);

  function handleMemberSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMemberSearch(memberSearchInput.trim());
  }

  return (
    <section className="page">
      <header className="page-header">
        <h2>Tenant detail</h2>
        <p>Inspect tenant profile, member roster, and recent audit actions.</p>
      </header>

      <div className="inline-actions">
        <Link className="nav-link" href="/dashboard/tenants">
          Back to tenant list
        </Link>
        <Link className="nav-link" href={`/dashboard/memberships?tenantId=${tenantId}`}>
          Manage memberships
        </Link>
      </div>

      {state.tenant ? (
        <article className="card stack">
          <h3>Profile</h3>
          <dl className="detail-list">
            <div>
              <dt>Name</dt>
              <dd>{state.tenant.name}</dd>
            </div>
            <div>
              <dt>Slug</dt>
              <dd className="mono">{state.tenant.slug}</dd>
            </div>
            <div>
              <dt>Tenant ID</dt>
              <dd className="mono">{state.tenant.id}</dd>
            </div>
            <div>
              <dt>Members</dt>
              <dd>{state.tenant.memberCount}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatDate(state.tenant.createdAt)}</dd>
            </div>
          </dl>
        </article>
      ) : null}

      <article className="card stack">
        <h3>Members</h3>
        <form className="inline-actions" onSubmit={handleMemberSearch}>
          <input
            type="search"
            value={memberSearchInput}
            placeholder="Search members by email"
            onChange={(event) => setMemberSearchInput(event.target.value)}
          />
          <button type="submit">Apply</button>
          <button
            className="secondary"
            type="button"
            onClick={() => {
              setMemberSearchInput('');
              setMemberSearch('');
            }}
          >
            Reset
          </button>
        </form>

        {state.loading ? <p className="muted">Loading tenant detail...</p> : null}
        {!state.loading && state.members.length === 0 ? (
          <p className="muted">No members found for this tenant.</p>
        ) : null}

        {state.members.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Role</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {state.members.map((member) => (
                <tr key={`${member.tenantId}:${member.user.id}`}>
                  <td>{member.user.email}</td>
                  <td>{member.user.name ?? '-'}</td>
                  <td>{member.role}</td>
                  <td>{formatDate(member.joinedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </article>

      <article className="card stack">
        <h3>Recent audit logs</h3>
        {state.recentLogs.length === 0 ? <p className="muted">No tenant audit logs yet.</p> : null}
        {state.recentLogs.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Actor</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {state.recentLogs.map((log) => (
                <tr key={log.id}>
                  <td>{log.action}</td>
                  <td>{log.actorUserEmail ?? log.actorUserId}</td>
                  <td>{formatDate(log.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </article>

      {state.error ? <p className="error">{state.error}</p> : null}
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
