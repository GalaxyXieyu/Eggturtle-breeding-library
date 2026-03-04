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
  apiRequest,
  getAdminTenantSubscription,
  reactivateAdminTenant,
  suspendAdminTenant,
  updateAdminTenantSubscription
} from '../../../../lib/api-client';
import {
  formatAuditActionLabel,
  formatPlanLabel,
  formatSubscriptionStatusLabel,
  formatTenantRoleLabel
} from '../../../../lib/admin-labels';
import { formatDateTime, formatUnknownError } from '../../../../lib/formatters';

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

type LifecycleState = {
  reason: string;
  suspending: boolean;
  reactivating: boolean;
  error: string | null;
  actionMessage: string | null;
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
  const [lifecycleState, setLifecycleState] = useState<LifecycleState>({
    reason: '',
    suspending: false,
    reactivating: false,
    error: null,
    actionMessage: null
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
            error: formatUnknownError(error, { includeErrorCode: true })
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
        setLifecycleState((previous) => ({
          ...previous,
          reason: response.subscription.disabledReason ?? '',
          error: null,
          actionMessage: null
        }));
      } catch (error) {
        if (!cancelled) {
          setSubscriptionState((previous) => ({
            ...previous,
            loading: false,
            error: formatUnknownError(error, { includeErrorCode: true }),
            subscription: null
          }));
          setSubscriptionPlan('FREE');
          setSubscriptionExpiresAtInput('');
          setSubscriptionMaxImagesInput('');
          setSubscriptionMaxStorageBytesInput('');
          setSubscriptionMaxSharesInput('');
          setLifecycleState((previous) => ({
            ...previous,
            reason: '',
            error: null,
            actionMessage: null
          }));
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

  function applySubscriptionSnapshot(subscription: TenantSubscription, actionMessage: string | null) {
    setSubscriptionState({
      loading: false,
      saving: false,
      error: null,
      actionMessage,
      subscription
    });
    setSubscriptionPlan(subscription.plan);
    setSubscriptionExpiresAtInput(toDateTimeLocalValue(subscription.expiresAt));
    setSubscriptionMaxImagesInput(toNullableNumberInputValue(subscription.maxImages));
    setSubscriptionMaxStorageBytesInput(subscription.maxStorageBytes ?? '');
    setSubscriptionMaxSharesInput(toNullableNumberInputValue(subscription.maxShares));
  }

  async function handleSubscriptionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    let maxImages: number | null;
    let maxShares: number | null;
    let maxStorageBytes: string | null;

    try {
      maxImages = parseNullableInt(subscriptionMaxImagesInput, '图片上限');
      maxShares = parseNullableInt(subscriptionMaxSharesInput, '分享上限');
      maxStorageBytes = parseNullableStorageBytes(subscriptionMaxStorageBytesInput);
    } catch (error) {
      setSubscriptionState((previous) => ({
        ...previous,
        error: error instanceof Error ? error.message : '订阅参数格式不正确。'
      }));
      return;
    }

    const confirmMessage = [
      `确认更新租户 ${tenantId} 的订阅配置吗？`,
      `套餐：${formatPlanLabel(subscriptionPlan)}（${subscriptionPlan}）`,
      `到期时间：${subscriptionExpiresAtInput ? subscriptionExpiresAtInput : '无到期'}`
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

      applySubscriptionSnapshot(
        response.subscription,
        response.auditLogId
          ? `订阅已更新。审计ID：${response.auditLogId}`
          : '订阅已更新。'
      );
      setLifecycleState((previous) => ({
        ...previous,
        reason: response.subscription.disabledReason ?? previous.reason,
        error: null
      }));
    } catch (error) {
      setSubscriptionState((previous) => ({
        ...previous,
        saving: false,
        error: formatUnknownError(error, { includeErrorCode: true })
      }));
    }
  }

  async function handleSuspendSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = lifecycleState.reason.trim();
    if (!reason) {
      setLifecycleState((previous) => ({
        ...previous,
        error: '请填写冻结原因。'
      }));
      return;
    }

    const confirmMessage = [`确认冻结租户 ${tenantId} 吗？`, `原因：${reason}`].join('\n');
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setLifecycleState((previous) => ({
      ...previous,
      suspending: true,
      error: null,
      actionMessage: null
    }));

    try {
      const response = await suspendAdminTenant(tenantId, { reason });
      applySubscriptionSnapshot(
        response.subscription,
        response.auditLogId ? `生命周期状态已更新。审计ID：${response.auditLogId}` : '租户已冻结。'
      );
      setLifecycleState((previous) => ({
        ...previous,
        reason: response.subscription.disabledReason ?? reason,
        suspending: false,
        error: null,
        actionMessage: response.auditLogId
          ? `租户已冻结。审计ID：${response.auditLogId}`
          : '租户已冻结。'
      }));
    } catch (error) {
      setLifecycleState((previous) => ({
        ...previous,
        suspending: false,
        error: formatUnknownError(error, { includeErrorCode: true })
      }));
    }
  }

  async function handleReactivateTenant() {
    const confirmMessage = `确认恢复租户 ${tenantId} 吗？`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setLifecycleState((previous) => ({
      ...previous,
      reactivating: true,
      error: null,
      actionMessage: null
    }));

    try {
      const response = await reactivateAdminTenant(tenantId);
      applySubscriptionSnapshot(
        response.subscription,
        response.auditLogId ? `生命周期状态已更新。审计ID：${response.auditLogId}` : '租户已恢复。'
      );
      setLifecycleState((previous) => ({
        ...previous,
        reason: '',
        reactivating: false,
        error: null,
        actionMessage: response.auditLogId
          ? `租户已恢复。审计ID：${response.auditLogId}`
          : '租户已恢复。'
      }));
    } catch (error) {
      setLifecycleState((previous) => ({
        ...previous,
        reactivating: false,
        error: formatUnknownError(error, { includeErrorCode: true })
      }));
    }
  }

  return (
    <section className="page admin-page">
      <AdminPageHeader
        eyebrow="租户治理"
        title="租户详情"
        description="统一管理租户基础信息、订阅配额与成员关系。"
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
              <dd>{formatDateTime(state.tenant.createdAt)}</dd>
            </div>
          </dl>
        </AdminPanel>
      ) : null}

      <AdminPanel className="stack">
        <div className="admin-section-head">
          <h3>订阅与配额</h3>
          <p>查看当前订阅计划并按需调整资源配额。</p>
        </div>

        {subscriptionState.loading ? <p className="muted">加载订阅数据中...</p> : null}

        {subscriptionState.subscription ? (
          <dl className="detail-list admin-detail-list">
            <div>
              <dt>套餐</dt>
              <dd>
                <div className="stack row-tight">
                  <AdminBadge tone="accent">{formatPlanLabel(subscriptionState.subscription.plan)}</AdminBadge>
                  <span className="mono muted">{subscriptionState.subscription.plan}</span>
                </div>
              </dd>
            </div>
            <div>
              <dt>状态</dt>
              <dd>
                <AdminBadge tone={toSubscriptionStatusTone(subscriptionState.subscription.status)}>
                  {formatSubscriptionStatusLabel(subscriptionState.subscription.status)}
                </AdminBadge>
              </dd>
            </div>
            {subscriptionState.subscription.disabledAt ? (
              <div>
                <dt>冻结时间</dt>
                <dd>{formatDateTime(subscriptionState.subscription.disabledAt)}</dd>
              </div>
            ) : null}
            {subscriptionState.subscription.disabledReason ? (
              <div>
                <dt>冻结原因</dt>
                <dd>{subscriptionState.subscription.disabledReason}</dd>
              </div>
            ) : null}
            <div>
              <dt>到期时间</dt>
              <dd>{formatOptionalDate(subscriptionState.subscription.expiresAt)}</dd>
            </div>
            <div>
              <dt>图片上限</dt>
              <dd>{formatNullableValue(subscriptionState.subscription.maxImages)}</dd>
            </div>
            <div>
              <dt>存储上限（字节）</dt>
              <dd>{formatNullableValue(subscriptionState.subscription.maxStorageBytes)}</dd>
            </div>
            <div>
              <dt>分享上限</dt>
              <dd>{formatNullableValue(subscriptionState.subscription.maxShares)}</dd>
            </div>
          </dl>
        ) : null}

        <form className="stack admin-subscription-form" onSubmit={handleSubscriptionSubmit}>
          <h3>更新订阅</h3>

          <div className="form-grid admin-subscription-grid">
            <label className="stack row-tight" htmlFor="subscription-plan">
              <span>套餐</span>
              <select
                id="subscription-plan"
                value={subscriptionPlan}
                onChange={(event) => setSubscriptionPlan(event.target.value as TenantSubscriptionPlan)}
                disabled={subscriptionState.saving}
              >
                {subscriptionPlanOptions.map((plan) => (
                  <option key={plan} value={plan}>
                    {formatPlanLabel(plan)}（{plan}）
                  </option>
                ))}
              </select>
            </label>

            <label className="stack row-tight" htmlFor="subscription-expires-at">
              <span>到期时间</span>
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
                  无到期
                </button>
              </div>
            </label>

            <label className="stack row-tight" htmlFor="subscription-max-images">
              <span>图片上限</span>
              <input
                id="subscription-max-images"
                type="number"
                min={0}
                step={1}
                value={subscriptionMaxImagesInput}
                onChange={(event) => setSubscriptionMaxImagesInput(event.target.value)}
                placeholder="不限制"
                disabled={subscriptionState.saving}
              />
            </label>

            <label className="stack row-tight" htmlFor="subscription-max-storage-bytes">
              <span>存储上限（字节）</span>
              <input
                id="subscription-max-storage-bytes"
                type="text"
                inputMode="numeric"
                value={subscriptionMaxStorageBytesInput}
                onChange={(event) => setSubscriptionMaxStorageBytesInput(event.target.value)}
                placeholder="不限制"
                disabled={subscriptionState.saving}
              />
            </label>

            <label className="stack row-tight" htmlFor="subscription-max-shares">
              <span>分享上限</span>
              <input
                id="subscription-max-shares"
                type="number"
                min={0}
                step={1}
                value={subscriptionMaxSharesInput}
                onChange={(event) => setSubscriptionMaxSharesInput(event.target.value)}
                placeholder="不限制"
                disabled={subscriptionState.saving}
              />
            </label>
          </div>

          <div className="inline-actions">
            <button type="submit" disabled={subscriptionState.saving}>
              {subscriptionState.saving ? '保存中...' : '保存订阅'}
            </button>
          </div>
        </form>

        <form className="stack admin-subscription-form" onSubmit={handleSuspendSubmit}>
          <h3>生命周期控制</h3>
          <p className="muted">冻结后租户写操作会被拒绝，直至恢复。</p>

          <label className="stack row-tight" htmlFor="tenant-suspend-reason">
            <span>冻结原因</span>
            <input
              id="tenant-suspend-reason"
              type="text"
              maxLength={255}
              value={lifecycleState.reason}
              onChange={(event) =>
                setLifecycleState((previous) => ({
                  ...previous,
                  reason: event.target.value,
                  error: null
                }))
              }
              placeholder="例如：账单逾期 / 风险排查"
              disabled={subscriptionState.saving || lifecycleState.suspending || lifecycleState.reactivating}
            />
          </label>

          <div className="inline-actions">
            <button
              type="submit"
              disabled={subscriptionState.saving || lifecycleState.suspending || lifecycleState.reactivating}
            >
              {lifecycleState.suspending ? '冻结中...' : '冻结租户'}
            </button>
            <button
              className="secondary"
              type="button"
              onClick={handleReactivateTenant}
              disabled={subscriptionState.saving || lifecycleState.suspending || lifecycleState.reactivating}
            >
              {lifecycleState.reactivating ? '恢复中...' : '恢复租户'}
            </button>
          </div>
        </form>

        {subscriptionState.error ? <p className="error">{subscriptionState.error}</p> : null}
        {subscriptionState.actionMessage ? <p className="success">{subscriptionState.actionMessage}</p> : null}
        {lifecycleState.error ? <p className="error">{lifecycleState.error}</p> : null}
        {lifecycleState.actionMessage ? <p className="success">{lifecycleState.actionMessage}</p> : null}
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
                    <AdminBadge tone={toRoleTone(member.role)}>{formatTenantRoleLabel(member.role)}</AdminBadge>
                  </td>
                  <td>{formatDateTime(member.joinedAt)}</td>
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
                  <td>{formatAuditActionLabel(log.action)}</td>
                  <td>{log.actorUserEmail ?? log.actorUserId}</td>
                  <td>{formatDateTime(log.createdAt)}</td>
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
    throw new Error(`${label} 必须是大于等于 0 的整数。`);
  }

  return parsed;
}

function parseNullableStorageBytes(value: string) {
  if (!value.trim()) {
    return null;
  }

  if (!/^\d+$/.test(value.trim())) {
    throw new Error('存储上限必须是大于等于 0 的整数（字节）。');
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

function formatOptionalDate(value: string | null) {
  if (!value) {
    return '无到期';
  }

  return formatDateTime(value);
}

function formatNullableValue(value: string | number | null) {
  if (value === null) {
    return '不限制';
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

  if (status === 'DISABLED') {
    return 'danger';
  }

  if (status === 'TRIALING') {
    return 'warning';
  }

  if (status === 'EXPIRED' || status === 'CANCELED') {
    return 'danger';
  }

  return 'neutral';
}
