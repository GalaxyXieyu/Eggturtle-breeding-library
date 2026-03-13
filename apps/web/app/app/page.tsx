'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useUiPreferences } from '@/components/ui-preferences';
import { ApiError, clearAccessToken, getAccessToken } from '@/lib/api-client';
import {
  normalizeShareSource,
  sanitizeInternalNext,
  type ShareSource,
} from '@/lib/post-auth-redirect';
import { resolveCurrentTenantSlug } from '@/lib/tenant-session';
import WorkspaceLoadingState from '@/components/ui/workspace-loading-state';

type PageState = {
  error: string | null;
  loading: boolean;
};

type AppIntent = 'dashboard' | 'account' | 'subscription';

const TENANT_ENTRY_MESSAGES = {
  zh: {
    title: '正在进入工作台',
    subtitle: '正在解析用户上下文。',
    loading: '正在进入工作台…',
    loadingDetail: '正在同步用户权限与工作台配置，通常只需几秒。',
    noTenantContext: '当前账号未绑定用户，请重新登录后重试。',
    retryLogin: '重新登录',
    backToLogin: '返回登录',
    unknownError: '未知错误'
  },
  en: {
    title: 'Entering Workspace',
    subtitle: 'Resolving tenant context.',
    loading: 'Opening workspace…',
    loadingDetail: 'Syncing tenant permissions and workspace settings. This should only take a few seconds.',
    noTenantContext: 'No tenant is bound to this account. Please sign in again.',
    retryLogin: 'Sign in again',
    backToLogin: 'Back to login',
    unknownError: 'Unknown error'
  }
} as const;

export default function AppEntryPage() {
  const router = useRouter();
  const { locale } = useUiPreferences();
  const messages = TENANT_ENTRY_MESSAGES[locale];
  const [state, setState] = useState<PageState>({
    loading: true,
    error: null
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const source = normalizeShareSource(params.get('source'));

    if (!getAccessToken()) {
      const nextPath = `${window.location.pathname}${window.location.search}`;
      const loginUrl = new URL('/login', window.location.origin);
      if (source === 'share') {
        loginUrl.searchParams.set('source', 'share');
      }
      loginUrl.searchParams.set('next', nextPath);
      router.replace(`${loginUrl.pathname}?${loginUrl.searchParams.toString()}`);
      return;
    }

    let isCancelled = false;

    async function resolveRoute() {
      try {
        const safeNext = sanitizeInternalNext(params.get('next'));
        if (safeNext) {
          router.replace(safeNext);
          return;
        }

        const intent = normalizeAppIntent(params.get('intent'));
        const tenantSlug = await resolveCurrentTenantSlug();
        if (!tenantSlug) {
          if (!isCancelled) {
            clearAccessToken();
            const loginUrl = new URL('/login', window.location.origin);
            if (source === 'share') {
              loginUrl.searchParams.set('source', 'share');
            }
            loginUrl.searchParams.set('next', `${window.location.pathname}${window.location.search}`);
            router.replace(`${loginUrl.pathname}?${loginUrl.searchParams.toString()}`);
          }
          return;
        }

        const nextPath = resolveTenantIntentPath(tenantSlug, intent, source);

        if (!isCancelled) {
          router.replace(nextPath);
        }
      } catch (error) {
        if (!isCancelled) {
          setState({ loading: false, error: formatError(error, messages.unknownError) });
        }
      }
    }

    void resolveRoute();

    return () => {
      isCancelled = true;
    };
  }, [messages.noTenantContext, messages.unknownError, router]);

  if (state.loading) {
    return (
      <main className="pb-16 sm:pb-8">
        <WorkspaceLoadingState
          eyebrow="Workspace"
          title={messages.title}
          detail={messages.loadingDetail}
          status={messages.loading}
        />
      </main>
    );
  }

  return (
    <main className="space-y-4 pb-16 sm:pb-8">
      <section className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-[35rem] items-center justify-center">
        <div className="w-full rounded-[2rem] border border-red-200/80 bg-white p-6 shadow-[0_24px_80px_rgba(28,25,23,0.08)] sm:p-7">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-stone-400">Workspace</p>
            <h1 className="text-2xl font-semibold tracking-tight text-stone-950 sm:text-3xl">{messages.title}</h1>
            <p className="text-sm leading-6 text-stone-500">{messages.subtitle}</p>
          </div>

          {state.error ? (
            <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {state.error}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
              onClick={() => {
                clearAccessToken();
                router.push('/login');
              }}
            >
              {messages.retryLogin}
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-neutral-300 bg-white px-5 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50"
              onClick={() => router.push('/login')}
            >
              {messages.backToLogin}
            </button>
          </div>
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
