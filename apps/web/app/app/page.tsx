'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { meResponseSchema, type MeResponse } from '@eggturtle/shared/auth';

import { ApiError, apiRequest, clearAccessToken, getAccessToken } from '../../lib/api-client';

type PageState = {
  error: string | null;
  loading: boolean;
  me: MeResponse | null;
};

export default function AppPage() {
  const router = useRouter();
  const [state, setState] = useState<PageState>({
    loading: true,
    me: null,
    error: null
  });

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    let isCancelled = false;

    async function loadMe() {
      try {
        const me = await apiRequest('/me', {
          responseSchema: meResponseSchema
        });

        if (!isCancelled) {
          setState({ loading: false, me, error: null });
        }
      } catch (error) {
        if (!isCancelled) {
          setState({ loading: false, me: null, error: formatError(error) });
        }
      }
    }

    void loadMe();

    return () => {
      isCancelled = true;
    };
  }, [router]);

  return (
    <main>
      <h1>Eggturtle Web v0</h1>
      <p>Signed-in user and current tenant context.</p>

      <section className="card stack">
        {state.loading ? <p>Loading /me ...</p> : null}

        {state.me ? (
          <>
            <p>
              <strong>User ID:</strong> {state.me.user.id}
            </p>
            <p>
              <strong>Email:</strong> {state.me.user.email}
            </p>
            <p>
              <strong>Name:</strong> {state.me.user.name ?? '(empty)'}
            </p>
            <p>
              <strong>tenantId:</strong> {state.me.tenantId ?? '(none)'}
            </p>
          </>
        ) : null}

        {state.error ? <p className="error">{state.error}</p> : null}

        <div className="row">
          <button type="button" onClick={() => router.push('/app/tenants')}>
            Manage tenants
          </button>
          <button
            type="button"
            onClick={() => {
              clearAccessToken();
              router.replace('/login');
            }}
          >
            Log out
          </button>
        </div>
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

  return 'Unknown error';
}
