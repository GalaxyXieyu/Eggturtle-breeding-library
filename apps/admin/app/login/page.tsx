'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  meResponseSchema,
  passwordLoginRequestSchema,
  requestCodeRequestSchema,
  requestCodeResponseSchema,
  verifyCodeRequestSchema
} from '@eggturtle/shared';

import { UiPreferenceControls, type UiLocale, useUiPreferences } from '../../components/ui-preferences';
import { ApiError, apiRequest } from '../../lib/api-client';

type LoginMode = 'password' | 'code';

type LoginCopy = {
  productTitle: string;
  productSubtitle: string;
  checkingSession: string;
  modeLabel: string;
  modePassword: string;
  modeCode: string;
  emailLabel: string;
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
  unknownError: string;
};

const COPY: Record<UiLocale, LoginCopy> = {
  zh: {
    productTitle: '蛋龟选育库',
    productSubtitle: '用数据驱动选育优化，提升繁育决策效率。',
    checkingSession: '正在检查会话状态...',
    modeLabel: '登录模式',
    modePassword: '账号密码',
    modeCode: '邮箱验证码',
    emailLabel: '邮箱',
    passwordLabel: '密码',
    passwordPlaceholder: '请输入密码',
    signingIn: '登录中...',
    signInButton: '登录后台',
    sending: '发送中...',
    requestCode: '获取验证码',
    codeSentTo: '验证码已发送至',
    devCode: '开发验证码',
    verificationCode: '验证码',
    codePlaceholder: '6 位数字',
    verifying: '验证中...',
    verifyAndSignIn: '验证并登录',
    changeEmail: '更换邮箱',
    unknownError: '未知错误'
  },
  en: {
    productTitle: 'Eggturtle',
    productSubtitle: 'Data-driven breeding optimization for higher quality and faster decisions.',
    checkingSession: 'Checking session status...',
    modeLabel: 'Login mode',
    modePassword: 'Password',
    modeCode: 'Email code',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Enter your password',
    signingIn: 'Signing in...',
    signInButton: 'Sign in to Admin',
    sending: 'Sending...',
    requestCode: 'Request code',
    codeSentTo: 'Verification code sent to',
    devCode: 'Dev code',
    verificationCode: 'Verification code',
    codePlaceholder: '6-digit code',
    verifying: 'Verifying...',
    verifyAndSignIn: 'Verify and sign in',
    changeEmail: 'Change email',
    unknownError: 'Unknown error'
  }
};

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

      await apiRequest('/api/auth/password-login', {
        method: 'POST',
        body: payload,
        requestSchema: passwordLoginRequestSchema,
        responseSchema: meResponseSchema
      });

      router.replace(redirectTo);
    } catch (requestError) {
      setError(formatError(requestError, copy.unknownError));
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
      const response = await apiRequest('/api/auth/request-code', {
        method: 'POST',
        body: payload,
        requestSchema: requestCodeRequestSchema,
        responseSchema: requestCodeResponseSchema
      });

      setRequestedEmail(payload.email);
      setDevCode(response.devCode ?? null);
      setCode('');
    } catch (requestError) {
      setError(formatError(requestError, copy.unknownError));
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
        code
      });

      await apiRequest('/api/auth/verify-code', {
        method: 'POST',
        body: payload,
        requestSchema: verifyCodeRequestSchema,
        responseSchema: meResponseSchema
      });

      router.replace(redirectTo);
    } catch (requestError) {
      setError(formatError(requestError, copy.unknownError));
    } finally {
      setLoading(false);
    }
  }

  const isCodeRequest = mode === 'code' && !requestedEmail;
  const isCodeVerify = mode === 'code' && Boolean(requestedEmail);

  return (
    <main className="login-page">
      <section className="login-layout">
        <div className="login-spacer" aria-hidden="true" />

        <section className="stack login-right">
          <header className="stack login-brand">
            <h1 className="login-product-title">{copy.productTitle}</h1>
            <p className="login-product-subtitle">{copy.productSubtitle}</p>
          </header>

          <section className="card stack login-card" aria-live={checkingSession ? 'polite' : undefined}>
            <div className="login-card-preferences">
              <UiPreferenceControls className="login-preference-controls" />
            </div>

            {checkingSession ? <p className="muted login-session-hint">{copy.checkingSession}</p> : null}

            {!checkingSession ? (
              <>
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

                {error ? (
                  <p className="login-alert" role="alert">
                    {error}
                  </p>
                ) : null}

                {mode === 'password' ? (
                  <form className="stack login-panel" onSubmit={handlePasswordLogin}>
                    <div className="stack login-field">
                      <label htmlFor="email">{copy.emailLabel}</label>
                      <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        placeholder="you@eggturtle.local"
                        onChange={(event) => setEmail(event.target.value)}
                        required
                      />
                    </div>

                    <div className="stack login-field">
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
                    </div>

                    <button type="submit" disabled={loading}>
                      {loading ? copy.signingIn : copy.signInButton}
                    </button>
                  </form>
                ) : null}

                {isCodeRequest ? (
                  <form className="stack login-panel" onSubmit={handleRequestCode}>
                    <div className="stack login-field">
                      <label htmlFor="code-email">{copy.emailLabel}</label>
                      <input
                        id="code-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        placeholder="you@eggturtle.local"
                        onChange={(event) => setEmail(event.target.value)}
                        required
                      />
                    </div>

                    <button type="submit" disabled={loading}>
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
                        {copy.devCode}：<code>{devCode}</code>
                      </p>
                    ) : null}

                    <div className="stack login-field">
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
                    </div>

                    <div className="inline-actions login-inline-actions">
                      <button type="submit" disabled={loading}>
                        {loading ? copy.verifying : copy.verifyAndSignIn}
                      </button>
                      <button className="secondary" type="button" disabled={loading} onClick={resetCodeFlow}>
                        {copy.changeEmail}
                      </button>
                    </div>
                  </form>
                ) : null}
              </>
            ) : null}
          </section>
        </section>
      </section>
    </main>
  );
}

function formatError(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
