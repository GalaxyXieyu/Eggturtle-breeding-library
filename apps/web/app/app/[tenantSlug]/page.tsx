'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { meResponseSchema, type MeResponse } from '@eggturtle/shared';

import {
  ApiError,
  apiRequest,
  clearAccessToken,
  getAccessToken
} from '../../../lib/api-client';
import { switchTenantBySlug } from '../../../lib/tenant-session';

type PageState = {
  error: string | null;
  loading: boolean;
  me: MeResponse | null;
};

export default function TenantAppPage() {
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = useMemo(() => params.tenantSlug ?? '', [params.tenantSlug]);
  const [state, setState] = useState<PageState>({
    loading: true,
    me: null,
    error: null
  });

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }

    if (!tenantSlug) {
      setState({ loading: false, me: null, error: 'Missing tenantSlug in route.' });
      return;
    }

    let isCancelled = false;

    async function loadMe() {
      try {
        await switchTenantBySlug(tenantSlug);

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
  }, [router, tenantSlug]);

  return (
    <main>
      <h1>Eggturtle Web v0</h1>
      <p>Tenant-scoped dashboard.</p>

      <section className="card stack">
        <p>
          <strong>tenantSlug:</strong> {tenantSlug || '(none)'}
        </p>

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
          <button type="button" onClick={() => router.push(`/app/${tenantSlug}/featured-products`)}>
            Featured products
          </button>
          <button type="button" onClick={() => router.push(`/app/${tenantSlug}/tenants`)}>
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
