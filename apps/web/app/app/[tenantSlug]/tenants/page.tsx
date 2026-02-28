'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  createTenantRequestSchema,
  createTenantResponseSchema,
  myTenantsResponseSchema,
  type TenantMembership
} from '@eggturtle/shared/tenant';

import { ApiError, apiRequest, getAccessToken } from '../../../../lib/api-client';
import { switchTenantBySlug } from '../../../../lib/tenant-session';

export default function TenantManagementPage() {
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = useMemo(() => params.tenantSlug ?? '', [params.tenantSlug]);
  const [tenants, setTenants] = useState<TenantMembership[]>([]);
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [switchingSlug, setSwitchingSlug] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTenants = useCallback(async () => {
    try {
      const response = await apiRequest('/tenants/me', {
        responseSchema: myTenantsResponseSchema
      });

      setTenants(response.tenants);
      setError(null);
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }

    if (!tenantSlug) {
      setError('Missing tenantSlug in route.');
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        await switchTenantBySlug(tenantSlug);
      } catch (requestError) {
        setError(formatError(requestError));
        setLoading(false);
        return;
      }

      await loadTenants();
    })();
  }, [loadTenants, router, tenantSlug]);

  async function handleCreateTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const payload = createTenantRequestSchema.parse({
        slug,
        name
      });

      const response = await apiRequest('/tenants', {
        method: 'POST',
        body: payload,
        requestSchema: createTenantRequestSchema,
        responseSchema: createTenantResponseSchema
      });

      setMessage(`Created tenant ${response.tenant.slug}`);
      setSlug('');
      setName('');
      setLoading(true);
      await loadTenants();
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function handleSwitchTenant(targetSlug: string) {
    setSwitchingSlug(targetSlug);
    setMessage(null);
    setError(null);

    try {
      const response = await switchTenantBySlug(targetSlug);
      router.push(`/app/${response.tenant.slug}`);
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setSwitchingSlug(null);
    }
  }

  return (
    <main className="workspace-shell">
      <header className="workspace-head">
        <div className="stack">
          <h1>租户管理</h1>
          <p className="muted">当前路由租户：{tenantSlug || '(unknown)'}</p>
        </div>
        <button type="button" className="secondary" onClick={() => router.push(`/app/${tenantSlug}`)}>
          返回工作台
        </button>
      </header>

      <section className="card panel stack">
        <div className="row between">
          <h2>我的租户</h2>
          {!loading ? <p className="muted">共 {tenants.length} 个</p> : null}
        </div>
        {loading ? <p className="notice notice-info">正在加载租户信息...</p> : null}
        {!loading && tenants.length === 0 ? <p className="notice notice-warning">当前账号还没有租户。</p> : null}

        {!loading && tenants.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Slug</th>
                  <th>名称</th>
                  <th>角色</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((membership) => (
                  <tr key={membership.tenant.id}>
                    <td>
                      <strong>{membership.tenant.slug}</strong>
                    </td>
                    <td>{membership.tenant.name}</td>
                    <td>{membership.role}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-compact"
                        disabled={switchingSlug === membership.tenant.slug}
                        onClick={() => {
                          void handleSwitchTenant(membership.tenant.slug);
                        }}
                      >
                        {switchingSlug === membership.tenant.slug ? '切换中...' : '切换'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <form className="card panel stack" onSubmit={handleCreateTenant}>
        <h2>创建新租户</h2>
        <div className="form-grid form-grid-2">
          <div className="stack">
            <label htmlFor="tenant-slug">Slug</label>
            <input
              id="tenant-slug"
              type="text"
              value={slug}
              placeholder="my-first-tenant"
              onChange={(event) => setSlug(event.target.value)}
              required
            />
          </div>

          <div className="stack">
            <label htmlFor="tenant-name">名称</label>
            <input
              id="tenant-name"
              type="text"
              value={name}
              placeholder="My First Tenant"
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
        </div>

        <div className="row">
          <button type="submit" disabled={saving}>
            {saving ? '创建中...' : '创建租户'}
          </button>
        </div>
      </form>

      {message ? <p className="notice notice-success">{message}</p> : null}
      {error ? <p className="notice notice-error">{error}</p> : null}
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
