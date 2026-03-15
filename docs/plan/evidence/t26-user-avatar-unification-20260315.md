# T26 - 用户头像统一为分享头像（2026-03-15）

## 需求结论
- 分享配置页不再让用户手动选分享头像。
- 账号页新增个人头像上传、裁切、预览、删除。
- App 内分享预览 / 海报 / 导航统一优先使用当前登录用户头像。
- 公开分享页统一使用分享创建者头像。
- 旧的 `avatarPreset` 配置继续保留为兼容回退，不删除库字段和协议字段。

## 代码范围
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260315092000_user_avatar_url/migration.sql`
- `apps/api/src/auth/auth-profile.service.ts`
- `apps/api/src/auth/auth-shared.service.ts`
- `apps/api/src/auth/auth.module.ts`
- `apps/api/src/auth/me.controller.ts`
- `apps/api/src/auth/me-avatar.public.controller.ts`
- `apps/api/src/shares/shares-public.service.ts`
- `apps/api/src/tenant-share-presentation/tenant-share-presentation.service.ts`
- `packages/shared/src/auth.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/share.ts`
- `apps/web/app/app/[tenantSlug]/account/account-avatar-crop-dialog.tsx`
- `apps/web/app/app/[tenantSlug]/account/account-profile-overview.tsx`
- `apps/web/app/app/[tenantSlug]/account/page.tsx`
- `apps/web/app/app/[tenantSlug]/layout.tsx`
- `apps/web/app/app/[tenantSlug]/share-presentation/page.tsx`
- `apps/web/app/public/_public-product/presentation.ts`
- `apps/web/app/public/_public-product/public-feed-page.tsx`
- `apps/web/app/public/_public-product/public-product-detail-page.tsx`
- `apps/web/app/public/_shared/public-floating-actions.tsx`
- `apps/web/app/public/_shared/public-share-features-screen.tsx`
- `apps/web/app/public/_shared/public-share-me-page.tsx`
- `apps/web/components/tenant-share-dialog-trigger.tsx`
- `apps/web/lib/locales/account.ts`
- `apps/web/lib/share-avatar.ts`
- `apps/web/lib/share-combo-poster.ts`

## 数据库
- 已新增 `users.avatar_url`。
- 本地已执行迁移：`20260315092000_user_avatar_url`。

## 验证记录
### 编译与静态检查
- `pnpm --filter @eggturtle/shared build` ✅
- `pnpm --filter @eggturtle/api build` ✅
- `pnpm --filter @eggturtle/web lint` ✅
- Web lint 仅剩既有 `no-img-element` warning，与本任务无关。

### API 冒烟
使用账号：`galaxyxieyu / Siri@2026`

1. `POST /auth/password-login` ✅
2. `GET /me/profile` ✅ 返回 `avatarUrl: null`
3. `POST /me/avatar` ✅ 返回头像 URL：`/me/avatar/assets?key=...`
4. `GET /me/avatar/assets?key=...` ✅ 返回 `200 OK` + `image/png`
5. `POST /shares` + 打开 `/s/:shareToken` + `GET /shares/:id/public?...` ✅
   - `presentation.identity.avatarUrl` 返回创建者头像代理地址 `/me/avatar/assets?key=...`
6. `DELETE /me/avatar` ✅ 返回 `avatarUrl: null`

## 额外修正
- 运行时发现本地数据库缺少 `avatar_url` 列，已补跑迁移。
- 运行时发现本地存储头像如果直接使用 `/uploads/...`，前端路径无法稳定命中 API；已统一规范为 `/me/avatar/assets?key=...`，保证 App 内与公开页一致可读。

## 结论
- 该需求已完成，且运行时链路已验证通过。
