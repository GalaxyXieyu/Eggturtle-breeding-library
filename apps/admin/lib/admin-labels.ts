import {
  type AdminUsageLimitStatus,
  type AdminUsageMetricKey,
  type AuditActionType,
  type SuperAdminAuditActionType,
  type TenantRole,
  type TenantSubscriptionPlan,
  type TenantSubscriptionStatus
} from '@eggturtle/shared';

import type { UiLocale } from '@/components/ui-preferences';
import {
  BUSINESS_AUDIT_ACTION_MESSAGES,
  PLAN_MESSAGES,
  SUBSCRIPTION_STATUS_MESSAGES,
  SUPER_ADMIN_AUDIT_ACTION_MESSAGES,
  TENANT_ROLE_MESSAGES,
  USAGE_METRIC_MESSAGES,
  USAGE_STATUS_MESSAGES,
} from '@/lib/locales/admin-labels';

export function formatPlanLabel(plan: TenantSubscriptionPlan | string, locale: UiLocale = 'zh') {
  return PLAN_MESSAGES[locale][plan as TenantSubscriptionPlan] ?? plan;
}

export function formatTenantRoleLabel(role: TenantRole | string, locale: UiLocale = 'zh') {
  return TENANT_ROLE_MESSAGES[locale][role as TenantRole] ?? role;
}

export function formatSubscriptionStatusLabel(status: TenantSubscriptionStatus | string, locale: UiLocale = 'zh') {
  return SUBSCRIPTION_STATUS_MESSAGES[locale][status as TenantSubscriptionStatus] ?? status;
}

export function formatUsageMetricLabel(metric: AdminUsageMetricKey | string, locale: UiLocale = 'zh') {
  return USAGE_METRIC_MESSAGES[locale][metric as AdminUsageMetricKey] ?? metric;
}

export function formatUsageStatusLabel(status: AdminUsageLimitStatus | string, locale: UiLocale = 'zh') {
  return USAGE_STATUS_MESSAGES[locale][status as AdminUsageLimitStatus] ?? status;
}

export function formatAuditActionLabel(action: SuperAdminAuditActionType | string, locale: UiLocale = 'zh') {
  return SUPER_ADMIN_AUDIT_ACTION_MESSAGES[locale][action as SuperAdminAuditActionType] ?? action;
}

export function formatBusinessAuditActionLabel(action: AuditActionType | string, locale: UiLocale = 'zh') {
  return BUSINESS_AUDIT_ACTION_MESSAGES[locale][action as AuditActionType] ?? action;
}
