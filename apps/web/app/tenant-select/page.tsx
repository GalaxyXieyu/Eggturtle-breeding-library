'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createTenantRequestSchema,
  createTenantResponseSchema,
  myTenantsResponseSchema,
  type TenantMembership
} from '@eggturtle/shared/tenant';

import { useUiPreferences } from '../../components/ui-preferences';
import { ApiError, apiRequest, getAccessToken } from '../../lib/api-client';
import { switchTenantBySlug } from '../../lib/tenant-session';

const COPY = {
  zh: {
    title: '选择租户',
    subtitle: '请选择要进入的租户。',
    backToEntry: '返回入口',
    myTenants: '我的租户',
    tenantCount: '共 {count} 个',
    loadingTenants: '正在加载租户列表...',
    noTenant: '当前账号还没有租户。',
    columnSlug: 'Slug',
    columnName: '名称',
    columnRole: '角色',
    columnAction: '操作',
    switching: '切换中...',
    enter: '进入',
    createTenant: '创建租户',
    tenantName: '名称',
    creating: '创建中...',
    createAction: '创建租户',
    createdMessage: '已创建租户 {slug}',
    unknownError: '未知错误'
  },
  en: {
    title: 'Select Tenant',
    subtitle: 'Choose a tenant workspace to continue.',
    backToEntry: 'Back to entry',
    myTenants: 'My Tenants',
    tenantCount: '{count} total',
    loadingTenants: 'Loading tenant list...',
    noTenant: 'No tenant found for current account.',
    columnSlug: 'Slug',
    columnName: 'Name',
    columnRole: 'Role',
    columnAction: 'Action',
    switching: 'Switching...',
    enter: 'Enter',
    createTenant: 'Create Tenant',
    tenantName: 'Name',
    creating: 'Creating...',
    createAction: 'Create Tenant',
    createdMessage: 'Created tenant {slug}',
    unknownError: 'Unknown error'
  }
} as const;

function formatTemplate(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''));
}

export default function TenantSelectPage() {
  const router = useRouter();
  const { locale } = useUiPreferences();
  const copy = COPY[locale];

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
      setError(formatError(requestError, copy.unknownError));
    } finally {
      setLoading(false);
    }
  }, [copy.unknownError]);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }

    void loadTenants();
  }, [loadTenants, router]);

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

      setMessage(formatTemplate(copy.createdMessage, { slug: response.tenant.slug }));
      setSlug('');
      setName('');
      setLoading(true);
      await loadTenants();
    } catch (requestError) {
      setError(formatError(requestError, copy.unknownError));
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
      setError(formatError(requestError, copy.unknownError));
    } finally {
      setSwitchingSlug(null);
    }
  }

  return (
    <main className="workspace-shell">
      <header className="workspace-head">
        <div className="stack">
          <h1>{copy.title}</h1>
          <p className="muted">{copy.subtitle}</p>
        </div>
        <button type="button" className="secondary" onClick={() => router.push('/app')}>
          {copy.backToEntry}
        </button>
      </header>

      <section className="card panel stack">
        <div className="row between">
          <h2>{copy.myTenants}</h2>
          {!loading ? <p className="muted">{formatTemplate(copy.tenantCount, { count: tenants.length })}</p> : null}
        </div>

        {loading ? <p className="notice notice-info">{copy.loadingTenants}</p> : null}
        {!loading && tenants.length === 0 ? <p className="notice notice-warning">{copy.noTenant}</p> : null}

        {!loading && tenants.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{copy.columnSlug}</th>
                  <th>{copy.columnName}</th>
                  <th>{copy.columnRole}</th>
                  <th>{copy.columnAction}</th>
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
                        {switchingSlug === membership.tenant.slug ? copy.switching : copy.enter}
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
        <h2>{copy.createTenant}</h2>
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
            <label htmlFor="tenant-name">{copy.tenantName}</label>
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
            {saving ? copy.creating : copy.createAction}
          </button>
        </div>
      </form>

      {message ? <p className="notice notice-success">{message}</p> : null}
      {error ? <p className="notice notice-error">{error}</p> : null}
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
