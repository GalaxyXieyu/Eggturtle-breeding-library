'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useUiPreferences } from '../../components/ui-preferences';
import { ApiError, getAccessToken } from '../../lib/api-client';
import { resolveCurrentTenantSlug } from '../../lib/tenant-session';

type PageState = {
  error: string | null;
  loading: boolean;
};

const COPY = {
  zh: {
    title: '正在进入工作台',
    subtitle: '正在解析租户上下文。',
    loading: '正在解析租户信息...',
    openTenantSelect: '打开租户选择',
    backToLogin: '返回登录',
    unknownError: '未知错误'
  },
  en: {
    title: 'Entering Workspace',
    subtitle: 'Resolving tenant context.',
    loading: 'Resolving tenant information...',
    openTenantSelect: 'Open tenant selector',
    backToLogin: 'Back to login',
    unknownError: 'Unknown error'
  }
} as const;

export default function AppEntryPage() {
  const router = useRouter();
  const { locale } = useUiPreferences();
  const copy = COPY[locale];
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
          setState({ loading: false, error: formatError(error, copy.unknownError) });
        }
      }
    }

    void resolveRoute();

    return () => {
      isCancelled = true;
    };
  }, [copy.unknownError, router]);

  return (
    <main className="workspace-shell">
      <header className="workspace-head">
        <div className="stack">
          <h1>{copy.title}</h1>
          <p className="muted">{copy.subtitle}</p>
        </div>
      </header>

      <section className="card panel stack">
        {state.loading ? <p className="notice notice-info">{copy.loading}</p> : null}
        {state.error ? <p className="notice notice-error">{state.error}</p> : null}

        {!state.loading && state.error ? (
          <div className="row">
            <button type="button" onClick={() => router.push('/tenant-select')}>
              {copy.openTenantSelect}
            </button>
            <button type="button" className="secondary" onClick={() => router.push('/login')}>
              {copy.backToLogin}
            </button>
          </div>
        ) : null}
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
