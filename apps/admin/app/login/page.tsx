'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  meResponseSchema,
  requestCodeRequestSchema,
  requestCodeResponseSchema,
  verifyCodeRequestSchema
} from '@eggturtle/shared';

import { ApiError, apiRequest } from '../../lib/api-client';

export default function LoginPage() {
  const router = useRouter();
  const [redirectTo, setRedirectTo] = useState('/dashboard');

  const [email, setEmail] = useState('');
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
        // No active session; keep the user on login page.
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
      <main className="login-wrap">
        <div className="card stack">
          <h1>Super Admin Sign In</h1>
          <p className="muted">Checking active session...</p>
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

function formatError(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
}
