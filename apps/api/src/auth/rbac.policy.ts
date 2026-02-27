import { normalizeTenantRole } from '@eggturtle/shared';
import type { EffectiveTenantRole, TenantRole } from '@eggturtle/shared';
import type { TenantMemberRole } from '@prisma/client';

const roleRank: Record<EffectiveTenantRole, number> = {
  VIEWER: 10,
  EDITOR: 20,
  ADMIN: 30,
  OWNER: 40
};

export function toEffectiveTenantRole(role: TenantMemberRole | TenantRole): EffectiveTenantRole {
  return normalizeTenantRole(role as TenantRole);
}

export function hasMinimumTenantRole(
  currentRole: TenantMemberRole | TenantRole,
  minimumRole: TenantRole
): boolean {
  return roleRank[toEffectiveTenantRole(currentRole)] >= roleRank[toEffectiveTenantRole(minimumRole)];
}
