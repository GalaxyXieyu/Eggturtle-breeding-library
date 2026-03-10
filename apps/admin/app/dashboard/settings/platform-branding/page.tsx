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
import { apiRequest } from '@/lib/api-client';
import { formatUnknownError } from '@/lib/formatters';

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
          setError(formatUnknownError(currentError));
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
  }, []);

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
      setSuccess('平台品牌已保存，前台和后台立即按新配置生效。');
    } catch (currentError) {
      setError(formatUnknownError(currentError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page admin-page settings-page">
      <AdminPageHeader
        eyebrow="平台品牌"
        title="平台品牌"
        description="统一维护首页、登录页、后台标题、公开图鉴默认文案和租户默认展示名。"
        actions={<AdminBadge tone="accent">保存即生效</AdminBadge>}
      />

      <div className="settings-side-grid">
        <AdminPanel className="stack">
          <div className="admin-section-head">
            <h3>品牌预览</h3>
            <p>当前配置会覆盖平台级默认品牌入口。</p>
          </div>
          <div className="settings-preview-list">
            <div>
              <span>首页品牌</span>
              <strong>{form.appName.zh}</strong>
              <small>{form.appName.en}</small>
            </div>
            <div>
              <span>后台标题</span>
              <strong>{form.adminTitle.zh}</strong>
              <small>{form.adminTitle.en}</small>
            </div>
            <div>
              <span>租户默认名</span>
              <strong>{form.defaultTenantName.zh}</strong>
              <small>{form.defaultTenantName.en}</small>
            </div>
            <div>
              <span>公开图鉴后缀</span>
              <strong>{form.publicCatalogTitleSuffix.zh}</strong>
              <small>{form.publicCatalogTitleSuffix.en}</small>
            </div>
          </div>
        </AdminPanel>

        <AdminPanel className="stack">
          <div className="admin-section-head">
            <h3>编辑品牌</h3>
            <p>推荐先维护名称与后台标题，再补充描述和公开图鉴默认文案。</p>
          </div>

          {error ? <p className="settings-inline-note error">{error}</p> : null}
          {success ? <p className="settings-inline-note success">{success}</p> : null}

          <form className="stack" onSubmit={handleSubmit}>
            <div className="settings-form-grid">
              <LocalizedField
                form={form}
                field="appName"
                label="品牌主名称"
                disabled={loading || saving}
                onChange={setForm}
              />
              <LocalizedField
                form={form}
                field="appEyebrow"
                label="品牌副标题"
                disabled={loading || saving}
                onChange={setForm}
              />
              <LocalizedField
                form={form}
                field="adminTitle"
                label="后台标题"
                disabled={loading || saving}
                onChange={setForm}
              />
              <LocalizedField
                form={form}
                field="adminSubtitle"
                label="后台副标题"
                disabled={loading || saving}
                multiline
                onChange={setForm}
              />
              <LocalizedField
                form={form}
                field="appDescription"
                label="平台描述"
                disabled={loading || saving}
                multiline
                onChange={setForm}
              />
              <LocalizedField
                form={form}
                field="defaultTenantName"
                label="默认租户名"
                disabled={loading || saving}
                onChange={setForm}
              />
              <LocalizedField
                form={form}
                field="publicCatalogTitleSuffix"
                label="公开图鉴标题后缀"
                disabled={loading || saving}
                onChange={setForm}
              />
              <LocalizedField
                form={form}
                field="publicCatalogSubtitleSuffix"
                label="公开图鉴副标题后缀"
                disabled={loading || saving}
                multiline
                onChange={setForm}
              />
            </div>

            <div className="settings-form-actions">
              <button type="submit" disabled={loading || saving}>
                {saving ? '保存中…' : '保存平台品牌'}
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
}: {
  form: PlatformBrandingConfig;
  field: LocalizedFieldKey;
  label: string;
  disabled: boolean;
  multiline?: boolean;
  onChange: (value: PlatformBrandingConfig) => void;
}) {
  return (
    <section className="settings-form-group">
      <div className="admin-section-head compact">
        <h3>{label}</h3>
      </div>
      <div className="settings-form-field">
        <label htmlFor={`${field}-zh`}>中文</label>
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
        <label htmlFor={`${field}-en`}>英文</label>
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
