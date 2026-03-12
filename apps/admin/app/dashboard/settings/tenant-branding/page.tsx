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
import { useUiPreferences } from '@/components/ui-preferences';
import { apiRequest } from '@/lib/api-client';
import { formatUnknownError } from '@/lib/formatters';
import { TENANT_BRANDING_MESSAGES } from '@/lib/locales/settings-pages';

const EMPTY_FORM: TenantBrandingOverride = {
  displayName: null,
  publicTitle: null,
  publicSubtitle: null,
};

export default function DashboardTenantBrandingPage() {
  const { locale } = useUiPreferences();
  const messages = TENANT_BRANDING_MESSAGES[locale];
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
          setError(formatUnknownError(currentError, { fallback: messages.tenantListError, locale }));
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
  }, [locale, messages.tenantListError]);

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
          setError(formatUnknownError(currentError, { fallback: messages.tenantBrandingError, locale }));
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
  }, [locale, messages.tenantBrandingError, selectedTenantId]);

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
      setSuccess(messages.saveSuccess);
    } catch (currentError) {
      setError(formatUnknownError(currentError, { fallback: messages.tenantBrandingError, locale }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page admin-page settings-page">
      <AdminPageHeader
        eyebrow={messages.eyebrow}
        title={messages.title}
        description={messages.description}
        actions={<AdminBadge tone="info">{messages.badge}</AdminBadge>}
      />

      <div className="tenant-branding-layout">
        <AdminPanel className="stack">
          <div className="admin-section-head">
            <h3>{messages.pickerTitle}</h3>
            <p>{messages.pickerDesc}</p>
          </div>

          <div className="settings-form-field">
            <label htmlFor="tenant-branding-search">{messages.searchLabel}</label>
            <input
              id="tenant-branding-search"
              value={tenantSearch}
              onChange={(event) => setTenantSearch(event.target.value)}
              placeholder={messages.searchPlaceholder}
            />
          </div>

          <div className="tenant-branding-list">
            {loadingTenants ? (
              <p className="muted">{messages.loadingTenants}</p>
            ) : filteredTenants.length === 0 ? (
              <p className="muted">{messages.emptyTenants}</p>
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
            <h3>{messages.editorTitle}</h3>
            <p>{messages.editorDesc}</p>
          </div>

          {selectedTenantMeta ? (
            <div className="settings-preview-list compact">
              <div>
                <span>{messages.currentTenant}</span>
                <strong>{selectedTenantMeta.name}</strong>
                <small>{selectedTenantMeta.slug}</small>
              </div>
              <div>
                <span>{messages.resolvedDisplayName}</span>
                <strong>{resolvedPreview.displayName || messages.emptyValue}</strong>
                <small>{messages.resolvedDisplayNameHint}</small>
              </div>
            </div>
          ) : null}

          {error ? <p className="settings-inline-note error">{error}</p> : null}
          {success ? <p className="settings-inline-note success">{success}</p> : null}

          <form className="stack" onSubmit={handleSubmit}>
            <div className="settings-form-field">
              <label htmlFor="tenant-display-name">{messages.displayNameLabel}</label>
              <input
                id="tenant-display-name"
                disabled={loadingBranding || saving || !selectedTenantId}
                value={form.displayName ?? ''}
                placeholder={messages.displayNamePlaceholder}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    displayName: normalizeNullableValue(event.target.value),
                  }))
                }
              />
            </div>

            <div className="settings-form-field">
              <label htmlFor="tenant-public-title">{messages.publicTitleLabel}</label>
              <input
                id="tenant-public-title"
                disabled={loadingBranding || saving || !selectedTenantId}
                value={form.publicTitle ?? ''}
                placeholder={messages.publicTitlePlaceholder}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    publicTitle: normalizeNullableValue(event.target.value),
                  }))
                }
              />
            </div>

            <div className="settings-form-field">
              <label htmlFor="tenant-public-subtitle">{messages.publicSubtitleLabel}</label>
              <textarea
                id="tenant-public-subtitle"
                rows={3}
                disabled={loadingBranding || saving || !selectedTenantId}
                value={form.publicSubtitle ?? ''}
                placeholder={messages.publicSubtitlePlaceholder}
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
                <span>{messages.resolvedPublicTitle}</span>
                <strong>{resolvedPreview.publicTitle || messages.emptyValue}</strong>
              </div>
              <div>
                <span>{messages.resolvedPublicSubtitle}</span>
                <small>{resolvedPreview.publicSubtitle || messages.emptyValue}</small>
              </div>
            </div>

            <div className="settings-form-actions">
              <button type="submit" disabled={loadingBranding || saving || !selectedTenantId}>
                {saving ? messages.savingButton : messages.saveButton}
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
