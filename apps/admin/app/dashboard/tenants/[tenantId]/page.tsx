'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  getAdminTenantResponseSchema,
  listAdminTenantMembersResponseSchema,
  listSuperAdminAuditLogsResponseSchema,
  tenantSubscriptionPlanSchema,
  type AdminTenant,
  type AdminTenantMember,
  type SuperAdminAuditLog,
  type TenantSubscription,
  type TenantSubscriptionPlan
} from '@eggturtle/shared';

import {
  AdminActionLink,
  AdminBadge,
  AdminPageHeader,
  AdminPanel,
  AdminTableFrame
} from '../../../../components/dashboard/polish-primitives';
import {
  ApiError,
  apiRequest,
  getAdminTenantSubscription,
  updateAdminTenantSubscription
} from '../../../../lib/api-client';

type DetailState = {
  loading: boolean;
  error: string | null;
  tenant: AdminTenant | null;
  members: AdminTenantMember[];
  recentLogs: SuperAdminAuditLog[];
};

type SubscriptionState = {
  loading: boolean;
  saving: boolean;
  error: string | null;
  actionMessage: string | null;
  subscription: TenantSubscription | null;
};

const subscriptionPlanOptions = tenantSubscriptionPlanSchema.options;

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
  const [subscriptionState, setSubscriptionState] = useState<SubscriptionState>({
    loading: true,
    saving: false,
    error: null,
    actionMessage: null,
    subscription: null
  });
  const [subscriptionPlan, setSubscriptionPlan] = useState<TenantSubscriptionPlan>('FREE');
  const [subscriptionExpiresAtInput, setSubscriptionExpiresAtInput] = useState('');
  const [subscriptionMaxImagesInput, setSubscriptionMaxImagesInput] = useState('');
  const [subscriptionMaxStorageBytesInput, setSubscriptionMaxStorageBytesInput] = useState('');
  const [subscriptionMaxSharesInput, setSubscriptionMaxSharesInput] = useState('');
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

  useEffect(() => {
    let cancelled = false;

    async function loadSubscription() {
      setSubscriptionState((previous) => ({
        ...previous,
        loading: true,
        error: null,
        actionMessage: null
      }));

      try {
        const response = await getAdminTenantSubscription(tenantId);
        if (cancelled) {
          return;
        }

        setSubscriptionState({
          loading: false,
          saving: false,
          error: null,
          actionMessage: null,
          subscription: response.subscription
        });
        setSubscriptionPlan(response.subscription.plan);
        setSubscriptionExpiresAtInput(toDateTimeLocalValue(response.subscription.expiresAt));
        setSubscriptionMaxImagesInput(toNullableNumberInputValue(response.subscription.maxImages));
        setSubscriptionMaxStorageBytesInput(response.subscription.maxStorageBytes ?? '');
        setSubscriptionMaxSharesInput(toNullableNumberInputValue(response.subscription.maxShares));
      } catch (error) {
        if (!cancelled) {
          setSubscriptionState((previous) => ({
            ...previous,
            loading: false,
            error: formatError(error),
            subscription: null
          }));
          setSubscriptionPlan('FREE');
          setSubscriptionExpiresAtInput('');
          setSubscriptionMaxImagesInput('');
          setSubscriptionMaxStorageBytesInput('');
          setSubscriptionMaxSharesInput('');
        }
      }
    }

    void loadSubscription();

    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  function handleMemberSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMemberSearch(memberSearchInput.trim());
  }

  async function handleSubscriptionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    let maxImages: number | null;
    let maxShares: number | null;
    let maxStorageBytes: string | null;

    try {
      maxImages = parseNullableInt(subscriptionMaxImagesInput, 'Max images');
      maxShares = parseNullableInt(subscriptionMaxSharesInput, 'Max shares');
      maxStorageBytes = parseNullableStorageBytes(subscriptionMaxStorageBytesInput);
    } catch (error) {
      setSubscriptionState((previous) => ({
        ...previous,
        error: error instanceof Error ? error.message : 'Invalid subscription input.'
      }));
      return;
    }

    const confirmMessage = [
      `Update subscription for tenant ${tenantId}?`,
      `Plan: ${subscriptionPlan}`,
      `Expiry: ${subscriptionExpiresAtInput ? subscriptionExpiresAtInput : 'Never'}`
    ].join('\n');

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setSubscriptionState((previous) => ({
      ...previous,
      saving: true,
      error: null,
      actionMessage: null
    }));

    try {
      const response = await updateAdminTenantSubscription(tenantId, {
        plan: subscriptionPlan,
        expiresAt: toIsoDateTimeOrNull(subscriptionExpiresAtInput),
        maxImages,
        maxStorageBytes,
        maxShares
      });

      setSubscriptionState({
        loading: false,
        saving: false,
        error: null,
        actionMessage: response.auditLogId
          ? `Subscription updated. Audit: ${response.auditLogId}`
          : 'Subscription updated successfully.',
        subscription: response.subscription
      });
      setSubscriptionPlan(response.subscription.plan);
      setSubscriptionExpiresAtInput(toDateTimeLocalValue(response.subscription.expiresAt));
      setSubscriptionMaxImagesInput(toNullableNumberInputValue(response.subscription.maxImages));
      setSubscriptionMaxStorageBytesInput(response.subscription.maxStorageBytes ?? '');
      setSubscriptionMaxSharesInput(toNullableNumberInputValue(response.subscription.maxShares));
    } catch (error) {
      setSubscriptionState((previous) => ({
        ...previous,
        saving: false,
        error: formatError(error)
      }));
    }
  }

  return (
    <section className="page admin-page">
      <AdminPageHeader
        eyebrow="Tenant Detail"
        title="租户详情"
        description="统一管理租户基础信息、Subscription 配额与成员关系。"
        actions={
          <div className="inline-actions">
            <AdminActionLink href="/dashboard/tenants">返回租户列表</AdminActionLink>
            <AdminActionLink href={`/dashboard/memberships?tenantId=${tenantId}`}>打开成员管理</AdminActionLink>
          </div>
        }
      />

      {state.tenant ? (
        <AdminPanel className="stack">
          <div className="admin-section-head">
            <h3>基础信息</h3>
            <p>租户标识、创建信息与成员规模。</p>
          </div>
          <dl className="detail-list admin-detail-list">
            <div>
              <dt>名称</dt>
              <dd>{state.tenant.name}</dd>
            </div>
            <div>
              <dt>Slug</dt>
              <dd className="mono">{state.tenant.slug}</dd>
            </div>
            <div>
              <dt>租户 ID</dt>
              <dd className="mono">{state.tenant.id}</dd>
            </div>
            <div>
              <dt>成员数</dt>
              <dd>{state.tenant.memberCount}</dd>
            </div>
            <div>
              <dt>创建时间</dt>
              <dd>{formatDate(state.tenant.createdAt)}</dd>
            </div>
          </dl>
        </AdminPanel>
      ) : null}

      <AdminPanel className="stack">
        <div className="admin-section-head">
          <h3>Subscription &amp; quota</h3>
          <p>查看当前订阅计划并按需调整资源配额。</p>
        </div>

        {subscriptionState.loading ? <p className="muted">Loading subscription...</p> : null}

        {subscriptionState.subscription ? (
          <dl className="detail-list admin-detail-list">
            <div>
              <dt>Plan</dt>
              <dd>
                <AdminBadge tone="accent">{subscriptionState.subscription.plan}</AdminBadge>
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <AdminBadge tone={toSubscriptionStatusTone(subscriptionState.subscription.status)}>
                  {subscriptionState.subscription.status}
                </AdminBadge>
              </dd>
            </div>
            <div>
              <dt>Expiry</dt>
              <dd>{formatOptionalDate(subscriptionState.subscription.expiresAt)}</dd>
            </div>
            <div>
              <dt>Max images</dt>
              <dd>{formatNullableValue(subscriptionState.subscription.maxImages)}</dd>
            </div>
            <div>
              <dt>Max storage (bytes)</dt>
              <dd>{formatNullableValue(subscriptionState.subscription.maxStorageBytes)}</dd>
            </div>
            <div>
              <dt>Max shares</dt>
              <dd>{formatNullableValue(subscriptionState.subscription.maxShares)}</dd>
            </div>
          </dl>
        ) : null}

        <form className="stack admin-subscription-form" onSubmit={handleSubscriptionSubmit}>
          <h3>Update subscription</h3>

          <div className="form-grid admin-subscription-grid">
            <label className="stack row-tight" htmlFor="subscription-plan">
              <span>Plan</span>
              <select
                id="subscription-plan"
                value={subscriptionPlan}
                onChange={(event) => setSubscriptionPlan(event.target.value as TenantSubscriptionPlan)}
                disabled={subscriptionState.saving}
              >
                {subscriptionPlanOptions.map((plan) => (
                  <option key={plan} value={plan}>
                    {plan}
                  </option>
                ))}
              </select>
            </label>

            <label className="stack row-tight" htmlFor="subscription-expires-at">
              <span>Expires at</span>
              <div className="inline-actions admin-inline-form">
                <input
                  id="subscription-expires-at"
                  type="datetime-local"
                  value={subscriptionExpiresAtInput}
                  onChange={(event) => setSubscriptionExpiresAtInput(event.target.value)}
                  disabled={subscriptionState.saving}
                />
                <button
                  className="secondary"
                  type="button"
                  onClick={() => setSubscriptionExpiresAtInput('')}
                  disabled={subscriptionState.saving}
                >
                  No expiry
                </button>
              </div>
            </label>

            <label className="stack row-tight" htmlFor="subscription-max-images">
              <span>Max images</span>
              <input
                id="subscription-max-images"
                type="number"
                min={0}
                step={1}
                value={subscriptionMaxImagesInput}
                onChange={(event) => setSubscriptionMaxImagesInput(event.target.value)}
                placeholder="Unlimited"
                disabled={subscriptionState.saving}
              />
            </label>

            <label className="stack row-tight" htmlFor="subscription-max-storage-bytes">
              <span>Max storage (bytes)</span>
              <input
                id="subscription-max-storage-bytes"
                type="text"
                inputMode="numeric"
                value={subscriptionMaxStorageBytesInput}
                onChange={(event) => setSubscriptionMaxStorageBytesInput(event.target.value)}
                placeholder="Unlimited"
                disabled={subscriptionState.saving}
              />
            </label>

            <label className="stack row-tight" htmlFor="subscription-max-shares">
              <span>Max shares</span>
              <input
                id="subscription-max-shares"
                type="number"
                min={0}
                step={1}
                value={subscriptionMaxSharesInput}
                onChange={(event) => setSubscriptionMaxSharesInput(event.target.value)}
                placeholder="Unlimited"
                disabled={subscriptionState.saving}
              />
            </label>
          </div>

          <div className="inline-actions">
            <button type="submit" disabled={subscriptionState.saving}>
              {subscriptionState.saving ? 'Saving...' : 'Save subscription'}
            </button>
          </div>
        </form>

        {subscriptionState.error ? <p className="error">{subscriptionState.error}</p> : null}
        {subscriptionState.actionMessage ? <p className="success">{subscriptionState.actionMessage}</p> : null}
      </AdminPanel>

      <AdminPanel className="stack">
        <div className="admin-section-head">
          <h3>成员列表</h3>
          <p>按邮箱筛选当前租户成员。</p>
        </div>

        <form className="inline-actions admin-inline-form" onSubmit={handleMemberSearch}>
          <input
            type="search"
            value={memberSearchInput}
            placeholder="按邮箱搜索成员"
            onChange={(event) => setMemberSearchInput(event.target.value)}
          />
          <button type="submit">应用</button>
          <button
            className="secondary"
            type="button"
            onClick={() => {
              setMemberSearchInput('');
              setMemberSearch('');
            }}
          >
            重置
          </button>
        </form>

        {state.loading ? <p className="muted">加载租户详情中...</p> : null}
        {!state.loading && state.members.length === 0 ? (
          <p className="muted">当前租户暂无成员。</p>
        ) : null}

        {state.members.length > 0 ? (
          <AdminTableFrame>
            <thead>
              <tr>
                <th>邮箱</th>
                <th>姓名</th>
                <th>角色</th>
                <th>加入时间</th>
              </tr>
            </thead>
            <tbody>
              {state.members.map((member) => (
                <tr key={`${member.tenantId}:${member.user.id}`}>
                  <td>{member.user.email}</td>
                  <td>{member.user.name ?? '-'}</td>
                  <td>
                    <AdminBadge tone={toRoleTone(member.role)}>{member.role}</AdminBadge>
                  </td>
                  <td>{formatDate(member.joinedAt)}</td>
                </tr>
              ))}
            </tbody>
          </AdminTableFrame>
        ) : null}
      </AdminPanel>

      <AdminPanel className="stack">
        <div className="admin-section-head">
          <h3>近期审计日志</h3>
          <p>默认展示最近 8 条与当前租户相关的操作记录。</p>
        </div>

        {state.recentLogs.length === 0 ? <p className="muted">该租户暂无审计记录。</p> : null}
        {state.recentLogs.length > 0 ? (
          <AdminTableFrame>
            <thead>
              <tr>
                <th>动作</th>
                <th>操作者</th>
                <th>时间</th>
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
          </AdminTableFrame>
        ) : null}
      </AdminPanel>

      {state.error ? <p className="error">{state.error}</p> : null}
    </section>
  );
}

function toNullableNumberInputValue(value: number | null) {
  return value === null ? '' : String(value);
}

function parseNullableInt(value: string, label: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }

  return parsed;
}

function parseNullableStorageBytes(value: string) {
  if (!value.trim()) {
    return null;
  }

  if (!/^\d+$/.test(value.trim())) {
    throw new Error('Max storage must be a non-negative integer in bytes.');
  }

  return value.trim();
}

function toDateTimeLocalValue(value: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const timezoneOffsetMinutes = date.getTimezoneOffset();
  const adjusted = new Date(date.getTime() - timezoneOffsetMinutes * 60 * 1000);
  return adjusted.toISOString().slice(0, 16);
}

function toIsoDateTimeOrNull(value: string) {
  if (!value.trim()) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatOptionalDate(value: string | null) {
  if (!value) {
    return 'Never';
  }

  return formatDate(value);
}

function formatNullableValue(value: string | number | null) {
  if (value === null) {
    return 'Unlimited';
  }

  return String(value);
}

function toRoleTone(role: string): 'accent' | 'info' | 'warning' | 'neutral' {
  if (role === 'OWNER') {
    return 'accent';
  }

  if (role === 'ADMIN') {
    return 'info';
  }

  if (role === 'EDITOR') {
    return 'warning';
  }

  return 'neutral';
}

function toSubscriptionStatusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'ACTIVE') {
    return 'success';
  }

  if (status === 'TRIALING') {
    return 'warning';
  }

  if (status === 'EXPIRED' || status === 'CANCELED') {
    return 'danger';
  }

  return 'neutral';
}

function formatError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.errorCode) {
      return `${error.message} (errorCode: ${error.errorCode})`;
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '未知错误';
}
