# @eggturtle/admin

Next.js backoffice for super-admin operations.

## Local setup

1. Copy env file and fill allowlist:
   ```bash
   cp apps/admin/.env.example apps/admin/.env.local
   ```
2. Set these values in `apps/admin/.env.local`:
   - `ADMIN_API_BASE_URL`: API service URL (default local: `http://localhost:30011`)
   - `ADMIN_SUPER_EMAIL_ALLOWLIST`: comma-separated super-admin emails allowed to enter `/dashboard/*`

## Auth flow

- `/login` requests email code from API (`/auth/request-code`) through admin route handlers.
- Verification (`/auth/verify-code`) sets an HttpOnly session cookie (`eggturtle.admin.access_token`).
- `/dashboard/*` is protected server-side by `DashboardAccessGuard`, which validates the cookie token via API `/me` and checks `ADMIN_SUPER_EMAIL_ALLOWLIST`.
- If session is invalid or not allowlisted, user is redirected to `/login`.

## Manual verification (T29 smoke)

1. Start API and admin app.
2. Visit `http://localhost:30020/dashboard` while signed out.
   - Expected: redirect to `/login`.
3. Request code on `/login` with an allowlisted email.
   - In development with `AUTH_DEV_CODE_ENABLED=true`, dev code is shown.
4. Verify code.
   - Expected: redirected to `/dashboard` and admin pages load.
5. Open DevTools and check cookies.
   - Expected: `eggturtle.admin.access_token` exists and is `HttpOnly`.
6. Click `Sign out` from dashboard top bar.
   - Expected: redirect to `/login`; revisiting `/dashboard` redirects back to `/login`.
7. Repeat login with a non-allowlisted email.
   - Expected: verify step returns `403` and dashboard remains inaccessible.
