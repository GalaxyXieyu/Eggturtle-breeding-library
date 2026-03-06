'use client';

import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  passwordLoginRequestSchema,
  passwordLoginResponseSchema,
  phoneLoginRequestSchema,
  phoneLoginResponseSchema,
  registerRequestSchema,
  registerResponseSchema,
  requestSmsCodeRequestSchema,
  requestSmsCodeResponseSchema,
} from '@eggturtle/shared/auth';

import {
  UiPreferenceControls,
  type UiLocale,
  useUiPreferences,
} from '../../components/ui-preferences';
import { apiRequest, getAccessToken, setAccessToken } from '../../lib/api-client';
import { formatApiError } from '../../lib/error-utils';
import { resolvePostAuthRedirect } from '../../lib/post-auth-redirect';

type EntryView = 'login' | 'register';
type LoginMode = 'password' | 'code';
type SmsFlow = 'login' | 'register';

type LoginCopy = {
  title: string;
  subtitle: string;
  loginTitle: string;
  registerTitle: string;
  showcaseItemAuth: string;
  showcaseItemTenant: string;
  showcaseItemWorkflow: string;
  entryLogin: string;
  entryRegister: string;
  modeLabel: string;
  modePassword: string;
  modeCode: string;
  passwordIdentifierLabel: string;
  passwordIdentifierPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  passwordLogin: string;
  passwordHint: string;
  codeLoginTitle: string;
  codeLoginHint: string;
  registerHint: string;
  registerAccountLabel: string;
  registerAccountPlaceholder: string;
  registerPasswordLabel: string;
  registerConfirmPasswordLabel: string;
  registerConfirmPasswordPlaceholder: string;
  phoneLabel: string;
  phonePlaceholder: string;
  verificationCode: string;
  codePlaceholder: string;
  codeSentTo: string;
  devCode: string;
  phoneInvalid: string;
  codeInvalid: string;
  accountInvalid: string;
  confirmPasswordMismatch: string;
  requestCode: string;
  resendCode: string;
  resendIn: string;
  sending: string;
  loggingIn: string;
  registering: string;
  registerSubmit: string;
  switchToRegister: string;
  switchToLogin: string;
  registerSummary: string;
  loginSummary: string;
  successCodeHint: string;
  unknownError: string;
};

const ACCOUNT_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]{2,30}[a-zA-Z0-9]$/;

const COPY: Record<UiLocale, LoginCopy> = {
  zh: {
    title: '蛋龟选育库',
    subtitle: '用数据驱动选育优化，提升繁育决策效率。',
    loginTitle: '登录用户端',
    registerTitle: '注册并开始',
    showcaseItemAuth: '支持账号 / 手机号密码登录',
    showcaseItemTenant: '分享页注册后自动进入你的专属工作台',
    showcaseItemWorkflow: '手机号验证码登录 + 手机号验证注册',
    entryLogin: '登录',
    entryRegister: '注册',
    modeLabel: '登录方式',
    modePassword: '账号密码',
    modeCode: '验证码登录',
    passwordIdentifierLabel: '账号或手机号',
    passwordIdentifierPlaceholder: '请输入账号或 11 位手机号',
    passwordLabel: '密码',
    passwordPlaceholder: '请输入登录密码',
    passwordLogin: '登录',
    passwordHint: '支持用注册账号或已绑定手机号直接登录。',
    codeLoginTitle: '手机号验证码登录',
    codeLoginHint: '适合已完成注册并绑定手机号的用户。',
    registerHint:
      '注册时请先填写账号与密码，再用手机号验证码完成验证。注册成功后会直接进入工作台。',
    registerAccountLabel: '账号',
    registerAccountPlaceholder: '4-32 位字母开头，字母/数字结尾，可含数字、下划线、连字符',
    registerPasswordLabel: '登录密码',
    registerConfirmPasswordLabel: '确认密码',
    registerConfirmPasswordPlaceholder: '再次输入登录密码',
    phoneLabel: '手机号',
    phonePlaceholder: '请输入 11 位手机号',
    verificationCode: '验证码',
    codePlaceholder: '6 位数字',
    codeSentTo: '验证码已发送至',
    devCode: '开发验证码',
    phoneInvalid: '请输入正确的 11 位手机号。',
    codeInvalid: '请输入 6 位验证码。',
    accountInvalid: '账号需 4-32 位、以字母开头、以字母或数字结尾，仅支持字母、数字、下划线、连字符。',
    confirmPasswordMismatch: '两次输入的密码不一致，请重新确认。',
    requestCode: '发送验证码',
    resendCode: '重新发送',
    resendIn: '秒后可重发',
    sending: '发送中…',
    loggingIn: '登录中…',
    registering: '注册中…',
    registerSubmit: '注册并进入工作台',
    switchToRegister: '没有账号？去注册',
    switchToLogin: '已有账号？去登录',
    registerSummary: '注册完成后，可用“账号 + 密码”或“手机号 + 密码/验证码”登录。',
    loginSummary: '从分享页进入也会保留回跳路径，登录后自动进入你的工作台。',
    successCodeHint: '验证码已发送，你可以直接输入验证码继续。',
    unknownError: '请求失败，请稍后重试。',
  },
  en: {
    title: 'Eggturtle Breeding Library',
    subtitle: 'Data-driven breeding optimization for faster and more reliable decisions.',
    loginTitle: 'Sign in to Workspace',
    registerTitle: 'Create your workspace',
    showcaseItemAuth: 'Password login with account or phone',
    showcaseItemTenant: 'Share-page sign-up enters your workspace automatically',
    showcaseItemWorkflow: 'Phone code login + phone-verified sign-up',
    entryLogin: 'Sign in',
    entryRegister: 'Register',
    modeLabel: 'Login method',
    modePassword: 'Password',
    modeCode: 'SMS code',
    passwordIdentifierLabel: 'Account or phone',
    passwordIdentifierPlaceholder: 'Enter your account or 11-digit phone',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Enter your password',
    passwordLogin: 'Sign in',
    passwordHint: 'Use your account or bound phone number to sign in.',
    codeLoginTitle: 'Phone code sign-in',
    codeLoginHint: 'Best for existing accounts with a bound phone number.',
    registerHint:
      'Create your account first, then verify the phone number with an SMS code. You will enter the workspace right after registration.',
    registerAccountLabel: 'Account',
    registerAccountPlaceholder: '4-32 chars, starts with a letter, supports numbers, _ and -',
    registerPasswordLabel: 'Password',
    registerConfirmPasswordLabel: 'Confirm password',
    registerConfirmPasswordPlaceholder: 'Enter the password again',
    phoneLabel: 'Phone number',
    phonePlaceholder: 'Enter 11-digit phone number',
    verificationCode: 'Verification code',
    codePlaceholder: '6-digit code',
    codeSentTo: 'Code sent to',
    devCode: 'Dev code',
    phoneInvalid: 'Please enter a valid 11-digit phone number.',
    codeInvalid: 'Please enter a valid 6-digit code.',
    accountInvalid:
      'Account must start with a letter and use 4-32 letters, numbers, underscores, or hyphens.',
    confirmPasswordMismatch: 'Passwords do not match.',
    requestCode: 'Send code',
    resendCode: 'Resend',
    resendIn: 's to resend',
    sending: 'Sending…',
    loggingIn: 'Signing in…',
    registering: 'Creating account…',
    registerSubmit: 'Register and enter workspace',
    switchToRegister: 'Need an account? Register',
    switchToLogin: 'Already have an account? Sign in',
    registerSummary:
      'After sign-up, you can sign in with account + password or phone + password/code.',
    loginSummary:
      'Share-page sign-in keeps the return path and sends you back into the workspace automatically.',
    successCodeHint: 'Code sent. Enter it to continue.',
    unknownError: 'Request failed. Please try again.',
  },
};

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageSkeleton />}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageSkeleton() {
  return (
    <main className="auth-shell auth-shell-login">
      <section className="login-layout">
        <section className="login-showcase">
          <div className="login-showcase-glow" aria-hidden />
          <div className="login-brand-copy">
            <h1>蛋龟选育库</h1>
            <p className="muted">正在准备登录体验…</p>
          </div>
        </section>

        <section className="login-card">
          <div className="login-card-head">
            <div className="login-card-top">
              <h2>正在加载…</h2>
            </div>
          </div>
          <div className="login-form-stack">
            <div className="login-entry-switch" aria-hidden>
              <button type="button" className="login-entry-btn active" disabled>
                登录
              </button>
              <button type="button" className="login-entry-btn" disabled>
                注册
              </button>
            </div>
            <div className="login-panel">
              <p className="muted">正在同步登录与注册入口，请稍候…</p>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useUiPreferences();
  const copy = COPY[locale];
  const entryView: EntryView = searchParams.get('view') === 'register' ? 'register' : 'login';

  const [loginMode, setLoginMode] = useState<LoginMode>('password');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginPhoneNumber, setLoginPhoneNumber] = useState('');
  const [loginPhoneCode, setLoginPhoneCode] = useState('');
  const [loginPhoneDevCode, setLoginPhoneDevCode] = useState<string | null>(null);
  const [loginSmsCooldown, setLoginSmsCooldown] = useState(0);

  const [registerAccount, setRegisterAccount] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [registerPhoneNumber, setRegisterPhoneNumber] = useState('');
  const [registerCode, setRegisterCode] = useState('');
  const [registerDevCode, setRegisterDevCode] = useState<string | null>(null);
  const [registerSmsCooldown, setRegisterSmsCooldown] = useState(0);

  const [hydrated, setHydrated] = useState(false);
  const [sendingLoginCode, setSendingLoginCode] = useState(false);
  const [sendingRegisterCode, setSendingRegisterCode] = useState(false);
  const [submittingPasswordLogin, setSubmittingPasswordLogin] = useState(false);
  const [submittingCodeLogin, setSubmittingCodeLogin] = useState(false);
  const [submittingRegister, setSubmittingRegister] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isBusy =
    sendingLoginCode ||
    sendingRegisterCode ||
    submittingPasswordLogin ||
    submittingCodeLogin ||
    submittingRegister;

  useEffect(() => {
    setHydrated(true);

    if (typeof window === 'undefined') {
      return;
    }

    if (getAccessToken()) {
      router.replace(resolvePostAuthRedirect('/app', window.location.search));
    }
  }, [router]);

  useEffect(() => {
    if (loginSmsCooldown <= 0 && registerSmsCooldown <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setLoginSmsCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      setRegisterSmsCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [loginSmsCooldown, registerSmsCooldown]);

  const loginCodeButtonLabel = useMemo(() => {
    if (sendingLoginCode) {
      return copy.sending;
    }

    if (loginSmsCooldown > 0) {
      return `${loginSmsCooldown}${copy.resendIn}`;
    }

    return loginPhoneDevCode ? copy.resendCode : copy.requestCode;
  }, [
    copy.requestCode,
    copy.resendCode,
    copy.resendIn,
    copy.sending,
    loginPhoneDevCode,
    loginSmsCooldown,
    sendingLoginCode,
  ]);

  const registerCodeButtonLabel = useMemo(() => {
    if (sendingRegisterCode) {
      return copy.sending;
    }

    if (registerSmsCooldown > 0) {
      return `${registerSmsCooldown}${copy.resendIn}`;
    }

    return registerDevCode ? copy.resendCode : copy.requestCode;
  }, [
    copy.requestCode,
    copy.resendCode,
    copy.resendIn,
    copy.sending,
    registerDevCode,
    registerSmsCooldown,
    sendingRegisterCode,
  ]);

  function getCurrentSearch() {
    if (typeof window === 'undefined') {
      return '';
    }

    return window.location.search;
  }

  function getPostAuthRedirect(
    defaultPath: string,
    options?: {
      allowedTenantSlug?: string;
      allowGenericAppEntryNext?: boolean;
      shareSourceNext?: string;
    },
  ) {
    return resolvePostAuthRedirect(
      defaultPath,
      getCurrentSearch(),
      options?.shareSourceNext,
      options,
    );
  }

  function normalizePhone(value: string) {
    return value.replace(/\D/g, '').slice(0, 11);
  }

  function normalizeAccount(value: string) {
    return value
      .replace(/\s+/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 32);
  }

  function switchEntryView(nextView: EntryView) {
    if (nextView === entryView) {
      return;
    }

    setError(null);
    setSuccess(null);

    const nextSearchParams = new URLSearchParams(searchParams.toString());
    if (nextView === 'register') {
      nextSearchParams.set('view', 'register');
    } else {
      nextSearchParams.delete('view');
    }

    const query = nextSearchParams.toString();
    router.replace(query ? `/login?${query}` : '/login');
  }

  function switchLoginMode(nextMode: LoginMode) {
    if (nextMode === loginMode) {
      return;
    }

    setLoginMode(nextMode);
    setError(null);
    setSuccess(null);
  }

  async function requestSmsCode(phoneNumber: string, flow: SmsFlow) {
    if (!/^1\d{10}$/.test(phoneNumber)) {
      setError(copy.phoneInvalid);
      return;
    }

    setError(null);
    setSuccess(null);

    if (flow === 'login') {
      setSendingLoginCode(true);
    } else {
      setSendingRegisterCode(true);
    }

    try {
      const payload = requestSmsCodeRequestSchema.parse({ phoneNumber, purpose: flow });
      const response = await apiRequest('/auth/request-sms-code', {
        method: 'POST',
        auth: false,
        body: payload,
        requestSchema: requestSmsCodeRequestSchema,
        responseSchema: requestSmsCodeResponseSchema,
      });

      if (flow === 'login') {
        setLoginPhoneDevCode(response.devCode ?? null);
        setLoginSmsCooldown(60);
      } else {
        setRegisterDevCode(response.devCode ?? null);
        setRegisterSmsCooldown(60);
      }

      setSuccess(
        locale === 'zh'
          ? `${copy.codeSentTo} ${phoneNumber}，${copy.successCodeHint}`
          : `${copy.codeSentTo} ${phoneNumber}. ${copy.successCodeHint}`,
      );
    } catch (requestError) {
      setError(formatApiError(requestError, copy.unknownError, locale));
    } finally {
      if (flow === 'login') {
        setSendingLoginCode(false);
      } else {
        setSendingRegisterCode(false);
      }
    }
  }

  async function handlePasswordLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittingPasswordLogin(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = passwordLoginRequestSchema.parse({
        email: loginIdentifier,
        password: loginPassword,
      });

      const response = await apiRequest('/auth/password-login', {
        method: 'POST',
        auth: false,
        body: payload,
        requestSchema: passwordLoginRequestSchema,
        responseSchema: passwordLoginResponseSchema,
      });

      setAccessToken(response.accessToken);
      router.replace(getPostAuthRedirect('/app'));
    } catch (requestError) {
      setError(formatApiError(requestError, copy.unknownError, locale));
    } finally {
      setSubmittingPasswordLogin(false);
    }
  }

  async function handleCodeLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!/^1\d{10}$/.test(loginPhoneNumber)) {
      setError(copy.phoneInvalid);
      return;
    }

    if (!/^\d{6}$/.test(loginPhoneCode)) {
      setError(copy.codeInvalid);
      return;
    }

    setSubmittingCodeLogin(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = phoneLoginRequestSchema.parse({
        phoneNumber: loginPhoneNumber,
        code: loginPhoneCode,
      });

      const response = await apiRequest('/auth/phone-login', {
        method: 'POST',
        auth: false,
        body: payload,
        requestSchema: phoneLoginRequestSchema,
        responseSchema: phoneLoginResponseSchema,
      });

      setAccessToken(response.accessToken);
      const nextPath = response.isNewUser
        ? `/app/${response.tenant.slug}/account?setup=1`
        : `/app/${response.tenant.slug}`;
      router.replace(
        getPostAuthRedirect(nextPath, {
          allowedTenantSlug: response.tenant.slug,
          allowGenericAppEntryNext: !response.isNewUser,
        }),
      );
    } catch (requestError) {
      setError(formatApiError(requestError, copy.unknownError, locale));
    } finally {
      setSubmittingCodeLogin(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!ACCOUNT_PATTERN.test(registerAccount)) {
      setError(copy.accountInvalid);
      return;
    }

    if (!/^1\d{10}$/.test(registerPhoneNumber)) {
      setError(copy.phoneInvalid);
      return;
    }

    if (!/^\d{6}$/.test(registerCode)) {
      setError(copy.codeInvalid);
      return;
    }

    if (registerPassword !== registerConfirmPassword) {
      setError(copy.confirmPasswordMismatch);
      return;
    }

    setSubmittingRegister(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = registerRequestSchema.parse({
        account: registerAccount,
        phoneNumber: registerPhoneNumber,
        code: registerCode,
        password: registerPassword,
      });

      const response = await apiRequest('/auth/register', {
        method: 'POST',
        auth: false,
        body: payload,
        requestSchema: registerRequestSchema,
        responseSchema: registerResponseSchema,
      });

      setAccessToken(response.accessToken);
      router.replace(
        getPostAuthRedirect(`/app/${response.tenant.slug}/account?setup=1`, {
          allowedTenantSlug: response.tenant.slug,
          allowGenericAppEntryNext: false,
          shareSourceNext: `/app/${response.tenant.slug}/account?setup=1`,
        }),
      );
    } catch (requestError) {
      setError(formatApiError(requestError, copy.unknownError, locale));
    } finally {
      setSubmittingRegister(false);
    }
  }

  return (
    <main className="auth-shell auth-shell-login">
      <section className="login-layout">
        <section className="login-showcase">
          <div className="login-showcase-glow" aria-hidden />
          <div className="login-brand-copy">
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
            <div className="login-card-top">
              <h2>{entryView === 'register' ? copy.registerTitle : copy.loginTitle}</h2>
              <UiPreferenceControls className="login-preference-controls" />
            </div>
          </div>

          <div className="login-form-stack">
            <div
              className="login-entry-switch"
              aria-label={entryView === 'register' ? copy.registerTitle : copy.loginTitle}
            >
              <button
                type="button"
                className={entryView === 'login' ? 'login-entry-btn active' : 'login-entry-btn'}
                aria-pressed={entryView === 'login'}
                onClick={() => switchEntryView('login')}
              >
                {copy.entryLogin}
              </button>
              <button
                type="button"
                className={entryView === 'register' ? 'login-entry-btn active' : 'login-entry-btn'}
                aria-pressed={entryView === 'register'}
                onClick={() => switchEntryView('register')}
              >
                {copy.entryRegister}
              </button>
            </div>

            {entryView === 'login' ? (
              <>
                <p className="muted">{copy.loginSummary}</p>

                <div className="login-mode-toggle" aria-label={copy.modeLabel}>
                  <button
                    type="button"
                    className={
                      loginMode === 'password' ? 'login-mode-btn active' : 'login-mode-btn'
                    }
                    aria-pressed={loginMode === 'password'}
                    onClick={() => switchLoginMode('password')}
                  >
                    {copy.modePassword}
                  </button>
                  <button
                    type="button"
                    className={loginMode === 'code' ? 'login-mode-btn active' : 'login-mode-btn'}
                    aria-pressed={loginMode === 'code'}
                    onClick={() => switchLoginMode('code')}
                  >
                    {copy.modeCode}
                  </button>
                </div>

                {loginMode === 'password' ? (
                  <form className="login-panel" onSubmit={handlePasswordLogin}>
                    <p className="muted">{copy.passwordHint}</p>

                    <div>
                      <label htmlFor="password-login-identifier">
                        {copy.passwordIdentifierLabel}
                      </label>
                      <input
                        id="password-login-identifier"
                        name="loginIdentifier"
                        type="text"
                        autoComplete="username"
                        value={loginIdentifier}
                        placeholder={copy.passwordIdentifierPlaceholder}
                        onChange={(event) => setLoginIdentifier(event.target.value)}
                        disabled={!hydrated || isBusy}
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="password-login-password">{copy.passwordLabel}</label>
                      <input
                        id="password-login-password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        value={loginPassword}
                        placeholder={copy.passwordPlaceholder}
                        onChange={(event) => setLoginPassword(event.target.value)}
                        disabled={!hydrated || isBusy}
                        required
                      />
                    </div>

                    <button type="submit" disabled={!hydrated || isBusy}>
                      {submittingPasswordLogin ? copy.loggingIn : copy.passwordLogin}
                    </button>
                  </form>
                ) : (
                  <form className="login-panel" onSubmit={handleCodeLogin}>
                    <h2>{copy.codeLoginTitle}</h2>
                    <p>{copy.codeLoginHint}</p>

                    <div>
                      <label htmlFor="login-phone">{copy.phoneLabel}</label>
                      <input
                        id="login-phone"
                        name="phoneNumber"
                        type="tel"
                        autoComplete="tel"
                        inputMode="numeric"
                        maxLength={11}
                        value={loginPhoneNumber}
                        placeholder={copy.phonePlaceholder}
                        onChange={(event) =>
                          setLoginPhoneNumber(normalizePhone(event.target.value))
                        }
                        disabled={!hydrated || isBusy}
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="login-code">{copy.verificationCode}</label>
                      <input
                        id="login-code"
                        name="code"
                        type="text"
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        maxLength={6}
                        value={loginPhoneCode}
                        placeholder={copy.codePlaceholder}
                        onChange={(event) =>
                          setLoginPhoneCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                        }
                        disabled={!hydrated || isBusy}
                        required
                      />
                    </div>

                    {loginPhoneDevCode ? (
                      <p className="login-dev-code">
                        {copy.devCode}
                        <code>{loginPhoneDevCode}</code>
                      </p>
                    ) : null}

                    <div className="row">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => void requestSmsCode(loginPhoneNumber, 'login')}
                        disabled={!hydrated || isBusy || loginSmsCooldown > 0}
                      >
                        {loginCodeButtonLabel}
                      </button>
                      <button type="submit" disabled={!hydrated || isBusy}>
                        {submittingCodeLogin ? copy.loggingIn : copy.modeCode}
                      </button>
                    </div>
                  </form>
                )}

                <div className="login-secondary-actions">
                  <button
                    type="button"
                    className="login-secondary-cta"
                    onClick={() => switchEntryView('register')}
                  >
                    {copy.switchToRegister}
                  </button>
                </div>
              </>
            ) : (
              <form className="login-panel" onSubmit={handleRegister}>
                <p>{copy.registerHint}</p>
                <p className="muted">{copy.registerSummary}</p>

                <div>
                  <label htmlFor="register-account">{copy.registerAccountLabel}</label>
                  <input
                    id="register-account"
                    name="account"
                    type="text"
                    autoComplete="username"
                    value={registerAccount}
                    placeholder={copy.registerAccountPlaceholder}
                    onChange={(event) => setRegisterAccount(normalizeAccount(event.target.value))}
                    disabled={!hydrated || isBusy}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="register-password">{copy.registerPasswordLabel}</label>
                  <input
                    id="register-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    value={registerPassword}
                    placeholder={copy.passwordPlaceholder}
                    onChange={(event) => setRegisterPassword(event.target.value)}
                    disabled={!hydrated || isBusy}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="register-password-confirm">
                    {copy.registerConfirmPasswordLabel}
                  </label>
                  <input
                    id="register-password-confirm"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={registerConfirmPassword}
                    placeholder={copy.registerConfirmPasswordPlaceholder}
                    onChange={(event) => setRegisterConfirmPassword(event.target.value)}
                    disabled={!hydrated || isBusy}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="register-phone">{copy.phoneLabel}</label>
                  <input
                    id="register-phone"
                    name="phoneNumber"
                    type="tel"
                    autoComplete="tel"
                    inputMode="numeric"
                    maxLength={11}
                    value={registerPhoneNumber}
                    placeholder={copy.phonePlaceholder}
                    onChange={(event) => setRegisterPhoneNumber(normalizePhone(event.target.value))}
                    disabled={!hydrated || isBusy}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="register-code">{copy.verificationCode}</label>
                  <input
                    id="register-code"
                    name="code"
                    type="text"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                    value={registerCode}
                    placeholder={copy.codePlaceholder}
                    onChange={(event) =>
                      setRegisterCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    disabled={!hydrated || isBusy}
                    required
                  />
                </div>

                {registerDevCode ? (
                  <p className="login-dev-code">
                    {copy.devCode}
                    <code>{registerDevCode}</code>
                  </p>
                ) : null}

                <div className="row">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => void requestSmsCode(registerPhoneNumber, 'register')}
                    disabled={!hydrated || isBusy || registerSmsCooldown > 0}
                  >
                    {registerCodeButtonLabel}
                  </button>
                  <button type="submit" disabled={!hydrated || isBusy}>
                    {submittingRegister ? copy.registering : copy.registerSubmit}
                  </button>
                </div>

                <div className="login-secondary-actions">
                  <button
                    type="button"
                    className="login-secondary-cta"
                    onClick={() => switchEntryView('login')}
                  >
                    {copy.switchToLogin}
                  </button>
                </div>
              </form>
            )}

            {success ? (
              <div className="login-success" role="status" aria-live="polite">
                <p>{success}</p>
              </div>
            ) : null}

            {error ? (
              <p className="error login-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}
