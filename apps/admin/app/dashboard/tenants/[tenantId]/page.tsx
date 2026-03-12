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
import { useUiPreferences } from '@/components/ui-preferences';
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
import { TENANT_DETAIL_MESSAGES } from '@/lib/locales/tenant-detail';

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
  const { locale } = useUiPreferences();
  const messages = TENANT_DETAIL_MESSAGES[locale];
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
            error: formatUnknownError(error, { fallback: messages.errors.loadDetail, locale }),
          }));
        }
      }
    }

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [locale, memberSearch, messages.errors.loadDetail, tenantId]);

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
            error: formatUnknownError(error, { fallback: messages.errors.loadInsights, locale }),
            insights: null,
          });
        }
      }
    }

    void loadInsights();

    return () => {
      cancelled = true;
    };
  }, [locale, messages.errors.loadInsights, tenantId]);

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
            error: formatUnknownError(error, { fallback: messages.errors.loadSubscription, locale }),
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
  }, [locale, messages.errors.loadSubscription, tenantId]);

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
        response.auditLogId ? messages.actions.auditIdSuffix(successMessage, response.auditLogId) : successMessage,
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
        error: formatUnknownError(error, { fallback: messages.errors.loadSubscription, locale }),
      }));
    }
  }

  async function handlePlanPresetAction(action: 'renew' | 'basic' | 'pro' | 'clear-expiry') {
    const currentExpiresAt = subscriptionState.subscription?.expiresAt ?? null;

    if (action === 'renew') {
      if (
        !window.confirm(
          messages.confirmations.renew(QUICK_PLAN_DURATION_DAYS),
        )
      ) {
        return;
      }

      await submitSubscriptionUpdate(
        {
          expiresAt: buildExtendedIsoDateTime(currentExpiresAt, QUICK_PLAN_DURATION_DAYS),
        },
        messages.actions.subscriptionRenewed,
      );
      return;
    }

    if (action === 'clear-expiry') {
      if (!window.confirm(messages.confirmations.clearExpiry)) {
        return;
      }

      await submitSubscriptionUpdate(
        {
          expiresAt: null,
        },
        messages.actions.expiryCleared,
      );
      return;
    }

    const targetPlan = action === 'basic' ? 'BASIC' : 'PRO';
    if (
      !window.confirm(
        messages.confirmations.upgrade(formatPlanLabel(targetPlan, locale), QUICK_PLAN_DURATION_DAYS),
      )
    ) {
      return;
    }

    await submitSubscriptionUpdate(
      {
        plan: targetPlan,
        expiresAt: buildExtendedIsoDateTime(currentExpiresAt, QUICK_PLAN_DURATION_DAYS),
      },
      messages.actions.subscriptionUpdated,
    );
  }

  async function handleSubscriptionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    let maxImages: number | null;
    let maxShares: number | null;
    let maxStorageBytes: string | null;

    try {
      maxImages = parseNullableInt(subscriptionMaxImagesInput, messages.fields.imagesLimit, locale);
      maxShares = parseNullableInt(subscriptionMaxSharesInput, messages.fields.sharesLimit, locale);
      maxStorageBytes = parseNullableStorageBytes(subscriptionMaxStorageBytesInput, locale);
    } catch (error) {
      setSubscriptionState((previous) => ({
        ...previous,
        error: error instanceof Error ? error.message : messages.errors.invalidSubscriptionParams,
      }));
      return;
    }

    const confirmMessage = messages.confirmations.updateSubscription(
      tenantId,
      formatPlanLabel(subscriptionPlan, locale),
      subscriptionPlan,
      subscriptionExpiresAtInput ? subscriptionExpiresAtInput : messages.helperLabels.noExpiry,
    );

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
      messages.actions.subscriptionUpdated,
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
      durationDays = parseRequiredPositiveInt(activationCodeDurationDaysInput, messages.fields.durationDays, 3650, locale);
      redeemLimit = parseRequiredPositiveInt(activationCodeRedeemLimitInput, messages.fields.redeemLimit, 1000, locale);
      maxImages = parseNullableInt(activationCodeMaxImagesInput, messages.fields.imagesLimit, locale);
      maxShares = parseNullableInt(activationCodeMaxSharesInput, messages.fields.sharesLimit, locale);
      maxStorageBytes = parseNullableStorageBytes(activationCodeMaxStorageBytesInput, locale);
    } catch (error) {
      setActivationCodeState((previous) => ({
        ...previous,
        error: error instanceof Error ? error.message : messages.errors.invalidActivationParams,
      }));
      return;
    }

    const confirmMessage = messages.confirmations.createActivationCode(
      tenantId,
      formatPlanLabel(activationCodePlan, locale),
      durationDays,
      redeemLimit,
    );

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
          ? messages.actions.auditIdSuffix(messages.actions.activationCreated, response.auditLogId)
          : messages.actions.activationCreated,
        generatedCode: response.activationCode.code,
        generatedCodeLabel: response.activationCode.codeLabel,
      });
    } catch (error) {
      setActivationCodeState((previous) => ({
        ...previous,
        saving: false,
        error: formatUnknownError(error, { fallback: messages.errors.createActivationCode, locale }),
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
        actionMessage: messages.errors.clipboardUnsupported,
      }));
      return;
    }

    if (copyResult === 'copied') {
      setActivationCodeState((previous) => ({
        ...previous,
        actionMessage: messages.errors.clipboardSuccess,
      }));
      return;
    }

    setActivationCodeState((previous) => ({
      ...previous,
      actionMessage: messages.errors.clipboardFailed,
    }));
  }

  async function handleSuspendSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = lifecycleState.reason.trim();
    if (!reason) {
      setLifecycleState((previous) => ({
        ...previous,
        error: messages.errors.suspendReasonRequired,
      }));
      return;
    }

    const confirmMessage = messages.confirmations.suspend(tenantId, reason);
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
        response.auditLogId ? messages.actions.auditIdSuffix(messages.actions.lifecycleUpdated, response.auditLogId) : messages.actions.suspended,
      );
      setLifecycleState((previous) => ({
        ...previous,
        reason: response.subscription.disabledReason ?? reason,
        suspending: false,
        error: null,
        actionMessage: response.auditLogId
          ? messages.actions.auditIdSuffix(messages.actions.suspended, response.auditLogId)
          : messages.actions.suspended,
      }));
    } catch (error) {
      setLifecycleState((previous) => ({
        ...previous,
        suspending: false,
        error: formatUnknownError(error, { fallback: messages.errors.updateLifecycle, locale }),
      }));
    }
  }

  async function handleReactivateTenant() {
    const confirmMessage = messages.confirmations.reactivate(tenantId);
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
        response.auditLogId ? messages.actions.auditIdSuffix(messages.actions.lifecycleUpdated, response.auditLogId) : messages.actions.reactivated,
      );
      setLifecycleState((previous) => ({
        ...previous,
        reason: '',
        reactivating: false,
        error: null,
        actionMessage: response.auditLogId
          ? messages.actions.auditIdSuffix(messages.actions.reactivated, response.auditLogId)
          : messages.actions.reactivated,
      }));
    } catch (error) {
      setLifecycleState((previous) => ({
        ...previous,
        reactivating: false,
        error: formatUnknownError(error, { fallback: messages.errors.updateLifecycle, locale }),
      }));
    }
  }

  const insights = insightsState.insights;
  const overviewSummaryCards = useMemo(
    () => [
      {
        label: messages.fields.expiresAt,
        value: formatOptionalDate(subscriptionState.subscription?.expiresAt ?? null, locale),
      },
      {
        label: messages.fields.memberCount,
        value: state.tenant ? messages.summaries.members(state.tenant.memberCount) : '-',
      },
      {
        label: messages.fields.lastActiveAt,
        value: state.tenant ? formatOptionalDateTime(state.tenant.lastActiveAt, locale) : '-',
      },
      {
        label: messages.fields.lastLoginAt,
        value: insights ? formatDateTimeCell(insights.loginMetrics.lastLoginAt, locale) : '-',
      },
    ],
    [insights, locale, messages, state.tenant, subscriptionState.subscription],
  );
  const overviewMetrics = useMemo(
    () => [
      {
        label: messages.fields.activeDays30d,
        value: insights ? String(insights.businessMetrics.activeDays30d) : '-',
      },
      {
        label: messages.fields.lastBusinessActivityAt,
        value: insights ? formatDateTimeCell(insights.businessMetrics.lastBusinessActivityAt, locale) : '-',
      },
      {
        label: messages.fields.totalProducts,
        value: insights ? String(insights.businessMetrics.totalProducts) : '-',
      },
      {
        label: messages.fields.totalImages,
        value: insights ? String(insights.businessMetrics.totalImages) : '-',
      },
      {
        label: messages.fields.storageUtilization,
        value: insights ? formatUtilization(insights.usage.usage.storageBytes.utilization) : '-',
      },
    ],
    [insights, locale, messages],
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
        title: messages.summaries.statusDisabled,
        detail: subscription.disabledReason?.trim()
          ? messages.summaries.reason(subscription.disabledReason)
          : messages.sections.lifecycleDesc,
      });
    } else if (subscription?.status === 'EXPIRED') {
      alerts.push({
        key: `subscription-${subscription.status.toLowerCase()}`,
        tone: 'danger',
        title: messages.summaries.statusExpired,
        detail: messages.summaries.currentStatus(formatSubscriptionStatusLabel(subscription.status, locale)),
      });
    }

    const expiryAlert = buildExpiryOperatorAlert(subscription?.expiresAt ?? null, locale);
    if (expiryAlert) {
      alerts.push(expiryAlert);
    }

    if (insights) {
      alerts.push(
        ...insights.usage.alerts.slice(0, 2).map((alert) => ({
          key: `usage-${alert.metric}-${alert.status}`,
          tone: (alert.status === 'exceeded' ? 'danger' : 'warning') as OperatorAlertTone,
          title: alert.status === 'exceeded' ? messages.summaries.usageExceeded : messages.summaries.usageNearLimit,
          detail: alert.status === 'exceeded'
            ? messages.summaries.usageExceededDetail(formatUsageAlertMetricLabel(alert.metric, locale))
            : messages.summaries.usageNearLimitDetail(formatUsageAlertMetricLabel(alert.metric, locale)),
        })),
      );

      if (insights.businessMetrics.activeDays30d === 0) {
        alerts.push({
          key: 'inactive-30d',
          tone: 'info',
          title: messages.summaries.inactive30dTitle,
          detail: messages.summaries.inactive30dDetail,
        });
      }
    }

    if (alerts.length === 0) {
      alerts.push({
        key: 'healthy',
        tone: 'success',
        title: messages.summaries.healthyTitle,
        detail: messages.summaries.healthyDetail,
      });
    }

    return alerts.slice(0, 4);
  }, [insights, locale, messages, subscriptionState.subscription]);
  const recentBusinessLogs = insights?.recentBusinessLogs.slice(0, 8) ?? [];
  const mobileBusinessLogs = recentBusinessLogs.slice(0, 4);
  const mobileMembers = state.members.slice(0, 8);
  const mobileAuditLogs = state.recentLogs.slice(0, 8);
  const businessLogSummary =
    recentBusinessLogs.length === 0 ? messages.summaries.noBusinessLogs : messages.summaries.businessLogs(recentBusinessLogs.length);
  const usageAlertSummary = insights
    ? insights.usage.alerts.length === 0
      ? messages.summaries.noUsageAlerts
      : messages.summaries.usageAlerts(insights.usage.alerts.length)
    : messages.summaries.noUsageData;
  const lifecycleSummary =
    subscriptionState.subscription?.status === 'DISABLED'
      ? messages.summaries.statusDisabled
      : subscriptionState.subscription?.status === 'EXPIRED'
        ? messages.summaries.statusExpired
        : messages.summaries.statusHealthy;
  const overviewSecondarySummary = insights
    ? [
        messages.summaries.activeDays(insights.businessMetrics.activeDays30d),
        messages.summaries.products(insights.businessMetrics.totalProducts),
        messages.summaries.storage(formatUtilization(insights.usage.usage.storageBytes.utilization)),
        insights.autoTags.length > 0 ? messages.summaries.tags(insights.autoTags.length) : null,
      ]
        .filter((value): value is string => Boolean(value))
        .join(' · ')
    : messages.summaries.noSecondary;

  const isDrawerSaving = subscriptionState.saving || activationCodeState.saving;

  return (
    <section className="page admin-page">
      <AdminPageHeader
        eyebrow={messages.header.eyebrow}
        title={messages.header.title}
        description={messages.header.description}
        actions={<AdminActionLink href="/dashboard/tenants">{messages.header.back}</AdminActionLink>}
      />

      <AdminSectionNav
        ariaLabel={messages.header.sectionNav}
        items={[
          {
            label: messages.header.navOverview,
            href: `/dashboard/tenants/${tenantId}#tenant-detail-overview`,
            active: activeDetailSection === 'tenant-detail-overview',
          },
          {
            label: messages.header.navUsage,
            href: `/dashboard/tenants/${tenantId}#tenant-detail-usage`,
            active: activeDetailSection === 'tenant-detail-usage',
          },
          {
            label: messages.header.navRecords,
            href: `/dashboard/tenants/${tenantId}#tenant-detail-business`,
            active:
              activeDetailSection === 'tenant-detail-business' ||
              activeDetailSection === 'tenant-detail-audit',
          },
          {
            label: messages.header.navMembers,
            href: `/dashboard/tenants/${tenantId}#tenant-detail-members`,
            active: activeDetailSection === 'tenant-detail-members',
          },
          {
            label: messages.header.navActions,
            href: `/dashboard/tenants/${tenantId}#tenant-detail-actions`,
            active: activeDetailSection === 'tenant-detail-actions',
          },
        ]}
      />

      {isPlanDrawerOpen || isActivationDrawerOpen ? (
        <button
          type="button"
          className="admin-overlay-backdrop"
          aria-label={messages.header.closeDrawer}
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
              <strong id="tenant-plan-drawer-title">{messages.drawers.planTitle}</strong>
              <p className="muted">{messages.drawers.planDesc}</p>
            </div>
            <button
              className="dashboard-bottom-dock-close"
              type="button"
              aria-label={messages.header.closeDrawer}
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
              <strong>{subscriptionState.saving ? messages.drawers.processing : messages.drawers.renew30d}</strong>
              <span>{messages.drawers.renew30dDesc}</span>
            </button>
            <button
              type="button"
              className="tenant-quick-action-card"
              disabled={subscriptionState.loading || subscriptionState.saving}
              onClick={() => handlePlanPresetAction('basic')}
            >
              <strong>{subscriptionState.saving ? messages.drawers.processing : messages.drawers.upgradeBasic}</strong>
              <span>{messages.drawers.upgradeBasicDesc}</span>
            </button>
            <button
              type="button"
              className="tenant-quick-action-card"
              disabled={subscriptionState.loading || subscriptionState.saving}
              onClick={() => handlePlanPresetAction('pro')}
            >
              <strong>{subscriptionState.saving ? messages.drawers.processing : messages.drawers.upgradePro}</strong>
              <span>{messages.drawers.upgradeProDesc}</span>
            </button>
            <button
              type="button"
              className="tenant-quick-action-card"
              disabled={subscriptionState.loading || subscriptionState.saving}
              onClick={() => handlePlanPresetAction('clear-expiry')}
            >
              <strong>{subscriptionState.saving ? messages.drawers.processing : messages.drawers.clearExpiry}</strong>
              <span>{messages.drawers.clearExpiryDesc}</span>
            </button>
          </div>

          <details className="tenant-detail-drawer-details">
            <summary>{messages.drawers.advanced}</summary>
            <form className="stack admin-subscription-form" onSubmit={handleSubscriptionSubmit}>
              <div className="form-grid admin-subscription-grid">
                <label className="stack row-tight" htmlFor="subscription-plan">
                  <span>{messages.fields.plan}</span>
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
                        {formatPlanLabel(plan, locale)} ({plan})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="stack row-tight" htmlFor="subscription-expires-at">
                  <span>{messages.fields.expiresAt}</span>
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
                      {messages.drawers.noExpiry}
                    </button>
                  </div>
                </label>

                <label className="stack row-tight" htmlFor="subscription-max-images">
                  <span>{messages.fields.imagesLimit}</span>
                  <input
                    id="subscription-max-images"
                    type="number"
                    min={0}
                    step={1}
                    value={subscriptionMaxImagesInput}
                    onChange={(event) => setSubscriptionMaxImagesInput(event.target.value)}
                    placeholder={messages.drawers.noLimit}
                    disabled={subscriptionState.saving}
                  />
                </label>

                <label className="stack row-tight" htmlFor="subscription-max-storage-bytes">
                  <span>{messages.fields.storageLimitBytes}</span>
                  <input
                    id="subscription-max-storage-bytes"
                    type="text"
                    inputMode="numeric"
                    value={subscriptionMaxStorageBytesInput}
                    onChange={(event) => setSubscriptionMaxStorageBytesInput(event.target.value)}
                    placeholder={messages.drawers.noLimit}
                    disabled={subscriptionState.saving}
                  />
                </label>

                <label className="stack row-tight" htmlFor="subscription-max-shares">
                  <span>{messages.fields.sharesLimit}</span>
                  <input
                    id="subscription-max-shares"
                    type="number"
                    min={0}
                    step={1}
                    value={subscriptionMaxSharesInput}
                    onChange={(event) => setSubscriptionMaxSharesInput(event.target.value)}
                    placeholder={messages.drawers.noLimit}
                    disabled={subscriptionState.saving}
                  />
                </label>
              </div>

              <div className="inline-actions">
                <button type="submit" disabled={subscriptionState.saving}>
                  {subscriptionState.saving ? messages.drawers.saving : messages.drawers.save}
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
              <strong id="tenant-activation-drawer-title">{messages.drawers.activationTitle}</strong>
              <p className="muted">{messages.drawers.activationDesc}</p>
            </div>
            <button
              className="dashboard-bottom-dock-close"
              type="button"
              aria-label={messages.header.closeDrawer}
              onClick={closeDrawers}
            >
              ×
            </button>
          </div>

          <form className="stack admin-subscription-form" onSubmit={handleActivationCodeSubmit}>
            <p className="muted">
              {messages.drawers.activationBindingNote}
            </p>
            <p className="muted">{messages.drawers.activationMaxSharesNote}</p>

            <div className="form-grid admin-subscription-grid">
              <label className="stack row-tight" htmlFor="activation-code-plan">
                <span>{messages.fields.targetPlan}</span>
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
                      {formatPlanLabel(plan, locale)} ({plan})
                    </option>
                  ))}
                </select>
              </label>

              <label className="stack row-tight" htmlFor="activation-code-duration-days">
                <span>{messages.fields.durationDays}</span>
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
                <span>{messages.fields.redeemLimit}</span>
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
                <span>{messages.fields.absoluteExpiresAt}</span>
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
                    {messages.drawers.unlimited}
                  </button>
                </div>
              </label>

              <label className="stack row-tight" htmlFor="activation-code-max-images">
                <span>{messages.fields.imagesLimit}</span>
                <input
                  id="activation-code-max-images"
                  type="number"
                  min={0}
                  step={1}
                  value={activationCodeMaxImagesInput}
                  onChange={(event) => setActivationCodeMaxImagesInput(event.target.value)}
                  placeholder={messages.drawers.noOverride}
                  disabled={activationCodeState.saving}
                />
              </label>

              <label className="stack row-tight" htmlFor="activation-code-max-storage-bytes">
                <span>{messages.fields.storageLimitBytes}</span>
                <input
                  id="activation-code-max-storage-bytes"
                  type="text"
                  inputMode="numeric"
                  value={activationCodeMaxStorageBytesInput}
                  onChange={(event) => setActivationCodeMaxStorageBytesInput(event.target.value)}
                  placeholder={messages.drawers.noOverride}
                  disabled={activationCodeState.saving}
                />
              </label>

              <label className="stack row-tight" htmlFor="activation-code-max-shares">
                <span>{messages.fields.sharesLimit}</span>
                <input
                  id="activation-code-max-shares"
                  type="number"
                  min={0}
                  step={1}
                  value={activationCodeMaxSharesInput}
                  onChange={(event) => setActivationCodeMaxSharesInput(event.target.value)}
                  placeholder={messages.drawers.noOverride}
                  disabled={activationCodeState.saving}
                />
              </label>
            </div>

            <div className="inline-actions">
              <button type="submit" disabled={activationCodeState.saving}>
                {activationCodeState.saving ? messages.drawers.generating : messages.drawers.generate}
              </button>
              {activationCodeState.generatedCode ? (
                <button
                  className="secondary"
                  type="button"
                  onClick={handleCopyGeneratedCode}
                  disabled={activationCodeState.saving}
                >
                  {messages.drawers.copyCode}
                </button>
              ) : null}
            </div>

            {activationCodeState.generatedCode ? (
              <div className="detail-list admin-detail-list">
                <div>
                  <dt>{messages.drawers.latestCode}</dt>
                  <dd className="mono">{activationCodeState.generatedCode}</dd>
                </div>
                <div>
                  <dt>{messages.drawers.codeLabel}</dt>
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
          <h3>{messages.sections.overviewTitle}</h3>
          <p>{messages.sections.overviewDesc}</p>
        </div>

        {state.loading ? <p className="muted">{messages.sections.loadingDetail}</p> : null}
        {subscriptionState.loading ? <p className="muted">{messages.sections.loadingSubscription}</p> : null}
        {insightsState.loading ? <p className="muted">{messages.sections.loadingInsights}</p> : null}
        {insightsState.error ? <p className="error">{insightsState.error}</p> : null}

        {state.tenant ? (
          <div className="tenant-detail-overview-shell">
            <div className="tenant-side-hero tenant-detail-overview-hero">
              <div className="stack row-tight tenant-detail-overview-copy">
                <h3>{state.tenant.name}</h3>
                <p className="mono">{state.tenant.slug}</p>
                <div className="tenant-detail-meta-row">
                  <span className="tenant-detail-meta-chip">
                    {messages.summaries.ownerLabel(state.tenant.owner?.account ?? state.tenant.owner?.email ?? messages.helperLabels.ownerMissing)}
                  </span>
                  <span className="tenant-detail-meta-chip mono">{messages.summaries.tenantIdLabel(state.tenant.id)}</span>
                  <span className="tenant-detail-meta-chip">
                    {messages.summaries.createdAtLabel(formatDateTime(state.tenant.createdAt, locale))}
                  </span>
                </div>
              </div>

              <div className="stack tenant-detail-overview-actions">
                <div className="inline-actions tenant-detail-badge-row">
                  <AdminBadge tone={toPlanTone(subscriptionState.subscription?.plan ?? 'FREE')}>
                    {formatPlanLabel(subscriptionState.subscription?.plan ?? 'FREE', locale)}
                  </AdminBadge>
                  <AdminBadge
                    tone={toSubscriptionStatusTone(subscriptionState.subscription?.status ?? 'ACTIVE')}
                  >
                    {formatSubscriptionStatusLabel(subscriptionState.subscription?.status ?? 'ACTIVE', locale)}
                  </AdminBadge>
                </div>

                <div className="inline-actions tenant-detail-action-bar">
                  <button
                    type="button"
                    onClick={openPlanDrawer}
                    disabled={isDrawerSaving || subscriptionState.loading}
                  >
                    {messages.sections.editPlan}
                  </button>
                  <button
                    className="secondary"
                    type="button"
                    onClick={openActivationDrawer}
                    disabled={isDrawerSaving}
                  >
                    {messages.sections.createActivationCode}
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
                        <strong>{messages.sections.overviewMetricsTitle}</strong>
                        <span>{overviewSecondarySummary}</span>
                      </span>
                      <span className="tenant-mobile-collapsible-hint">{messages.sections.expandHint}</span>
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
                        <p className="tenant-mobile-compact-note">{messages.summaries.noAutoTags}</p>
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
          <h3>{messages.sections.usageTitle}</h3>
          <p>{messages.sections.usageDesc}</p>
        </div>

        {!insightsState.loading && !insightsState.error && !insights ? (
          <p className="muted">{messages.summaries.noInsights}</p>
        ) : null}

        {insights ? (
          <>
            <div className="tenant-mobile-only">
              <details className="tenant-mobile-collapsible">
                <summary className="tenant-mobile-collapsible-summary">
                  <span className="tenant-mobile-collapsible-title">
                    <strong>{messages.sections.usageTitle}</strong>
                    <span>{usageAlertSummary}</span>
                  </span>
                  <span className="tenant-mobile-collapsible-hint">{messages.sections.expandHint}</span>
                </summary>
                <div className="tenant-mobile-collapsible-body">
                  <dl className="detail-list admin-detail-list">
                    <div>
                      <dt>{messages.fields.usageProducts}</dt>
                      <dd>{formatCountMetric(insights.usage.usage.products)}</dd>
                    </div>
                    <div>
                      <dt>{messages.fields.usageImages}</dt>
                      <dd>{formatCountMetric(insights.usage.usage.images)}</dd>
                    </div>
                    <div>
                      <dt>{messages.fields.usageShares}</dt>
                      <dd>{formatCountMetric(insights.usage.usage.shares)}</dd>
                    </div>
                    <div>
                      <dt>{messages.fields.usageStorage}</dt>
                      <dd>{formatStorageMetric(insights.usage.usage.storageBytes)}</dd>
                    </div>
                    <div>
                      <dt>{messages.fields.autoTags}</dt>
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
                      <dt>{messages.fields.usageAlerts}</dt>
                      <dd>
                        {insights.usage.alerts.length === 0
                          ? messages.summaries.noUsageReminder
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
                  <dt>{messages.fields.usageProducts}</dt>
                  <dd>{formatCountMetric(insights.usage.usage.products)}</dd>
                </div>
                <div>
                  <dt>{messages.fields.usageImages}</dt>
                  <dd>{formatCountMetric(insights.usage.usage.images)}</dd>
                </div>
                <div>
                  <dt>{messages.fields.usageShares}</dt>
                  <dd>{formatCountMetric(insights.usage.usage.shares)}</dd>
                </div>
                <div>
                  <dt>{messages.fields.usageStorage}</dt>
                  <dd>{formatStorageMetric(insights.usage.usage.storageBytes)}</dd>
                </div>
                <div>
                  <dt>{messages.fields.autoTags}</dt>
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
                  <dt>{messages.fields.usageAlerts}</dt>
                  <dd>
                    {insights.usage.alerts.length === 0
                      ? messages.summaries.noUsageReminder
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
          <h3>{messages.sections.businessTitle}</h3>
          <p>{messages.sections.businessDesc}</p>
        </div>

        {!insightsState.loading && recentBusinessLogs.length === 0 ? (
          <p className="muted">{messages.sections.noBusiness}</p>
        ) : null}
        {recentBusinessLogs.length > 0 ? (
          <>
            <div className="tenant-mobile-only">
              <details className="tenant-mobile-collapsible">
                <summary className="tenant-mobile-collapsible-summary">
                  <span className="tenant-mobile-collapsible-title">
                    <strong>{messages.sections.businessTitle}</strong>
                    <span>{businessLogSummary}</span>
                  </span>
                  <span className="tenant-mobile-collapsible-hint">{messages.sections.expandHint}</span>
                </summary>
                <div className="tenant-mobile-collapsible-body tenant-mobile-section-stack">
                  {mobileBusinessLogs.map((log) => (
                    <div key={log.id} className="tenant-side-feed-item">
                      <div className="stack row-tight">
                        <strong>{formatBusinessAuditActionLabel(log.action, locale)}</strong>
                        <span className="muted">{log.resourceType}</span>
                      </div>
                      <div className="stack row-tight tenant-side-feed-meta">
                        <span>{formatDateTime(log.createdAt, locale)}</span>
                        <span className="mono">{log.actorUserId}</span>
                      </div>
                    </div>
                  ))}
                  {recentBusinessLogs.length > mobileBusinessLogs.length ? (
                    <p className="tenant-mobile-compact-note">
                      {messages.summaries.businessLogsDisplayed(mobileBusinessLogs.length)}
                    </p>
                  ) : null}
                </div>
              </details>
            </div>

            <div className="tenant-desktop-only">
              <AdminTableFrame>
                <thead>
                  <tr>
                    <th>{messages.sections.thAction}</th>
                    <th>{messages.sections.thResource}</th>
                    <th>{messages.sections.thActor}</th>
                    <th>{messages.sections.thTime}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBusinessLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{formatBusinessAuditActionLabel(log.action, locale)}</td>
                      <td>{log.resourceType}</td>
                      <td>{log.actorUserId}</td>
                      <td>{formatDateTime(log.createdAt, locale)}</td>
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
          <h3>{messages.sections.membersTitle}</h3>
          <p>{messages.sections.membersDesc}</p>
        </div>

        <form className="inline-actions admin-inline-form" onSubmit={handleMemberSearch}>
          <input
            type="search"
            value={memberSearchInput}
            placeholder={messages.sections.memberSearchPlaceholder}
            onChange={(event) => setMemberSearchInput(event.target.value)}
          />
          <button type="submit">{messages.sections.apply}</button>
          <button
            className="secondary"
            type="button"
            onClick={() => {
              setMemberSearchInput('');
              setMemberSearch('');
            }}
          >
            {messages.sections.reset}
          </button>
        </form>

        {state.loading ? <p className="muted">{messages.sections.loadingMembers}</p> : null}
        {!state.loading && state.members.length === 0 ? <p className="muted">{messages.sections.noMembers}</p> : null}

        {state.members.length > 0 ? (
          <>
            <div className="tenant-mobile-only">
              <details className="tenant-mobile-collapsible">
                <summary className="tenant-mobile-collapsible-summary">
                  <span className="tenant-mobile-collapsible-title">
                    <strong>{messages.sections.membersTitle}</strong>
                    <span>{memberSearch ? messages.summaries.membersFiltered(state.members.length) : messages.summaries.membersCurrent(state.members.length)}</span>
                  </span>
                  <span className="tenant-mobile-collapsible-hint">{messages.sections.expandHint}</span>
                </summary>
                <div className="tenant-mobile-collapsible-body tenant-side-member-list">
                  {mobileMembers.map((member) => (
                    <div key={`${member.tenantId}:${member.user.id}`} className="tenant-side-member-item">
                      <div className="stack row-tight">
                        <strong>{member.user.email}</strong>
                        <span className="muted">{member.user.name ?? '-'}</span>
                        <span className="muted">{messages.summaries.joinedAt(formatDateTime(member.joinedAt, locale))}</span>
                      </div>
                      <AdminBadge tone={toRoleTone(member.role)}>
                        {formatTenantRoleLabel(member.role, locale)}
                      </AdminBadge>
                    </div>
                  ))}
                  {state.members.length > mobileMembers.length ? (
                    <p className="tenant-mobile-compact-note">
                      {messages.summaries.membersTruncated(mobileMembers.length)}
                    </p>
                  ) : null}
                </div>
              </details>
            </div>

            <div className="tenant-desktop-only">
              <AdminTableFrame>
                <thead>
                  <tr>
                    <th>{messages.sections.thEmail}</th>
                    <th>{messages.sections.thName}</th>
                    <th>{messages.sections.thRole}</th>
                    <th>{messages.sections.thJoinedAt}</th>
                  </tr>
                </thead>
                <tbody>
                  {state.members.map((member) => (
                    <tr key={`${member.tenantId}:${member.user.id}`}>
                      <td>{member.user.email}</td>
                      <td>{member.user.name ?? '-'}</td>
                      <td>
                        <AdminBadge tone={toRoleTone(member.role)}>
                          {formatTenantRoleLabel(member.role, locale)}
                        </AdminBadge>
                      </td>
                      <td>{formatDateTime(member.joinedAt, locale)}</td>
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
          <h3>{messages.sections.auditTitle}</h3>
          <p>{messages.sections.auditDesc}</p>
        </div>

        {state.recentLogs.length === 0 ? <p className="muted">{messages.sections.noAudit}</p> : null}
        {state.recentLogs.length > 0 ? (
          <>
            <div className="tenant-mobile-only">
              <details className="tenant-mobile-collapsible">
                <summary className="tenant-mobile-collapsible-summary">
                  <span className="tenant-mobile-collapsible-title">
                    <strong>{messages.sections.auditTitle}</strong>
                    <span>{messages.summaries.recentAuditLogs(state.recentLogs.length)}</span>
                  </span>
                  <span className="tenant-mobile-collapsible-hint">{messages.sections.expandHint}</span>
                </summary>
                <div className="tenant-mobile-collapsible-body tenant-side-feed">
                  {mobileAuditLogs.map((log) => (
                    <div key={log.id} className="tenant-side-feed-item">
                      <div className="stack row-tight">
                        <strong>{formatAuditActionLabel(log.action, locale)}</strong>
                        <span className="muted mono">{log.actorUserId}</span>
                      </div>
                      <div className="stack row-tight tenant-side-feed-meta">
                        <span>{formatDateTime(log.createdAt, locale)}</span>
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
                    <th>{messages.sections.thAction}</th>
                    <th>{messages.sections.thActor}</th>
                    <th>{messages.sections.thTime}</th>
                  </tr>
                </thead>
                <tbody>
                  {state.recentLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{formatAuditActionLabel(log.action, locale)}</td>
                      <td>{log.actorUserId}</td>
                      <td>{formatDateTime(log.createdAt, locale)}</td>
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
          <h3>{messages.sections.actionsTitle}</h3>
          <p>{messages.sections.actionsDesc}</p>
        </div>

        <div className="tenant-mobile-only tenant-mobile-section-stack">
          <div className="tenant-detail-mobile-actions">
            <AdminActionLink href={`/dashboard/memberships?tenantId=${tenantId}`}>
              {messages.sections.openMemberships}
            </AdminActionLink>
          </div>

          <details className="tenant-mobile-collapsible">
            <summary className="tenant-mobile-collapsible-summary">
              <span className="tenant-mobile-collapsible-title">
                <strong>{messages.sections.lifecycleTitle}</strong>
                <span>{lifecycleSummary}</span>
              </span>
              <span className="tenant-mobile-collapsible-hint">{messages.sections.expandHint}</span>
            </summary>
            <div className="tenant-mobile-collapsible-body">
              <form className="stack admin-subscription-form" onSubmit={handleSuspendSubmit}>
                <p className="muted">{messages.sections.lifecycleDesc}</p>

                <label className="stack row-tight" htmlFor="tenant-suspend-reason-mobile">
                  <span>{messages.fields.freezeReason}</span>
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
                    placeholder={messages.sections.freezeReasonPlaceholder}
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
                    {lifecycleState.suspending ? messages.sections.suspending : messages.sections.suspend}
                  </button>
                  <button
                    className="secondary"
                    type="button"
                    onClick={handleReactivateTenant}
                    disabled={
                      subscriptionState.saving || lifecycleState.suspending || lifecycleState.reactivating
                    }
                  >
                    {lifecycleState.reactivating ? messages.sections.reactivating : messages.sections.reactivate}
                  </button>
                </div>
              </form>
            </div>
          </details>
        </div>

        <div className="tenant-desktop-only tenant-mobile-section-stack">
          <div className="inline-actions tenant-detail-section-actions">
            <AdminActionLink href={`/dashboard/memberships?tenantId=${tenantId}`}>
              {messages.sections.openMemberships}
            </AdminActionLink>
          </div>

          <form className="stack admin-subscription-form" onSubmit={handleSuspendSubmit}>
            <h3>{messages.sections.lifecycleTitle}</h3>
            <p className="muted">{messages.sections.lifecycleDesc}</p>

            <label className="stack row-tight" htmlFor="tenant-suspend-reason-desktop">
              <span>{messages.fields.freezeReason}</span>
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
                placeholder={messages.sections.freezeReasonPlaceholder}
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
                {lifecycleState.suspending ? messages.sections.suspending : messages.sections.suspend}
              </button>
              <button
                className="secondary"
                type="button"
                onClick={handleReactivateTenant}
                disabled={
                  subscriptionState.saving || lifecycleState.suspending || lifecycleState.reactivating
                }
              >
                {lifecycleState.reactivating ? messages.sections.reactivating : messages.sections.reactivate}
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

function parseNullableInt(value: string, label: string, locale: 'zh' | 'en') {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(TENANT_DETAIL_MESSAGES[locale].validation.nonNegativeInteger(label));
  }

  return parsed;
}

function parseNullableStorageBytes(value: string, locale: 'zh' | 'en') {
  if (!value.trim()) {
    return null;
  }

  if (!/^\d+$/.test(value.trim())) {
    throw new Error(TENANT_DETAIL_MESSAGES[locale].validation.storageNonNegativeInteger);
  }

  return value.trim();
}

function parseRequiredPositiveInt(value: string, label: string, max: number, locale: 'zh' | 'en') {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(TENANT_DETAIL_MESSAGES[locale].validation.required(label));
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new Error(TENANT_DETAIL_MESSAGES[locale].validation.positiveIntegerRange(label, max));
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

function buildExpiryOperatorAlert(expiresAt: string | null, locale: 'zh' | 'en') {
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
      title: TENANT_DETAIL_MESSAGES[locale].expiryAlerts.expiredTitle,
      detail: TENANT_DETAIL_MESSAGES[locale].expiryAlerts.expiredDetail(formatDateTime(expiresAt, locale)),
    };
  }

  if (diffDays <= 3) {
    return {
      key: 'expires-soon-danger',
      tone: 'danger' as const,
      title: TENANT_DETAIL_MESSAGES[locale].expiryAlerts.within3DaysTitle,
      detail: TENANT_DETAIL_MESSAGES[locale].expiryAlerts.within3DaysDetail(formatDateTime(expiresAt, locale)),
    };
  }

  if (diffDays <= 7) {
    return {
      key: 'expires-soon-warning',
      tone: 'warning' as const,
      title: TENANT_DETAIL_MESSAGES[locale].expiryAlerts.within7DaysTitle,
      detail: TENANT_DETAIL_MESSAGES[locale].expiryAlerts.within7DaysDetail(formatDateTime(expiresAt, locale)),
    };
  }

  return null;
}

function formatUsageAlertMetricLabel(metric: string, locale: 'zh' | 'en') {
  if (metric === 'products') {
    return TENANT_DETAIL_MESSAGES[locale].helperLabels.products;
  }

  if (metric === 'images') {
    return TENANT_DETAIL_MESSAGES[locale].helperLabels.images;
  }

  if (metric === 'shares') {
    return TENANT_DETAIL_MESSAGES[locale].helperLabels.shares;
  }

  if (metric === 'storageBytes') {
    return TENANT_DETAIL_MESSAGES[locale].helperLabels.storageBytes;
  }

  return metric;
}

function formatOptionalDate(value: string | null, locale: 'zh' | 'en') {
  if (!value) {
    return TENANT_DETAIL_MESSAGES[locale].helperLabels.noExpiry;
  }

  return formatDateTime(value, locale);
}

function formatOptionalDateTime(value: string | null, locale: 'zh' | 'en') {
  if (!value) {
    return TENANT_DETAIL_MESSAGES[locale].helperLabels.noData;
  }

  return formatDateTime(value, locale);
}

function formatDateTimeCell(value: string | null, locale: 'zh' | 'en') {
  if (!value) {
    return TENANT_DETAIL_MESSAGES[locale].helperLabels.noData;
  }

  return formatDateTime(value, locale);
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
