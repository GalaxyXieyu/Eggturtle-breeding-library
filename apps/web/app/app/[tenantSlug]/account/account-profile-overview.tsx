'use client';

import { useMemo, useState } from 'react';
import { KeyRound, LogOut, Smartphone, UserRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUiPreferences } from '@/components/ui-preferences';
import {
  MobileSettingsCard as SettingsCard,
  MobileSettingsEditorPanel as AccountEditorPanel,
  MobileSettingsHeader,
  MobileSettingRow as AccountSettingRow,
} from '@/components/ui/mobile-settings';
import {
  CUSTOM_SECURITY_QUESTION_VALUE,
  formatDate,
  maskPhoneNumber,
} from '@/app/app/[tenantSlug]/account/account-page-utils';
import { ACCOUNT_PROFILE_MESSAGES } from '@/lib/locales/account';

type AccountProfileOverviewProps = {
  boundPhoneNumber: string | null;
  confirmPassword: string;
  currentPassword: string;
  isReplacingBoundPhone: boolean;
  loginAccountHint: string;
  loginAccountValue: string;
  nameDraft: string;
  newPassword: string;
  oldPhoneCodeCooldown: number;
  oldPhoneCodeDraft: string;
  onConfirmPasswordChange: (value: string) => void;
  onCurrentPasswordChange: (value: string) => void;
  onLogout: () => void;
  onNameDraftChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onOldPhoneCodeDraftChange: (value: string) => void;
  onPhoneCodeDraftChange: (value: string) => void;
  onPhoneDraftChange: (value: string) => void;
  onBindPhone: () => void;
  onSavePassword: () => void;
  onSaveProfile: () => void;
  onSaveSecurity: () => void;
  onSelectedSecurityQuestionChange: (value: string) => void;
  onSecurityAnswerDraftChange: (value: string) => void;
  onSecurityQuestionDraftChange: (value: string) => void;
  onSendOldPhoneCode: () => void;
  onSendPhoneCode: () => void;
  passwordUpdatedAt: string | null | undefined;
  phoneCodeCooldown: number;
  phoneCodeDraft: string;
  phoneDraft: string;
  profileCreatedAt: string | undefined;
  savingPassword: boolean;
  savingPhoneBinding: boolean;
  savingProfile: boolean;
  savingSecurity: boolean;
  securityAnswerDraft: string;
  securityQuestionDraft: string;
  selectedSecurityQuestion: string;
  sendingOldPhoneCode: boolean;
  sendingPhoneCode: boolean;
  securityQuestionOptions: string[];
};

type EditorKey = 'name' | 'phone' | 'password' | 'security' | null;

export default function AccountProfileOverview({
  boundPhoneNumber,
  confirmPassword,
  currentPassword,
  isReplacingBoundPhone,
  loginAccountHint,
  loginAccountValue,
  nameDraft,
  newPassword,
  oldPhoneCodeCooldown,
  oldPhoneCodeDraft,
  onConfirmPasswordChange,
  onCurrentPasswordChange,
  onLogout,
  onNameDraftChange,
  onNewPasswordChange,
  onOldPhoneCodeDraftChange,
  onPhoneCodeDraftChange,
  onPhoneDraftChange,
  onBindPhone,
  onSavePassword,
  onSaveProfile,
  onSaveSecurity,
  onSelectedSecurityQuestionChange,
  onSecurityAnswerDraftChange,
  onSecurityQuestionDraftChange,
  onSendOldPhoneCode,
  onSendPhoneCode,
  passwordUpdatedAt,
  phoneCodeCooldown,
  phoneCodeDraft,
  phoneDraft,
  profileCreatedAt,
  savingPassword,
  savingPhoneBinding,
  savingProfile,
  savingSecurity,
  securityAnswerDraft,
  securityQuestionDraft,
  selectedSecurityQuestion,
  sendingOldPhoneCode,
  sendingPhoneCode,
  securityQuestionOptions,
}: AccountProfileOverviewProps) {
  const { locale } = useUiPreferences();
  const messages = ACCOUNT_PROFILE_MESSAGES[locale];
  const [activeEditor, setActiveEditor] = useState<EditorKey>(null);

  const phoneSummary = boundPhoneNumber ? maskPhoneNumber(boundPhoneNumber) : messages.phoneSummaryEmpty;
  const passwordSummary = passwordUpdatedAt
    ? messages.passwordSummaryUpdated(formatDate(passwordUpdatedAt, locale))
    : messages.passwordSummaryEmpty;
  const securitySummary = securityQuestionDraft.trim()
    ? securityQuestionDraft.trim()
    : messages.securitySummaryEmpty;
  const loginAccountDetail = useMemo(() => {
    const parts = [loginAccountHint];
    if (profileCreatedAt) {
      parts.push(messages.createdAt(formatDate(profileCreatedAt, locale)));
    }
    return parts.filter(Boolean).join(' · ');
  }, [messages, locale, loginAccountHint, profileCreatedAt]);

  function toggleEditor(nextEditor: Exclude<EditorKey, null>) {
    setActiveEditor((current) => (current === nextEditor ? null : nextEditor));
  }

  return (
    <section className="relative mx-auto w-full max-w-3xl space-y-3 overflow-x-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top_right,rgba(255,212,0,0.16),transparent_36%),radial-gradient(circle_at_top_left,rgba(255,255,255,0.9),transparent_34%)]" />
      <MobileSettingsHeader
        className="relative"
        title={messages.title}
        titleAs="h2"
        description={messages.description}
      />

      <SettingsCard>
        <AccountSettingRow
          icon={<UserRound size={16} />}
          label={messages.loginAccountLabel}
          summary={loginAccountValue}
          detail={loginAccountDetail}
        />
        <AccountSettingRow
          active={activeEditor === 'name'}
          icon={<UserRound size={16} />}
          label={messages.displayNameLabel}
          summary={nameDraft.trim() || messages.displayNameEmpty}
          detail={messages.displayNameDetail}
          onClick={() => toggleEditor('name')}
        />
        {activeEditor === 'name' ? (
          <AccountEditorPanel onClose={() => setActiveEditor(null)}>
            <div className="space-y-2">
              <Label htmlFor="account-name">{messages.displayNameLabel}</Label>
              <Input
                id="account-name"
                value={nameDraft}
                placeholder={messages.displayNamePlaceholder}
                onChange={(event) => onNameDraftChange(event.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Button disabled={savingProfile} onClick={() => void onSaveProfile()}>
                {savingProfile ? messages.savingProfile : messages.saveProfile}
              </Button>
            </div>
          </AccountEditorPanel>
        ) : null}

        <AccountSettingRow
          active={activeEditor === 'phone'}
          icon={<Smartphone size={16} />}
          label={messages.phoneLabel}
          summary={phoneSummary}
          detail={messages.phoneDetail}
          onClick={() => toggleEditor('phone')}
        />
        {activeEditor === 'phone' ? (
          <AccountEditorPanel onClose={() => setActiveEditor(null)}>
            <div className="space-y-2">
              <Label htmlFor="account-phone">{messages.phoneFieldLabel}</Label>
              <Input
                id="account-phone"
                value={phoneDraft}
                inputMode="numeric"
                maxLength={11}
                placeholder={messages.phonePlaceholder}
                onChange={(event) =>
                  onPhoneDraftChange(event.target.value.replace(/\D/g, '').slice(0, 11))
                }
              />
              <p className="text-xs text-neutral-500">
                {messages.phoneBoundLabel(boundPhoneNumber ? maskPhoneNumber(boundPhoneNumber) : messages.phoneUnbound)}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-phone-code">{messages.phoneCodeLabel}</Label>
              <div className="flex gap-2">
                <Input
                  id="account-phone-code"
                  value={phoneCodeDraft}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder={messages.phoneCodePlaceholder}
                  onChange={(event) =>
                    onPhoneCodeDraftChange(event.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={sendingPhoneCode || phoneCodeCooldown > 0}
                  onClick={() => void onSendPhoneCode()}
                >
                  {sendingPhoneCode
                    ? messages.sending
                    : phoneCodeCooldown > 0
                      ? `${phoneCodeCooldown}s`
                      : messages.send}
                </Button>
              </div>
            </div>
            {isReplacingBoundPhone ? (
              <div className="space-y-2">
                <Label htmlFor="account-old-phone-code">{messages.oldPhoneCodeLabel}</Label>
                <div className="flex gap-2">
                  <Input
                    id="account-old-phone-code"
                    value={oldPhoneCodeDraft}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder={messages.oldPhoneCodePlaceholder}
                    onChange={(event) =>
                      onOldPhoneCodeDraftChange(event.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={sendingOldPhoneCode || oldPhoneCodeCooldown > 0}
                    onClick={() => void onSendOldPhoneCode()}
                  >
                    {sendingOldPhoneCode
                      ? messages.sending
                      : oldPhoneCodeCooldown > 0
                        ? `${oldPhoneCodeCooldown}s`
                        : messages.send}
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="flex justify-end">
              <Button disabled={savingPhoneBinding} onClick={() => void onBindPhone()}>
                {savingPhoneBinding ? messages.bindingPhone : messages.bindPhone}
              </Button>
            </div>
          </AccountEditorPanel>
        ) : null}
      </SettingsCard>

      <SettingsCard>
        <AccountSettingRow
          active={activeEditor === 'password'}
          icon={<KeyRound size={16} />}
          label={messages.passwordLabel}
          summary={passwordSummary}
          detail={messages.passwordDetail}
          onClick={() => toggleEditor('password')}
        />
        {activeEditor === 'password' ? (
          <AccountEditorPanel onClose={() => setActiveEditor(null)}>
            <div className="space-y-2">
              <Label htmlFor="current-password">{messages.currentPasswordLabel}</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                placeholder={messages.currentPasswordPlaceholder}
                onChange={(event) => onCurrentPasswordChange(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">{messages.newPasswordLabel}</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                placeholder={messages.newPasswordPlaceholder}
                onChange={(event) => onNewPasswordChange(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{messages.confirmPasswordLabel}</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                placeholder={messages.confirmPasswordPlaceholder}
                onChange={(event) => onConfirmPasswordChange(event.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Button
                variant="secondary"
                disabled={savingPassword}
                onClick={() => void onSavePassword()}
              >
                {savingPassword ? messages.updatingPassword : messages.updatePassword}
              </Button>
            </div>
          </AccountEditorPanel>
        ) : null}

        <AccountSettingRow
          active={activeEditor === 'security'}
          icon={<KeyRound size={16} />}
          label={messages.securityLabel}
          summary={securitySummary}
          detail={messages.securityDetail}
          onClick={() => toggleEditor('security')}
        />
        {activeEditor === 'security' ? (
          <AccountEditorPanel onClose={() => setActiveEditor(null)}>
            <div className="space-y-2">
              <Label htmlFor="security-question-select">{messages.securityQuestionLabel}</Label>
              <select
                id="security-question-select"
                className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900"
                value={selectedSecurityQuestion}
                onChange={(event) => onSelectedSecurityQuestionChange(event.target.value)}
              >
                {securityQuestionOptions.map((item) => (
                  <option key={`security-option-${item}`} value={item}>
                    {item}
                  </option>
                ))}
                <option value={CUSTOM_SECURITY_QUESTION_VALUE}>{messages.securityQuestionCustom}</option>
              </select>
              {selectedSecurityQuestion === CUSTOM_SECURITY_QUESTION_VALUE ? (
                <Input
                  id="security-question-custom"
                  value={securityQuestionDraft}
                  placeholder={messages.securityQuestionCustomPlaceholder}
                  onChange={(event) => onSecurityQuestionDraftChange(event.target.value)}
                />
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="security-answer">{messages.securityAnswerLabel}</Label>
              <Input
                id="security-answer"
                value={securityAnswerDraft}
                placeholder={messages.securityAnswerPlaceholder}
                onChange={(event) => onSecurityAnswerDraftChange(event.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Button
                variant="secondary"
                disabled={savingSecurity}
                onClick={() => void onSaveSecurity()}
              >
                {savingSecurity ? messages.savingSecurity : messages.saveSecurity}
              </Button>
            </div>
          </AccountEditorPanel>
        ) : null}
      </SettingsCard>

      <SettingsCard>
        <div className="p-1.5">
          <Button
            variant="ghost"
            className="h-10 w-full justify-start rounded-xl text-neutral-700 hover:bg-stone-50 hover:text-neutral-900"
            onClick={onLogout}
          >
            <LogOut size={16} />
            <span>{messages.logout}</span>
          </Button>
        </div>
      </SettingsCard>
    </section>
  );
}
