'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  getAdminTenantResponseSchema,
  listAdminTenantMembersResponseSchema,
  listSuperAdminAuditLogsResponseSchema,
  tenantSubscriptionPlanSchema,
  type AdminTenant,
  type AdminTenantInsights,
  type AdminTenantMember,
  type SuperAdminAuditLog,
  type TenantSubscription,
  type TenantSubscriptionPlan,
} from '@eggturtle/shared';

import {
  AdminActionLink,
  AdminBadge,
  AdminPageHeader,
  AdminPanel,
  AdminSectionNav,
  AdminTableFrame,
} from '@/components/dashboard/polish-primitives';
import {
  apiRequest,
  createAdminTenantSubscriptionActivationCode,
  getAdminTenantInsights,
  getAdminTenantSubscription,
  reactivateAdminTenant,
  suspendAdminTenant,
  updateAdminTenantSubscription,
} from '@/lib/api-client';
import {
  formatAuditActionLabel,
  formatBusinessAuditActionLabel,
  formatPlanLabel,
  formatSubscriptionStatusLabel,
  formatTenantRoleLabel,
} from '@/lib/admin-labels';
import { formatDateTime, formatUnknownError } from '@/lib/formatters';

type DetailState = {
  loading: boolean;
  error: string | null;
  tenant: AdminTenant | null;
  members: AdminTenantMember[];
  recentLogs: SuperAdminAuditLog[];
};

type InsightsState = {
  loading: boolean;
  error: string | null;
  insights: AdminTenantInsights | null;
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

type ActivationCodeState = {
  saving: boolean;
  error: string | null;
  actionMessage: string | null;
  generatedCode: string | null;
  generatedCodeLabel: string | null;
};

type ClipboardCopyResult = 'copied' | 'unsupported' | 'failed';
type OperatorAlertTone = 'success' | 'info' | 'warning' | 'danger';

const subscriptionPlanOptions = tenantSubscriptionPlanSchema.options;
const QUICK_PLAN_DURATION_DAYS = 30;
const SUBSCRIPTION_DRAWER_ID = 'tenant-subscription-drawer';
const ACTIVATION_DRAWER_ID = 'tenant-activation-drawer';

export default function TenantDetailPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;

  const [state, setState] = useState<DetailState>({
    loading: true,
    error: null,
    tenant: null,
    members: [],
    recentLogs: [],
  });
  const [insightsState, setInsightsState] = useState<InsightsState>({
    loading: true,
    error: null,
    insights: null,
  });
  const [subscriptionState, setSubscriptionState] = useState<SubscriptionState>({
    loading: true,
    saving: false,
    error: null,
    actionMessage: null,
    subscription: null,
  });
  const [lifecycleState, setLifecycleState] = useState<LifecycleState>({
    reason: '',
    suspending: false,
    reactivating: false,
    error: null,
    actionMessage: null,
  });
  const [activationCodeState, setActivationCodeState] = useState<ActivationCodeState>({
    saving: false,
    error: null,
    actionMessage: null,
    generatedCode: null,
    generatedCodeLabel: null,
  });

  const [subscriptionPlan, setSubscriptionPlan] = useState<TenantSubscriptionPlan>('FREE');
  const [subscriptionExpiresAtInput, setSubscriptionExpiresAtInput] = useState('');
  const [subscriptionMaxImagesInput, setSubscriptionMaxImagesInput] = useState('');
  const [subscriptionMaxStorageBytesInput, setSubscriptionMaxStorageBytesInput] = useState('');
  const [subscriptionMaxSharesInput, setSubscriptionMaxSharesInput] = useState('');

  const [activationCodePlan, setActivationCodePlan] = useState<TenantSubscriptionPlan>('PRO');
  const [activationCodeDurationDaysInput, setActivationCodeDurationDaysInput] = useState('30');
  const [activationCodeRedeemLimitInput, setActivationCodeRedeemLimitInput] = useState('1');
  const [activationCodeExpiresAtInput, setActivationCodeExpiresAtInput] = useState('');
  const [activationCodeMaxImagesInput, setActivationCodeMaxImagesInput] = useState('');
  const [activationCodeMaxStorageBytesInput, setActivationCodeMaxStorageBytesInput] = useState('');
  const [activationCodeMaxSharesInput, setActivationCodeMaxSharesInput] = useState('');

  const [memberSearchInput, setMemberSearchInput] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [isPlanDrawerOpen, setIsPlanDrawerOpen] = useState(false);
  const [isActivationDrawerOpen, setIsActivationDrawerOpen] = useState(false);
  const [activeDetailSection, setActiveDetailSection] = useState('tenant-detail-overview');

  useEffect(() => {
    const syncActiveSection = () => {
      const hash = window.location.hash.replace('#', '');
      if (!hash) {
        setActiveDetailSection('tenant-detail-overview');
        return;
      }

      if (hash === 'tenant-detail-audit') {
        setActiveDetailSection('tenant-detail-business');
        return;
      }

      setActiveDetailSection(hash);
    };

    syncActiveSection();
    window.addEventListener('hashchange', syncActiveSection);

    return () => {
      window.removeEventListener('hashchange', syncActiveSection);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDetail() {
      setState((previous) => ({ ...previous, loading: true, error: null }));

      try {
        const memberQuery = new URLSearchParams();
        if (memberSearch.trim()) {
          memberQuery.set('search', memberSearch.trim());
        }

        const [tenantResponse, memberResponse, logResponse] = await Promise.all([
          apiRequest(`/admin/tenants/${tenantId}`, {
            responseSchema: getAdminTenantResponseSchema,
          }),
          apiRequest(
            `/admin/tenants/${tenantId}/members${memberQuery.size ? `?${memberQuery.toString()}` : ''}`,
            {
              responseSchema: listAdminTenantMembersResponseSchema,
            },
          ),
          apiRequest(`/admin/audit-logs?tenantId=${tenantId}&page=1&pageSize=8`, {
            responseSchema: listSuperAdminAuditLogsResponseSchema,
          }),
        ]);

        if (cancelled) {
          return;
        }

        setState({
          loading: false,
          error: null,
          tenant: tenantResponse.tenant,
          members: memberResponse.members,
          recentLogs: logResponse.logs,
        });
      } catch (error) {
        if (!cancelled) {
          setState((previous) => ({
            ...previous,
            loading: false,
            error: formatUnknownError(error, { includeErrorCode: true }),
          }));
        }
      }
    }

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [memberSearch, tenantId]);

  useEffect(() => {
    let cancelled = false;

    async function loadInsights() {
      setInsightsState({
        loading: true,
        error: null,
        insights: null,
      });

      try {
        const response = await getAdminTenantInsights(tenantId);
        if (cancelled) {
          return;
        }

        setInsightsState({
          loading: false,
          error: null,
          insights: response.insights,
        });
      } catch (error) {
        if (!cancelled) {
          setInsightsState({
            loading: false,
            error: formatUnknownError(error, { includeErrorCode: true }),
            insights: null,
          });
        }
      }
    }

    void loadInsights();

    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  useEffect(() => {
    let cancelled = false;

    async function loadSubscription() {
      setSubscriptionState((previous) => ({
        ...previous,
        loading: true,
        error: null,
        actionMessage: null,
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
          subscription: response.subscription,
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
          actionMessage: null,
        }));
      } catch (error) {
        if (!cancelled) {
          setSubscriptionState((previous) => ({
            ...previous,
            loading: false,
            error: formatUnknownError(error, { includeErrorCode: true }),
            subscription: null,
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

  useEffect(() => {
    if (!(isPlanDrawerOpen || isActivationDrawerOpen) || typeof window === 'undefined') {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsPlanDrawerOpen(false);
        setIsActivationDrawerOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActivationDrawerOpen, isPlanDrawerOpen]);

  function openPlanDrawer() {
    setIsActivationDrawerOpen(false);
    setIsPlanDrawerOpen(true);
  }

  function openActivationDrawer() {
    setIsPlanDrawerOpen(false);
    setIsActivationDrawerOpen(true);
  }

  function closeDrawers() {
    setIsPlanDrawerOpen(false);
    setIsActivationDrawerOpen(false);
  }

  function handleMemberSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMemberSearch(memberSearchInput.trim());
  }

  function applySubscriptionSnapshot(
    subscription: TenantSubscription,
    actionMessage: string | null,
  ) {
    setSubscriptionState({
      loading: false,
      saving: false,
      error: null,
      actionMessage,
      subscription,
    });
    setSubscriptionPlan(subscription.plan);
    setSubscriptionExpiresAtInput(toDateTimeLocalValue(subscription.expiresAt));
    setSubscriptionMaxImagesInput(toNullableNumberInputValue(subscription.maxImages));
    setSubscriptionMaxStorageBytesInput(subscription.maxStorageBytes ?? '');
    setSubscriptionMaxSharesInput(toNullableNumberInputValue(subscription.maxShares));
  }

  async function submitSubscriptionUpdate(
    payload: {
      plan?: TenantSubscriptionPlan | undefined;
      expiresAt?: string | null | undefined;
      maxImages?: number | null | undefined;
      maxStorageBytes?: string | null | undefined;
      maxShares?: number | null | undefined;
    },
    successMessage: string,
  ) {
    setSubscriptionState((previous) => ({
      ...previous,
      saving: true,
      error: null,
      actionMessage: null,
    }));

    try {
      const response = await updateAdminTenantSubscription(tenantId, payload);
      applySubscriptionSnapshot(
        response.subscription,
        response.auditLogId ? `${successMessage} 审计ID：${response.auditLogId}` : successMessage,
      );
      setLifecycleState((previous) => ({
        ...previous,
        reason: response.subscription.disabledReason ?? previous.reason,
        error: null,
      }));
      setIsPlanDrawerOpen(false);
    } catch (error) {
      setSubscriptionState((previous) => ({
        ...previous,
        saving: false,
        error: formatUnknownError(error, { includeErrorCode: true }),
      }));
    }
  }

  async function handlePlanPresetAction(action: 'renew' | 'basic' | 'pro' | 'clear-expiry') {
    const currentExpiresAt = subscriptionState.subscription?.expiresAt ?? null;

    if (action === 'renew') {
      if (
        !window.confirm(
          `确认在当前有效期基础上续 ${QUICK_PLAN_DURATION_DAYS} 天吗？`,
        )
      ) {
        return;
      }

      await submitSubscriptionUpdate(
        {
          expiresAt: buildExtendedIsoDateTime(currentExpiresAt, QUICK_PLAN_DURATION_DAYS),
        },
        '订阅已续期。',
      );
      return;
    }

    if (action === 'clear-expiry') {
      if (!window.confirm('确认清除当前到期时间吗？')) {
        return;
      }

      await submitSubscriptionUpdate(
        {
          expiresAt: null,
        },
        '到期时间已清除。',
      );
      return;
    }

    const targetPlan = action === 'basic' ? 'BASIC' : 'PRO';
    if (
      !window.confirm(
        `确认将用户升级为 ${formatPlanLabel(targetPlan)}，并在当前有效期基础上续 ${QUICK_PLAN_DURATION_DAYS} 天吗？`,
      )
    ) {
      return;
    }

    await submitSubscriptionUpdate(
      {
        plan: targetPlan,
        expiresAt: buildExtendedIsoDateTime(currentExpiresAt, QUICK_PLAN_DURATION_DAYS),
      },
      '订阅已更新。',
    );
  }

  async function handleSubscriptionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    let maxImages: number | null;
    let maxShares: number | null;
    let maxStorageBytes: string | null;

    try {
      maxImages = parseNullableInt(subscriptionMaxImagesInput, '图片上限');
      maxShares = parseNullableInt(subscriptionMaxSharesInput, '产品上限（maxShares）');
      maxStorageBytes = parseNullableStorageBytes(subscriptionMaxStorageBytesInput);
    } catch (error) {
      setSubscriptionState((previous) => ({
        ...previous,
        error: error instanceof Error ? error.message : '订阅参数格式不正确。',
      }));
      return;
    }

    const confirmMessage = [
      `确认更新用户 ${tenantId} 的订阅配置吗？`,
      `套餐：${formatPlanLabel(subscriptionPlan)}（${subscriptionPlan}）`,
      `到期时间：${subscriptionExpiresAtInput ? subscriptionExpiresAtInput : '无到期'}`,
    ].join('\n');

    if (!window.confirm(confirmMessage)) {
      return;
    }

    await submitSubscriptionUpdate(
      {
        plan: subscriptionPlan,
        expiresAt: toIsoDateTimeOrNull(subscriptionExpiresAtInput),
        maxImages,
        maxStorageBytes,
        maxShares,
      },
      '订阅已更新。',
    );
  }

  async function handleActivationCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    let durationDays: number;
    let redeemLimit: number;
    let maxImages: number | null;
    let maxShares: number | null;
    let maxStorageBytes: string | null;

    try {
      durationDays = parseRequiredPositiveInt(activationCodeDurationDaysInput, '有效天数', 3650);
      redeemLimit = parseRequiredPositiveInt(activationCodeRedeemLimitInput, '可兑换次数', 1000);
      maxImages = parseNullableInt(activationCodeMaxImagesInput, '图片上限');
      maxShares = parseNullableInt(activationCodeMaxSharesInput, '产品上限（maxShares）');
      maxStorageBytes = parseNullableStorageBytes(activationCodeMaxStorageBytesInput);
    } catch (error) {
      setActivationCodeState((previous) => ({
        ...previous,
        error: error instanceof Error ? error.message : '激活码参数格式不正确。',
      }));
      return;
    }

    const confirmMessage = [
      `确认给用户 ${tenantId} 生成 ${formatPlanLabel(activationCodePlan)} 激活码吗？`,
      `有效天数：${durationDays} 天`,
      `可兑换次数：${redeemLimit} 次`,
    ].join('\n');

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setActivationCodeState((previous) => ({
      ...previous,
      saving: true,
      error: null,
      actionMessage: null,
      generatedCode: null,
      generatedCodeLabel: null,
    }));

    try {
      const response = await createAdminTenantSubscriptionActivationCode({
        targetTenantId: tenantId,
        plan: activationCodePlan,
        durationDays,
        maxImages,
        maxStorageBytes,
        maxShares,
        redeemLimit,
        expiresAt: toIsoDateTimeOrNull(activationCodeExpiresAtInput),
      });

      setActivationCodeState({
        saving: false,
        error: null,
        actionMessage: response.auditLogId
          ? `激活码已生成。审计ID：${response.auditLogId}`
          : '激活码已生成。',
        generatedCode: response.activationCode.code,
        generatedCodeLabel: response.activationCode.codeLabel,
      });
    } catch (error) {
      setActivationCodeState((previous) => ({
        ...previous,
        saving: false,
        error: formatUnknownError(error, { includeErrorCode: true }),
      }));
    }
  }

  async function handleCopyGeneratedCode() {
    if (!activationCodeState.generatedCode) {
      return;
    }

    const copyResult = await copyTextToClipboard(activationCodeState.generatedCode);
    if (copyResult === 'unsupported') {
      setActivationCodeState((previous) => ({
        ...previous,
        actionMessage: '当前浏览器不支持自动复制，请手动复制激活码。',
      }));
      return;
    }

    if (copyResult === 'copied') {
      setActivationCodeState((previous) => ({
        ...previous,
        actionMessage: '激活码已复制到剪贴板。',
      }));
      return;
    }

    setActivationCodeState((previous) => ({
      ...previous,
      actionMessage: '复制失败，请手动复制激活码。',
    }));
  }

  async function handleSuspendSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = lifecycleState.reason.trim();
    if (!reason) {
      setLifecycleState((previous) => ({
        ...previous,
        error: '请填写冻结原因。',
      }));
      return;
    }

    const confirmMessage = [`确认冻结用户 ${tenantId} 吗？`, `原因：${reason}`].join('\n');
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setLifecycleState((previous) => ({
      ...previous,
      suspending: true,
      error: null,
      actionMessage: null,
    }));

    try {
      const response = await suspendAdminTenant(tenantId, { reason });
      applySubscriptionSnapshot(
        response.subscription,
        response.auditLogId ? `生命周期状态已更新。审计ID：${response.auditLogId}` : '用户已冻结。',
      );
      setLifecycleState((previous) => ({
        ...previous,
        reason: response.subscription.disabledReason ?? reason,
        suspending: false,
        error: null,
        actionMessage: response.auditLogId
          ? `用户已冻结。审计ID：${response.auditLogId}`
          : '用户已冻结。',
      }));
    } catch (error) {
      setLifecycleState((previous) => ({
        ...previous,
        suspending: false,
        error: formatUnknownError(error, { includeErrorCode: true }),
      }));
    }
  }

  async function handleReactivateTenant() {
    const confirmMessage = `确认恢复用户 ${tenantId} 吗？`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setLifecycleState((previous) => ({
      ...previous,
      reactivating: true,
      error: null,
      actionMessage: null,
    }));

    try {
      const response = await reactivateAdminTenant(tenantId);
      applySubscriptionSnapshot(
        response.subscription,
        response.auditLogId ? `生命周期状态已更新。审计ID：${response.auditLogId}` : '用户已恢复。',
      );
      setLifecycleState((previous) => ({
        ...previous,
        reason: '',
        reactivating: false,
        error: null,
        actionMessage: response.auditLogId
          ? `用户已恢复。审计ID：${response.auditLogId}`
          : '用户已恢复。',
      }));
    } catch (error) {
      setLifecycleState((previous) => ({
        ...previous,
        reactivating: false,
        error: formatUnknownError(error, { includeErrorCode: true }),
      }));
    }
  }

  const insights = insightsState.insights;
  const overviewSummaryCards = useMemo(
    () => [
      {
        label: '到期时间',
        value: formatOptionalDate(subscriptionState.subscription?.expiresAt ?? null),
      },
      {
        label: '成员数',
        value: state.tenant ? `${state.tenant.memberCount} 人` : '-',
      },
      {
        label: '最后活跃',
        value: state.tenant ? formatOptionalDateTime(state.tenant.lastActiveAt) : '-',
      },
      {
        label: '最近登录',
        value: insights ? formatDateTimeCell(insights.loginMetrics.lastLoginAt) : '-',
      },
    ],
    [insights, state.tenant, subscriptionState.subscription],
  );
  const overviewMetrics = useMemo(
    () => [
      {
        label: '30天活跃天数',
        value: insights ? String(insights.businessMetrics.activeDays30d) : '-',
      },
      {
        label: '最近业务动作',
        value: insights ? formatDateTimeCell(insights.businessMetrics.lastBusinessActivityAt) : '-',
      },
      {
        label: '产品数',
        value: insights ? String(insights.businessMetrics.totalProducts) : '-',
      },
      {
        label: '图片数',
        value: insights ? String(insights.businessMetrics.totalImages) : '-',
      },
      {
        label: '存储利用率',
        value: insights ? formatUtilization(insights.usage.usage.storageBytes.utilization) : '-',
      },
    ],
    [insights],
  );
  const operatorAlerts = useMemo(() => {
    const alerts: Array<{
      key: string;
      tone: OperatorAlertTone;
      title: string;
      detail: string;
    }> = [];
    const subscription = subscriptionState.subscription;

    if (subscription?.status === 'DISABLED') {
      alerts.push({
        key: 'subscription-disabled',
        tone: 'danger',
        title: '已冻结',
        detail: subscription.disabledReason?.trim()
          ? `原因：${subscription.disabledReason}`
          : '当前用户写操作会被拒绝，需确认是否恢复。',
      });
    } else if (subscription?.status === 'EXPIRED') {
      alerts.push({
        key: `subscription-${subscription.status.toLowerCase()}`,
        tone: 'danger',
        title: '订阅已失效',
        detail: `当前状态为 ${formatSubscriptionStatusLabel(subscription.status)}。`,
      });
    }

    const expiryAlert = buildExpiryOperatorAlert(subscription?.expiresAt ?? null);
    if (expiryAlert) {
      alerts.push(expiryAlert);
    }

    if (insights) {
      alerts.push(
        ...insights.usage.alerts.slice(0, 2).map((alert) => ({
          key: `usage-${alert.metric}-${alert.status}`,
          tone: (alert.status === 'exceeded' ? 'danger' : 'warning') as OperatorAlertTone,
          title: alert.status === 'exceeded' ? '配额已超限' : '配额接近上限',
          detail: `${formatUsageAlertMetricLabel(alert.metric)}${alert.status === 'exceeded' ? '已超出配置上限' : '已接近配置上限'}。`,
        })),
      );

      if (insights.businessMetrics.activeDays30d === 0) {
        alerts.push({
          key: 'inactive-30d',
          tone: 'info',
          title: '近 30 天无活跃',
          detail: '最近 30 天没有业务活跃记录，建议确认是否流失或停用。',
        });
      }
    }

    if (alerts.length === 0) {
      alerts.push({
        key: 'healthy',
        tone: 'success',
        title: '当前无高优先提醒',
        detail: '套餐状态、活跃度和容量暂未出现需要立即处理的问题。',
      });
    }

    return alerts.slice(0, 4);
  }, [insights, subscriptionState.subscription]);
  const recentBusinessLogs = insights?.recentBusinessLogs.slice(0, 8) ?? [];
  const mobileBusinessLogs = recentBusinessLogs.slice(0, 4);
  const mobileMembers = state.members.slice(0, 8);
  const mobileAuditLogs = state.recentLogs.slice(0, 8);
  const businessLogSummary =
    recentBusinessLogs.length === 0 ? '暂无业务动作' : `最近 ${recentBusinessLogs.length} 条业务动作`;
  const usageAlertSummary = insights
    ? insights.usage.alerts.length === 0
      ? '当前无容量提醒'
      : `${insights.usage.alerts.length} 条容量提醒`
    : '暂无用量数据';
  const lifecycleSummary =
    subscriptionState.subscription?.status === 'DISABLED'
      ? '当前已冻结'
      : subscriptionState.subscription?.status === 'EXPIRED'
        ? '订阅已过期'
        : '当前正常';
  const overviewSecondarySummary = insights
    ? [
        `${insights.businessMetrics.activeDays30d} 天活跃`,
        `${insights.businessMetrics.totalProducts} 产品`,
        `${formatUtilization(insights.usage.usage.storageBytes.utilization)} 存储`,
        insights.autoTags.length > 0 ? `${insights.autoTags.length} 个标签` : null,
      ]
        .filter((value): value is string => Boolean(value))
        .join(' · ')
    : '暂无二级指标';

  const isDrawerSaving = subscriptionState.saving || activationCodeState.saving;

  return (
    <section className="page admin-page">
      <AdminPageHeader
        eyebrow="用户治理"
        title="用户详情"
        description="先看清当前用户状态，再决定是否编辑套餐或生成激活码。"
        actions={<AdminActionLink href="/dashboard/tenants">返回用户列表</AdminActionLink>}
      />

      <AdminSectionNav
        ariaLabel="用户详情分类"
        items={[
          {
            label: '概览',
            href: `/dashboard/tenants/${tenantId}#tenant-detail-overview`,
            active: activeDetailSection === 'tenant-detail-overview',
          },
          {
            label: '用量',
            href: `/dashboard/tenants/${tenantId}#tenant-detail-usage`,
            active: activeDetailSection === 'tenant-detail-usage',
          },
          {
            label: '记录',
            href: `/dashboard/tenants/${tenantId}#tenant-detail-business`,
            active:
              activeDetailSection === 'tenant-detail-business' ||
              activeDetailSection === 'tenant-detail-audit',
          },
          {
            label: '成员',
            href: `/dashboard/tenants/${tenantId}#tenant-detail-members`,
            active: activeDetailSection === 'tenant-detail-members',
          },
          {
            label: '操作',
            href: `/dashboard/tenants/${tenantId}#tenant-detail-actions`,
            active: activeDetailSection === 'tenant-detail-actions',
          },
        ]}
      />

      {isPlanDrawerOpen || isActivationDrawerOpen ? (
        <button
          type="button"
          className="admin-overlay-backdrop"
          aria-label="关闭抽屉"
          onClick={closeDrawers}
        />
      ) : null}

      <div
        id={SUBSCRIPTION_DRAWER_ID}
        className={`tenant-detail-drawer${isPlanDrawerOpen ? ' is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tenant-plan-drawer-title"
        aria-hidden={!isPlanDrawerOpen}
      >
        <AdminPanel className="stack tenant-detail-drawer-panel">
          <div className="tenant-detail-drawer-header">
            <div className="stack row-tight">
              <strong id="tenant-plan-drawer-title">编辑套餐</strong>
              <p className="muted">先用常用预设，复杂配额再展开高级设置。</p>
            </div>
            <button
              className="dashboard-bottom-dock-close"
              type="button"
              aria-label="关闭抽屉"
              onClick={closeDrawers}
            >
              ×
            </button>
          </div>

          <div className="tenant-quick-actions-grid">
            <button
              type="button"
              className="tenant-quick-action-card"
              disabled={subscriptionState.loading || subscriptionState.saving}
              onClick={() => handlePlanPresetAction('renew')}
            >
              <strong>{subscriptionState.saving ? '处理中...' : '续 30 天'}</strong>
              <span>在当前有效期基础上顺延 30 天</span>
            </button>
            <button
              type="button"
              className="tenant-quick-action-card"
              disabled={subscriptionState.loading || subscriptionState.saving}
              onClick={() => handlePlanPresetAction('basic')}
            >
              <strong>{subscriptionState.saving ? '处理中...' : '升 BASIC 并续 30 天'}</strong>
              <span>切换到 BASIC，并顺延当前有效期</span>
            </button>
            <button
              type="button"
              className="tenant-quick-action-card"
              disabled={subscriptionState.loading || subscriptionState.saving}
              onClick={() => handlePlanPresetAction('pro')}
            >
              <strong>{subscriptionState.saving ? '处理中...' : '升 PRO 并续 30 天'}</strong>
              <span>切换到 PRO，并顺延当前有效期</span>
            </button>
            <button
              type="button"
              className="tenant-quick-action-card"
              disabled={subscriptionState.loading || subscriptionState.saving}
              onClick={() => handlePlanPresetAction('clear-expiry')}
            >
              <strong>{subscriptionState.saving ? '处理中...' : '清除到期时间'}</strong>
              <span>适合手工改成长期有效的特殊情况</span>
            </button>
          </div>

          <details className="tenant-detail-drawer-details">
            <summary>高级设置</summary>
            <form className="stack admin-subscription-form" onSubmit={handleSubscriptionSubmit}>
              <div className="form-grid admin-subscription-grid">
                <label className="stack row-tight" htmlFor="subscription-plan">
                  <span>套餐</span>
                  <select
                    id="subscription-plan"
                    value={subscriptionPlan}
                    onChange={(event) =>
                      setSubscriptionPlan(event.target.value as TenantSubscriptionPlan)
                    }
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
                  <span>产品上限（maxShares）</span>
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
                  {subscriptionState.saving ? '保存中...' : '保存套餐设置'}
                </button>
              </div>
            </form>
          </details>

          {subscriptionState.error ? <p className="error">{subscriptionState.error}</p> : null}
          {subscriptionState.actionMessage ? (
            <p className="success">{subscriptionState.actionMessage}</p>
          ) : null}
        </AdminPanel>
      </div>

      <div
        id={ACTIVATION_DRAWER_ID}
        className={`tenant-detail-drawer${isActivationDrawerOpen ? ' is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tenant-activation-drawer-title"
        aria-hidden={!isActivationDrawerOpen}
      >
        <AdminPanel className="stack tenant-detail-drawer-panel">
          <div className="tenant-detail-drawer-header">
            <div className="stack row-tight">
              <strong id="tenant-activation-drawer-title">生成激活码</strong>
              <p className="muted">保留高级工具入口，不再出现在详情正文主流程里。</p>
            </div>
            <button
              className="dashboard-bottom-dock-close"
              type="button"
              aria-label="关闭抽屉"
              onClick={closeDrawers}
            >
              ×
            </button>
          </div>

          <form className="stack admin-subscription-form" onSubmit={handleActivationCodeSubmit}>
            <p className="muted">
              当前表单会绑定本用户，适合做用户定向码；如需通用码，请走未来的高级工具流。
            </p>
            <p className="muted">注意：当前 maxShares 仍沿用为产品数量覆盖值，不限制分享创建次数。</p>

            <div className="form-grid admin-subscription-grid">
              <label className="stack row-tight" htmlFor="activation-code-plan">
                <span>目标套餐</span>
                <select
                  id="activation-code-plan"
                  value={activationCodePlan}
                  onChange={(event) =>
                    setActivationCodePlan(event.target.value as TenantSubscriptionPlan)
                  }
                  disabled={activationCodeState.saving}
                >
                  {subscriptionPlanOptions.map((plan) => (
                    <option key={plan} value={plan}>
                      {formatPlanLabel(plan)}（{plan}）
                    </option>
                  ))}
                </select>
              </label>

              <label className="stack row-tight" htmlFor="activation-code-duration-days">
                <span>有效天数</span>
                <input
                  id="activation-code-duration-days"
                  type="number"
                  min={1}
                  max={3650}
                  step={1}
                  value={activationCodeDurationDaysInput}
                  onChange={(event) => setActivationCodeDurationDaysInput(event.target.value)}
                  disabled={activationCodeState.saving}
                />
              </label>

              <label className="stack row-tight" htmlFor="activation-code-redeem-limit">
                <span>可兑换次数</span>
                <input
                  id="activation-code-redeem-limit"
                  type="number"
                  min={1}
                  max={1000}
                  step={1}
                  value={activationCodeRedeemLimitInput}
                  onChange={(event) => setActivationCodeRedeemLimitInput(event.target.value)}
                  disabled={activationCodeState.saving}
                />
              </label>

              <label className="stack row-tight" htmlFor="activation-code-expires-at">
                <span>绝对过期时间</span>
                <div className="inline-actions admin-inline-form">
                  <input
                    id="activation-code-expires-at"
                    type="datetime-local"
                    value={activationCodeExpiresAtInput}
                    onChange={(event) => setActivationCodeExpiresAtInput(event.target.value)}
                    disabled={activationCodeState.saving}
                  />
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => setActivationCodeExpiresAtInput('')}
                    disabled={activationCodeState.saving}
                  >
                    无限制
                  </button>
                </div>
              </label>

              <label className="stack row-tight" htmlFor="activation-code-max-images">
                <span>图片上限</span>
                <input
                  id="activation-code-max-images"
                  type="number"
                  min={0}
                  step={1}
                  value={activationCodeMaxImagesInput}
                  onChange={(event) => setActivationCodeMaxImagesInput(event.target.value)}
                  placeholder="不覆盖"
                  disabled={activationCodeState.saving}
                />
              </label>

              <label className="stack row-tight" htmlFor="activation-code-max-storage-bytes">
                <span>存储上限（字节）</span>
                <input
                  id="activation-code-max-storage-bytes"
                  type="text"
                  inputMode="numeric"
                  value={activationCodeMaxStorageBytesInput}
                  onChange={(event) => setActivationCodeMaxStorageBytesInput(event.target.value)}
                  placeholder="不覆盖"
                  disabled={activationCodeState.saving}
                />
              </label>

              <label className="stack row-tight" htmlFor="activation-code-max-shares">
                <span>产品上限（maxShares）</span>
                <input
                  id="activation-code-max-shares"
                  type="number"
                  min={0}
                  step={1}
                  value={activationCodeMaxSharesInput}
                  onChange={(event) => setActivationCodeMaxSharesInput(event.target.value)}
                  placeholder="不覆盖"
                  disabled={activationCodeState.saving}
                />
              </label>
            </div>

            <div className="inline-actions">
              <button type="submit" disabled={activationCodeState.saving}>
                {activationCodeState.saving ? '生成中...' : '生成激活码'}
              </button>
              {activationCodeState.generatedCode ? (
                <button
                  className="secondary"
                  type="button"
                  onClick={handleCopyGeneratedCode}
                  disabled={activationCodeState.saving}
                >
                  复制激活码
                </button>
              ) : null}
            </div>

            {activationCodeState.generatedCode ? (
              <div className="detail-list admin-detail-list">
                <div>
                  <dt>最新激活码</dt>
                  <dd className="mono">{activationCodeState.generatedCode}</dd>
                </div>
                <div>
                  <dt>代码标签</dt>
                  <dd className="mono">{activationCodeState.generatedCodeLabel ?? '-'}</dd>
                </div>
              </div>
            ) : null}
          </form>

          {activationCodeState.error ? <p className="error">{activationCodeState.error}</p> : null}
          {activationCodeState.actionMessage ? (
            <p className="success">{activationCodeState.actionMessage}</p>
          ) : null}
        </AdminPanel>
      </div>

      <AdminPanel id="tenant-detail-overview" className="stack tenant-detail-overview-panel">
        <div className="admin-section-head">
          <h3>运营首屏概览</h3>
          <p>把身份、套餐和活跃度压在首屏，方便运营先判断再操作。</p>
        </div>

        {state.loading ? <p className="muted">加载用户详情中...</p> : null}
        {subscriptionState.loading ? <p className="muted">加载订阅数据中...</p> : null}
        {insightsState.loading ? <p className="muted">加载用户洞察中...</p> : null}
        {insightsState.error ? <p className="error">{insightsState.error}</p> : null}

        {state.tenant ? (
          <div className="tenant-detail-overview-shell">
            <div className="tenant-side-hero tenant-detail-overview-hero">
              <div className="stack row-tight tenant-detail-overview-copy">
                <h3>{state.tenant.name}</h3>
                <p className="mono">{state.tenant.slug}</p>
                <div className="tenant-detail-meta-row">
                  <span className="tenant-detail-meta-chip">
                    Owner：{state.tenant.owner?.account ?? state.tenant.owner?.email ?? '无 Owner'}
                  </span>
                  <span className="tenant-detail-meta-chip mono">用户 ID：{state.tenant.id}</span>
                  <span className="tenant-detail-meta-chip">
                    创建于 {formatDateTime(state.tenant.createdAt)}
                  </span>
                </div>
              </div>

              <div className="stack tenant-detail-overview-actions">
                <div className="inline-actions tenant-detail-badge-row">
                  <AdminBadge tone={toPlanTone(subscriptionState.subscription?.plan ?? 'FREE')}>
                    {formatPlanLabel(subscriptionState.subscription?.plan ?? 'FREE')}
                  </AdminBadge>
                  <AdminBadge
                    tone={toSubscriptionStatusTone(subscriptionState.subscription?.status ?? 'ACTIVE')}
                  >
                    {formatSubscriptionStatusLabel(subscriptionState.subscription?.status ?? 'ACTIVE')}
                  </AdminBadge>
                </div>

                <div className="inline-actions tenant-detail-action-bar">
                  <button
                    type="button"
                    onClick={openPlanDrawer}
                    disabled={isDrawerSaving || subscriptionState.loading}
                  >
                    编辑套餐
                  </button>
                  <button
                    className="secondary"
                    type="button"
                    onClick={openActivationDrawer}
                    disabled={isDrawerSaving}
                  >
                    生成激活码
                  </button>
                </div>
              </div>
            </div>

            <div className="tenant-detail-summary-grid">
              {overviewSummaryCards.map((item) => (
                <div key={item.label} className="tenant-detail-summary-card">
                  <span className="tenant-detail-summary-label">{item.label}</span>
                  <strong className="tenant-detail-summary-value">{item.value}</strong>
                </div>
              ))}
            </div>

            <div className="tenant-detail-alert-grid">
              {operatorAlerts.map((alert) => (
                <div
                  key={alert.key}
                  className={`tenant-detail-alert-card is-${alert.tone}`}
                >
                  <AdminBadge tone={alert.tone}>{alert.title}</AdminBadge>
                  <p>{alert.detail}</p>
                </div>
              ))}
            </div>

            {insights ? (
              <>
                <div className="tenant-mobile-only">
                  <details className="tenant-mobile-collapsible tenant-detail-overview-collapsible">
                    <summary className="tenant-mobile-collapsible-summary">
                      <span className="tenant-mobile-collapsible-title">
                        <strong>运营指标与标签</strong>
                        <span>{overviewSecondarySummary}</span>
                      </span>
                      <span className="tenant-mobile-collapsible-hint">点开查看</span>
                    </summary>
                    <div className="tenant-mobile-collapsible-body tenant-detail-overview-secondary">
                      {insights.autoTags.length > 0 ? (
                        <div className="tenant-detail-tag-strip">
                          {insights.autoTags.map((tag) => (
                            <AdminBadge key={tag.key} tone={tag.tone}>
                              {tag.label}
                            </AdminBadge>
                          ))}
                        </div>
                      ) : (
                        <p className="tenant-mobile-compact-note">当前无自动标签。</p>
                      )}

                      <div className="tenant-side-metrics-grid tenant-detail-overview-metrics">
                        {overviewMetrics.map((metric) => (
                          <div key={metric.label} className="tenant-side-metric-card">
                            <span className="tenant-side-metric-label">{metric.label}</span>
                            <strong className="tenant-side-metric-value">{metric.value}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  </details>
                </div>

                <div className="tenant-desktop-only tenant-detail-overview-secondary">
                  {insights.autoTags.length > 0 ? (
                    <div className="tenant-detail-tag-strip">
                      {insights.autoTags.map((tag) => (
                        <AdminBadge key={tag.key} tone={tag.tone}>
                          {tag.label}
                        </AdminBadge>
                      ))}
                    </div>
                  ) : null}

                  <div className="tenant-side-metrics-grid tenant-detail-overview-metrics">
                    {overviewMetrics.map((metric) => (
                      <div key={metric.label} className="tenant-side-metric-card">
                        <span className="tenant-side-metric-label">{metric.label}</span>
                        <strong className="tenant-side-metric-value">{metric.value}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        {subscriptionState.error ? <p className="error">{subscriptionState.error}</p> : null}
        {subscriptionState.actionMessage ? (
          <p className="success">{subscriptionState.actionMessage}</p>
        ) : null}
      </AdminPanel>

      <AdminPanel id="tenant-detail-usage" className="stack">
        <div className="admin-section-head">
          <h3>使用与配额明细</h3>
          <p>首屏先做运营判断，这里再确认容量占用、标签和提醒。</p>
        </div>

        {!insightsState.loading && !insightsState.error && !insights ? (
          <p className="muted">暂无用户洞察数据。</p>
        ) : null}

        {insights ? (
          <>
            <div className="tenant-mobile-only">
              <details className="tenant-mobile-collapsible">
                <summary className="tenant-mobile-collapsible-summary">
                  <span className="tenant-mobile-collapsible-title">
                    <strong>使用与配额明细</strong>
                    <span>{usageAlertSummary}</span>
                  </span>
                  <span className="tenant-mobile-collapsible-hint">点开查看</span>
                </summary>
                <div className="tenant-mobile-collapsible-body">
                  <dl className="detail-list admin-detail-list">
                    <div>
                      <dt>产品用量</dt>
                      <dd>{formatCountMetric(insights.usage.usage.products)}</dd>
                    </div>
                    <div>
                      <dt>图片用量</dt>
                      <dd>{formatCountMetric(insights.usage.usage.images)}</dd>
                    </div>
                    <div>
                      <dt>分享用量</dt>
                      <dd>{formatCountMetric(insights.usage.usage.shares)}</dd>
                    </div>
                    <div>
                      <dt>存储用量</dt>
                      <dd>{formatStorageMetric(insights.usage.usage.storageBytes)}</dd>
                    </div>
                    <div>
                      <dt>自动标签</dt>
                      <dd>
                        <div className="governance-tag-row">
                          {insights.autoTags.length === 0 ? <span className="muted">-</span> : null}
                          {insights.autoTags.map((tag) => (
                            <AdminBadge key={tag.key} tone={tag.tone}>
                              {tag.label}
                            </AdminBadge>
                          ))}
                        </div>
                      </dd>
                    </div>
                    <div>
                      <dt>容量提醒</dt>
                      <dd>
                        {insights.usage.alerts.length === 0
                          ? '当前无提醒'
                          : insights.usage.alerts.map((alert) => alert.message).join('；')}
                      </dd>
                    </div>
                  </dl>
                </div>
              </details>
            </div>

            <div className="tenant-desktop-only">
              <dl className="detail-list admin-detail-list">
                <div>
                  <dt>产品用量</dt>
                  <dd>{formatCountMetric(insights.usage.usage.products)}</dd>
                </div>
                <div>
                  <dt>图片用量</dt>
                  <dd>{formatCountMetric(insights.usage.usage.images)}</dd>
                </div>
                <div>
                  <dt>分享用量</dt>
                  <dd>{formatCountMetric(insights.usage.usage.shares)}</dd>
                </div>
                <div>
                  <dt>存储用量</dt>
                  <dd>{formatStorageMetric(insights.usage.usage.storageBytes)}</dd>
                </div>
                <div>
                  <dt>自动标签</dt>
                  <dd>
                    <div className="governance-tag-row">
                      {insights.autoTags.length === 0 ? <span className="muted">-</span> : null}
                      {insights.autoTags.map((tag) => (
                        <AdminBadge key={tag.key} tone={tag.tone}>
                          {tag.label}
                        </AdminBadge>
                      ))}
                    </div>
                  </dd>
                </div>
                <div>
                  <dt>容量提醒</dt>
                  <dd>
                    {insights.usage.alerts.length === 0
                      ? '当前无提醒'
                      : insights.usage.alerts.map((alert) => alert.message).join('；')}
                  </dd>
                </div>
              </dl>
            </div>
          </>
        ) : null}
      </AdminPanel>

      <AdminPanel id="tenant-detail-business" className="stack">
        <div className="admin-section-head">
          <h3>最近业务记录</h3>
          <p>优先看用户近期做了什么，而不是先看后台审计。</p>
        </div>

        {!insightsState.loading && recentBusinessLogs.length === 0 ? (
          <p className="muted">最近没有业务记录。</p>
        ) : null}
        {recentBusinessLogs.length > 0 ? (
          <>
            <div className="tenant-mobile-only">
              <details className="tenant-mobile-collapsible">
                <summary className="tenant-mobile-collapsible-summary">
                  <span className="tenant-mobile-collapsible-title">
                    <strong>最近业务记录</strong>
                    <span>{businessLogSummary}</span>
                  </span>
                  <span className="tenant-mobile-collapsible-hint">点开查看</span>
                </summary>
                <div className="tenant-mobile-collapsible-body tenant-mobile-section-stack">
                  {mobileBusinessLogs.map((log) => (
                    <div key={log.id} className="tenant-side-feed-item">
                      <div className="stack row-tight">
                        <strong>{formatBusinessAuditActionLabel(log.action)}</strong>
                        <span className="muted">{log.resourceType}</span>
                      </div>
                      <div className="stack row-tight tenant-side-feed-meta">
                        <span>{formatDateTime(log.createdAt)}</span>
                        <span className="mono">{log.actorUserId}</span>
                      </div>
                    </div>
                  ))}
                  {recentBusinessLogs.length > mobileBusinessLogs.length ? (
                    <p className="tenant-mobile-compact-note">
                      已展示最近 {mobileBusinessLogs.length} 条业务动作，完整列表在桌面表格中可查看更多上下文。
                    </p>
                  ) : null}
                </div>
              </details>
            </div>

            <div className="tenant-desktop-only">
              <AdminTableFrame>
                <thead>
                  <tr>
                    <th>动作</th>
                    <th>资源</th>
                    <th>操作者</th>
                    <th>时间</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBusinessLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{formatBusinessAuditActionLabel(log.action)}</td>
                      <td>{log.resourceType}</td>
                      <td>{log.actorUserId}</td>
                      <td>{formatDateTime(log.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </AdminTableFrame>
            </div>
          </>
        ) : null}
      </AdminPanel>

      <AdminPanel id="tenant-detail-members" className="stack">
        <div className="admin-section-head">
          <h3>成员列表</h3>
          <p>按邮箱筛选当前用户成员。</p>
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

        {state.loading ? <p className="muted">加载成员中...</p> : null}
        {!state.loading && state.members.length === 0 ? <p className="muted">当前用户暂无成员。</p> : null}

        {state.members.length > 0 ? (
          <>
            <div className="tenant-mobile-only">
              <details className="tenant-mobile-collapsible">
                <summary className="tenant-mobile-collapsible-summary">
                  <span className="tenant-mobile-collapsible-title">
                    <strong>成员列表</strong>
                    <span>{memberSearch ? `筛选结果 ${state.members.length} 人` : `当前成员 ${state.members.length} 人`}</span>
                  </span>
                  <span className="tenant-mobile-collapsible-hint">点开查看</span>
                </summary>
                <div className="tenant-mobile-collapsible-body tenant-side-member-list">
                  {mobileMembers.map((member) => (
                    <div key={`${member.tenantId}:${member.user.id}`} className="tenant-side-member-item">
                      <div className="stack row-tight">
                        <strong>{member.user.email}</strong>
                        <span className="muted">{member.user.name ?? '-'}</span>
                        <span className="muted">加入时间：{formatDateTime(member.joinedAt)}</span>
                      </div>
                      <AdminBadge tone={toRoleTone(member.role)}>
                        {formatTenantRoleLabel(member.role)}
                      </AdminBadge>
                    </div>
                  ))}
                  {state.members.length > mobileMembers.length ? (
                    <p className="tenant-mobile-compact-note">
                      当前仅展示前 {mobileMembers.length} 位成员，建议结合搜索继续缩小范围。
                    </p>
                  ) : null}
                </div>
              </details>
            </div>

            <div className="tenant-desktop-only">
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
                        <AdminBadge tone={toRoleTone(member.role)}>
                          {formatTenantRoleLabel(member.role)}
                        </AdminBadge>
                      </td>
                      <td>{formatDateTime(member.joinedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </AdminTableFrame>
            </div>
          </>
        ) : null}
      </AdminPanel>

      <AdminPanel id="tenant-detail-audit" className="stack">
        <div className="admin-section-head">
          <h3>近期审计日志</h3>
          <p>用于补充后台操作视角，不抢占首屏。</p>
        </div>

        {state.recentLogs.length === 0 ? <p className="muted">该用户暂无审计记录。</p> : null}
        {state.recentLogs.length > 0 ? (
          <>
            <div className="tenant-mobile-only">
              <details className="tenant-mobile-collapsible">
                <summary className="tenant-mobile-collapsible-summary">
                  <span className="tenant-mobile-collapsible-title">
                    <strong>近期审计日志</strong>
                    <span>最近 {state.recentLogs.length} 条后台记录</span>
                  </span>
                  <span className="tenant-mobile-collapsible-hint">点开查看</span>
                </summary>
                <div className="tenant-mobile-collapsible-body tenant-side-feed">
                  {mobileAuditLogs.map((log) => (
                    <div key={log.id} className="tenant-side-feed-item">
                      <div className="stack row-tight">
                        <strong>{formatAuditActionLabel(log.action)}</strong>
                        <span className="muted mono">{log.actorUserId}</span>
                      </div>
                      <div className="stack row-tight tenant-side-feed-meta">
                        <span>{formatDateTime(log.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            </div>

            <div className="tenant-desktop-only">
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
                      <td>{log.actorUserId}</td>
                      <td>{formatDateTime(log.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </AdminTableFrame>
            </div>
          </>
        ) : null}
      </AdminPanel>

      <AdminPanel id="tenant-detail-actions" className="stack">
        <div className="admin-section-head">
          <h3>更多操作</h3>
          <p>成员管理和生命周期控制收在这里，避免干扰主流程。</p>
        </div>

        <div className="tenant-mobile-only tenant-mobile-section-stack">
          <div className="tenant-detail-mobile-actions">
            <AdminActionLink href={`/dashboard/memberships?tenantId=${tenantId}`}>
              打开成员管理
            </AdminActionLink>
          </div>

          <details className="tenant-mobile-collapsible">
            <summary className="tenant-mobile-collapsible-summary">
              <span className="tenant-mobile-collapsible-title">
                <strong>生命周期控制</strong>
                <span>{lifecycleSummary}</span>
              </span>
              <span className="tenant-mobile-collapsible-hint">点开查看</span>
            </summary>
            <div className="tenant-mobile-collapsible-body">
              <form className="stack admin-subscription-form" onSubmit={handleSuspendSubmit}>
                <p className="muted">冻结后用户写操作会被拒绝，直至恢复。</p>

                <label className="stack row-tight" htmlFor="tenant-suspend-reason-mobile">
                  <span>冻结原因</span>
                  <input
                    id="tenant-suspend-reason-mobile"
                    type="text"
                    maxLength={255}
                    value={lifecycleState.reason}
                    onChange={(event) =>
                      setLifecycleState((previous) => ({
                        ...previous,
                        reason: event.target.value,
                        error: null,
                      }))
                    }
                    placeholder="例如：账单逾期 / 风险排查"
                    disabled={
                      subscriptionState.saving || lifecycleState.suspending || lifecycleState.reactivating
                    }
                  />
                </label>

                <div className="inline-actions tenant-detail-mobile-form-actions">
                  <button
                    type="submit"
                    disabled={
                      subscriptionState.saving || lifecycleState.suspending || lifecycleState.reactivating
                    }
                  >
                    {lifecycleState.suspending ? '冻结中...' : '冻结用户'}
                  </button>
                  <button
                    className="secondary"
                    type="button"
                    onClick={handleReactivateTenant}
                    disabled={
                      subscriptionState.saving || lifecycleState.suspending || lifecycleState.reactivating
                    }
                  >
                    {lifecycleState.reactivating ? '恢复中...' : '恢复用户'}
                  </button>
                </div>
              </form>
            </div>
          </details>
        </div>

        <div className="tenant-desktop-only tenant-mobile-section-stack">
          <div className="inline-actions tenant-detail-section-actions">
            <AdminActionLink href={`/dashboard/memberships?tenantId=${tenantId}`}>
              打开成员管理
            </AdminActionLink>
          </div>

          <form className="stack admin-subscription-form" onSubmit={handleSuspendSubmit}>
            <h3>生命周期控制</h3>
            <p className="muted">冻结后用户写操作会被拒绝，直至恢复。</p>

            <label className="stack row-tight" htmlFor="tenant-suspend-reason-desktop">
              <span>冻结原因</span>
              <input
                id="tenant-suspend-reason-desktop"
                type="text"
                maxLength={255}
                value={lifecycleState.reason}
                onChange={(event) =>
                  setLifecycleState((previous) => ({
                    ...previous,
                    reason: event.target.value,
                    error: null,
                  }))
                }
                placeholder="例如：账单逾期 / 风险排查"
                disabled={
                  subscriptionState.saving || lifecycleState.suspending || lifecycleState.reactivating
                }
              />
            </label>

            <div className="inline-actions">
              <button
                type="submit"
                disabled={
                  subscriptionState.saving || lifecycleState.suspending || lifecycleState.reactivating
                }
              >
                {lifecycleState.suspending ? '冻结中...' : '冻结用户'}
              </button>
              <button
                className="secondary"
                type="button"
                onClick={handleReactivateTenant}
                disabled={
                  subscriptionState.saving || lifecycleState.suspending || lifecycleState.reactivating
                }
              >
                {lifecycleState.reactivating ? '恢复中...' : '恢复用户'}
              </button>
            </div>
          </form>
        </div>

        {lifecycleState.error ? <p className="error">{lifecycleState.error}</p> : null}
        {lifecycleState.actionMessage ? <p className="success">{lifecycleState.actionMessage}</p> : null}
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

function parseRequiredPositiveInt(value: string, label: string, max: number) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} 不能为空。`);
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new Error(`${label} 必须是 1 到 ${max} 的整数。`);
  }

  return parsed;
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

function buildExtendedIsoDateTime(currentExpiresAt: string | null, days: number) {
  const now = new Date();
  const current = currentExpiresAt ? new Date(currentExpiresAt) : null;
  const base = current && current.getTime() > now.getTime() ? current : now;
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

async function copyTextToClipboard(text: string): Promise<ClipboardCopyResult> {
  if (!navigator.clipboard?.writeText) {
    return 'unsupported';
  }

  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

function buildExpiryOperatorAlert(expiresAt: string | null) {
  if (!expiresAt) {
    return null;
  }

  const target = new Date(expiresAt);
  if (Number.isNaN(target.getTime())) {
    return null;
  }

  const diffMs = target.getTime() - Date.now();
  const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

  if (diffMs <= 0) {
    return {
      key: 'expired-at',
      tone: 'danger' as const,
      title: '已过期',
      detail: `订阅已于 ${formatDateTime(expiresAt)} 到期。`,
    };
  }

  if (diffDays <= 3) {
    return {
      key: 'expires-soon-danger',
      tone: 'danger' as const,
      title: '3 天内到期',
      detail: `订阅将在 ${formatDateTime(expiresAt)} 到期。`,
    };
  }

  if (diffDays <= 7) {
    return {
      key: 'expires-soon-warning',
      tone: 'warning' as const,
      title: '7 天内到期',
      detail: `订阅将在 ${formatDateTime(expiresAt)} 到期。`,
    };
  }

  return null;
}

function formatUsageAlertMetricLabel(metric: string) {
  if (metric === 'products') {
    return '产品数';
  }

  if (metric === 'images') {
    return '图片数';
  }

  if (metric === 'shares') {
    return '分享数';
  }

  if (metric === 'storageBytes') {
    return '存储容量';
  }

  return metric;
}

function formatOptionalDate(value: string | null) {
  if (!value) {
    return '无到期';
  }

  return formatDateTime(value);
}

function formatOptionalDateTime(value: string | null) {
  if (!value) {
    return '暂无';
  }

  return formatDateTime(value);
}

function formatDateTimeCell(value: string | null) {
  if (!value) {
    return '暂无';
  }

  return formatDateTime(value);
}

function formatCountMetric(metric: {
  used: number;
  limit: number | null;
  utilization: number | null;
}) {
  return `${metric.used} / ${metric.limit === null ? '∞' : metric.limit}（${formatUtilization(metric.utilization)}）`;
}

function formatStorageMetric(metric: {
  usedBytes: string;
  limitBytes: string | null;
  utilization: number | null;
}) {
  return `${formatBytes(metric.usedBytes)} / ${metric.limitBytes === null ? '∞' : formatBytes(metric.limitBytes)}（${formatUtilization(metric.utilization)}）`;
}

function formatBytes(bytes: string | null) {
  if (!bytes) {
    return '-';
  }

  const value = Number(bytes);
  if (!Number.isFinite(value)) {
    return bytes;
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let current = value;

  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }

  const formatted = current >= 10 ? current.toFixed(0) : current.toFixed(1);
  return `${formatted} ${units[unitIndex]}`;
}

function formatUtilization(value: number | null) {
  if (value === null) {
    return '∞';
  }

  return `${Math.round(value * 100)}%`;
}

function toPlanTone(plan: string): 'accent' | 'info' | 'neutral' {
  if (plan === 'PRO') {
    return 'accent';
  }

  if (plan === 'BASIC') {
    return 'info';
  }

  return 'neutral';
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
