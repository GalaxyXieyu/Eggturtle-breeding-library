'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  meResponseSchema,
  phoneLoginRequestSchema,
  requestSmsCodeRequestSchema,
  requestSmsCodeResponseSchema
} from '@eggturtle/shared';

import { UiPreferenceControls, type UiLocale, useUiPreferences } from '@/components/ui-preferences';
import { usePlatformBranding } from '@/lib/branding-client';
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
  phoneLabel: string;
  phonePlaceholder: string;
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
  changePhone: string;
  identifierRequired: string;
  emailInvalid: string;
  accountInvalid: string;
  phoneInvalid: string;
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
    showcaseSecurity: '超级管理员权限校验',
    showcaseOperations: '租户订阅 / 用量 / 活跃度总览',
    showcaseInsights: '跨租户运营、审计与数据治理能力',
    cardTitle: '管理后台登录',
    cardSubtitle: '仅超级管理员账号可访问，优先使用账号或手机号登录。',
    checkingSession: '正在检查会话状态…',
    modeLabel: '登录模式',
    modePassword: '账号密码',
    modeCode: '手机验证码',
    passwordHint: '推荐使用后台账号或手机号登录；旧邮箱密码仍兼容，但不再作为主入口。',
    codeHint: '短信验证码会发送到已绑定的后台手机号，仅允许超级管理员登录。',
    loginIdentifierLabel: '账号或手机号',
    loginIdentifierPlaceholder: '请输入后台账号或手机号，例如 galaxyxieyu / 13800138000',
    phoneLabel: '手机号',
    phonePlaceholder: '请输入已绑定的 11 位手机号',
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
    changePhone: '更换手机号',
    identifierRequired: '请输入后台账号、手机号，或旧邮箱。',
    emailInvalid: '请输入正确的邮箱地址。',
    accountInvalid: '请输入有效账号名：4-32 位、以字母开头、以字母或数字结尾，可包含数字、下划线、连字符。',
    phoneInvalid: '请输入正确的 11 位中国大陆手机号。',
    passwordRequired: '请输入登录密码。',
    codeInvalid: '请输入 6 位数字验证码。',
    unknownError: '未知错误'
  },
  en: {
    productTitle: 'Breeding Traceability Record',
    productSubtitle: 'Data-driven breeding optimization for higher quality and faster decisions.',
    showcaseEyebrow: 'Admin Console',
    showcaseSecurity: 'Super-admin permission enforcement',
    showcaseOperations: 'Tenant subscriptions, usage & activity overview',
    showcaseInsights: 'Cross-tenant operations, audit & governance tools',
    cardTitle: 'Admin Sign In',
    cardSubtitle: 'Only super-admin accounts can access this console.',
    checkingSession: 'Checking session status…',
    modeLabel: 'Login mode',
    modePassword: 'Password',
    modeCode: 'SMS code',
    passwordHint: 'Use your admin account or phone number. Legacy email password sign-in remains compatible.',
    codeHint: 'The verification code is sent to a bound admin phone number and only grants super-admin access.',
    loginIdentifierLabel: 'Account or phone',
    loginIdentifierPlaceholder: 'Enter your admin account or phone, e.g. galaxyxieyu / 13800138000',
    phoneLabel: 'Phone number',
    phonePlaceholder: 'Enter the bound 11-digit phone number',
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
    changePhone: 'Change phone',
    identifierRequired: 'Enter your admin account, phone number, or legacy email.',
    emailInvalid: 'Enter a valid email address.',
    accountInvalid:
      'Enter a valid account name: 4-32 chars, starts with a letter, ends with a letter or number, and only uses letters, numbers, underscores, or hyphens.',
    phoneInvalid: 'Enter a valid 11-digit mainland China mobile number.',
    passwordRequired: 'Enter your password.',
    codeInvalid: 'Enter the 6-digit verification code.',
    unknownError: 'Unknown error'
  }
};

function normalizeCode(value: string) {
  return value.replace(/\D/g, '').slice(0, 6);
}

function parseMainlandPhone(value: string): string | null {
  const compact = value.trim().replace(/[\s-]/g, '');
  if (!compact) {
    return null;
  }

  if (!/^(?:\+?86)?1\d{10}$/.test(compact)) {
    return null;
  }

  return compact.replace(/^\+?86/, '');
}

function resolveAdminLoginIdentifier(value: string, copy: LoginCopy) {
  const compact = value.trim().replace(/\s+/g, '');

  if (!compact) {
    return { ok: false as const, message: copy.identifierRequired };
  }

  const normalizedPhone = parseMainlandPhone(compact);
  if (normalizedPhone) {
    return { ok: true as const, login: normalizedPhone };
  }

  const normalized = compact.toLowerCase();
  if (normalized.includes('@')) {
    if (!EMAIL_PATTERN.test(normalized)) {
      return { ok: false as const, message: copy.emailInvalid };
    }

    return { ok: true as const, login: normalized };
  }

  if (/^\d+$/.test(compact)) {
    return { ok: false as const, message: copy.phoneInvalid };
  }

  if (!ACCOUNT_PATTERN.test(normalized)) {
    return { ok: false as const, message: copy.accountInvalid };
  }

  return { ok: true as const, login: normalized };
}

export default function LoginPage() {
  const router = useRouter();
  const { locale } = useUiPreferences();
  const branding = usePlatformBranding();
  const copy = {
    ...COPY[locale],
    productTitle: branding.appName[locale],
    productSubtitle: branding.appDescription[locale],
  };

  const [redirectTo, setRedirectTo] = useState('/dashboard');
  const [mode, setMode] = useState<LoginMode>('password');

  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [requestedPhoneNumber, setRequestedPhoneNumber] = useState<string | null>(null);
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
    setRequestedPhoneNumber(null);
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

    const resolvedIdentifier = resolveAdminLoginIdentifier(loginIdentifier, copy);
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
        auth: false,
        body: {
          login: resolvedIdentifier.login,
          password
        },
        responseSchema: meResponseSchema
      });

      resetCodeFlow();
      switchMode('password');
      router.replace(redirectTo);
    } catch (requestError) {
      setError(formatUnknownError(requestError, { fallback: copy.unknownError, locale }));
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestSmsCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedPhone = parseMainlandPhone(phoneNumber);
    if (!normalizedPhone) {
      setError(copy.phoneInvalid);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiRequest('/api/auth/request-sms-code', {
        method: 'POST',
        auth: false,
        body: {
          phoneNumber: normalizedPhone,
          purpose: 'login'
        },
        requestSchema: requestSmsCodeRequestSchema,
        responseSchema: requestSmsCodeResponseSchema
      });

      setRequestedPhoneNumber(normalizedPhone);
      setPhoneNumber(normalizedPhone);
      setDevCode(response.devCode ?? null);
      setCode('');
    } catch (requestError) {
      setError(formatUnknownError(requestError, { fallback: copy.unknownError, locale }));
    } finally {
      setLoading(false);
    }
  }

  async function handlePhoneLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requestedPhoneNumber) {
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
      await apiRequest('/api/auth/phone-login', {
        method: 'POST',
        auth: false,
        body: {
          phoneNumber: requestedPhoneNumber,
          code: normalizedCode
        },
        requestSchema: phoneLoginRequestSchema,
        responseSchema: meResponseSchema
      });

      router.replace(redirectTo);
    } catch (requestError) {
      setError(formatUnknownError(requestError, { fallback: copy.unknownError, locale }));
    } finally {
      setLoading(false);
    }
  }

  const isCodeRequest = mode === 'code' && !requestedPhoneNumber;
  const isCodeVerify = mode === 'code' && Boolean(requestedPhoneNumber);
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
                      value={loginIdentifier}
                      placeholder={copy.loginIdentifierPlaceholder}
                      onChange={(event) => setLoginIdentifier(event.target.value)}
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
                <form className="stack login-panel" onSubmit={handleRequestSmsCode}>
                  <p className="muted">{copy.codeHint}</p>

                  <div className="stack login-field">
                    <label htmlFor="code-phone">{copy.phoneLabel}</label>
                    <input
                      id="code-phone"
                      name="phoneNumber"
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      spellCheck={false}
                      value={phoneNumber}
                      placeholder={copy.phonePlaceholder}
                      onChange={(event) => setPhoneNumber(event.target.value)}
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
                <form className="stack login-panel" onSubmit={handlePhoneLogin}>
                  <p className="muted login-code-hint">
                    {copy.codeSentTo} <strong>{requestedPhoneNumber}</strong>
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
                      {copy.changePhone}
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
