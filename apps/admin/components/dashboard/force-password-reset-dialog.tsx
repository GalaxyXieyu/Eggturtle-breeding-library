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
import { FORCE_PASSWORD_RESET_MESSAGES } from '@/lib/locales/shell';

type ForcePasswordResetDialogProps = {
  currentUserEmail: string;
  open: boolean;
};

export function ForcePasswordResetDialog({
  currentUserEmail,
  open
}: ForcePasswordResetDialogProps) {
  const router = useRouter();
  const { locale } = useUiPreferences();
  const messages = FORCE_PASSWORD_RESET_MESSAGES[locale];
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
      setError(messages.passwordMismatch);
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
      setError(formatUnknownError(requestError, { fallback: messages.unknownError, locale }));
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
            <strong>{messages.accountLabel}</strong>
            <span>{currentUserEmail}</span>
          </div>
          <div className="stack">
            <h2 id="force-password-reset-title">{messages.title}</h2>
            <p>{messages.description}</p>
          </div>
        </div>

        <form className="force-password-reset-form" onSubmit={handleSubmit}>
          <div className="settings-form-group force-password-reset-fields">
            <label className="settings-form-field">
              <span>{messages.currentPassword}</span>
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder={messages.currentPasswordPlaceholder}
                disabled={submitting}
                required
              />
            </label>

            <label className="settings-form-field">
              <span>{messages.newPassword}</span>
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder={messages.newPasswordPlaceholder}
                disabled={submitting}
                required
              />
            </label>

            <label className="settings-form-field">
              <span>{messages.confirmPassword}</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder={messages.confirmPasswordPlaceholder}
                disabled={submitting}
                required
              />
            </label>
          </div>

          {error ? <p className="settings-inline-note error">{error}</p> : null}

          <div className="settings-form-actions">
            <button type="submit" disabled={submitting}>
              {submitting ? messages.saving : messages.save}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
