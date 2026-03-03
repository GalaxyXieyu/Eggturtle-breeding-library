'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useUiPreferences } from '../../components/ui-preferences';
import { ApiError, clearAccessToken, getAccessToken } from '../../lib/api-client';
import {
  normalizeShareSource,
  sanitizeInternalNext,
  type ShareSource,
} from '../../lib/post-auth-redirect';
import { resolveCurrentTenantSlug } from '../../lib/tenant-session';

type PageState = {
  error: string | null;
  loading: boolean;
};

type AppIntent = 'dashboard' | 'account' | 'subscription';

const COPY = {
  zh: {
    title: '正在进入工作台',
    subtitle: '正在解析租户上下文。',
    loading: '正在解析租户信息...',
    loadingDetail: '正在同步租户权限与工作台配置，通常只需几秒。',
    loadingStage: '连接工作台服务',
    noTenantContext: '当前账号未绑定租户，请重新登录后重试。',
    retryLogin: '重新登录',
    backToLogin: '返回登录',
    unknownError: '未知错误'
  },
  en: {
    title: 'Entering Workspace',
    subtitle: 'Resolving tenant context.',
    loading: 'Resolving tenant information...',
    loadingDetail: 'Syncing tenant permissions and workspace settings. This should only take a few seconds.',
    loadingStage: 'Connecting workspace services',
    noTenantContext: 'No tenant is bound to this account. Please sign in again.',
    retryLogin: 'Sign in again',
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
        const params = new URLSearchParams(window.location.search);
        const safeNext = sanitizeInternalNext(params.get('next'));
        if (safeNext) {
          router.replace(safeNext);
          return;
        }

        const source = normalizeShareSource(params.get('source'));
        const intent = normalizeAppIntent(params.get('intent'));
        const tenantSlug = await resolveCurrentTenantSlug();
        if (!tenantSlug) {
          if (!isCancelled) {
            setState({
              loading: false,
              error: copy.noTenantContext
            });
          }
          return;
        }

        const nextPath = resolveTenantIntentPath(tenantSlug, intent, source);

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
  }, [copy.noTenantContext, copy.unknownError, router]);

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
              <button
                type="button"
                onClick={() => {
                  clearAccessToken();
                  router.push('/login');
                }}
              >
                {copy.retryLogin}
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

function normalizeAppIntent(value: string | null): AppIntent {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'account') {
    return 'account';
  }
  if (normalized === 'subscription') {
    return 'subscription';
  }
  return 'dashboard';
}

function resolveTenantIntentPath(tenantSlug: string, intent: AppIntent, source: ShareSource): string {
  if (source === 'share' && intent === 'dashboard') {
    return `/app/${tenantSlug}`;
  }

  if (intent === 'account') {
    return `/app/${tenantSlug}/account`;
  }

  if (intent === 'subscription') {
    return `/app/${tenantSlug}/subscription`;
  }

  return `/app/${tenantSlug}`;
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
