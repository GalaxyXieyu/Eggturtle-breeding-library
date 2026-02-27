'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, getAccessToken } from '../../lib/api-client';
import { resolveCurrentTenantSlug } from '../../lib/tenant-session';

type PageState = {
  error: string | null;
  loading: boolean;
};

export default function AppEntryPage() {
  const router = useRouter();
  const [state, setState] = useState<PageState>({
    loading: true,
    error: null
  });

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }

    let isCancelled = false;

    async function resolveRoute() {
      try {
        const tenantSlug = await resolveCurrentTenantSlug();
        const nextPath = tenantSlug ? `/app/${tenantSlug}` : '/tenant-select';

        if (!isCancelled) {
          router.replace(nextPath);
        }
      } catch (error) {
        if (!isCancelled) {
          setState({ loading: false, error: formatError(error) });
        }
      }
    }

    void resolveRoute();

    return () => {
      isCancelled = true;
    };
  }, [router]);

  return (
    <main>
      <h1>Loading workspace</h1>
      {state.loading ? <p>Resolving tenant context...</p> : null}
      {state.error ? <p className="error">{state.error}</p> : null}

      {!state.loading && state.error ? (
        <div className="row">
          <button type="button" onClick={() => router.push('/tenant-select')}>
            Open tenant selector
          </button>
          <button type="button" onClick={() => router.push('/login')}>
            Back to login
          </button>
        </div>
      ) : null}
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
