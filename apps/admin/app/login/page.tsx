'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  meResponseSchema,
  phoneLoginRequestSchema,
  requestSmsCodeRequestSchema,
  requestSmsCodeResponseSchema
} from '@eggturtle/shared';

import { UiPreferenceControls, useUiPreferences } from '@/components/ui-preferences';
import { usePlatformBranding } from '@/lib/branding-client';
import { apiRequest } from '@/lib/api-client';
import { formatUnknownError } from '@/lib/formatters';
import { ADMIN_LOGIN_MESSAGES, type AdminLoginMessages } from '@/lib/locales/login';

type LoginMode = 'password' | 'code';

const ACCOUNT_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]{2,30}[a-zA-Z0-9]$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function resolveAdminLoginIdentifier(value: string, messages: AdminLoginMessages) {
  const compact = value.trim().replace(/\s+/g, '');

  if (!compact) {
    return { ok: false as const, message: messages.identifierRequired };
  }

  const normalizedPhone = parseMainlandPhone(compact);
  if (normalizedPhone) {
    return { ok: true as const, login: normalizedPhone };
  }

  const normalized = compact.toLowerCase();
  if (normalized.includes('@')) {
    if (!EMAIL_PATTERN.test(normalized)) {
      return { ok: false as const, message: messages.emailInvalid };
    }

    return { ok: true as const, login: normalized };
  }

  if (/^\d+$/.test(compact)) {
    return { ok: false as const, message: messages.phoneInvalid };
  }

  if (!ACCOUNT_PATTERN.test(normalized)) {
    return { ok: false as const, message: messages.accountInvalid };
  }

  return { ok: true as const, login: normalized };
}

export default function LoginPage() {
  const router = useRouter();
  const { locale } = useUiPreferences();
  const branding = usePlatformBranding();
  const messages = {
    ...ADMIN_LOGIN_MESSAGES[locale],
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

    const resolvedIdentifier = resolveAdminLoginIdentifier(loginIdentifier, messages);
    if (!resolvedIdentifier.ok) {
      setError(resolvedIdentifier.message);
      return;
    }

    if (!password.trim()) {
      setError(messages.passwordRequired);
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
      setError(formatUnknownError(requestError, { fallback: messages.unknownError, locale }));
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestSmsCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedPhone = parseMainlandPhone(phoneNumber);
    if (!normalizedPhone) {
      setError(messages.phoneInvalid);
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
      setError(formatUnknownError(requestError, { fallback: messages.unknownError, locale }));
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
      setError(messages.codeInvalid);
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
      setError(formatUnknownError(requestError, { fallback: messages.unknownError, locale }));
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
            <span className="login-eyebrow">{messages.showcaseEyebrow}</span>
            <h1 className="login-product-title">{messages.productTitle}</h1>
            <p className="login-product-subtitle">{messages.productSubtitle}</p>
          </div>
        </section>

        <section className="stack login-card" aria-live={checkingSession ? 'polite' : undefined}>
          <div className="login-card-head">
            <div className="login-card-top">
              <div className="stack login-card-copy">
                <h2>{messages.cardTitle}</h2>
                <p className="muted">{messages.cardSubtitle}</p>
              </div>
              <UiPreferenceControls className="login-preference-controls" />
            </div>
          </div>

          {checkingSession ? <p className="muted login-session-hint">{messages.checkingSession}</p> : null}

          {!checkingSession ? (
            <div className="stack login-form-stack">
              <div className="login-mode-toggle" role="tablist" aria-label={messages.modeLabel}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'password'}
                  className={mode === 'password' ? 'login-mode-btn active' : 'login-mode-btn'}
                  onClick={() => switchMode('password')}
                >
                  {messages.modePassword}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'code'}
                  className={mode === 'code' ? 'login-mode-btn active' : 'login-mode-btn'}
                  onClick={() => switchMode('code')}
                >
                  {messages.modeCode}
                </button>
              </div>

              {mode === 'password' ? (
                <form className="stack login-panel" onSubmit={handlePasswordLogin}>
                  <p className="muted">{messages.passwordHint}</p>

                  <div className="stack login-field">
                    <label htmlFor="login-identifier">{messages.loginIdentifierLabel}</label>
                    <input
                      id="login-identifier"
                      name="loginIdentifier"
                      type="text"
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      value={loginIdentifier}
                      placeholder={messages.loginIdentifierPlaceholder}
                      onChange={(event) => setLoginIdentifier(event.target.value)}
                      disabled={isBusy}
                      required
                    />
                  </div>

                  <div className="stack login-field">
                    <label htmlFor="password">{messages.passwordLabel}</label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      placeholder={messages.passwordPlaceholder}
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
                    {loading ? messages.signingIn : messages.signInButton}
                  </button>
                </form>
              ) : null}

              {isCodeRequest ? (
                <form className="stack login-panel" onSubmit={handleRequestSmsCode}>
                  <p className="muted">{messages.codeHint}</p>

                  <div className="stack login-field">
                    <label htmlFor="code-phone">{messages.phoneLabel}</label>
                    <input
                      id="code-phone"
                      name="phoneNumber"
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      spellCheck={false}
                      value={phoneNumber}
                      placeholder={messages.phonePlaceholder}
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
                    {loading ? messages.sending : messages.requestCode}
                  </button>
                </form>
              ) : null}

              {isCodeVerify ? (
                <form className="stack login-panel" onSubmit={handlePhoneLogin}>
                  <p className="muted login-code-hint">
                    {messages.codeSentTo} <strong>{requestedPhoneNumber}</strong>
                  </p>

                  {devCode ? (
                    <p className="login-dev-code">
                      <span>{messages.devCode}</span>
                      <code>{devCode}</code>
                    </p>
                  ) : null}

                  <div className="stack login-field">
                    <label htmlFor="code">{messages.verificationCode}</label>
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
                      placeholder={messages.codePlaceholder}
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
                      {loading ? messages.verifying : messages.verifyAndSignIn}
                    </button>
                    <button className="secondary" type="button" disabled={isBusy} onClick={resetCodeFlow}>
                      {messages.changePhone}
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
