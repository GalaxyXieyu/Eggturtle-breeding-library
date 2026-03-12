'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUiPreferences } from '@/components/ui-preferences';
import {
  CUSTOM_SECURITY_QUESTION_VALUE,
  maskPhoneNumber,
  type SetupRequirements,
} from '@/app/app/[tenantSlug]/account/account-page-utils';
import { ACCOUNT_SETUP_MESSAGES } from '@/lib/locales/account';

type AccountSetupCardProps = {
  setupChecklistItems: string[];
  loginAccountValue: string;
  loginAccountHint: string;
  boundPhoneNumber: string | null;
  setupRequirements: SetupRequirements;
  selectedSecurityQuestion: string;
  securityQuestionOptions: string[];
  securityQuestionDraft: string;
  securityAnswerDraft: string;
  nameDraft: string;
  newPassword: string;
  confirmPassword: string;
  completingSetup: boolean;
  setupSubmitLabel: string;
  onNameDraftChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSelectedSecurityQuestionChange: (value: string) => void;
  onSecurityQuestionDraftChange: (value: string) => void;
  onSecurityAnswerDraftChange: (value: string) => void;
  onCompleteSetup: () => void;
};

export default function AccountSetupCard({
  setupChecklistItems,
  loginAccountValue,
  loginAccountHint,
  boundPhoneNumber,
  setupRequirements,
  selectedSecurityQuestion,
  securityQuestionOptions,
  securityQuestionDraft,
  securityAnswerDraft,
  nameDraft,
  newPassword,
  confirmPassword,
  completingSetup,
  setupSubmitLabel,
  onNameDraftChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onSelectedSecurityQuestionChange,
  onSecurityQuestionDraftChange,
  onSecurityAnswerDraftChange,
  onCompleteSetup,
}: AccountSetupCardProps) {
  const { locale } = useUiPreferences();
  const messages = ACCOUNT_SETUP_MESSAGES[locale];

  return (
    <Card className="overflow-hidden rounded-3xl border-[#FFD400]/75 bg-[linear-gradient(145deg,rgba(255,247,213,0.96),rgba(255,255,255,0.98))]">
      <CardHeader className="space-y-3">
        <CardTitle className="text-2xl text-neutral-900">{messages.title}</CardTitle>
        <CardDescription className="text-neutral-700">
          {setupChecklistItems.length > 0
            ? messages.checklist(setupChecklistItems.join(locale === 'zh' ? '、' : ', '))
            : messages.ready}
        </CardDescription>
        {setupChecklistItems.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {setupChecklistItems.map((item) => (
              <span
                key={item}
                className="rounded-full border border-[#e1bb35] bg-white/80 px-3 py-1 text-xs font-semibold text-[#7a5b00]"
              >
                {messages.pendingPrefix}
                {item}
              </span>
            ))}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="setup-login-account">{messages.loginAccountLabel}</Label>
          <Input id="setup-login-account" value={loginAccountValue} disabled />
          <p className="text-xs text-neutral-500">{loginAccountHint}</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="setup-bound-phone">{messages.boundPhoneLabel}</Label>
          <Input
            id="setup-bound-phone"
            value={boundPhoneNumber ? maskPhoneNumber(boundPhoneNumber) : messages.boundPhoneUnbound}
            disabled
          />
          <p className="text-xs text-neutral-500">{messages.boundPhoneHint}</p>
        </div>

        {setupRequirements.needsDisplayName ? (
          <div className="grid gap-2 xl:col-span-2">
            <Label htmlFor="setup-name">{messages.displayNameLabel}</Label>
            <Input
              id="setup-name"
              value={nameDraft}
              placeholder={messages.displayNamePlaceholder}
              onChange={(event) => onNameDraftChange(event.target.value)}
            />
            <p className="text-xs text-neutral-500">{messages.displayNameHint}</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-700 xl:col-span-2">
            {messages.displayNameDone}
          </div>
        )}

        {setupRequirements.needsPassword ? (
          <>
            <div className="grid gap-2">
              <Label htmlFor="setup-password">{messages.passwordLabel}</Label>
              <Input
                id="setup-password"
                type="password"
                value={newPassword}
                placeholder={messages.passwordPlaceholder}
                onChange={(event) => onNewPasswordChange(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="setup-password-confirm">{messages.confirmPasswordLabel}</Label>
              <Input
                id="setup-password-confirm"
                type="password"
                value={confirmPassword}
                placeholder={messages.confirmPasswordPlaceholder}
                onChange={(event) => onConfirmPasswordChange(event.target.value)}
              />
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-700 xl:col-span-2">
            {messages.passwordDone}
          </div>
        )}

        {setupRequirements.needsSecurity ? (
          <>
            <div className="grid gap-2 xl:col-span-2">
              <Label htmlFor="setup-security-question-select">{messages.securityQuestionLabel}</Label>
              <select
                id="setup-security-question-select"
                className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900"
                value={selectedSecurityQuestion}
                onChange={(event) => onSelectedSecurityQuestionChange(event.target.value)}
              >
                {securityQuestionOptions.map((item) => (
                  <option key={`setup-security-option-${item}`} value={item}>
                    {item}
                  </option>
                ))}
                <option value={CUSTOM_SECURITY_QUESTION_VALUE}>{messages.securityQuestionCustom}</option>
              </select>
              {selectedSecurityQuestion === CUSTOM_SECURITY_QUESTION_VALUE ? (
                <Input
                  id="setup-security-question-custom"
                  value={securityQuestionDraft}
                  placeholder={messages.securityQuestionCustomPlaceholder}
                  onChange={(event) => onSecurityQuestionDraftChange(event.target.value)}
                />
              ) : null}
            </div>
            <div className="grid gap-2 xl:col-span-2">
              <Label htmlFor="setup-security-answer">{messages.securityAnswerLabel}</Label>
              <Input
                id="setup-security-answer"
                value={securityAnswerDraft}
                placeholder={messages.securityAnswerPlaceholder}
                onChange={(event) => onSecurityAnswerDraftChange(event.target.value)}
              />
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-700 xl:col-span-2">
            {messages.securityDone}
          </div>
        )}

        <div className="xl:col-span-2">
          <Button
            variant="default"
            className="bg-neutral-900 text-white hover:bg-neutral-800 disabled:bg-neutral-900 disabled:text-white"
            disabled={completingSetup}
            onClick={onCompleteSetup}
          >
            {completingSetup ? messages.submitting : setupSubmitLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
