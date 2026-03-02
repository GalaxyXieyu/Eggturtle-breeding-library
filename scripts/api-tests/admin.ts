import {
  createAdminTenantResponseSchema,
  deleteTenantMemberResponseSchema,
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
  assertErrorCode,
  assertStatus,
  defaultEmail,
  loginWithDevCode,
  uniqueSuffix,
} from './lib';

export const adminModule: TestModule = {
  name: 'admin',
  description: 'Admin endpoint deny/allow checks for tenant user and super-admin member revoke flow',
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

      const afterLifecycleResponse = await ctx.request({
        method: 'GET',
        path: `/admin/tenants/${tenantId}/subscription`,
        token: superAdminLogin.token,
      });
      assertStatus(afterLifecycleResponse, 200, 'admin.lifecycle.subscription.after');
      const afterLifecyclePayload = getAdminTenantSubscriptionResponseSchema.parse(afterLifecycleResponse.body);
      if (afterLifecyclePayload.subscription.disabledAt !== null) {
        throw new ApiTestError('admin.lifecycle.subscription.after disabledAt should be null');
      }
      if (afterLifecyclePayload.subscription.disabledReason !== null) {
        throw new ApiTestError('admin.lifecycle.subscription.after disabledReason should be null');
      }
      checks += 1;

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
      if (deleteMemberPayload.previousRole !== upsertMemberPayload.role) {
        throw new ApiTestError('admin.delete-member response previousRole mismatch');
      }
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

      removedMemberUserId = upsertMemberPayload.user.id;
      removedTenantId = tenantId;
    } else {
      ctx.log.warn('admin.super-admin.warn', {
        status: superAdminResponse.status,
        hint: 'Enable SUPER_ADMIN_ENABLED and include email in SUPER_ADMIN_EMAILS for positive checks.',
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
