'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  requestCodeRequestSchema,
  requestCodeResponseSchema,
  verifyCodeRequestSchema,
  verifyCodeResponseSchema
} from '@eggturtle/shared/auth';

import { ApiError, apiRequest, getAccessToken, setAccessToken } from '../../lib/api-client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [requestedEmail, setRequestedEmail] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (getAccessToken()) {
      router.replace('/app');
    }
  }, [router]);

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
        code
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
    <main>
      <h1>Sign in</h1>
      <p>Use email verification code to sign in.</p>

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
          <div className="row">
            <button type="submit" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify code'}
            </button>
            <button
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
