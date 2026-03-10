'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  getAdminTenantBrandingResponseSchema,
  listAdminTenantsResponseSchema,
  updateAdminTenantBrandingRequestSchema,
  updateAdminTenantBrandingResponseSchema,
  type AdminTenant,
  type TenantBrandingOverride,
} from '@eggturtle/shared';

import { AdminBadge, AdminPageHeader, AdminPanel } from '@/components/dashboard/polish-primitives';
import { apiRequest } from '@/lib/api-client';
import { formatUnknownError } from '@/lib/formatters';

const EMPTY_FORM: TenantBrandingOverride = {
  displayName: null,
  publicTitle: null,
  publicSubtitle: null,
};

export default function DashboardTenantBrandingPage() {
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [tenantSearch, setTenantSearch] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [loadingBranding, setLoadingBranding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<TenantBrandingOverride>(EMPTY_FORM);
  const [resolvedPreview, setResolvedPreview] = useState({
    displayName: '',
    publicTitle: '',
    publicSubtitle: '',
  });
  const [selectedTenantMeta, setSelectedTenantMeta] = useState<{
    id: string;
    slug: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await apiRequest('/admin/tenants', {
          responseSchema: listAdminTenantsResponseSchema,
        });

        if (!cancelled) {
          setTenants(response.tenants);
          setSelectedTenantId((current) => current || response.tenants[0]?.id || '');
        }
      } catch (currentError) {
        if (!cancelled) {
          setError(formatUnknownError(currentError));
        }
      } finally {
        if (!cancelled) {
          setLoadingTenants(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredTenants = useMemo(() => {
    const keyword = tenantSearch.trim().toLowerCase();
    if (!keyword) {
      return tenants;
    }

    return tenants.filter((tenant) =>
      [tenant.name, tenant.slug, tenant.owner?.email ?? '', tenant.owner?.name ?? '']
        .join(' ')
        .toLowerCase()
        .includes(keyword),
    );
  }, [tenantSearch, tenants]);

  useEffect(() => {
    if (!selectedTenantId) {
      return;
    }

    let cancelled = false;
    setLoadingBranding(true);
    setError(null);
    setSuccess(null);

    void (async () => {
      try {
        const response = await apiRequest(`/admin/branding/tenants/${selectedTenantId}`, {
          responseSchema: getAdminTenantBrandingResponseSchema,
        });

        if (!cancelled) {
          setForm(response.branding);
          setResolvedPreview(response.resolved);
          setSelectedTenantMeta(response.tenant);
        }
      } catch (currentError) {
        if (!cancelled) {
          setError(formatUnknownError(currentError));
          setForm(EMPTY_FORM);
          setResolvedPreview({
            displayName: '',
            publicTitle: '',
            publicSubtitle: '',
          });
          setSelectedTenantMeta(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingBranding(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedTenantId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTenantId) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await apiRequest(`/admin/branding/tenants/${selectedTenantId}`, {
        method: 'PUT',
        body: {
          branding: form,
        },
        requestSchema: updateAdminTenantBrandingRequestSchema,
        responseSchema: updateAdminTenantBrandingResponseSchema,
      });

      setForm(response.branding);
      setResolvedPreview(response.resolved);
      setSelectedTenantMeta(response.tenant);
      setSuccess('租户品牌已保存，公开页默认标题立即按新配置生效。');
    } catch (currentError) {
      setError(formatUnknownError(currentError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page admin-page settings-page">
      <AdminPageHeader
        eyebrow="租户品牌"
        title="租户品牌"
        description="为具体租户覆盖展示名和公开图鉴默认标题，留空时继续继承平台品牌规则。"
        actions={<AdminBadge tone="info">超管统一维护</AdminBadge>}
      />

      <div className="tenant-branding-layout">
        <AdminPanel className="stack">
          <div className="admin-section-head">
            <h3>选择租户</h3>
            <p>先选中租户，再编辑品牌覆盖字段。</p>
          </div>

          <div className="settings-form-field">
            <label htmlFor="tenant-branding-search">搜索</label>
            <input
              id="tenant-branding-search"
              value={tenantSearch}
              onChange={(event) => setTenantSearch(event.target.value)}
              placeholder="搜索租户名 / slug / owner"
            />
          </div>

          <div className="tenant-branding-list">
            {loadingTenants ? (
              <p className="muted">正在加载租户…</p>
            ) : filteredTenants.length === 0 ? (
              <p className="muted">没有匹配租户。</p>
            ) : (
              filteredTenants.map((tenant) => {
                const active = tenant.id === selectedTenantId;

                return (
                  <button
                    key={tenant.id}
                    type="button"
                    data-ui="button"
                    className={`tenant-branding-item${active ? ' active' : ''}`}
                    onClick={() => setSelectedTenantId(tenant.id)}
                  >
                    <strong>{tenant.name}</strong>
                    <span>{tenant.slug}</span>
                  </button>
                );
              })
            )}
          </div>
        </AdminPanel>

        <AdminPanel className="stack">
          <div className="admin-section-head">
            <h3>编辑覆盖</h3>
            <p>为空时回退到平台品牌默认规则。</p>
          </div>

          {selectedTenantMeta ? (
            <div className="settings-preview-list compact">
              <div>
                <span>当前租户</span>
                <strong>{selectedTenantMeta.name}</strong>
                <small>{selectedTenantMeta.slug}</small>
              </div>
              <div>
                <span>解析后展示名</span>
                <strong>{resolvedPreview.displayName || '—'}</strong>
                <small>公开页与租户默认展示共用</small>
              </div>
            </div>
          ) : null}

          {error ? <p className="settings-inline-note error">{error}</p> : null}
          {success ? <p className="settings-inline-note success">{success}</p> : null}

          <form className="stack" onSubmit={handleSubmit}>
            <div className="settings-form-field">
              <label htmlFor="tenant-display-name">覆盖展示名</label>
              <input
                id="tenant-display-name"
                disabled={loadingBranding || saving || !selectedTenantId}
                value={form.displayName ?? ''}
                placeholder="例如：XX 选育工作室"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    displayName: normalizeNullableValue(event.target.value),
                  }))
                }
              />
            </div>

            <div className="settings-form-field">
              <label htmlFor="tenant-public-title">公开图鉴标题</label>
              <input
                id="tenant-public-title"
                disabled={loadingBranding || saving || !selectedTenantId}
                value={form.publicTitle ?? ''}
                placeholder="留空则自动拼接租户名和平台后缀"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    publicTitle: normalizeNullableValue(event.target.value),
                  }))
                }
              />
            </div>

            <div className="settings-form-field">
              <label htmlFor="tenant-public-subtitle">公开图鉴副标题</label>
              <textarea
                id="tenant-public-subtitle"
                rows={3}
                disabled={loadingBranding || saving || !selectedTenantId}
                value={form.publicSubtitle ?? ''}
                placeholder="留空则按平台默认规则生成"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    publicSubtitle: normalizeNullableValue(event.target.value),
                  }))
                }
              />
            </div>

            <div className="settings-preview-list compact">
              <div>
                <span>解析后公开标题</span>
                <strong>{resolvedPreview.publicTitle || '—'}</strong>
              </div>
              <div>
                <span>解析后公开副标题</span>
                <small>{resolvedPreview.publicSubtitle || '—'}</small>
              </div>
            </div>

            <div className="settings-form-actions">
              <button type="submit" disabled={loadingBranding || saving || !selectedTenantId}>
                {saving ? '保存中…' : '保存租户品牌'}
              </button>
            </div>
          </form>
        </AdminPanel>
      </div>
    </section>
  );
}

function normalizeNullableValue(value: string) {
  const normalized = value.trim();
  return normalized ? normalized : null;
}
