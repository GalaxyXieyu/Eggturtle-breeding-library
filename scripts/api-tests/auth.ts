import {
  ApiTestError,
  ModuleResult,
  TestContext,
  TestModule,
  asObject,
  defaultEmail,
  ensureKeys,
  readObject,
  readString,
  requestCode,
  switchTenant,
  uniqueSuffix,
  verifyCode,
} from './lib';

export const authModule: TestModule = {
  name: 'auth',
  description: 'Auth code flow, token verification, and optional tenant switch',
  requiresWrites: true,
  run,
};

async function run(ctx: TestContext): Promise<ModuleResult> {
  ctx.requireWrites('auth');

  let checks = 0;
  const email = ctx.options.email ?? defaultEmail('api-auth');

  ctx.log.info('auth.start', { email });

  const healthResponse = await ctx.request({ method: 'GET', path: '/health' });
  if (healthResponse.status !== 200) {
    throw new ApiTestError(`health expected 200, got ${healthResponse.status}`);
  }

  const healthBody = asObject(healthResponse.body, 'health response');
  const status = readString(healthBody, 'status', 'health.status');
  if (status !== 'ok') {
    throw new ApiTestError(`health.status expected "ok", got ${status}`);
  }
  checks += 1;

  const requestedCode = await requestCode(ctx, email);
  checks += 1;

  const verified = await verifyCode(ctx, email, requestedCode.devCode);
  checks += 1;

  const passwordForAccountLogin = `Auth@${Date.now()}!`;
  const requestedPasswordCode = await requestCode(ctx, email);
  checks += 1;
  await verifyCode(ctx, email, requestedPasswordCode.devCode, passwordForAccountLogin);
  checks += 1;

  const accountName = email.split('@')[0];
  const passwordLoginResponse = await ctx.request({
    method: 'POST',
    path: '/auth/password-login',
    json: {
      email: accountName,
      password: passwordForAccountLogin
    }
  });
  if (passwordLoginResponse.status !== 201) {
    throw new ApiTestError(`password-login by account name expected 201, got ${passwordLoginResponse.status}`);
  }

  const passwordLoginBody = asObject(passwordLoginResponse.body, 'auth.password-login response');
  ensureKeys(passwordLoginBody, ['accessToken', 'user'], 'auth.password-login');
  const passwordAccessToken = readString(passwordLoginBody, 'accessToken', 'auth.password-login.accessToken');
  const passwordUser = readObject(passwordLoginBody, 'user', 'auth.password-login.user');
  const passwordUserEmail = readString(passwordUser, 'email', 'auth.password-login.user.email');
  if (passwordUserEmail !== email) {
    throw new ApiTestError(`password-login by account name expected email ${email}, got ${passwordUserEmail}`);
  }
  checks += 1;

  const passwordMeResponse = await ctx.request({
    method: 'GET',
    path: '/me',
    token: passwordAccessToken
  });
  if (passwordMeResponse.status !== 200) {
    throw new ApiTestError(`/me after account-name password-login expected 200, got ${passwordMeResponse.status}`);
  }
  checks += 1;

  const meResponse = await ctx.request({
    method: 'GET',
    path: '/me',
    token: verified.accessToken,
  });
  if (meResponse.status !== 200) {
    throw new ApiTestError(`/me expected 200, got ${meResponse.status}`);
  }

  const meBody = asObject(meResponse.body, 'me response');
  const meUser = readObject(meBody, 'user', 'me.user');
  readString(meUser, 'id', 'me.user.id');
  readString(meUser, 'email', 'me.user.email');
  checks += 1;

  let switchedTenantId: string | undefined;
  if (ctx.options.tenantId) {
    const switched = await switchTenant(ctx, verified.accessToken, {
      tenantId: ctx.options.tenantId,
    });
    const switchedTenant = asObject(switched.tenant, 'auth.switch-tenant.tenant');
    switchedTenantId = readString(switchedTenant, 'id', 'auth.switch-tenant.tenant.id');
    checks += 1;

    const currentTenantResponse = await ctx.request({
      method: 'GET',
      path: '/tenants/current',
      token: switched.token,
    });
    if (currentTenantResponse.status !== 200) {
      throw new ApiTestError(
        `/tenants/current expected 200 after switch, got ${currentTenantResponse.status}`,
      );
    }

    const currentTenantBody = asObject(currentTenantResponse.body, 'tenants.current response');
    ensureKeys(currentTenantBody, ['tenant', 'role'], 'tenants.current');
    checks += 1;
  }

  ctx.log.ok('auth.done', {
    checks,
    email,
    devCodeSample: `${requestedCode.devCode.slice(0, 2)}****`,
    switchedTenantId: switchedTenantId ?? 'n/a',
    runId: uniqueSuffix('auth'),
  });

  return {
    checks,
    details: {
      email,
      switchedTenantId: switchedTenantId ?? null,
    },
  };
}
