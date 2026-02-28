'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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

type LoginCopy = {
  title: string;
  subtitle: string;
  heroEyebrow: string;
  formTitle: string;
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
};

const COPY: Record<Locale, LoginCopy> = {
  zh: {
    title: '蛋龟选育库',
    subtitle: '用数据驱动选育优化，提升繁育决策效率。',
    heroEyebrow: 'Tenant Portal',
    formTitle: '登录租户端',
    showcaseItemAuth: '统一登录与会话管理',
    showcaseItemTenant: '多租户隔离与成员权限控制',
    showcaseItemWorkflow: '验证码 + 密码双模式',
    localeLabel: '语言',
    modeLabel: '登录模式',
    localeZh: '中文',
    localeEn: '英文',
    modePassword: '账号密码',
    modeCode: '邮箱验证码',
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
    setPasswordHint: '填写后将同步设置该账号的登录密码。'
  },
  en: {
    title: 'Eggturtle Breeding Library',
    subtitle: 'Data-driven breeding optimization for faster and more reliable decisions.',
    heroEyebrow: 'Tenant Portal',
    formTitle: 'Sign in to Workspace',
    showcaseItemAuth: 'Unified login and session handling',
    showcaseItemTenant: 'Tenant isolation with role-based control',
    showcaseItemWorkflow: 'Password + one-time code modes',
    localeLabel: 'Language',
    modeLabel: 'Login mode',
    localeZh: 'Chinese',
    localeEn: 'English',
    modePassword: 'Password',
    modeCode: 'Email Code',
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
    setPasswordHint: 'If provided, this will set your account password.'
  }
};

export default function LoginPage() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>('zh');
  const [mode, setMode] = useState<LoginMode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [requestedEmail, setRequestedEmail] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [registrationPassword, setRegistrationPassword] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
            <h2>{copy.formTitle}</h2>
          </div>
          <div className="login-form-stack">
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
                  value={email}
                  placeholder={copy.emailPlaceholder}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
                <label htmlFor="password">{copy.passwordLabel}</label>
                <input
                  id="password"
                  type="password"
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
