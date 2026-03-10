# T71 Admin 登录改造说明

## A. 超级管理员白名单修复（已落地）

- 校验函数：`apps/admin/lib/admin-auth.ts` → `isSuperAdminEmailAllowlisted()`
- allowlist 来源（按优先级）：
  1. `ADMIN_SUPER_EMAIL_ALLOWLIST`
  2. `ADMIN_SUPER_ADMIN_EMAILS`（兼容旧变量）
  3. `SUPER_ADMIN_EMAILS`（与 API/Web 共享）
- 本地开发环境已把 `523018705@qq.com` 加入 `apps/admin/.env.local` 的 `ADMIN_SUPER_EMAIL_ALLOWLIST`。
- 说明：生产/预发需要在对应环境变量中加入该邮箱，否则仍会被 `/api/auth/session` 与 `/api/auth/*` 拦截导致循环跳转/闪烁。

## B. Admin 统一手机号验证码登录（设计+最小改造建议）

### 目标
- admin 登录入口与 web 统一：优先手机号 + 短信验证码（尽量不走邮箱）。

### Web 现有接口（可复用）
- 发送短信验证码：`POST /auth/request-sms-code`
  - schema: `requestSmsCodeRequestSchema`（packages/shared）
  - payload: `{ phoneNumber, purpose }`（purpose: login/register）
- 手机号验证码登录：`POST /auth/phone-login`
  - schema: `phoneLoginRequestSchema`（packages/shared）
  - payload: `{ phoneNumber, code }`

> API 侧已有 `x-eggturtle-auth-surface` header 支持区分来源（web 已传 `web`）。admin 可传 `admin`。

### Admin 当前实现现状
- 目前 admin 登录：
  - 账号密码：`/api/auth/password-login` → upstream `/auth/password-login`
  - 邮箱验证码：`/api/auth/request-code` + `/api/auth/verify-code` → upstream `/auth/request-code` + `/auth/verify-code`
- 白名单校验在 admin 的 Next Route Handler 中以 email 为主。

### 最小落地方案（推荐）
1. admin 新增 route：
   - `POST /api/auth/request-sms-code`（转发到 API `/auth/request-sms-code`）
   - `POST /api/auth/phone-login`（转发到 API `/auth/phone-login`，成功后写入 admin cookie）
2. admin 登录页 `apps/admin/app/login/page.tsx`：
   - 新增 tab：`手机号验证码`（默认选中）
   - UI 复用 web 的手机号/验证码输入与 devCode 提示逻辑
3. 访问控制（关键点，需要确认策略）：
   - 现状：allowlist 是 email。
   - 建议：改为 allowlist “identifier”（支持 email / account / phone 前缀匹配），或新增 `ADMIN_SUPER_IDENTIFIER_ALLOWLIST`。
   - 更稳方案：API `/me` 返回 user roles（或 membership role=SUPER_ADMIN）作为后台准入；admin 仅做 UI 引导，真正准入由 API 统一控制。

### 回归清单
- admin 登录页：手机号验证码可以请求验证码、展示 devCode（dev 环境）、输入验证码登录。
- 登录后：`/dashboard` 不闪烁、不循环跳转。
- 白名单：
  - 非 allowlist 账号：明确提示 403 文案。
  - allowlist 账号：可进入 dashboard。
