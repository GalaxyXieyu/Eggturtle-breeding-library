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
    <main className="workspace-shell">
      <header className="workspace-head">
        <div className="stack">
          <h1>正在进入工作台</h1>
          <p className="muted">正在解析租户上下文。</p>
        </div>
      </header>

      <section className="card panel stack">
        {state.loading ? <p className="notice notice-info">正在解析租户信息...</p> : null}
        {state.error ? <p className="notice notice-error">{state.error}</p> : null}

        {!state.loading && state.error ? (
          <div className="row">
            <button type="button" onClick={() => router.push('/tenant-select')}>
              打开租户选择
            </button>
            <button type="button" className="secondary" onClick={() => router.push('/login')}>
              返回登录
            </button>
          </div>
        ) : null}
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
