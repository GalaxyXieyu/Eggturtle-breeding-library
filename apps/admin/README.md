# @eggturtle/admin

Next.js backoffice for super-admin operations.

## Local setup

1. Copy env file:
   ```bash
   cp apps/admin/.env.example apps/admin/.env.local
   ```
2. Set these values in `apps/admin/.env.local`:
   - `ADMIN_API_BASE_URL`: API service URL (default local: `http://localhost:30011`)
3. For local development, seed will bootstrap the default admin automatically:
   - seeded account: `admin`
   - seeded password: `Siri@2026`
   - first login is forced to change password
4. Grant additional super-admin users by database flag, not env allowlists:
   ```bash
   pnpm --filter @eggturtle/api super-admin:set -- --login galaxyxieyu --confirm
   ```
5. In production, do not use the public local-dev password. Bootstrap explicitly:
   ```bash
   pnpm --filter @eggturtle/api super-admin:bootstrap -- --account admin --email admin@example.com --password '<temporary-password>' --confirm
   ```

## Auth flow

- `/login` uses password or SMS login for admin accounts.
- Password mode on `/login` supports account name, phone number, and legacy email compatibility.
- Verification (`/auth/verify-code`) sets an HttpOnly session cookie (`eggturtle.admin.access_token`).
- `/dashboard/*` is protected server-side by session validation plus `user.isSuperAdmin`.
- If the bootstrap admin still uses the initial password, the dashboard blocks usage until the password is changed.
- If session is invalid or user is not a super admin, user is redirected to `/login`.

## Manual verification (T29 smoke)

1. Start API and admin app.
2. Visit `http://localhost:30020/dashboard` while signed out.
   - Expected: redirect to `/login`.
3. Sign in with `admin / Siri@2026`.
   - Expected: redirected to `/dashboard` and forced to change password before continuing.
4. Change the password.
   - Expected: password reset dialog disappears and dashboard becomes usable.
5. Grant `galaxyxieyu` as super admin with the CLI script, then sign in again with account or phone.
   - Expected: redirected to `/dashboard` and admin pages load.
6. Open DevTools and check cookies.
   - Expected: `eggturtle.admin.access_token` exists and is `HttpOnly`.
7. Click `Sign out` from dashboard top bar.
   - Expected: redirect to `/login`; revisiting `/dashboard` redirects back to `/login`.
8. Repeat login with a non-super-admin account.
   - Expected: login returns `403` and dashboard remains inaccessible.
