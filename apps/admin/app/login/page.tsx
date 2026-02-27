'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authUserSchema, requestCodeRequestSchema, requestCodeResponseSchema, verifyCodeRequestSchema } from '@eggturtle/shared/auth';

type VerifyCodeRouteResponse = {
  ok: true;
  user: unknown;
};

type SessionRouteResponse = {
  authenticated: true;
  user: unknown;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [requestedEmail, setRequestedEmail] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const response = await requestJson('/api/auth/session', {
          method: 'GET'
        });

        const parsed = parseSessionResponse(response);

        if (!cancelled && parsed.authenticated) {
          router.replace('/dashboard');
          return;
        }
      } catch {
        // Ignore 401 and keep the user on login page.
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
  }, [router]);

  async function handleRequestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = requestCodeRequestSchema.parse({ email });
      const response = await requestJson('/api/auth/request-code', {
        method: 'POST',
        body: payload
      });
      const parsed = requestCodeResponseSchema.parse(response);

      setRequestedEmail(payload.email);
      setDevCode(parsed.devCode ?? null);
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

      const response = await requestJson('/api/auth/verify-code', {
        method: 'POST',
        body: payload
      });
      const parsed = parseVerifyResponse(response);

      authUserSchema.parse(parsed.user);
      router.replace('/dashboard');
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="login-wrap">
        <div className="card stack">
          <h1>Super Admin Sign In</h1>
          <p className="muted">Checking session...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="login-wrap">
      <div className="card stack">
        <h1>Super Admin Sign In</h1>
        <p className="muted">Use email verification code to enter `/dashboard`.</p>
      </div>

      {!requestedEmail ? (
        <form className="card stack" onSubmit={handleRequestCode}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            placeholder="you@eggturtle.local"
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Request code'}
          </button>
        </form>
      ) : (
        <form className="card stack" onSubmit={handleVerifyCode}>
          <p>
            Code sent to: <strong>{requestedEmail}</strong>
          </p>
          {devCode ? (
            <p>
              Dev code: <code>{devCode}</code>
            </p>
          ) : null}
          <label htmlFor="code">Verification code</label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            placeholder="6-digit code"
            onChange={(event) => setCode(event.target.value)}
            required
          />
          <div className="inline-actions">
            <button type="submit" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify code'}
            </button>
            <button
              className="secondary"
              type="button"
              disabled={loading}
              onClick={() => {
                setRequestedEmail(null);
                setDevCode(null);
                setCode('');
              }}
            >
              Change email
            </button>
          </div>
        </form>
      )}

      {error ? <p className="error">{error}</p> : null}
    </main>
  );
}

function parseVerifyResponse(value: unknown): VerifyCodeRouteResponse {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid verify response payload.');
  }

  if (!('ok' in value) || value.ok !== true || !('user' in value)) {
    throw new Error('Invalid verify response payload.');
  }

  return value as VerifyCodeRouteResponse;
}

function parseSessionResponse(value: unknown): SessionRouteResponse {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid session response payload.');
  }

  if (!('authenticated' in value) || value.authenticated !== true || !('user' in value)) {
    throw new Error('Invalid session response payload.');
  }

  return value as SessionRouteResponse;
}

async function requestJson(path: string, options: { method: 'GET' | 'POST'; body?: unknown }) {
  const response = await fetch(path, {
    method: options.method,
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store'
  });

  const payload = await parseJsonBody(response);

  if (!response.ok) {
    throw new Error(pickErrorMessage(payload, `Request failed with status ${response.status}`));
  }

  return payload;
}

async function parseJsonBody(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

function pickErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  if ('message' in payload && typeof payload.message === 'string') {
    return payload.message;
  }

  if ('error' in payload && typeof payload.error === 'string') {
    return payload.error;
  }

  return fallback;
}

function formatError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
}
