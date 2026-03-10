import {
  adminActivityOverviewResponseSchema,
  adminRevenueOverviewResponseSchema,
  adminUsageOverviewResponseSchema,
  createAdminTenantResponseSchema,
  deleteTenantMemberResponseSchema,
  getAdminTenantUsageResponseSchema,
  listAdminTenantMembersResponseSchema,
  listAdminTenantsResponseSchema,
  reactivateAdminTenantResponseSchema,
  suspendAdminTenantResponseSchema,
  upsertTenantMemberResponseSchema,
} from '../../packages/shared/src/admin';
import { getAdminTenantSubscriptionResponseSchema } from '../../packages/shared/src/subscription';

import {
  ApiTestError,
  ModuleResult,
  TestContext,
  TestModule,
  asObject,
  assertErrorCode,
  assertStatus,
  defaultEmail,
  ensureTenantSession,
  loginWithDevCode,
  readString,
  uniqueSuffix,
} from './lib';

const AUDIT_EXPORT_TEST_LIMIT = 2000;

export const adminModule: TestModule = {
  name: 'admin',
  description: 'Admin endpoint deny/allow checks for tenant user, audit export, and super-admin member revoke flow',
  requiresWrites: true,
  run,
};

async function run(ctx: TestContext): Promise<ModuleResult> {
  ctx.requireWrites('admin');

  let checks = 0;

  const tenantUserEmail = ctx.options.email ?? defaultEmail('api-admin-role');
  const tenantUserLogin = await loginWithDevCode(ctx, tenantUserEmail);

  const tenantDeniedResponse = await ctx.request({
    method: 'GET',
    path: '/admin/tenants',
    token: tenantUserLogin.token,
  });
  assertStatus(tenantDeniedResponse, 403, 'tenant-role admin endpoint deny');
  assertErrorCode(tenantDeniedResponse, 'FORBIDDEN');
  checks += 1;

  let superAdminStatus: number | null = null;
  let removedMemberUserId: string | null = null;
  let removedTenantId: string | null = null;

  if (ctx.options.superAdminEmail) {
    const superAdminLogin = await loginWithDevCode(ctx, ctx.options.superAdminEmail);
    const superAdminResponse = await ctx.request({
      method: 'GET',
      path: '/admin/tenants',
      token: superAdminLogin.token,
    });

    superAdminStatus = superAdminResponse.status;
    checks += 1;

    if (ctx.options.requireSuperAdminPass && superAdminResponse.status !== 200) {
      throw new ApiTestError(`super-admin check expected 200, got ${superAdminResponse.status}`);
    }

    if (superAdminResponse.status === 200) {
      listAdminTenantsResponseSchema.parse(superAdminResponse.body);
      const activityOverviewResponse = await ctx.request({
        method: 'GET',
        path: '/admin/analytics/activity/overview',
        token: superAdminLogin.token,
        query: {
          window: '30d',
        },
      });
      assertStatus(activityOverviewResponse, 200, 'admin.analytics.activity.overview');
      const activityOverviewPayload = adminActivityOverviewResponseSchema.parse(activityOverviewResponse.body);
      if (activityOverviewPayload.trend.length === 0) {
        throw new ApiTestError('admin.analytics.activity.overview trend should not be empty');
      }
      checks += 1;

      const usageOverviewResponse = await ctx.request({
        method: 'GET',
        path: '/admin/analytics/usage/overview',
        token: superAdminLogin.token,
        query: {
          topN: 10,
        },
      });
      assertStatus(usageOverviewResponse, 200, 'admin.analytics.usage.overview');
      const usageOverviewPayload = adminUsageOverviewResponseSchema.parse(usageOverviewResponse.body);
      if (usageOverviewPayload.topTenants.length > 0) {
        const firstTenant = usageOverviewPayload.topTenants[0];
        const tenantUsageResponse = await ctx.request({
          method: 'GET',
          path: `/admin/tenants/${firstTenant.tenantId}/usage`,
          token: superAdminLogin.token,
        });
        assertStatus(tenantUsageResponse, 200, 'admin.tenants.usage.detail');
        const tenantUsagePayload = getAdminTenantUsageResponseSchema.parse(tenantUsageResponse.body);
        if (tenantUsagePayload.tenant.tenantId !== firstTenant.tenantId) {
          throw new ApiTestError('admin.tenants.usage.detail tenantId mismatch');
        }
        checks += 1;
      }
      checks += 1;

      const revenueOverviewResponse = await ctx.request({
        method: 'GET',
        path: '/admin/analytics/revenue/overview',
        token: superAdminLogin.token,
        query: {
          window: '30d',
        },
      });
      assertStatus(revenueOverviewResponse, 200, 'admin.analytics.revenue.overview');
      adminRevenueOverviewResponseSchema.parse(revenueOverviewResponse.body);
      checks += 1;

      const superAdminUser = asObject(superAdminLogin.user, 'auth.verify-code.user');
      const superAdminUserId = readString(superAdminUser, 'id', 'auth.verify-code.user.id');

      const tenantSlug = uniqueSuffix('admin-rm-member').slice(0, 80);
      const createTenantResponse = await ctx.request({
        method: 'POST',
        path: '/admin/tenants',
        token: superAdminLogin.token,
        json: {
          slug: tenantSlug,
          name: `Admin Remove Member ${Date.now()}`,
        },
      });
      assertStatus(createTenantResponse, 201, 'admin.create-tenant');
      const createTenantPayload = createAdminTenantResponseSchema.parse(createTenantResponse.body);
      const tenantId = createTenantPayload.tenant.id;
      checks += 1;

      const beforeLifecycleResponse = await ctx.request({
        method: 'GET',
        path: `/admin/tenants/${tenantId}/subscription`,
        token: superAdminLogin.token,
      });
      assertStatus(beforeLifecycleResponse, 200, 'admin.lifecycle.subscription.before');
      const beforeLifecyclePayload = getAdminTenantSubscriptionResponseSchema.parse(beforeLifecycleResponse.body);
      if (beforeLifecyclePayload.subscription.disabledAt !== null) {
        throw new ApiTestError('admin.lifecycle.subscription.before disabledAt should be null');
      }
      checks += 1;

      const suspendReason = `risk-review-${Date.now()}`;
      const suspendResponse = await ctx.request({
        method: 'POST',
        path: `/admin/tenants/${tenantId}/lifecycle/suspend`,
        token: superAdminLogin.token,
        json: {
          reason: suspendReason,
        },
      });
      assertStatus(suspendResponse, 201, 'admin.lifecycle.suspend');
      const suspendPayload = suspendAdminTenantResponseSchema.parse(suspendResponse.body);
      if (suspendPayload.subscription.status !== 'DISABLED') {
        throw new ApiTestError('admin.lifecycle.suspend status should be DISABLED');
      }
      if (suspendPayload.subscription.disabledAt === null) {
        throw new ApiTestError('admin.lifecycle.suspend disabledAt should not be null');
      }
      if (suspendPayload.subscription.disabledReason !== suspendReason) {
        throw new ApiTestError('admin.lifecycle.suspend disabledReason mismatch');
      }
      checks += 1;

      const reactivateResponse = await ctx.request({
        method: 'POST',
        path: `/admin/tenants/${tenantId}/lifecycle/reactivate`,
        token: superAdminLogin.token,
      });
      assertStatus(reactivateResponse, 201, 'admin.lifecycle.reactivate');
      const reactivatePayload = reactivateAdminTenantResponseSchema.parse(reactivateResponse.body);
      if (reactivatePayload.subscription.disabledAt !== null) {
        throw new ApiTestError('admin.lifecycle.reactivate disabledAt should be null');
      }
      if (reactivatePayload.subscription.disabledReason !== null) {
        throw new ApiTestError('admin.lifecycle.reactivate disabledReason should be null');
      }
      if (reactivatePayload.subscription.status !== 'ACTIVE') {
        throw new ApiTestError('admin.lifecycle.reactivate status should be ACTIVE');
      }
      checks += 1;

      const offboardReason = `offboard-review-${Date.now()}`;

      const memberEmail = defaultEmail('api-admin-remove-member');
      const upsertMemberResponse = await ctx.request({
        method: 'POST',
        path: `/admin/tenants/${tenantId}/members`,
        token: superAdminLogin.token,
        json: {
          email: memberEmail,
          role: 'EDITOR',
        },
      });
      assertStatus(upsertMemberResponse, 201, 'admin.upsert-member');
      const upsertMemberPayload = upsertTenantMemberResponseSchema.parse(upsertMemberResponse.body);
      checks += 1;

      // P0 regression: role changes must take effect immediately for existing tokens.
      // 1) Editor can write.
      const memberSession = await ensureTenantSession(ctx, {
        email: memberEmail,
        tenantId,
      });

      const editorWriteResponse = await ctx.request({
        method: 'POST',
        path: '/products',
        token: memberSession.token,
        json: {
          code: uniqueSuffix('rbac-live-write').toUpperCase().slice(0, 64),
          name: `RBAC Live Write ${Date.now()}`,
          description: 'rbac live check',
        },
      });
      assertStatus(editorWriteResponse, 201, 'rbac.live.editor.write');
      checks += 1;

      // 2) Downgrade to VIEWER and ensure the *same* token is immediately blocked for writes.
      const downgradeResponse = await ctx.request({
        method: 'POST',
        path: `/admin/tenants/${tenantId}/members`,
        token: superAdminLogin.token,
        json: {
          email: memberEmail,
          role: 'VIEWER',
        },
      });
      assertStatus(downgradeResponse, 201, 'admin.upsert-member.downgrade-viewer');
      const downgradedPayload = upsertTenantMemberResponseSchema.parse(downgradeResponse.body);
      if (downgradedPayload.role !== 'VIEWER') {
        throw new ApiTestError('admin.upsert-member.downgrade-viewer role should be VIEWER');
      }
      checks += 1;

      const viewerWriteResponse = await ctx.request({
        method: 'POST',
        path: '/products',
        token: memberSession.token,
        json: {
          code: uniqueSuffix('rbac-live-deny').toUpperCase().slice(0, 64),
          name: `RBAC Live Deny ${Date.now()}`,
          description: 'rbac live deny check',
        },
      });
      assertStatus(viewerWriteResponse, 403, 'rbac.live.viewer.write');
      assertErrorCode(viewerWriteResponse, 'FORBIDDEN');
      checks += 1;

      const viewerReadResponse = await ctx.request({
        method: 'GET',
        path: '/products',
        token: memberSession.token,
      });
      assertStatus(viewerReadResponse, 200, 'rbac.live.viewer.read');
      checks += 1;

      // 3) Remove membership and ensure the same token cannot access the tenant anymore.
      const deleteMemberResponse = await ctx.request({
        method: 'DELETE',
        path: `/admin/tenants/${tenantId}/members/${upsertMemberPayload.user.id}`,
        token: superAdminLogin.token,
      });
      assertStatus(deleteMemberResponse, 200, 'admin.delete-member');
      const deleteMemberPayload = deleteTenantMemberResponseSchema.parse(deleteMemberResponse.body);
      if (deleteMemberPayload.tenantId !== tenantId) {
        throw new ApiTestError('admin.delete-member response tenantId mismatch');
      }
      if (deleteMemberPayload.userId !== upsertMemberPayload.user.id) {
        throw new ApiTestError('admin.delete-member response userId mismatch');
      }
      if (!deleteMemberPayload.removed) {
        throw new ApiTestError('admin.delete-member response removed should be true');
      }
      if (deleteMemberPayload.previousRole !== downgradedPayload.role) {
        throw new ApiTestError('admin.delete-member response previousRole mismatch');
      }
      checks += 1;

      const revokedReadResponse = await ctx.request({
        method: 'GET',
        path: '/products',
        token: memberSession.token,
      });
      assertStatus(revokedReadResponse, [401, 403, 404], 'rbac.live.revoked.read');
      checks += 1;

      const revokedWriteResponse = await ctx.request({
        method: 'POST',
        path: '/products',
        token: memberSession.token,
        json: {
          code: uniqueSuffix('rbac-live-revoked').toUpperCase().slice(0, 64),
          name: `RBAC Live Revoked ${Date.now()}`,
          description: 'rbac live revoked check',
        },
      });
      assertStatus(revokedWriteResponse, [401, 403, 404], 'rbac.live.revoked.write');
      checks += 1;

      const deleteMissingMemberResponse = await ctx.request({
        method: 'DELETE',
        path: `/admin/tenants/${tenantId}/members/${upsertMemberPayload.user.id}`,
        token: superAdminLogin.token,
      });
      assertStatus(deleteMissingMemberResponse, 404, 'admin.delete-member.missing');
      assertErrorCode(deleteMissingMemberResponse, 'TENANT_MEMBER_NOT_FOUND');
      checks += 1;

      const listMembersResponse = await ctx.request({
        method: 'GET',
        path: `/admin/tenants/${tenantId}/members`,
        token: superAdminLogin.token,
      });
      assertStatus(listMembersResponse, 200, 'admin.list-members.after-delete');
      const membersPayload = listAdminTenantMembersResponseSchema.parse(listMembersResponse.body);
      if (membersPayload.members.some((member) => member.user.id === upsertMemberPayload.user.id)) {
        throw new ApiTestError('admin.list-members.after-delete still contains removed member');
      }
      checks += 1;

      const exportFrom = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const exportTo = new Date(Date.now() + 60 * 1000).toISOString();
      const exportCsvResponse = await ctx.request({
        method: 'GET',
        path: '/admin/audit-logs/export',
        token: superAdminLogin.token,
        query: {
          from: exportFrom,
          to: exportTo,
          actorUserId: superAdminUserId,
          limit: AUDIT_EXPORT_TEST_LIMIT,
        },
      });
      assertStatus(exportCsvResponse, 200, 'admin.audit-export.csv.ok');

      const exportContentType = exportCsvResponse.headers.get('content-type') ?? '';
      if (!exportContentType.includes('text/csv')) {
        throw new ApiTestError(
          `admin.audit-export.csv.ok expected content-type to include text/csv, got ${exportContentType}`,
        );
      }

      const csvLines = splitCsvLines(exportCsvResponse.text);
      if (csvLines.length === 0) {
        throw new ApiTestError('admin.audit-export.csv.ok expected non-empty csv payload');
      }

      const headerRow = stripUtf8Bom(csvLines[0]).toLowerCase();
      if (!headerRow.includes('"action"') || !headerRow.includes('"createdat"')) {
        throw new ApiTestError('admin.audit-export.csv.ok header should include action and createdAt columns');
      }

      if (csvLines.length > AUDIT_EXPORT_TEST_LIMIT + 1) {
        throw new ApiTestError(
          `admin.audit-export.csv.ok expected at most ${AUDIT_EXPORT_TEST_LIMIT + 1} lines, got ${csvLines.length}`,
        );
      }
      checks += 1;

      const exportOverLimitResponse = await ctx.request({
        method: 'GET',
        path: '/admin/audit-logs/export',
        token: superAdminLogin.token,
        query: {
          from: exportFrom,
          to: exportTo,
          actorUserId: superAdminUserId,
          limit: 1,
        },
      });
      assertStatus(exportOverLimitResponse, 400, 'admin.audit-export.csv.limit');
      const overLimitPayload = asObject(exportOverLimitResponse.body, 'admin.audit-export.csv.limit response');
      const overLimitMessage = readString(overLimitPayload, 'message', 'admin.audit-export.csv.limit.message');
      if (!overLimitMessage.toLowerCase().includes('narrow')) {
        throw new ApiTestError(
          `admin.audit-export.csv.limit message should guide filter narrowing, got ${overLimitMessage}`,
        );
      }
      checks += 1;

      const offboardResponse = await ctx.request({
        method: 'POST',
        path: `/admin/tenants/${tenantId}/lifecycle/offboard`,
        token: superAdminLogin.token,
        json: {
          reason: offboardReason,
          confirmTenantSlug: tenantSlug,
        },
      });
      assertStatus(offboardResponse, 201, 'admin.lifecycle.offboard');
      // The offboard endpoint returns the same payload shape as suspend/reactivate today.
      const offboardPayload = suspendAdminTenantResponseSchema.parse(offboardResponse.body);
      if (offboardPayload.subscription.status !== 'DISABLED') {
        throw new ApiTestError('admin.lifecycle.offboard status should be DISABLED');
      }
      if (offboardPayload.subscription.disabledAt === null) {
        throw new ApiTestError('admin.lifecycle.offboard disabledAt should not be null');
      }
      if (!offboardPayload.subscription.disabledReason?.includes(offboardReason)) {
        throw new ApiTestError('admin.lifecycle.offboard disabledReason mismatch');
      }
      checks += 1;

      const afterLifecycleResponse = await ctx.request({
        method: 'GET',
        path: `/admin/tenants/${tenantId}/subscription`,
        token: superAdminLogin.token,
      });
      assertStatus(afterLifecycleResponse, 200, 'admin.lifecycle.subscription.after');
      const afterLifecyclePayload = getAdminTenantSubscriptionResponseSchema.parse(afterLifecycleResponse.body);
      if (afterLifecyclePayload.subscription.disabledAt === null) {
        throw new ApiTestError('admin.lifecycle.subscription.after disabledAt should not be null after offboard');
      }
      if (!afterLifecyclePayload.subscription.disabledReason?.includes(offboardReason)) {
        throw new ApiTestError('admin.lifecycle.subscription.after disabledReason should include offboard reason');
      }
      checks += 1;

      removedMemberUserId = upsertMemberPayload.user.id;
      removedTenantId = tenantId;
    } else {
      ctx.log.warn('admin.super-admin.warn', {
        status: superAdminResponse.status,
        hint: 'Mark the target user as isSuperAdmin=true for positive checks.',
      });
    }
  }

  ctx.log.ok('admin.done', {
    checks,
    tenantUserEmail,
    superAdminStatus: superAdminStatus ?? 'skipped',
    removedTenantId: removedTenantId ?? 'skipped',
    removedMemberUserId: removedMemberUserId ?? 'skipped',
  });

  return {
    checks,
    details: {
      tenantUserEmail,
      superAdminStatus,
      removedTenantId,
      removedMemberUserId,
    },
  };
}

function splitCsvLines(payload: string): string[] {
  return payload
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function stripUtf8Bom(input: string): string {
  return input.startsWith('\uFEFF') ? input.slice(1) : input;
}
