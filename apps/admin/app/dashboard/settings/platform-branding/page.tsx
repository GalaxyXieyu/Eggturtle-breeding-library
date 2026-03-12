'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  DEFAULT_PLATFORM_BRANDING,
  getPlatformBrandingResponseSchema,
  updatePlatformBrandingRequestSchema,
  updatePlatformBrandingResponseSchema,
  type PlatformBrandingConfig,
} from '@eggturtle/shared';

import { AdminBadge, AdminPageHeader, AdminPanel } from '@/components/dashboard/polish-primitives';
import { useUiPreferences } from '@/components/ui-preferences';
import { apiRequest } from '@/lib/api-client';
import { formatUnknownError } from '@/lib/formatters';
import { PLATFORM_BRANDING_MESSAGES } from '@/lib/locales/settings-pages';

type LocalizedFieldKey =
  | 'appName'
  | 'appEyebrow'
  | 'appDescription'
  | 'adminTitle'
  | 'adminSubtitle'
  | 'defaultTenantName'
  | 'publicCatalogTitleSuffix'
  | 'publicCatalogSubtitleSuffix';

export default function DashboardPlatformBrandingPage() {
  const { locale } = useUiPreferences();
  const messages = PLATFORM_BRANDING_MESSAGES[locale];
  const [form, setForm] = useState<PlatformBrandingConfig>(DEFAULT_PLATFORM_BRANDING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await apiRequest('/admin/branding/platform', {
          responseSchema: getPlatformBrandingResponseSchema,
        });

        if (!cancelled) {
          setForm(response.branding);
          setError(null);
        }
      } catch (currentError) {
        if (!cancelled) {
          setError(formatUnknownError(currentError, { fallback: messages.unknownError, locale }));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [locale, messages.unknownError]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await apiRequest('/admin/branding/platform', {
        method: 'PUT',
        body: {
          branding: form,
        },
        requestSchema: updatePlatformBrandingRequestSchema,
        responseSchema: updatePlatformBrandingResponseSchema,
      });

      setForm(response.branding);
      setSuccess(messages.saveSuccess);
    } catch (currentError) {
      setError(formatUnknownError(currentError, { fallback: messages.unknownError, locale }));
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
        actions={<AdminBadge tone="accent">{messages.saveBadge}</AdminBadge>}
      />

      <div className="settings-side-grid">
        <AdminPanel className="stack">
          <div className="admin-section-head">
            <h3>{messages.previewTitle}</h3>
            <p>{messages.previewDesc}</p>
          </div>
          <div className="settings-preview-list">
            <div>
              <span>{messages.previewAppName}</span>
              <strong>{form.appName.zh}</strong>
              <small>{form.appName.en}</small>
            </div>
            <div>
              <span>{messages.previewAdminTitle}</span>
              <strong>{form.adminTitle.zh}</strong>
              <small>{form.adminTitle.en}</small>
            </div>
            <div>
              <span>{messages.previewDefaultTenant}</span>
              <strong>{form.defaultTenantName.zh}</strong>
              <small>{form.defaultTenantName.en}</small>
            </div>
            <div>
              <span>{messages.previewCatalogSuffix}</span>
              <strong>{form.publicCatalogTitleSuffix.zh}</strong>
              <small>{form.publicCatalogTitleSuffix.en}</small>
            </div>
          </div>
        </AdminPanel>

        <AdminPanel className="stack">
          <div className="admin-section-head">
            <h3>{messages.editorTitle}</h3>
            <p>{messages.editorDesc}</p>
          </div>

          {error ? <p className="settings-inline-note error">{error}</p> : null}
          {success ? <p className="settings-inline-note success">{success}</p> : null}

          <form className="stack" onSubmit={handleSubmit}>
            <div className="settings-form-grid">
              <LocalizedField
                form={form}
                field="appName"
                label={messages.fields.appName}
                disabled={loading || saving}
                onChange={setForm}
                messages={messages}
              />
              <LocalizedField
                form={form}
                field="appEyebrow"
                label={messages.fields.appEyebrow}
                disabled={loading || saving}
                onChange={setForm}
                messages={messages}
              />
              <LocalizedField
                form={form}
                field="adminTitle"
                label={messages.fields.adminTitle}
                disabled={loading || saving}
                onChange={setForm}
                messages={messages}
              />
              <LocalizedField
                form={form}
                field="adminSubtitle"
                label={messages.fields.adminSubtitle}
                disabled={loading || saving}
                multiline
                onChange={setForm}
                messages={messages}
              />
              <LocalizedField
                form={form}
                field="appDescription"
                label={messages.fields.appDescription}
                disabled={loading || saving}
                multiline
                onChange={setForm}
                messages={messages}
              />
              <LocalizedField
                form={form}
                field="defaultTenantName"
                label={messages.fields.defaultTenantName}
                disabled={loading || saving}
                onChange={setForm}
                messages={messages}
              />
              <LocalizedField
                form={form}
                field="publicCatalogTitleSuffix"
                label={messages.fields.publicCatalogTitleSuffix}
                disabled={loading || saving}
                onChange={setForm}
                messages={messages}
              />
              <LocalizedField
                form={form}
                field="publicCatalogSubtitleSuffix"
                label={messages.fields.publicCatalogSubtitleSuffix}
                disabled={loading || saving}
                multiline
                onChange={setForm}
                messages={messages}
              />
            </div>

            <div className="settings-form-actions">
              <button type="submit" disabled={loading || saving}>
                {saving ? messages.savingButton : messages.saveButton}
              </button>
            </div>
          </form>
        </AdminPanel>
      </div>
    </section>
  );
}

function LocalizedField({
  form,
  field,
  label,
  disabled,
  multiline = false,
  onChange,
  messages,
}: {
  form: PlatformBrandingConfig;
  field: LocalizedFieldKey;
  label: string;
  disabled: boolean;
  multiline?: boolean;
  onChange: (value: PlatformBrandingConfig) => void;
  messages: (typeof PLATFORM_BRANDING_MESSAGES)[keyof typeof PLATFORM_BRANDING_MESSAGES];
}) {
  return (
    <section className="settings-form-group">
      <div className="admin-section-head compact">
        <h3>{label}</h3>
      </div>
      <div className="settings-form-field">
        <label htmlFor={`${field}-zh`}>{messages.localeZh}</label>
        {multiline ? (
          <textarea
            id={`${field}-zh`}
            rows={3}
            disabled={disabled}
            value={form[field].zh}
            onChange={(event) =>
              onChange({
                ...form,
                [field]: {
                  ...form[field],
                  zh: event.target.value,
                },
              })
            }
          />
        ) : (
          <input
            id={`${field}-zh`}
            disabled={disabled}
            value={form[field].zh}
            onChange={(event) =>
              onChange({
                ...form,
                [field]: {
                  ...form[field],
                  zh: event.target.value,
                },
              })
            }
          />
        )}
      </div>
      <div className="settings-form-field">
        <label htmlFor={`${field}-en`}>{messages.localeEn}</label>
        {multiline ? (
          <textarea
            id={`${field}-en`}
            rows={3}
            disabled={disabled}
            value={form[field].en}
            onChange={(event) =>
              onChange({
                ...form,
                [field]: {
                  ...form[field],
                  en: event.target.value,
                },
              })
            }
          />
        ) : (
          <input
            id={`${field}-en`}
            disabled={disabled}
            value={form[field].en}
            onChange={(event) =>
              onChange({
                ...form,
                [field]: {
                  ...form[field],
                  en: event.target.value,
                },
              })
            }
          />
        )}
      </div>
    </section>
  );
}
