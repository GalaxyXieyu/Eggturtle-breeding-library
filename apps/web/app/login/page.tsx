'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  passwordLoginRequestSchema,
  passwordLoginResponseSchema,
  phoneLoginRequestSchema,
  phoneLoginResponseSchema,
  requestSmsCodeRequestSchema,
  requestSmsCodeResponseSchema
} from '@eggturtle/shared/auth';

import { ApiError, apiRequest, getAccessToken, setAccessToken } from '../../lib/api-client';
import { resolvePostAuthRedirect } from '../../lib/post-auth-redirect';
import { UiPreferenceControls, type UiLocale, useUiPreferences } from '../../components/ui-preferences';

type LoginMode = 'password' | 'phone';

type LoginCopy = {
  title: string;
  subtitle: string;
  formTitle: string;
  showcaseItemAuth: string;
  showcaseItemTenant: string;
  showcaseItemWorkflow: string;
  modeLabel: string;
  modePassword: string;
  modePhone: string;
  passwordIdentifierLabel: string;
  passwordIdentifierPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  passwordLogin: string;
  registerStep1Title: string;
  registerStep1Hint: string;
  registerPhoneLabel: string;
  registerPhonePlaceholder: string;
  verificationCode: string;
  codePlaceholder: string;
  codeSentTo: string;
  devCode: string;
  registerPhoneInvalid: string;
  registerNeedSendFirst: string;
  registerSendCode: string;
  registerResendCode: string;
  registerResendIn: string;
  phoneLogin: string;
  sending: string;
  verifying: string;
};

const COPY: Record<UiLocale, LoginCopy> = {
  zh: {
    title: '蛋龟选育库',
    subtitle: '用数据驱动选育优化，提升繁育决策效率。',
    formTitle: '登录用户端',
    showcaseItemAuth: '统一登录与会话管理',
    showcaseItemTenant: '用户空间隔离与成员权限控制',
    showcaseItemWorkflow: '手机号验证码登录 + 账号密码登录',
    modeLabel: '登录模式',
    modePassword: '账号密码',
    modePhone: '手机号',
    passwordIdentifierLabel: '账号',
    passwordIdentifierPlaceholder: '邮箱 / 用户名 / 空间标识',
    passwordLabel: '密码',
    passwordPlaceholder: '请输入登录密码',
    passwordLogin: '账号密码登录',
    registerStep1Title: '手机号登录',
    registerStep1Hint: '请输入手机号和验证码，登录后再补填用户名、密码、密保。',
    registerPhoneLabel: '手机号',
    registerPhonePlaceholder: '请输入 11 位手机号',
    verificationCode: '验证码',
    codePlaceholder: '6 位数字',
    codeSentTo: '验证码已发送至',
    devCode: '开发验证码',
    registerPhoneInvalid: '请输入正确的 11 位手机号。',
    registerNeedSendFirst: '请先发送短信验证码。',
    registerSendCode: '发送验证码',
    registerResendCode: '重新发送',
    registerResendIn: '秒后可重发',
    phoneLogin: '登录',
    sending: '发送中...',
    verifying: '登录中...'
  },
  en: {
    title: 'Eggturtle Breeding Library',
    subtitle: 'Data-driven breeding optimization for faster and more reliable decisions.',
    formTitle: 'Sign in to Workspace',
    showcaseItemAuth: 'Unified login and session handling',
    showcaseItemTenant: 'Workspace isolation with role-based control',
    showcaseItemWorkflow: 'Phone code login + password login',
    modeLabel: 'Login mode',
    modePassword: 'Password',
    modePhone: 'Phone',
    passwordIdentifierLabel: 'Account',
    passwordIdentifierPlaceholder: 'Email / username / workspace slug',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Enter your password',
    passwordLogin: 'Sign in with password',
    registerStep1Title: 'Phone Login',
    registerStep1Hint: 'Enter phone and code. Complete profile details after sign in.',
    registerPhoneLabel: 'Phone number',
    registerPhonePlaceholder: 'Enter 11-digit phone number',
    verificationCode: 'Verification code',
    codePlaceholder: '6-digit code',
    codeSentTo: 'Code sent to',
    devCode: 'Dev code',
    registerPhoneInvalid: 'Please enter a valid 11-digit phone number.',
    registerNeedSendFirst: 'Please send an SMS code first.',
    registerSendCode: 'Send code',
    registerResendCode: 'Resend code',
    registerResendIn: 's to resend',
    phoneLogin: 'Sign in',
    sending: 'Sending...',
    verifying: 'Signing in...'
  }
};

export default function LoginPage() {
  const router = useRouter();
  const { locale } = useUiPreferences();
  const [mode, setMode] = useState<LoginMode>('password');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneDevCode, setPhoneDevCode] = useState<string | null>(null);
  const [smsSent, setSmsSent] = useState(false);
  const [smsCooldown, setSmsCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');

    if (view === 'register') {
      setMode('phone');
      return;
    }

    if (getAccessToken()) {
      router.replace(resolvePostAuthRedirect('/app', window.location.search));
    }
  }, [router]);

  useEffect(() => {
    if (smsCooldown <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setSmsCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [smsCooldown]);

  const copy = COPY[locale];

  function getPostAuthRedirect(defaultPath: string): string {
    if (typeof window === 'undefined') {
      return defaultPath;
    }

    return resolvePostAuthRedirect(defaultPath, window.location.search);
  }

  function resetPhoneFlow() {
    setPhoneNumber('');
    setPhoneCode('');
    setPhoneDevCode(null);
    setSmsSent(false);
    setSmsCooldown(0);
  }

  function normalizePhone(value: string): string {
    return value.replace(/\D/g, '').slice(0, 11);
  }

  async function handleRequestSmsCode() {
    if (!/^1\d{10}$/.test(phoneNumber)) {
      setError(copy.registerPhoneInvalid);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = requestSmsCodeRequestSchema.parse({ phoneNumber });
      const response = await apiRequest('/auth/request-sms-code', {
        method: 'POST',
        auth: false,
        body: payload,
        requestSchema: requestSmsCodeRequestSchema,
        responseSchema: requestSmsCodeResponseSchema
      });

      setPhoneDevCode(response.devCode ?? null);
      setSmsSent(true);
      setSmsCooldown(60);
    } catch (requestError) {
      setError(formatError(requestError, locale));
    } finally {
      setLoading(false);
    }
  }

  async function handlePhoneLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!/^1\d{10}$/.test(phoneNumber)) {
      setError(copy.registerPhoneInvalid);
      return;
    }

    if (!smsSent) {
      setError(copy.registerNeedSendFirst);
      return;
    }

    if (!/^\d{6}$/.test(phoneCode)) {
      setError(copy.codePlaceholder);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = phoneLoginRequestSchema.parse({
        phoneNumber,
        code: phoneCode
      });

      const response = await apiRequest('/auth/phone-login', {
        method: 'POST',
        auth: false,
        body: payload,
        requestSchema: phoneLoginRequestSchema,
        responseSchema: phoneLoginResponseSchema
      });

      setAccessToken(response.accessToken);
      const nextPath = response.isNewUser ? `/app/${response.tenant.slug}/account?setup=1` : `/app/${response.tenant.slug}`;
      router.replace(getPostAuthRedirect(nextPath));
    } catch (requestError) {
      setError(formatError(requestError, locale));
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = passwordLoginRequestSchema.parse({
        email: loginIdentifier,
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
      router.replace(getPostAuthRedirect('/app'));
    } catch (requestError) {
      setError(formatError(requestError, locale));
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode: LoginMode) {
    if (mode === nextMode) {
      return;
    }

    setMode(nextMode);
    setError(null);
    if (nextMode === 'phone') {
      resetPhoneFlow();
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
              <h2>{copy.formTitle}</h2>
              <UiPreferenceControls className="login-preference-controls" />
            </div>
          </div>

          <div className="login-form-stack">
            <div className="login-mode-toggle" role="tablist" aria-label={copy.modeLabel}>
              <button
                type="button"
                className={mode === 'password' ? 'login-mode-btn active' : 'login-mode-btn'}
                role="tab"
                aria-selected={mode === 'password'}
                onClick={() => switchMode('password')}
              >
                {copy.modePassword}
              </button>
              <button
                type="button"
                className={mode === 'phone' ? 'login-mode-btn active' : 'login-mode-btn'}
                role="tab"
                aria-selected={mode === 'phone'}
                onClick={() => switchMode('phone')}
              >
                {copy.modePhone}
              </button>
            </div>

            {mode === 'password' ? (
              <form className="stack login-panel" onSubmit={handlePasswordLogin}>
                <label htmlFor="password-login-identifier">{copy.passwordIdentifierLabel}</label>
                <input
                  id="password-login-identifier"
                  type="text"
                  autoComplete="username"
                  value={loginIdentifier}
                  placeholder={copy.passwordIdentifierPlaceholder}
                  onChange={(event) => setLoginIdentifier(event.target.value)}
                  disabled={!hydrated || loading}
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
                  disabled={!hydrated || loading}
                  required
                />
                <button type="submit" disabled={loading || !hydrated}>
                  {loading ? copy.verifying : copy.passwordLogin}
                </button>
              </form>
            ) : (
              <form className="stack login-panel" onSubmit={handlePhoneLogin}>
                <h2>{copy.registerStep1Title}</h2>
                <p>{copy.registerStep1Hint}</p>

                <label htmlFor="register-phone">{copy.registerPhoneLabel}</label>
                <input
                  id="register-phone"
                  type="tel"
                  autoComplete="tel"
                  value={phoneNumber}
                  placeholder={copy.registerPhonePlaceholder}
                  inputMode="numeric"
                  maxLength={11}
                  onChange={(event) => setPhoneNumber(normalizePhone(event.target.value))}
                  required
                />

                <label htmlFor="register-code">{copy.verificationCode}</label>
                <input
                  id="register-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={phoneCode}
                  placeholder={copy.codePlaceholder}
                  onChange={(event) => setPhoneCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                />

                {smsSent ? (
                  <p>
                    {copy.codeSentTo}: <strong>{phoneNumber}</strong>
                  </p>
                ) : null}

                {phoneDevCode ? (
                  <p className="login-dev-code">
                    {copy.devCode}: <code>{phoneDevCode}</code>
                  </p>
                ) : null}

                <div className="row">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => void handleRequestSmsCode()}
                    disabled={loading || !hydrated || smsCooldown > 0}
                  >
                    {loading
                      ? copy.sending
                      : smsCooldown > 0
                        ? `${smsCooldown}${copy.registerResendIn}`
                        : smsSent
                          ? copy.registerResendCode
                          : copy.registerSendCode}
                  </button>
                  <button type="submit" disabled={loading || !hydrated}>
                    {loading ? copy.verifying : copy.phoneLogin}
                  </button>
                </div>
              </form>
            )}

            {error ? <p className="error login-error">{error}</p> : null}
          </div>
        </section>
      </section>
    </main>
  );
}

function formatError(error: unknown, locale: UiLocale) {
  const fallbackMessage = locale === 'zh' ? '请求失败，请稍后重试。' : 'Request failed. Please try again.';
  const networkMessage =
    locale === 'zh' ? '网络请求失败，请检查网络后重试。' : 'Network request failed. Please check your connection and try again.';
  const timeoutMessage =
    locale === 'zh' ? '请求超时，请稍后再试。' : 'Request timed out. Please try again later.';

  const toFriendlyMessage = (message: string | undefined) => {
    const normalizedMessage = message?.trim();
    if (!normalizedMessage) {
      return fallbackMessage;
    }

    if (/failed to fetch|fetch failed|networkerror|network request failed|load failed/i.test(normalizedMessage)) {
      return networkMessage;
    }

    if (/timeout|timed out/i.test(normalizedMessage)) {
      return timeoutMessage;
    }

    return normalizedMessage;
  };

  if (error instanceof ApiError) {
    return toFriendlyMessage(error.message);
  }

  if (error instanceof Error) {
    return toFriendlyMessage(error.message);
  }

  return fallbackMessage;
}
