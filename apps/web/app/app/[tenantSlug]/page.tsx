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
  const [productIdInput, setProductIdInput] = useState('');

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
    <main className="workspace-shell">
      <header className="workspace-head">
        <div className="stack">
          <h1>租户工作台</h1>
          <p className="muted">
            当前租户：<strong>{tenantSlug || '(none)'}</strong>
          </p>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            clearAccessToken();
            router.replace('/login');
          }}
        >
          退出登录
        </button>
      </header>

      <section className="card panel stack">
        {state.loading ? <p className="notice notice-info">正在加载账号信息...</p> : null}
        {state.error ? <p className="notice notice-error">{state.error}</p> : null}

        {state.me ? (
          <div className="kv-grid">
            <p>
              <span className="muted">用户 ID</span>
              <strong>{state.me.user.id}</strong>
            </p>
            <p>
              <span className="muted">邮箱</span>
              <strong>{state.me.user.email}</strong>
            </p>
            <p>
              <span className="muted">姓名</span>
              <strong>{state.me.user.name ?? '(empty)'}</strong>
            </p>
            <p>
              <span className="muted">租户 ID</span>
              <strong>{state.me.tenantId ?? '(none)'}</strong>
            </p>
          </div>
        ) : null}
      </section>

      <section className="card panel stack">
        <h2>快捷入口</h2>
        <div className="action-grid">
          <button type="button" onClick={() => router.push(`/app/${tenantSlug}/series`)}>
            系列管理
          </button>
          <button type="button" onClick={() => router.push(`/app/${tenantSlug}/breeders`)}>
            种龟管理
          </button>
          <button type="button" onClick={() => router.push(`/app/${tenantSlug}/products`)}>
            产品管理
          </button>
          <button type="button" onClick={() => router.push(`/app/${tenantSlug}/featured-products`)}>
            推荐产品
          </button>
          <button type="button" onClick={() => router.push(`/app/${tenantSlug}/tenants`)}>
            租户成员
          </button>
        </div>
        <div className="row">
          <input
            type="text"
            value={productIdInput}
            onChange={(event) => setProductIdInput(event.target.value)}
            placeholder="输入 Product ID 直达图片管理（可选）"
          />
          <button
            type="button"
            disabled={!productIdInput.trim()}
            onClick={() => router.push(`/app/${tenantSlug}/products/${productIdInput.trim()}`)}
          >
            直达图片页
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

  return '未知错误';
}
