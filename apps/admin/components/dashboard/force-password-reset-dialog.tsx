'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  updateMyPasswordRequestSchema,
  updateMyPasswordResponseSchema
} from '@eggturtle/shared';

import { useUiPreferences } from '@/components/ui-preferences';
import { apiRequest } from '@/lib/api-client';
import { formatUnknownError } from '@/lib/formatters';

type ForcePasswordResetDialogProps = {
  currentUserEmail: string;
  open: boolean;
};

const COPY = {
  zh: {
    title: '先修改初始密码',
    description: '这是系统初始化的临时管理员密码。继续使用后台前，请先改成你自己的密码。',
    currentPassword: '当前密码',
    currentPasswordPlaceholder: '请输入当前临时密码',
    newPassword: '新密码',
    newPasswordPlaceholder: '请输入新的后台密码',
    confirmPassword: '确认新密码',
    confirmPasswordPlaceholder: '请再次输入新密码',
    passwordMismatch: '两次输入的新密码不一致。',
    save: '保存并继续',
    saving: '保存中…',
    accountLabel: '当前账号',
    unknownError: '修改密码失败，请稍后重试。'
  },
  en: {
    title: 'Change the bootstrap password first',
    description:
      'This is the temporary admin password created during bootstrap. Change it before continuing to use the console.',
    currentPassword: 'Current password',
    currentPasswordPlaceholder: 'Enter the temporary password',
    newPassword: 'New password',
    newPasswordPlaceholder: 'Enter the new admin password',
    confirmPassword: 'Confirm new password',
    confirmPasswordPlaceholder: 'Enter the new password again',
    passwordMismatch: 'The two new password entries do not match.',
    save: 'Save and continue',
    saving: 'Saving…',
    accountLabel: 'Current account',
    unknownError: 'Failed to update password. Please try again.'
  }
} as const;

export function ForcePasswordResetDialog({
  currentUserEmail,
  open
}: ForcePasswordResetDialogProps) {
  const router = useRouter();
  const { locale } = useUiPreferences();
  const copy = COPY[locale];
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || dismissed) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      setError(copy.passwordMismatch);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await apiRequest('/api/auth/change-password', {
        method: 'PUT',
        auth: false,
        body: {
          currentPassword,
          newPassword
        },
        requestSchema: updateMyPasswordRequestSchema,
        responseSchema: updateMyPasswordResponseSchema
      });

      setDismissed(true);
      router.refresh();
    } catch (requestError) {
      setError(formatUnknownError(requestError, { fallback: copy.unknownError, locale }));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="force-password-reset-overlay" role="presentation">
      <section
        className="force-password-reset-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="force-password-reset-title"
      >
        <div className="force-password-reset-head">
          <div className="stack">
            <strong>{copy.accountLabel}</strong>
            <span>{currentUserEmail}</span>
          </div>
          <div className="stack">
            <h2 id="force-password-reset-title">{copy.title}</h2>
            <p>{copy.description}</p>
          </div>
        </div>

        <form className="force-password-reset-form" onSubmit={handleSubmit}>
          <div className="settings-form-group force-password-reset-fields">
            <label className="settings-form-field">
              <span>{copy.currentPassword}</span>
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder={copy.currentPasswordPlaceholder}
                disabled={submitting}
                required
              />
            </label>

            <label className="settings-form-field">
              <span>{copy.newPassword}</span>
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder={copy.newPasswordPlaceholder}
                disabled={submitting}
                required
              />
            </label>

            <label className="settings-form-field">
              <span>{copy.confirmPassword}</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder={copy.confirmPasswordPlaceholder}
                disabled={submitting}
                required
              />
            </label>
          </div>

          {error ? <p className="settings-inline-note error">{error}</p> : null}

          <div className="settings-form-actions">
            <button type="submit" disabled={submitting}>
              {submitting ? copy.saving : copy.save}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
