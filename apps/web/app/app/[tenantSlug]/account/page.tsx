'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  meProfileResponseSchema,
  myPhoneBindingResponseSchema,
  mySecurityProfileResponseSchema,
  requestSmsCodeRequestSchema,
  requestSmsCodeResponseSchema,
  type MeProfile,
  upsertMyPhoneBindingRequestSchema,
  upsertMyPhoneBindingResponseSchema,
  upsertMySecurityProfileRequestSchema,
  upsertMySecurityProfileResponseSchema,
  updateMeProfileRequestSchema,
  updateMeProfileResponseSchema,
  updateMyPasswordRequestSchema,
  updateMyPasswordResponseSchema,
} from '@eggturtle/shared';
import AccountProfileOverview from '@/app/app/[tenantSlug]/account/account-profile-overview';
import { AccountSectionNav } from '@/components/account-section-nav';
import { Card } from '@/components/ui/card';
import { apiRequest, clearAccessToken } from '@/lib/api-client';
import { formatApiError } from '@/lib/error-utils';
import { ensureTenantRouteSession } from '@/lib/tenant-route-session';
import AccountSetupCard from '@/app/app/[tenantSlug]/account/account-setup-card';
import {
  CUSTOM_SECURITY_QUESTION_VALUE,
  EMPTY_SETUP_REQUIREMENTS,
  describeLoginAccount,
  formatLoginAccount,
  getSecurityQuestionOptions,
  getSetupChecklistItems,
  getSetupSubmitLabel,
  maskPhoneNumber,
  normalizeAccountTab,
  resolveProfileSetupRequirements,
  toBusinessSetupError,
  type AccountTab,
  type SetupRequirements,
} from '@/app/app/[tenantSlug]/account/account-page-utils';
import { useUiPreferences } from '@/components/ui-preferences';
import { ACCOUNT_PAGE_MESSAGES } from '@/lib/locales/account';
import SubscriptionPageContent from '@/app/app/[tenantSlug]/subscription/page';
import ReferralPanel from '@/app/app/[tenantSlug]/account/referral-panel';

export default function AccountPage() {
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const searchParams = useSearchParams();
  const tenantSlug = useMemo(() => params.tenantSlug ?? '', [params.tenantSlug]);
  const { locale } = useUiPreferences();
  const messages = ACCOUNT_PAGE_MESSAGES[locale];
  const securityQuestionOptions = getSecurityQuestionOptions(locale);

  const [activeTab, setActiveTab] = useState<AccountTab>('profile');
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [sendingPhoneCode, setSendingPhoneCode] = useState(false);
  const [sendingOldPhoneCode, setSendingOldPhoneCode] = useState(false);
  const [savingPhoneBinding, setSavingPhoneBinding] = useState(false);
  const [completingSetup, setCompletingSetup] = useState(false);

  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [setupRequirements, setSetupRequirements] =
    useState<SetupRequirements>(EMPTY_SETUP_REQUIREMENTS);

  const [nameDraft, setNameDraft] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [boundPhoneNumber, setBoundPhoneNumber] = useState<string | null>(null);
  const [phoneDraft, setPhoneDraft] = useState('');
  const [phoneCodeDraft, setPhoneCodeDraft] = useState('');
  const [phoneCodeCooldown, setPhoneCodeCooldown] = useState(0);
  const [oldPhoneCodeDraft, setOldPhoneCodeDraft] = useState('');
  const [oldPhoneCodeCooldown, setOldPhoneCodeCooldown] = useState(0);
  const [securityQuestionDraft, setSecurityQuestionDraft] = useState('');
  const [securityAnswerDraft, setSecurityAnswerDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const needsSetup = searchParams.get('setup') === '1';
  const mustCompleteSetup =
    setupRequirements.needsDisplayName ||
    setupRequirements.needsPassword ||
    setupRequirements.needsSecurity;
  const shouldShowSetup = needsSetup || mustCompleteSetup;
  const isReplacingBoundPhone = Boolean(boundPhoneNumber && boundPhoneNumber !== phoneDraft);
  const selectedSecurityQuestion = securityQuestionOptions.includes(
    securityQuestionDraft as (typeof securityQuestionOptions)[number],
  )
    ? securityQuestionDraft
    : CUSTOM_SECURITY_QUESTION_VALUE;
  const loginAccountValue = formatLoginAccount(profile?.account, boundPhoneNumber, locale);
  const loginAccountHint = describeLoginAccount(profile?.account, boundPhoneNumber, locale);
  const setupChecklistItems = getSetupChecklistItems(setupRequirements, locale);
  const setupSubmitLabel = getSetupSubmitLabel(setupRequirements, locale);

  useEffect(() => {
    if (phoneCodeCooldown <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setPhoneCodeCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [phoneCodeCooldown]);

  useEffect(() => {
    if (oldPhoneCodeCooldown <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setOldPhoneCodeCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [oldPhoneCodeCooldown]);

  useEffect(() => {
    const rawTab = searchParams.get('tab');
    if (rawTab === 'share') {
      if (tenantSlug) {
        router.replace(`/app/${tenantSlug}/share-presentation`);
      }
      return;
    }
    setActiveTab(normalizeAccountTab(rawTab));
  }, [router, searchParams, tenantSlug]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setMessage(null);

    void (async () => {
      try {
        const access = await ensureTenantRouteSession({
          tenantSlug,
          missingTenantMessage: messages.missingTenant,
          router,
        });

        if (!access.ok) {
          if (!cancelled) {
            if (access.reason === 'missing-tenant') {
              setError(access.message ?? messages.missingTenant);
            }
            setLoading(false);
          }
          return;
        }

        const [profileResponse, securityResponse, phoneBindingResponse] = await Promise.all([
          apiRequest('/me/profile', {
            responseSchema: meProfileResponseSchema,
          }),
          apiRequest('/me/security-profile', {
            responseSchema: mySecurityProfileResponseSchema,
          }),
          apiRequest('/me/phone-binding', {
            responseSchema: myPhoneBindingResponseSchema,
          }),
        ]);

        if (cancelled) {
          return;
        }

        setProfile(profileResponse.profile);
        setNameDraft(profileResponse.profile.name ?? '');
        setBoundPhoneNumber(phoneBindingResponse.binding?.phoneNumber ?? null);
        setPhoneDraft(phoneBindingResponse.binding?.phoneNumber ?? '');
        setPhoneCodeDraft('');
        setPhoneCodeCooldown(0);
        setOldPhoneCodeDraft('');
        setOldPhoneCodeCooldown(0);
        const nextSetupRequirements = resolveProfileSetupRequirements(
          profileResponse.profile,
          securityResponse.profile,
        );
        setSetupRequirements(nextSetupRequirements);
        setSecurityQuestionDraft(
          securityResponse.profile?.question ??
            (nextSetupRequirements.needsSecurity ? securityQuestionOptions[0] ?? '' : ''),
        );
        setSecurityAnswerDraft('');
      } catch (requestError) {
        if (!cancelled) {
          setError(formatApiError(requestError, undefined, locale));
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
  }, [router, tenantSlug, needsSetup, locale, messages.missingTenant, securityQuestionOptions]);

  useEffect(() => {
    if (!loading && needsSetup && !mustCompleteSetup && tenantSlug) {
      router.replace(`/app/${tenantSlug}`);
    }
  }, [loading, mustCompleteSetup, needsSetup, router, tenantSlug]);

  async function handleSaveProfile() {
    setSavingProfile(true);
    setError(null);
    setMessage(null);

    try {
      const payload = updateMeProfileRequestSchema.parse({
        name: nameDraft.trim() ? nameDraft.trim() : null,
      });
      const response = await apiRequest('/me/profile', {
        method: 'PUT',
        body: payload,
        requestSchema: updateMeProfileRequestSchema,
        responseSchema: updateMeProfileResponseSchema,
      });

      setProfile(response.profile);
      setNameDraft(response.profile.name ?? '');
      setSetupRequirements((current) => ({
        ...current,
        needsDisplayName: !response.profile.name?.trim(),
      }));
      setMessage(messages.profileUpdated);
    } catch (requestError) {
      setError(formatApiError(requestError, undefined, locale));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) {
      setError(messages.passwordMismatch);
      return;
    }

    setSavingPassword(true);
    setError(null);
    setMessage(null);

    try {
      const payload = updateMyPasswordRequestSchema.parse({
        currentPassword: currentPassword.trim() ? currentPassword.trim() : undefined,
        newPassword,
      });
      await apiRequest('/me/password', {
        method: 'PUT',
        body: payload,
        requestSchema: updateMyPasswordRequestSchema,
        responseSchema: updateMyPasswordResponseSchema,
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSetupRequirements((current) => ({
        ...current,
        needsPassword: false,
      }));
      setMessage(messages.passwordUpdated);
    } catch (requestError) {
      setError(formatApiError(requestError, undefined, locale));
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleSendPhoneCode() {
    if (!/^1\d{10}$/.test(phoneDraft)) {
      setError(messages.phoneInvalid);
      return;
    }

    setSendingPhoneCode(true);
    setError(null);
    setMessage(null);

    try {
      const payload = requestSmsCodeRequestSchema.parse({
        phoneNumber: phoneDraft,
        purpose: 'binding',
      });
      await apiRequest('/auth/request-sms-code', {
        method: 'POST',
        auth: false,
        body: payload,
        requestSchema: requestSmsCodeRequestSchema,
        responseSchema: requestSmsCodeResponseSchema,
      });

      setPhoneCodeCooldown(60);
      setMessage(messages.smsSentTo(maskPhoneNumber(phoneDraft)));
    } catch (requestError) {
      setError(formatApiError(requestError, undefined, locale));
    } finally {
      setSendingPhoneCode(false);
    }
  }

  async function handleSendOldPhoneCode() {
    if (!boundPhoneNumber || !/^1\d{10}$/.test(boundPhoneNumber)) {
      setError(messages.phoneMissing);
      return;
    }

    setSendingOldPhoneCode(true);
    setError(null);
    setMessage(null);

    try {
      const payload = requestSmsCodeRequestSchema.parse({
        phoneNumber: boundPhoneNumber,
        purpose: 'replace',
      });
      await apiRequest('/auth/request-sms-code', {
        method: 'POST',
        auth: false,
        body: payload,
        requestSchema: requestSmsCodeRequestSchema,
        responseSchema: requestSmsCodeResponseSchema,
      });

      setOldPhoneCodeCooldown(60);
      setMessage(messages.oldSmsSentTo(maskPhoneNumber(boundPhoneNumber)));
    } catch (requestError) {
      setError(formatApiError(requestError, undefined, locale));
    } finally {
      setSendingOldPhoneCode(false);
    }
  }

  async function handleBindPhone() {
    if (!/^1\d{10}$/.test(phoneDraft)) {
      setError(messages.phoneInvalid);
      return;
    }

    if (!/^\d{6}$/.test(phoneCodeDraft)) {
      setError(messages.codeInvalid);
      return;
    }

    if (isReplacingBoundPhone && !/^\d{6}$/.test(oldPhoneCodeDraft)) {
      setError(messages.oldCodeRequired);
      return;
    }

    setSavingPhoneBinding(true);
    setError(null);
    setMessage(null);

    try {
      const payload = upsertMyPhoneBindingRequestSchema.parse({
        phoneNumber: phoneDraft,
        code: phoneCodeDraft,
        oldCode: isReplacingBoundPhone ? oldPhoneCodeDraft : undefined,
      });
      const response = await apiRequest('/me/phone-binding', {
        method: 'PUT',
        body: payload,
        requestSchema: upsertMyPhoneBindingRequestSchema,
        responseSchema: upsertMyPhoneBindingResponseSchema,
      });

      setBoundPhoneNumber(response.binding.phoneNumber);
      setPhoneDraft(response.binding.phoneNumber);
      setPhoneCodeDraft('');
      setOldPhoneCodeDraft('');
      setOldPhoneCodeCooldown(0);
      setMessage(
        isReplacingBoundPhone
          ? messages.phoneReplacedSuccess(maskPhoneNumber(response.binding.phoneNumber))
          : messages.phoneBoundSuccess(maskPhoneNumber(response.binding.phoneNumber)),
      );
    } catch (requestError) {
      setError(formatApiError(requestError, undefined, locale));
    } finally {
      setSavingPhoneBinding(false);
    }
  }

  async function handleSaveSecurityProfile() {
    setSavingSecurity(true);
    setError(null);
    setMessage(null);

    try {
      const payload = upsertMySecurityProfileRequestSchema.parse({
        question: securityQuestionDraft.trim(),
        answer: securityAnswerDraft.trim(),
      });
      await apiRequest('/me/security-profile', {
        method: 'PUT',
        body: payload,
        requestSchema: upsertMySecurityProfileRequestSchema,
        responseSchema: upsertMySecurityProfileResponseSchema,
      });

      setSecurityQuestionDraft(payload.question);
      setSecurityAnswerDraft('');
      setSetupRequirements((current) => ({
        ...current,
        needsSecurity: false,
      }));
      setMessage(messages.securityUpdated);
    } catch (requestError) {
      setError(formatApiError(requestError, undefined, locale));
    } finally {
      setSavingSecurity(false);
    }
  }

  function handleLogout() {
    clearAccessToken();
    router.replace('/login');
  }

  async function handleCompleteSetup() {
    const trimmedName = nameDraft.trim();
    const trimmedSecurityQuestion = securityQuestionDraft.trim();
    const trimmedSecurityAnswer = securityAnswerDraft.trim();

    if (setupRequirements.needsDisplayName && !trimmedName) {
      setError(messages.displayNameRequired);
      return;
    }

    if (setupRequirements.needsPassword && newPassword.length < 8) {
      setError(messages.passwordTooShort);
      return;
    }

    if (setupRequirements.needsPassword && newPassword !== confirmPassword) {
      setError(messages.passwordMismatch);
      return;
    }

    if (setupRequirements.needsSecurity && trimmedSecurityQuestion.length < 2) {
      setError(messages.securityQuestionRequired);
      return;
    }

    if (setupRequirements.needsSecurity && trimmedSecurityAnswer.length < 2) {
      setError(messages.securityAnswerRequired);
      return;
    }

    if (!mustCompleteSetup) {
      router.replace(`/app/${tenantSlug}`);
      return;
    }

    setCompletingSetup(true);
    setError(null);
    setMessage(null);

    try {
      let nextProfile = profile;

      if (setupRequirements.needsDisplayName) {
        const profilePayload = updateMeProfileRequestSchema.parse({
          name: trimmedName,
        });
        const profileResponse = await apiRequest('/me/profile', {
          method: 'PUT',
          body: profilePayload,
          requestSchema: updateMeProfileRequestSchema,
          responseSchema: updateMeProfileResponseSchema,
        });
        nextProfile = profileResponse.profile;
        setProfile(profileResponse.profile);
        setNameDraft(profileResponse.profile.name ?? '');
      }

      if (setupRequirements.needsPassword) {
        const passwordPayload = updateMyPasswordRequestSchema.parse({
          newPassword,
        });
        await apiRequest('/me/password', {
          method: 'PUT',
          body: passwordPayload,
          requestSchema: updateMyPasswordRequestSchema,
          responseSchema: updateMyPasswordResponseSchema,
        });
      }

      if (setupRequirements.needsSecurity) {
        const securityPayload = upsertMySecurityProfileRequestSchema.parse({
          question: trimmedSecurityQuestion,
          answer: trimmedSecurityAnswer,
        });
        await apiRequest('/me/security-profile', {
          method: 'PUT',
          body: securityPayload,
          requestSchema: upsertMySecurityProfileRequestSchema,
          responseSchema: upsertMySecurityProfileResponseSchema,
        });
        setSecurityQuestionDraft(securityPayload.question);
      }

      setProfile(nextProfile);
      setNewPassword('');
      setConfirmPassword('');
      setSecurityAnswerDraft('');
      setSetupRequirements(EMPTY_SETUP_REQUIREMENTS);
      router.replace(`/app/${tenantSlug}`);
    } catch (requestError) {
      setError(toBusinessSetupError(requestError, locale));
    } finally {
      setCompletingSetup(false);
    }
  }

  if (!loading && shouldShowSetup) {
    return (
      <main className="space-y-4 pb-10 sm:space-y-6">
        <AccountSetupCard
          setupChecklistItems={setupChecklistItems}
          loginAccountValue={loginAccountValue}
          loginAccountHint={loginAccountHint}
          boundPhoneNumber={boundPhoneNumber}
          setupRequirements={setupRequirements}
          selectedSecurityQuestion={selectedSecurityQuestion}
          securityQuestionDraft={securityQuestionDraft}
          securityAnswerDraft={securityAnswerDraft}
          nameDraft={nameDraft}
          newPassword={newPassword}
          confirmPassword={confirmPassword}
          completingSetup={completingSetup}
          setupSubmitLabel={setupSubmitLabel}
          securityQuestionOptions={[...securityQuestionOptions]}
          onNameDraftChange={setNameDraft}
          onNewPasswordChange={setNewPassword}
          onConfirmPasswordChange={setConfirmPassword}
          onSelectedSecurityQuestionChange={(value) => {
            setSecurityQuestionDraft(value === CUSTOM_SECURITY_QUESTION_VALUE ? '' : value);
          }}
          onSecurityQuestionDraftChange={setSecurityQuestionDraft}
          onSecurityAnswerDraftChange={setSecurityAnswerDraft}
          onCompleteSetup={() => void handleCompleteSetup()}
        />

        {error ? (
          <Card className="rounded-2xl border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-700">{error}</p>
          </Card>
        ) : null}
      </main>
    );
  }

  return (
    <main className="space-y-4 pb-10 sm:space-y-6">
      <AccountSectionNav tenantSlug={tenantSlug} active={activeTab} />

      {loading ? (
        <Card className="rounded-2xl border-neutral-200/90 bg-white p-6">
          <p className="text-sm text-neutral-600">{messages.loading}</p>
        </Card>
      ) : null}

      {!loading && activeTab === 'profile' ? (
        <AccountProfileOverview
          loginAccountValue={loginAccountValue}
          loginAccountHint={loginAccountHint}
          profileCreatedAt={profile?.createdAt}
          passwordUpdatedAt={profile?.passwordUpdatedAt}
          nameDraft={nameDraft}
          onNameDraftChange={setNameDraft}
          savingProfile={savingProfile}
          onSaveProfile={() => void handleSaveProfile()}
          boundPhoneNumber={boundPhoneNumber}
          phoneDraft={phoneDraft}
          onPhoneDraftChange={setPhoneDraft}
          phoneCodeDraft={phoneCodeDraft}
          onPhoneCodeDraftChange={setPhoneCodeDraft}
          phoneCodeCooldown={phoneCodeCooldown}
          sendingPhoneCode={sendingPhoneCode}
          onSendPhoneCode={() => void handleSendPhoneCode()}
          isReplacingBoundPhone={isReplacingBoundPhone}
          oldPhoneCodeDraft={oldPhoneCodeDraft}
          onOldPhoneCodeDraftChange={setOldPhoneCodeDraft}
          oldPhoneCodeCooldown={oldPhoneCodeCooldown}
          sendingOldPhoneCode={sendingOldPhoneCode}
          onSendOldPhoneCode={() => void handleSendOldPhoneCode()}
          savingPhoneBinding={savingPhoneBinding}
          onBindPhone={() => void handleBindPhone()}
          currentPassword={currentPassword}
          onCurrentPasswordChange={setCurrentPassword}
          newPassword={newPassword}
          onNewPasswordChange={setNewPassword}
          confirmPassword={confirmPassword}
          onConfirmPasswordChange={setConfirmPassword}
          savingPassword={savingPassword}
          onSavePassword={() => void handleChangePassword()}
          selectedSecurityQuestion={selectedSecurityQuestion}
          securityQuestionOptions={[...securityQuestionOptions]}
          securityQuestionDraft={securityQuestionDraft}
          onSelectedSecurityQuestionChange={(value) => {
            setSecurityQuestionDraft(value === CUSTOM_SECURITY_QUESTION_VALUE ? '' : value);
          }}
          onSecurityQuestionDraftChange={setSecurityQuestionDraft}
          securityAnswerDraft={securityAnswerDraft}
          onSecurityAnswerDraftChange={setSecurityAnswerDraft}
          savingSecurity={savingSecurity}
          onSaveSecurity={() => void handleSaveSecurityProfile()}
          onLogout={handleLogout}
        />
      ) : null}

      {!loading && activeTab === 'subscription' ? (
        <section className="rounded-3xl border border-neutral-200/90 bg-white p-2">
          <SubscriptionPageContent />
        </section>
      ) : null}

      {!loading && activeTab === 'referral' ? (
        <ReferralPanel tenantSlug={tenantSlug} />
      ) : null}

      {message ? (
        <Card className="rounded-2xl border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-700">{message}</p>
        </Card>
      ) : null}
      {error ? (
        <Card className="rounded-2xl border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">{error}</p>
        </Card>
      ) : null}
    </main>
  );
}
