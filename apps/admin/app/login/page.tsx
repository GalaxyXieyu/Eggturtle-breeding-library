'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  meResponseSchema,
  requestCodeRequestSchema,
  requestCodeResponseSchema,
  verifyCodeRequestSchema
} from '@eggturtle/shared';

import { UiPreferenceControls, type UiLocale, useUiPreferences } from '@/components/ui-preferences';
import { apiRequest } from '@/lib/api-client';
import { formatUnknownError } from '@/lib/formatters';

type LoginMode = 'password' | 'code';

type LoginCopy = {
  productTitle: string;
  productSubtitle: string;
  showcaseEyebrow: string;
  showcaseSecurity: string;
  showcaseOperations: string;
  showcaseInsights: string;
  cardTitle: string;
  cardSubtitle: string;
  checkingSession: string;
  modeLabel: string;
  modePassword: string;
  modeCode: string;
  passwordHint: string;
  codeHint: string;
  loginIdentifierLabel: string;
  loginIdentifierPlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  signingIn: string;
  signInButton: string;
  sending: string;
  requestCode: string;
  codeSentTo: string;
  devCode: string;
  verificationCode: string;
  codePlaceholder: string;
  verifying: string;
  verifyAndSignIn: string;
  changeEmail: string;
  identifierRequired: string;
  emailInvalid: string;
  accountInvalid: string;
  passwordRequired: string;
  codeInvalid: string;
  unknownError: string;
};

const ACCOUNT_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]{2,30}[a-zA-Z0-9]$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const COPY: Record<UiLocale, LoginCopy> = {
  zh: {
    productTitle: '选育溯源档案',
    productSubtitle: '用数据驱动选育优化，提升繁育决策效率。',
    showcaseEyebrow: 'Admin Console',
    showcaseSecurity: '超级管理员白名单校验',
    showcaseOperations: '租户订阅 / 用量 / 活跃度总览',
    showcaseInsights: '跨租户运营、审计与数据治理能力',
    cardTitle: '管理后台登录',
    cardSubtitle: '仅后台白名单账号可访问，支持邮箱或账号名登录。',
    checkingSession: '正在检查会话状态…',
    modeLabel: '登录模式',
    modePassword: '账号密码',
    modeCode: '邮箱验证码',
    passwordHint: '推荐使用后台邮箱或账号名登录；登录失败时会直接提示可处理的中文信息。',
    codeHint: '验证码会发送到后台白名单邮箱，仅支持已有后台账号。',
    loginIdentifierLabel: '邮箱或账号名',
    loginIdentifierPlaceholder: '请输入后台邮箱或账号名，例如 siri…',
    emailLabel: '邮箱',
    emailPlaceholder: '请输入白名单邮箱，例如 siri@admin.com…',
    passwordLabel: '密码',
    passwordPlaceholder: '请输入后台登录密码…',
    signingIn: '登录中…',
    signInButton: '登录后台',
    sending: '发送中…',
    requestCode: '获取验证码',
    codeSentTo: '验证码已发送至',
    devCode: '开发验证码',
    verificationCode: '验证码',
    codePlaceholder: '请输入 6 位验证码…',
    verifying: '验证中…',
    verifyAndSignIn: '验证并登录',
    changeEmail: '更换邮箱',
    identifierRequired: '请输入后台邮箱或账号名。',
    emailInvalid: '请输入正确的邮箱地址。',
    accountInvalid: '请输入有效账号名：4-32 位、以字母开头、以字母或数字结尾，可包含数字、下划线、连字符。',
    passwordRequired: '请输入登录密码。',
    codeInvalid: '请输入 6 位数字验证码。',
    unknownError: '未知错误'
  },
  en: {
    productTitle: 'Breeding Traceability Record',
    productSubtitle: 'Data-driven breeding optimization for higher quality and faster decisions.',
    showcaseEyebrow: 'Admin Console',
    showcaseSecurity: 'Super admin allowlist enforcement',
    showcaseOperations: 'Tenant subscriptions, usage & activity overview',
    showcaseInsights: 'Cross-tenant operations, audit & governance tools',
    cardTitle: 'Admin Sign In',
    cardSubtitle: 'Only allowlisted admin accounts can access this console.',
    checkingSession: 'Checking session status…',
    modeLabel: 'Login mode',
    modePassword: 'Password',
    modeCode: 'Email code',
    passwordHint: 'Use your admin email or account name. Errors are translated into actionable messages.',
    codeHint: 'The verification code is sent to an allowlisted admin email and works only for existing accounts.',
    loginIdentifierLabel: 'Email or account',
    loginIdentifierPlaceholder: 'Enter your admin email or account, e.g. siri…',
    emailLabel: 'Email',
    emailPlaceholder: 'Enter your allowlisted email, e.g. siri@admin.com…',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Enter your admin password…',
    signingIn: 'Signing in…',
    signInButton: 'Sign in to Admin',
    sending: 'Sending…',
    requestCode: 'Request code',
    codeSentTo: 'Verification code sent to',
    devCode: 'Dev code',
    verificationCode: 'Verification code',
    codePlaceholder: 'Enter the 6-digit code…',
    verifying: 'Verifying…',
    verifyAndSignIn: 'Verify & Sign In',
    changeEmail: 'Change email',
    identifierRequired: 'Enter your admin email or account.',
    emailInvalid: 'Enter a valid email address.',
    accountInvalid: 'Enter a valid account name: 4-32 chars, starts with a letter, ends with a letter or number, and only uses letters, numbers, underscores, or hyphens.',
    passwordRequired: 'Enter your password.',
    codeInvalid: 'Enter the 6-digit verification code.',
    unknownError: 'Unknown error'
  }
};

function normalizeIdentifier(value: string) {
  return value.trim().replace(/\s+/g, '').toLowerCase();
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeCode(value: string) {
  return value.replace(/\D/g, '').slice(0, 6);
}

function resolveAdminLoginIdentifier(value: string, copy: LoginCopy) {
  const normalized = normalizeIdentifier(value);

  if (!normalized) {
    return { ok: false as const, message: copy.identifierRequired };
  }

  if (normalized.includes('@')) {
    if (!EMAIL_PATTERN.test(normalized)) {
      return { ok: false as const, message: copy.emailInvalid };
    }

    return { ok: true as const, login: normalized };
  }

  if (!ACCOUNT_PATTERN.test(normalized)) {
    return { ok: false as const, message: copy.accountInvalid };
  }

  return { ok: true as const, login: normalized };
}

export default function LoginPage() {
  const router = useRouter();
  const { locale } = useUiPreferences();
  const copy = COPY[locale];

  const [redirectTo, setRedirectTo] = useState('/dashboard');
  const [mode, setMode] = useState<LoginMode>('password');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [requestedEmail, setRequestedEmail] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const candidate = new URLSearchParams(window.location.search).get('redirect');
    if (candidate && candidate.startsWith('/dashboard')) {
      setRedirectTo(candidate);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        await apiRequest('/api/auth/session', {
          responseSchema: meResponseSchema
        });

        if (!cancelled) {
          router.replace(redirectTo);
        }
      } catch {
        // 无有效会话，留在登录页。
      } finally {
        if (!cancelled) {
          setCheckingSession(false);
        }
      }
    }

    void checkSession();

    return () => {
      cancelled = true;
    };
  }, [redirectTo, router]);

  function resetCodeFlow() {
    setRequestedEmail(null);
    setCode('');
    setDevCode(null);
    setError(null);
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

    const resolvedIdentifier = resolveAdminLoginIdentifier(email, copy);
    if (!resolvedIdentifier.ok) {
      setError(resolvedIdentifier.message);
      return;
    }

    if (!password.trim()) {
      setError(copy.passwordRequired);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiRequest('/api/auth/password-login', {
        method: 'POST',
        body: {
          login: resolvedIdentifier.login,
          password
        },
        responseSchema: meResponseSchema
      });

      router.replace(redirectTo);
    } catch (requestError) {
      setError(formatUnknownError(requestError, { fallback: copy.unknownError, locale }));
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = normalizeEmail(email);
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError(copy.emailInvalid);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiRequest('/api/auth/request-code', {
        method: 'POST',
        body: {
          email: normalizedEmail
        },
        requestSchema: requestCodeRequestSchema,
        responseSchema: requestCodeResponseSchema
      });

      setRequestedEmail(normalizedEmail);
      setDevCode(response.devCode ?? null);
      setCode('');
    } catch (requestError) {
      setError(formatUnknownError(requestError, { fallback: copy.unknownError, locale }));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requestedEmail) {
      return;
    }

    const normalizedCode = normalizeCode(code);
    if (normalizedCode.length !== 6) {
      setError(copy.codeInvalid);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiRequest('/api/auth/verify-code', {
        method: 'POST',
        body: {
          email: requestedEmail,
          code: normalizedCode
        },
        requestSchema: verifyCodeRequestSchema,
        responseSchema: meResponseSchema
      });

      router.replace(redirectTo);
    } catch (requestError) {
      setError(formatUnknownError(requestError, { fallback: copy.unknownError, locale }));
    } finally {
      setLoading(false);
    }
  }

  const isCodeRequest = mode === 'code' && !requestedEmail;
  const isCodeVerify = mode === 'code' && Boolean(requestedEmail);
  const isBusy = loading || checkingSession;

  return (
    <main className="login-page">
      <section className="login-layout">
        <section className="login-showcase">
          <div className="login-showcase-glow" aria-hidden />
          <div className="login-brand-copy">
            <span className="login-eyebrow">{copy.showcaseEyebrow}</span>
            <h1 className="login-product-title">{copy.productTitle}</h1>
            <p className="login-product-subtitle">{copy.productSubtitle}</p>
          </div>
          <div className="login-showcase-chips">
            <span>{copy.showcaseSecurity}</span>
            <span>{copy.showcaseOperations}</span>
            <span>{copy.showcaseInsights}</span>
          </div>
        </section>

        <section className="stack login-card" aria-live={checkingSession ? 'polite' : undefined}>
          <div className="login-card-head">
            <div className="login-card-top">
              <div className="stack login-card-copy">
                <h2>{copy.cardTitle}</h2>
                <p className="muted">{copy.cardSubtitle}</p>
              </div>
              <UiPreferenceControls className="login-preference-controls" />
            </div>
          </div>

          {checkingSession ? <p className="muted login-session-hint">{copy.checkingSession}</p> : null}

          {!checkingSession ? (
            <div className="stack login-form-stack">
              <div className="login-mode-toggle" role="tablist" aria-label={copy.modeLabel}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'password'}
                  className={mode === 'password' ? 'login-mode-btn active' : 'login-mode-btn'}
                  onClick={() => switchMode('password')}
                >
                  {copy.modePassword}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'code'}
                  className={mode === 'code' ? 'login-mode-btn active' : 'login-mode-btn'}
                  onClick={() => switchMode('code')}
                >
                  {copy.modeCode}
                </button>
              </div>

              {mode === 'password' ? (
                <form className="stack login-panel" onSubmit={handlePasswordLogin}>
                  <p className="muted">{copy.passwordHint}</p>

                  <div className="stack login-field">
                    <label htmlFor="login-identifier">{copy.loginIdentifierLabel}</label>
                    <input
                      id="login-identifier"
                      name="loginIdentifier"
                      type="text"
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      value={email}
                      placeholder={copy.loginIdentifierPlaceholder}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={isBusy}
                      required
                    />
                  </div>

                  <div className="stack login-field">
                    <label htmlFor="password">{copy.passwordLabel}</label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      placeholder={copy.passwordPlaceholder}
                      onChange={(event) => setPassword(event.target.value)}
                      disabled={isBusy}
                      required
                    />
                  </div>

                  {error ? (
                    <p className="login-alert" role="alert">
                      {error}
                    </p>
                  ) : null}

                  <button type="submit" disabled={isBusy}>
                    {loading ? copy.signingIn : copy.signInButton}
                  </button>
                </form>
              ) : null}

              {isCodeRequest ? (
                <form className="stack login-panel" onSubmit={handleRequestCode}>
                  <p className="muted">{copy.codeHint}</p>

                  <div className="stack login-field">
                    <label htmlFor="code-email">{copy.emailLabel}</label>
                    <input
                      id="code-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      inputMode="email"
                      spellCheck={false}
                      value={email}
                      placeholder={copy.emailPlaceholder}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={isBusy}
                      required
                    />
                  </div>

                  {error ? (
                    <p className="login-alert" role="alert">
                      {error}
                    </p>
                  ) : null}

                  <button type="submit" disabled={isBusy}>
                    {loading ? copy.sending : copy.requestCode}
                  </button>
                </form>
              ) : null}

              {isCodeVerify ? (
                <form className="stack login-panel" onSubmit={handleVerifyCode}>
                  <p className="muted login-code-hint">
                    {copy.codeSentTo} <strong>{requestedEmail}</strong>
                  </p>

                  {devCode ? (
                    <p className="login-dev-code">
                      <span>{copy.devCode}</span>
                      <code>{devCode}</code>
                    </p>
                  ) : null}

                  <div className="stack login-field">
                    <label htmlFor="code">{copy.verificationCode}</label>
                    <input
                      id="code"
                      name="code"
                      type="text"
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      spellCheck={false}
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={code}
                      placeholder={copy.codePlaceholder}
                      onChange={(event) => setCode(normalizeCode(event.target.value))}
                      disabled={isBusy}
                      required
                    />
                  </div>

                  {error ? (
                    <p className="login-alert" role="alert">
                      {error}
                    </p>
                  ) : null}

                  <div className="inline-actions login-inline-actions">
                    <button type="submit" disabled={isBusy}>
                      {loading ? copy.verifying : copy.verifyAndSignIn}
                    </button>
                    <button className="secondary" type="button" disabled={isBusy} onClick={resetCodeFlow}>
                      {copy.changeEmail}
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
