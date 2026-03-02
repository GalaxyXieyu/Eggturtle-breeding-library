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
    loadingDetail: '正在同步租户权限与工作台配置，通常只需几秒。',
    loadingStage: '连接工作台服务',
    openTenantSelect: '打开租户选择',
    backToLogin: '返回登录',
    unknownError: '未知错误'
  },
  en: {
    title: 'Entering Workspace',
    subtitle: 'Resolving tenant context.',
    loading: 'Resolving tenant information...',
    loadingDetail: 'Syncing tenant permissions and workspace settings. This should only take a few seconds.',
    loadingStage: 'Connecting workspace services',
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
    <main className="workspace-shell tenant-entry-shell">
      <section className="tenant-entry-stage">
        <div className="tenant-entry-glow" aria-hidden />

        <div className="card panel stack tenant-entry-card" aria-live="polite">
          <header className="stack tenant-entry-header">
            <h1>{copy.title}</h1>
            <p className="muted">{state.loading ? copy.loadingDetail : copy.subtitle}</p>
          </header>

          {state.loading ? (
            <div className="tenant-entry-loading stack" role="status">
              <div className="tenant-entry-status">
                <span className="tenant-entry-ping" aria-hidden />
                <span>{copy.loading}</span>
              </div>
              <div className="tenant-entry-progress" aria-hidden>
                <span />
              </div>
              <p className="tenant-entry-stage-label">{copy.loadingStage}</p>
            </div>
          ) : null}

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
        </div>
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
