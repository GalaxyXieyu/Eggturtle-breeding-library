'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ErrorCode,
  deleteTenantMemberResponseSchema,
  listAdminTenantMembersResponseSchema,
  listAdminTenantsResponseSchema,
  meResponseSchema,
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [confirmingRemoveUserId, setConfirmingRemoveUserId] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [memberReloadSignal, setMemberReloadSignal] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentUser() {
      try {
        const response = await apiRequest('/api/auth/session', {
          responseSchema: meResponseSchema
        });

        if (!cancelled) {
          setCurrentUserId(response.user.id);
        }
      } catch {
        if (!cancelled) {
          setCurrentUserId(null);
        }
      }
    }

    void loadCurrentUser();

    return () => {
      cancelled = true;
    };
  }, []);

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
      setConfirmingRemoveUserId(null);
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
        setConfirmingRemoveUserId((previous) =>
          previous && response.members.every((member) => member.user.id !== previous) ? null : previous
        );
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
  }, [memberReloadSignal, memberSearch, selectedTenantId]);

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

  async function handleRemoveMember(member: AdminTenantMember) {
    if (!selectedTenantId || removingUserId) {
      return;
    }

    setRemovingUserId(member.user.id);
    setStatus((previous) => ({ ...previous, error: null, actionMessage: null }));

    let shouldReload = false;

    try {
      const response = await apiRequest(
        `/admin/tenants/${selectedTenantId}/members/${member.user.id}`,
        {
          method: 'DELETE',
          responseSchema: deleteTenantMemberResponseSchema
        }
      );

      setMembers((previous) => previous.filter((item) => item.user.id !== response.userId));
      setStatus((previous) => ({
        ...previous,
        actionMessage: `Removed ${member.user.email}. Audit: ${response.auditLogId}`
      }));

      shouldReload = true;
    } catch (error) {
      if (isTenantMemberNotFoundError(error)) {
        setMembers((previous) => previous.filter((item) => item.user.id !== member.user.id));
        shouldReload = true;
      }

      setStatus((previous) => ({
        ...previous,
        error: formatRemoveMemberError(error)
      }));
    } finally {
      setRemovingUserId(null);
      setConfirmingRemoveUserId(null);
      if (shouldReload) {
        setMemberReloadSignal((previous) => previous + 1);
      }
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
        <h2>租户成员管理</h2>
        <p>按租户查看成员并调整角色，所有写操作都会记录审计日志。</p>
      </header>

      <article className="card stack">
        <h3>租户范围</h3>
        {status.loadingTenants ? <p className="muted">加载租户中...</p> : null}
        {!status.loadingTenants && tenants.length === 0 ? (
          <p className="muted">暂无可用租户。</p>
        ) : null}

        <div className="inline-actions">
          <label htmlFor="membership-tenant">租户</label>
          <select
            id="membership-tenant"
            value={selectedTenantId}
            onChange={(event) => {
              setSelectedTenantId(event.target.value);
              setConfirmingRemoveUserId(null);
            }}
            disabled={tenants.length === 0 || status.saving || Boolean(removingUserId)}
          >
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name} ({tenant.slug})
              </option>
            ))}
          </select>
          {selectedTenant ? (
            <Link className="nav-link" href={`/dashboard/tenants/${selectedTenant.id}`}>
              查看租户详情
            </Link>
          ) : null}
        </div>
      </article>

      <form className="card stack" onSubmit={handleAddMember}>
        <h3>新增成员 / 按邮箱更新角色</h3>
        <div className="inline-actions">
          <input
            type="email"
            value={newMemberEmail}
            placeholder="member@example.com（请输入成员邮箱）"
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
          <button type="submit" disabled={!selectedTenantId || status.saving || Boolean(removingUserId)}>
            {status.saving ? '保存中...' : '应用角色'}
          </button>
        </div>
      </form>

      <article className="card stack">
        <h3>成员列表</h3>
        <form className="inline-actions" onSubmit={handleSearchSubmit}>
          <input
            type="search"
            value={searchInput}
            placeholder="按邮箱搜索成员"
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <button type="submit">应用</button>
          <button
            className="secondary"
            type="button"
            onClick={() => {
              setSearchInput('');
              setMemberSearch('');
            }}
          >
            重置
          </button>
        </form>

        {status.loadingMembers ? <p className="muted">加载成员中...</p> : null}
        {!status.loadingMembers && members.length === 0 ? (
          <p className="muted">该租户下没有匹配成员。</p>
        ) : null}

        {members.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>邮箱</th>
                <th>姓名</th>
                <th>角色</th>
                <th>加入时间</th>
                <th>操作</th>
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
                      disabled={status.saving || Boolean(removingUserId)}
                    >
                      {tenantRoleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{formatDate(member.joinedAt)}</td>
                  <td>
                    {confirmingRemoveUserId === member.user.id ? (
                      <div className="inline-actions">
                        <button
                          type="button"
                          onClick={() => void handleRemoveMember(member)}
                          disabled={Boolean(removingUserId)}
                        >
                          {removingUserId === member.user.id ? '移除中...' : '确认移除'}
                        </button>
                        <button
                          className="secondary"
                          type="button"
                          onClick={() => setConfirmingRemoveUserId(null)}
                          disabled={Boolean(removingUserId)}
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <div className="inline-actions">
                        <button
                          className="secondary"
                          type="button"
                          onClick={() => setConfirmingRemoveUserId(member.user.id)}
                          disabled={
                            status.saving ||
                            Boolean(removingUserId) ||
                            member.user.id === currentUserId
                          }
                        >
                          移除
                        </button>
                        {member.user.id === currentUserId ? <span className="muted">当前账号</span> : null}
                      </div>
                    )}
                  </td>
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
    return `已新增成员 ${response.user.email}，角色：${response.role}。审计ID：${response.auditLogId}`;
  }

  const previousRoleLabel = response.previousRole ?? 'UNKNOWN';
  return `已将 ${response.user.email} 从 ${previousRoleLabel} 调整为 ${response.role}。审计ID：${response.auditLogId}`;
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

  return '未知错误';
}

function isTenantMemberNotFoundError(error: unknown) {
  return error instanceof ApiError && error.errorCode === ErrorCode.TenantMemberNotFound;
}

function formatRemoveMemberError(error: unknown) {
  if (isTenantMemberNotFoundError(error)) {
    return '成员已不存在，列表已刷新。';
  }

  return formatError(error);
}
