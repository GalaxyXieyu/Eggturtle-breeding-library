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

import { ApiError, apiRequest } from '../../lib/api-client';

type LoginMode = 'password' | 'code';

export default function LoginPage() {
  const router = useRouter();
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
      setError(formatError(requestError));
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="login-page">
        <section className="login-shell login-shell-loading">
          <section className="login-brand card stack login-admin-hero" aria-hidden="true">
            <h1 className="login-brand-title">蛋龟选育库</h1>
            <p className="login-brand-description">用数据驱动选育优化，沉淀谱系与性状，提升繁育决策效率。</p>
          </section>
          <section className="card stack login-card" aria-live="polite">
            <p className="login-eyebrow">SESSION CHECK</p>
            <h2 className="login-form-title">正在检查会话</h2>
            <p className="muted">如果已登录，将自动跳转到控制台。</p>
          </section>
        </section>
      </main>
    );
  }

  const isCodeRequest = mode === 'code' && !requestedEmail;
  const isCodeVerify = mode === 'code' && Boolean(requestedEmail);

  return (
    <main className="login-page">
      <section className="login-shell">
        <section className="login-brand card stack login-admin-hero">
          <h1 className="login-brand-title">蛋龟选育库</h1>
          <p className="login-brand-description">用数据驱动选育优化，沉淀谱系与性状，提升繁育决策效率。</p>
        </section>

        <section className="card stack login-card">
          <header className="stack login-card-head">
            <p className="login-eyebrow">SIGN IN</p>
            <h2>登录后台</h2>
            <p className="muted">请选择认证方式并完成验证。</p>
          </header>

          <div className="login-mode-toggle" role="tablist" aria-label="登录模式">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'password'}
              className={mode === 'password' ? 'login-mode-btn active' : 'login-mode-btn'}
              onClick={() => switchMode('password')}
            >
              账号密码
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'code'}
              className={mode === 'code' ? 'login-mode-btn active' : 'login-mode-btn'}
              onClick={() => switchMode('code')}
            >
              邮箱验证码
            </button>
          </div>

          {error ? (
            <p className="login-alert" role="alert">
              {error}
            </p>
          ) : null}

          {mode === 'password' ? (
            <form className="stack login-panel" onSubmit={handlePasswordLogin}>
              <div className="stack login-panel-head">
                <h3 className="login-form-title">账号密码登录</h3>
                <p className="muted">请输入管理员邮箱与密码。</p>
              </div>

              <div className="stack login-field">
                <label htmlFor="email">邮箱</label>
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
                <label htmlFor="password">密码</label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  placeholder="请输入密码"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>

              <button type="submit" disabled={loading}>
                {loading ? '登录中...' : '登录后台'}
              </button>
            </form>
          ) : null}

          {isCodeRequest ? (
            <form className="stack login-panel" onSubmit={handleRequestCode}>
              <div className="stack login-panel-head">
                <h3 className="login-form-title">发送验证码</h3>
                <p className="muted">输入邮箱后将发送 6 位验证码。</p>
              </div>

              <div className="stack login-field">
                <label htmlFor="code-email">邮箱</label>
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
                {loading ? '发送中...' : '获取验证码'}
              </button>
            </form>
          ) : null}

          {isCodeVerify ? (
            <form className="stack login-panel" onSubmit={handleVerifyCode}>
              <div className="stack login-panel-head">
                <h3 className="login-form-title">验证码登录</h3>
                <p className="muted">
                  已发送到：<strong>{requestedEmail}</strong>
                </p>
              </div>

              {devCode ? (
                <p className="login-dev-code">
                  开发验证码：<code>{devCode}</code>
                </p>
              ) : null}

              <div className="stack login-field">
                <label htmlFor="code">验证码</label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  placeholder="6 位数字"
                  onChange={(event) => setCode(event.target.value)}
                  required
                />
              </div>

              <div className="inline-actions login-inline-actions">
                <button type="submit" disabled={loading}>
                  {loading ? '验证中...' : '验证并登录'}
                </button>
                <button className="secondary" type="button" disabled={loading} onClick={resetCodeFlow}>
                  更换邮箱
                </button>
              </div>
            </form>
          ) : null}
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
