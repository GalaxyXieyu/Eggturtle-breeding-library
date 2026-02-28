'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  redeemTenantSubscriptionActivationCodeRequestSchema,
  redeemTenantSubscriptionActivationCodeResponseSchema,
  type RedeemTenantSubscriptionActivationCodeResponse
} from '@eggturtle/shared';
import {
  passwordLoginRequestSchema,
  passwordLoginResponseSchema,
  requestCodeRequestSchema,
  requestCodeResponseSchema,
  verifyCodeRequestSchema,
  verifyCodeResponseSchema
} from '@eggturtle/shared/auth';

import { ApiError, apiRequest, getAccessToken, setAccessToken } from '../../lib/api-client';

type Locale = 'zh' | 'en';
type LoginMode = 'password' | 'code';
type EntryView = 'signin' | 'activation' | 'register';

type LoginCopy = {
  title: string;
  subtitle: string;
  heroEyebrow: string;
  formTitle: string;
  activationCardTitle: string;
  registerCardTitle: string;
  showcaseItemAuth: string;
  showcaseItemTenant: string;
  showcaseItemWorkflow: string;
  localeLabel: string;
  modeLabel: string;
  localeZh: string;
  localeEn: string;
  modePassword: string;
  modeCode: string;
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  passwordLogin: string;
  requestCode: string;
  sending: string;
  codeSentTo: string;
  devCode: string;
  verificationCode: string;
  codePlaceholder: string;
  verifyCode: string;
  verifying: string;
  changeEmail: string;
  setPasswordLabel: string;
  setPasswordPlaceholder: string;
  setPasswordHint: string;
  activationCta: string;
  registerCta: string;
  activationTitle: string;
  activationHint: string;
  activationCodeLabel: string;
  activationCodePlaceholder: string;
  activationSubmit: string;
  activationSubmitting: string;
  activationNeedLogin: string;
  activationSuccess: string;
  activationPlanLabel: string;
  activationExpiresLabel: string;
  activationRedeemLabel: string;
  activationDoneAtLabel: string;
  backToLogin: string;
  registerTitle: string;
  registerHint: string;
  registerEmailLabel: string;
  registerPasswordLabel: string;
  registerConfirmPasswordLabel: string;
  registerSubmit: string;
  registerNotReady: string;
  registerPasswordMismatch: string;
  registerWeakPassword: string;
};

const COPY: Record<Locale, LoginCopy> = {
  zh: {
    title: '蛋龟选育库',
    subtitle: '用数据驱动选育优化，提升繁育决策效率。',
    heroEyebrow: 'Tenant Portal',
    formTitle: '登录租户端',
    activationCardTitle: '用激活码激活',
    registerCardTitle: '注册账户',
    showcaseItemAuth: '统一登录与会话管理',
    showcaseItemTenant: '多租户隔离与成员权限控制',
    showcaseItemWorkflow: '验证码 + 密码双模式',
    localeLabel: '语言',
    modeLabel: '登录模式',
    localeZh: '中文',
    localeEn: '英文',
    modePassword: '账号密码',
    modeCode: '邮箱验证',
    emailLabel: '邮箱',
    emailPlaceholder: 'you@eggturtle.local',
    passwordLabel: '密码',
    passwordPlaceholder: '请输入登录密码',
    passwordLogin: '账号密码登录',
    requestCode: '获取验证码',
    sending: '发送中...',
    codeSentTo: '验证码已发送至',
    devCode: '开发验证码',
    verificationCode: '验证码',
    codePlaceholder: '6 位数字',
    verifyCode: '验证并登录',
    verifying: '验证中...',
    changeEmail: '更换邮箱',
    setPasswordLabel: '设置登录密码（可选）',
    setPasswordPlaceholder: '至少 8 位，后续可直接密码登录',
    setPasswordHint: '填写后将同步设置该账号的登录密码。',
    activationCta: '用激活码激活',
    registerCta: '注册账户',
    activationTitle: '激活租户订阅',
    activationHint: '请输入激活码以开通或续期订阅。当前接口要求你已登录并选择租户（OWNER）。',
    activationCodeLabel: '激活码',
    activationCodePlaceholder: '请输入 8-80 位激活码',
    activationSubmit: '立即激活',
    activationSubmitting: '激活中...',
    activationNeedLogin: '请先登录并选择租户后再激活。',
    activationSuccess: '激活成功，订阅状态已更新。',
    activationPlanLabel: '当前套餐',
    activationExpiresLabel: '到期时间',
    activationRedeemLabel: '兑换次数',
    activationDoneAtLabel: '激活时间',
    backToLogin: '返回登录',
    registerTitle: '创建租户端账户',
    registerHint: '完成基础信息填写后即可提交注册申请。',
    registerEmailLabel: '注册邮箱',
    registerPasswordLabel: '设置密码',
    registerConfirmPasswordLabel: '确认密码',
    registerSubmit: '提交注册',
    registerNotReady: '注册接口尚未接入（TODO: 对接 /auth/register），当前仅提供表单预览。',
    registerPasswordMismatch: '两次输入的密码不一致，请检查。',
    registerWeakPassword: '密码至少 8 位。'
  },
  en: {
    title: 'Eggturtle Breeding Library',
    subtitle: 'Data-driven breeding optimization for faster and more reliable decisions.',
    heroEyebrow: 'Tenant Portal',
    formTitle: 'Sign in to Workspace',
    activationCardTitle: 'Activate by Code',
    registerCardTitle: 'Register Account',
    showcaseItemAuth: 'Unified login and session handling',
    showcaseItemTenant: 'Tenant isolation with role-based control',
    showcaseItemWorkflow: 'Password + one-time code modes',
    localeLabel: 'Language',
    modeLabel: 'Login mode',
    localeZh: 'Chinese',
    localeEn: 'English',
    modePassword: 'Password',
    modeCode: 'Email Verify',
    emailLabel: 'Email',
    emailPlaceholder: 'you@eggturtle.local',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Enter your password',
    passwordLogin: 'Sign in with password',
    requestCode: 'Request code',
    sending: 'Sending...',
    codeSentTo: 'Code sent to',
    devCode: 'Dev code',
    verificationCode: 'Verification code',
    codePlaceholder: '6-digit code',
    verifyCode: 'Verify and sign in',
    verifying: 'Verifying...',
    changeEmail: 'Change email',
    setPasswordLabel: 'Set password (optional)',
    setPasswordPlaceholder: 'At least 8 chars for future password login',
    setPasswordHint: 'If provided, this will set your account password.',
    activationCta: 'Activate by code',
    registerCta: 'Register account',
    activationTitle: 'Activate tenant subscription',
    activationHint:
      'Enter an activation code to enable or extend subscription. This endpoint requires a logged-in OWNER with a selected tenant.',
    activationCodeLabel: 'Activation code',
    activationCodePlaceholder: 'Enter 8-80 characters',
    activationSubmit: 'Activate now',
    activationSubmitting: 'Activating...',
    activationNeedLogin: 'Please sign in and select a tenant before activation.',
    activationSuccess: 'Activation succeeded and subscription is updated.',
    activationPlanLabel: 'Plan',
    activationExpiresLabel: 'Expires at',
    activationRedeemLabel: 'Redeem usage',
    activationDoneAtLabel: 'Activated at',
    backToLogin: 'Back to sign in',
    registerTitle: 'Create tenant account',
    registerHint: 'Fill the base information and submit your registration request.',
    registerEmailLabel: 'Email',
    registerPasswordLabel: 'Password',
    registerConfirmPasswordLabel: 'Confirm password',
    registerSubmit: 'Submit registration',
    registerNotReady: 'Registration API is not integrated yet (TODO: wire /auth/register). Form preview only.',
    registerPasswordMismatch: 'Passwords do not match.',
    registerWeakPassword: 'Password must be at least 8 characters.'
  }
};

export default function LoginPage() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>('zh');
  const [entryView, setEntryView] = useState<EntryView>('signin');
  const [mode, setMode] = useState<LoginMode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [requestedEmail, setRequestedEmail] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [registrationPassword, setRegistrationPassword] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [activationCode, setActivationCode] = useState('');
  const [activationResult, setActivationResult] = useState<RedeemTenantSubscriptionActivationCodeResponse | null>(
    null
  );
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [registerNotice, setRegisterNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activationLoading, setActivationLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');

    if (view === 'activate') {
      setEntryView('activation');
      return;
    }

    if (view === 'register') {
      setEntryView('register');
      return;
    }

    if (getAccessToken()) {
      router.replace('/app');
    }
  }, [router]);

  const copy = COPY[locale];

  function resetCodeFlow() {
    setRequestedEmail(null);
    setCode('');
    setDevCode(null);
    setRegistrationPassword('');
  }

  function switchEntryView(nextView: EntryView) {
    if (entryView === nextView) {
      return;
    }

    setEntryView(nextView);
    setError(null);
    setRegisterNotice(null);

    if (nextView === 'signin') {
      setActivationResult(null);
      return;
    }

    if (nextView === 'activation') {
      setActivationCode('');
      return;
    }

    setRegisterEmail('');
    setRegisterPassword('');
    setRegisterConfirmPassword('');
  }

  function switchMode(nextMode: LoginMode) {
    if (mode === nextMode) {
      return;
    }

    setMode(nextMode);
    setError(null);
    resetCodeFlow();
  }

  async function handlePasswordLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = passwordLoginRequestSchema.parse({
        email,
        password
      });

      const response = await apiRequest('/auth/password-login', {
        method: 'POST',
        auth: false,
        body: payload,
        requestSchema: passwordLoginRequestSchema,
        responseSchema: passwordLoginResponseSchema
      });

      setAccessToken(response.accessToken);
      router.replace('/app');
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = requestCodeRequestSchema.parse({ email });
      const response = await apiRequest('/auth/request-code', {
        method: 'POST',
        auth: false,
        body: payload,
        requestSchema: requestCodeRequestSchema,
        responseSchema: requestCodeResponseSchema
      });

      setRequestedEmail(payload.email);
      setDevCode(response.devCode ?? null);
      setCode('');
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requestedEmail) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = verifyCodeRequestSchema.parse({
        email: requestedEmail,
        code,
        password: registrationPassword ? registrationPassword : undefined
      });

      const response = await apiRequest('/auth/verify-code', {
        method: 'POST',
        auth: false,
        body: payload,
        requestSchema: verifyCodeRequestSchema,
        responseSchema: verifyCodeResponseSchema
      });

      setAccessToken(response.accessToken);
      router.replace('/app');
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setLoading(false);
    }
  }

  async function handleActivationRedeem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!getAccessToken()) {
      setError(copy.activationNeedLogin);
      return;
    }

    setActivationLoading(true);
    setError(null);
    setActivationResult(null);

    try {
      const payload = redeemTenantSubscriptionActivationCodeRequestSchema.parse({
        code: activationCode
      });

      const response = await apiRequest('/subscriptions/activation-codes/redeem', {
        method: 'POST',
        body: payload,
        requestSchema: redeemTenantSubscriptionActivationCodeRequestSchema,
        responseSchema: redeemTenantSubscriptionActivationCodeResponseSchema
      });

      setActivationResult(response);
      setActivationCode('');
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setActivationLoading(false);
    }
  }

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRegisterLoading(true);
    setError(null);
    setRegisterNotice(null);

    try {
      if (registerPassword.length < 8) {
        setError(copy.registerWeakPassword);
        return;
      }

      if (registerPassword !== registerConfirmPassword) {
        setError(copy.registerPasswordMismatch);
        return;
      }

      setRegisterNotice(copy.registerNotReady);
    } finally {
      setRegisterLoading(false);
    }
  }

  return (
    <main className="auth-shell auth-shell-login">
      <section className="login-toolbar">
        <div className="locale-toggle" role="group" aria-label={copy.localeLabel}>
          <button
            type="button"
            className={locale === 'zh' ? 'locale-btn active' : 'locale-btn'}
            onClick={() => setLocale('zh')}
          >
            {copy.localeZh}
          </button>
          <button
            type="button"
            className={locale === 'en' ? 'locale-btn active' : 'locale-btn'}
            onClick={() => setLocale('en')}
          >
            {copy.localeEn}
          </button>
        </div>
      </section>

      <section className="login-layout">
        <section className="login-showcase">
          <div className="login-showcase-glow" aria-hidden />
          <div className="login-brand-copy">
            <p className="login-kicker">{copy.heroEyebrow}</p>
            <h1>{copy.title}</h1>
            <p className="muted">{copy.subtitle}</p>
          </div>
          <div className="login-showcase-chips">
            <span>{copy.showcaseItemAuth}</span>
            <span>{copy.showcaseItemTenant}</span>
            <span>{copy.showcaseItemWorkflow}</span>
          </div>
        </section>

        <section className="login-card">
          <div className="login-card-head">
            <h2>
              {entryView === 'signin'
                ? copy.formTitle
                : entryView === 'activation'
                  ? copy.activationCardTitle
                  : copy.registerCardTitle}
            </h2>
          </div>

          <div className="login-form-stack">
            {entryView === 'signin' ? (
              <>
                <div className="login-mode-toggle" role="tablist" aria-label={copy.modeLabel}>
                  <button
                    type="button"
                    className={mode === 'password' ? 'login-mode-btn active' : 'login-mode-btn'}
                    onClick={() => switchMode('password')}
                  >
                    {copy.modePassword}
                  </button>
                  <button
                    type="button"
                    className={mode === 'code' ? 'login-mode-btn active' : 'login-mode-btn'}
                    onClick={() => switchMode('code')}
                  >
                    {copy.modeCode}
                  </button>
                </div>

                {mode === 'password' ? (
                  <form className="stack login-panel" onSubmit={handlePasswordLogin}>
                    <label htmlFor="password-email">{copy.emailLabel}</label>
                    <input
                      id="password-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      placeholder={copy.emailPlaceholder}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                    <label htmlFor="password">{copy.passwordLabel}</label>
                    <input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      placeholder={copy.passwordPlaceholder}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                    <button type="submit" disabled={loading}>
                      {loading ? copy.verifying : copy.passwordLogin}
                    </button>
                  </form>
                ) : !requestedEmail ? (
                  <form className="stack login-panel" onSubmit={handleRequestCode}>
                    <label htmlFor="email">{copy.emailLabel}</label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      placeholder={copy.emailPlaceholder}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                    <button type="submit" disabled={loading}>
                      {loading ? copy.sending : copy.requestCode}
                    </button>
                  </form>
                ) : (
                  <form className="stack login-panel" onSubmit={handleVerifyCode}>
                    <h2>{copy.verificationCode}</h2>
                    <p>
                      {copy.codeSentTo}: <strong>{requestedEmail}</strong>
                    </p>
                    {devCode ? (
                      <p className="login-dev-code">
                        {copy.devCode}: <code>{devCode}</code>
                      </p>
                    ) : null}
                    <label htmlFor="code">{copy.verificationCode}</label>
                    <input
                      id="code"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={code}
                      placeholder={copy.codePlaceholder}
                      onChange={(event) => setCode(event.target.value)}
                      required
                    />
                    <label htmlFor="registration-password">{copy.setPasswordLabel}</label>
                    <input
                      id="registration-password"
                      type="password"
                      minLength={8}
                      value={registrationPassword}
                      placeholder={copy.setPasswordPlaceholder}
                      onChange={(event) => setRegistrationPassword(event.target.value)}
                    />
                    <p className="muted">{copy.setPasswordHint}</p>
                    <div className="row">
                      <button type="submit" disabled={loading}>
                        {loading ? copy.verifying : copy.verifyCode}
                      </button>
                      <button
                        className="secondary"
                        type="button"
                        disabled={loading}
                        onClick={resetCodeFlow}
                      >
                        {copy.changeEmail}
                      </button>
                    </div>
                  </form>
                )}

                <div className="login-secondary-actions">
                  <button type="button" className="login-text-link" onClick={() => switchEntryView('activation')}>
                    {copy.activationCta}
                  </button>
                  <button type="button" className="login-text-link" onClick={() => switchEntryView('register')}>
                    {copy.registerCta}
                  </button>
                </div>
              </>
            ) : null}

            {entryView === 'activation' ? (
              <form className="stack login-panel" onSubmit={handleActivationRedeem}>
                <h2>{copy.activationTitle}</h2>
                <p>{copy.activationHint}</p>
                <label htmlFor="activation-code">{copy.activationCodeLabel}</label>
                <input
                  id="activation-code"
                  type="text"
                  value={activationCode}
                  minLength={8}
                  maxLength={80}
                  placeholder={copy.activationCodePlaceholder}
                  onChange={(event) => setActivationCode(event.target.value)}
                  required
                />
                <button type="submit" disabled={activationLoading}>
                  {activationLoading ? copy.activationSubmitting : copy.activationSubmit}
                </button>

                {activationResult ? (
                  <div className="login-success" role="status" aria-live="polite">
                    <p>{copy.activationSuccess}</p>
                    <p>
                      {copy.activationPlanLabel}: <strong>{activationResult.subscription.plan}</strong>
                    </p>
                    <p>
                      {copy.activationExpiresLabel}:{' '}
                      <strong>
                        {activationResult.subscription.expiresAt
                          ? new Date(activationResult.subscription.expiresAt).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')
                          : 'N/A'}
                      </strong>
                    </p>
                    <p>
                      {copy.activationRedeemLabel}:{' '}
                      <strong>
                        {activationResult.activationCode.redeemedCount}/{activationResult.activationCode.redeemLimit}
                      </strong>
                    </p>
                    <p>
                      {copy.activationDoneAtLabel}:{' '}
                      <strong>{new Date(activationResult.redeemedAt).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')}</strong>
                    </p>
                  </div>
                ) : null}

                <button type="button" className="login-text-link login-text-link-start" onClick={() => switchEntryView('signin')}>
                  {copy.backToLogin}
                </button>
              </form>
            ) : null}

            {entryView === 'register' ? (
              <form className="stack login-panel" onSubmit={handleRegisterSubmit}>
                <h2>{copy.registerTitle}</h2>
                <p>{copy.registerHint}</p>
                <label htmlFor="register-email">{copy.registerEmailLabel}</label>
                <input
                  id="register-email"
                  type="email"
                  autoComplete="email"
                  value={registerEmail}
                  placeholder={copy.emailPlaceholder}
                  onChange={(event) => setRegisterEmail(event.target.value)}
                  required
                />
                <label htmlFor="register-password">{copy.registerPasswordLabel}</label>
                <input
                  id="register-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={registerPassword}
                  placeholder={copy.setPasswordPlaceholder}
                  onChange={(event) => setRegisterPassword(event.target.value)}
                  required
                />
                <label htmlFor="register-confirm-password">{copy.registerConfirmPasswordLabel}</label>
                <input
                  id="register-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={registerConfirmPassword}
                  placeholder={copy.passwordPlaceholder}
                  onChange={(event) => setRegisterConfirmPassword(event.target.value)}
                  required
                />
                <button type="submit" disabled={registerLoading}>
                  {registerLoading ? copy.verifying : copy.registerSubmit}
                </button>
                {registerNotice ? <p className="login-todo-note">{registerNotice}</p> : null}

                <button type="button" className="login-text-link login-text-link-start" onClick={() => switchEntryView('signin')}>
                  {copy.backToLogin}
                </button>
              </form>
            ) : null}

            {error ? <p className="error login-error">{error}</p> : null}
          </div>
        </section>
      </section>
    </main>
  );
}

function formatError(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '未知错误';
}
