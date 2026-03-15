/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Camera, ChevronRight, KeyRound, LogOut, Smartphone, UserRound, X } from 'lucide-react';

import type { TenantSubscription } from '@eggturtle/shared';

import AccountAvatarCropDialog from '@/app/app/[tenantSlug]/account/account-avatar-crop-dialog';
import SubscriptionPageContent from '@/app/app/[tenantSlug]/subscription/subscription-content';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { resolveAuthenticatedAssetUrl } from '@/lib/api-client';
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
  avatarUploading: boolean;
  avatarUrl: string | null | undefined;
  subscription: TenantSubscription | null;
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
  initialSubscriptionExpanded?: boolean;
  onAvatarUpload: (file: File) => Promise<void> | void;
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

type CropSource = {
  fileName: string;
  revokeOnClose: boolean;
  url: string;
};

type EditorKey = 'name' | 'phone' | 'password' | 'security' | null;

export default function AccountProfileOverview({
  avatarUploading,
  avatarUrl,
  subscription,
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
  initialSubscriptionExpanded = false,
  onAvatarUpload,
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
  const [cropSource, setCropSource] = useState<CropSource | null>(null);
  const [subscriptionExpanded, setSubscriptionExpanded] = useState(initialSubscriptionExpanded);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const resolvedAvatarUrl = avatarUrl?.trim() ? resolveAuthenticatedAssetUrl(avatarUrl) : null;
  const avatarBusy = avatarUploading;
  const phoneSummary = boundPhoneNumber
    ? maskPhoneNumber(boundPhoneNumber)
    : messages.phoneSummaryEmpty;
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
  const subscriptionPlanLabel = formatSubscriptionPlanLabel(subscription?.plan, locale);
  const subscriptionStatusLabel = buildSubscriptionStatusLabel(subscription?.expiresAt, messages);
  const subscriptionQuotaItems = [
    {
      label: messages.subscriptionStorageQuota,
      value: formatQuotaBytes(subscription?.maxStorageBytes, messages.subscriptionUnlimited),
    },
    {
      label: messages.subscriptionImageQuota,
      value: formatQuotaCount(subscription?.maxImages, messages.subscriptionUnlimited),
    },
    {
      label: messages.subscriptionShareQuota,
      value: formatQuotaCount(subscription?.maxShares, messages.subscriptionUnlimited),
    },
  ];
  const subscriptionQuotaSummary = subscriptionQuotaItems
    .map((item) => `${item.label} ${item.value}`)
    .join(' · ');

  useEffect(() => {
    if (initialSubscriptionExpanded) {
      setSubscriptionExpanded(true);
    }
  }, [initialSubscriptionExpanded]);

  function toggleEditor(nextEditor: Exclude<EditorKey, null>) {
    setActiveEditor((current) => (current === nextEditor ? null : nextEditor));
  }

  function closeCropDialog() {
    setCropSource((current) => {
      if (current?.revokeOnClose) {
        URL.revokeObjectURL(current.url);
      }
      return null;
    });
  }

  function handleAvatarTrigger() {
    if (avatarBusy) {
      return;
    }

    avatarInputRef.current?.click();
  }

  function handleAvatarFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setCropSource({
      fileName: file.name,
      revokeOnClose: true,
      url: objectUrl,
    });
  }

  async function handleConfirmCrop(payload: { blob: Blob; fileName: string }) {
    const file = new File([payload.blob], payload.fileName, {
      type: payload.blob.type || 'image/jpeg',
    });
    try {
      await onAvatarUpload(file);
      closeCropDialog();
    } catch {
      return;
    }
  }

  return (
    <section className="relative mx-auto w-full max-w-3xl space-y-3 overflow-x-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top_right,rgba(255,212,0,0.16),transparent_36%),radial-gradient(circle_at_top_left,rgba(255,255,255,0.9),transparent_34%)]" />
      <MobileSettingsHeader className="relative" title={messages.title} titleAs="h2" />

      <div className="px-1">
        <input
          ref={avatarInputRef}
          id="account-avatar-upload"
          type="file"
          accept="image/*"
          className="hidden"
          disabled={avatarBusy}
          onChange={handleAvatarFileChange}
        />

        <div className="account-profile-hero rounded-[30px] bg-[linear-gradient(180deg,rgba(255,248,217,0.72),rgba(255,255,255,0.72))] px-5 py-5 sm:px-6">
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label={messages.uploadAvatar}
              disabled={avatarBusy}
              onClick={handleAvatarTrigger}
              className="group relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/[0.06] bg-stone-100 shadow-[0_6px_16px_rgba(15,23,42,0.06)] transition-transform hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD400]/70 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:size-28"
            >
              {resolvedAvatarUrl ? (
                <img
                  src={resolvedAvatarUrl}
                  alt={messages.avatarLabel}
                  className="size-full object-cover"
                />
              ) : (
                <UserRound size={40} className="text-neutral-500" />
              )}
              <span className="absolute bottom-2 right-2 flex size-8 items-center justify-center rounded-full border border-white/80 bg-black/70 text-white shadow-sm">
                <Camera size={14} />
              </span>
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-base font-semibold tracking-[-0.02em] text-neutral-900 sm:text-lg">
                  {nameDraft.trim() || loginAccountValue}
                </p>
                <Badge variant="accent">{subscriptionPlanLabel}</Badge>
              </div>
              <p className="mt-1 text-sm font-medium text-neutral-700">{subscriptionStatusLabel}</p>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                <span className="font-medium text-neutral-800">{messages.subscriptionQuotaLabel}</span>
                <span className="ml-1">{subscriptionQuotaSummary}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-expanded={subscriptionExpanded}
            aria-haspopup="dialog"
            className="account-subscription-trigger mt-4 flex w-full items-center justify-between rounded-2xl border border-[#E6A11C] bg-[linear-gradient(180deg,rgba(255,248,217,0.86),rgba(255,255,255,0.96))] px-3.5 py-3 text-left transition-colors hover:bg-[linear-gradient(180deg,rgba(255,248,217,0.95),rgba(255,255,255,1))]"
            onClick={() => setSubscriptionExpanded(true)}
          >
            <span className="text-sm font-medium text-neutral-500">{messages.subscriptionDetailAction}</span>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
              {subscriptionPlanLabel}
              <ChevronRight size={16} className="text-neutral-400 transition-transform" />
            </span>
          </button>
        </div>
      </div>

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
                {messages.phoneBoundLabel(
                  boundPhoneNumber ? maskPhoneNumber(boundPhoneNumber) : messages.phoneUnbound,
                )}
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
                <option value={CUSTOM_SECURITY_QUESTION_VALUE}>
                  {messages.securityQuestionCustom}
                </option>
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

      {subscriptionExpanded ? (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="account-subscription-dialog-title"
          onClick={() => setSubscriptionExpanded(false)}
        >
          <section
            className="account-subscription-dialog-panel w-full max-w-xl rounded-[28px] border border-black/[0.05] bg-[linear-gradient(180deg,rgba(255,250,230,0.98),rgba(255,255,255,0.98))] p-4 shadow-[0_20px_56px_rgba(15,23,42,0.16)] sm:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <p id="account-subscription-dialog-title" className="text-base font-semibold text-neutral-900">
                {messages.subscriptionDetailAction}
              </p>
              <button
                type="button"
                aria-label="关闭"
                className="flex size-9 items-center justify-center rounded-full bg-white/90 text-neutral-500 transition hover:text-neutral-900"
                onClick={() => setSubscriptionExpanded(false)}
              >
                <X size={18} />
              </button>
            </div>
            <SubscriptionPageContent embedded />
          </section>
        </div>
      ) : null}

      <AccountAvatarCropDialog
        open={Boolean(cropSource)}
        sourceName={cropSource?.fileName}
        sourceUrl={cropSource?.url ?? null}
        confirming={avatarUploading}
        onClose={closeCropDialog}
        onConfirm={handleConfirmCrop}
      />
    </section>
  );
}


function formatSubscriptionPlanLabel(plan: TenantSubscription['plan'] | null | undefined, locale: 'zh' | 'en') {
  if (plan === 'PRO') {
    return locale === 'zh' ? '专业版会员' : 'Pro member';
  }

  if (plan === 'BASIC') {
    return locale === 'zh' ? '基础版会员' : 'Basic member';
  }

  return locale === 'zh' ? '免费版会员' : 'Free member';
}

function buildSubscriptionStatusLabel(
  expiresAt: string | null | undefined,
  messages: Pick<
    (typeof ACCOUNT_PROFILE_MESSAGES)['zh'],
    'subscriptionDaysLeft' | 'subscriptionExpired' | 'subscriptionLongTerm'
  >,
) {
  if (!expiresAt) {
    return messages.subscriptionLongTerm;
  }

  const remainingDays = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
  if (remainingDays <= 0) {
    return messages.subscriptionExpired;
  }

  return messages.subscriptionDaysLeft(remainingDays);
}

function formatQuotaCount(value: number | null | undefined, unlimitedLabel: string) {
  if (typeof value !== 'number' || value < 0) {
    return unlimitedLabel;
  }

  return String(value);
}

function formatQuotaBytes(value: string | null | undefined, unlimitedLabel: string) {
  if (!value || !/^\d+$/.test(value)) {
    return unlimitedLabel;
  }

  const raw = BigInt(value);
  const gb = 1024n * 1024n * 1024n;
  const mb = 1024n * 1024n;

  if (raw >= gb) {
    const whole = Number(raw) / Number(gb);
    return `${whole >= 10 ? whole.toFixed(0) : whole.toFixed(1)} GB`;
  }

  if (raw >= mb) {
    const whole = Number(raw) / Number(mb);
    return `${whole >= 10 ? whole.toFixed(0) : whole.toFixed(1)} MB`;
  }

  return `${value} B`;
}
