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
import { KeyRound, LogOut, UserRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AccountSectionNav } from '@/components/account-section-nav';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiRequest, clearAccessToken } from '@/lib/api-client';
import { formatApiError } from '@/lib/error-utils';
import { ensureTenantRouteSession } from '@/lib/tenant-route-session';
import AccountSetupCard from '@/app/app/[tenantSlug]/account/account-setup-card';
import {
  CUSTOM_SECURITY_QUESTION_VALUE,
  EMPTY_SETUP_REQUIREMENTS,
  SECURITY_QUESTION_OPTIONS,
  describeLoginAccount,
  formatDate,
  formatLoginAccount,
  getSetupChecklistItems,
  getSetupSubmitLabel,
  maskPhoneNumber,
  normalizeAccountTab,
  resolveProfileSetupRequirements,
  toBusinessSetupError,
  type AccountTab,
  type SetupRequirements,
} from '@/app/app/[tenantSlug]/account/account-page-utils';
import SubscriptionPageContent from '@/app/app/[tenantSlug]/subscription/page';

export default function AccountPage() {
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const searchParams = useSearchParams();
  const tenantSlug = useMemo(() => params.tenantSlug ?? '', [params.tenantSlug]);

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
  const selectedSecurityQuestion = SECURITY_QUESTION_OPTIONS.includes(
    securityQuestionDraft as (typeof SECURITY_QUESTION_OPTIONS)[number],
  )
    ? securityQuestionDraft
    : CUSTOM_SECURITY_QUESTION_VALUE;
  const loginAccountValue = formatLoginAccount(profile?.account, boundPhoneNumber);
  const loginAccountHint = describeLoginAccount(profile?.account, boundPhoneNumber);
  const setupChecklistItems = getSetupChecklistItems(setupRequirements);
  const setupSubmitLabel = getSetupSubmitLabel(setupRequirements);

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
          missingTenantMessage: '缺少 tenantSlug。',
          router,
        });

        if (!access.ok) {
          if (!cancelled) {
            if (access.reason === 'missing-tenant') {
              setError(access.message ?? '缺少 tenantSlug。');
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
            (nextSetupRequirements.needsSecurity ? SECURITY_QUESTION_OPTIONS[0] : ''),
        );
        setSecurityAnswerDraft('');
      } catch (requestError) {
        if (!cancelled) {
          setError(formatApiError(requestError));
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
  }, [router, tenantSlug, needsSetup]);

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
      setMessage('账户资料已更新。');
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致。');
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
      setMessage('密码已更新。');
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleSendPhoneCode() {
    if (!/^1\d{10}$/.test(phoneDraft)) {
      setError('请输入正确的 11 位手机号。');
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
      setMessage(`验证码已发送到 ${maskPhoneNumber(phoneDraft)}。`);
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setSendingPhoneCode(false);
    }
  }

  async function handleSendOldPhoneCode() {
    if (!boundPhoneNumber || !/^1\d{10}$/.test(boundPhoneNumber)) {
      setError('当前账号未绑定可用手机号，请先完成绑定。');
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
      setMessage(`原绑定手机号 ${maskPhoneNumber(boundPhoneNumber)} 的验证码已发送。`);
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setSendingOldPhoneCode(false);
    }
  }

  async function handleBindPhone() {
    if (!/^1\d{10}$/.test(phoneDraft)) {
      setError('请输入正确的 11 位手机号。');
      return;
    }

    if (!/^\d{6}$/.test(phoneCodeDraft)) {
      setError('请输入 6 位验证码。');
      return;
    }

    if (isReplacingBoundPhone && !/^\d{6}$/.test(oldPhoneCodeDraft)) {
      setError('更换手机号前，请先输入原手机号收到的 6 位验证码。');
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
          ? `手机号已更换为 ${maskPhoneNumber(response.binding.phoneNumber)}。`
          : `手机号 ${maskPhoneNumber(response.binding.phoneNumber)} 绑定成功。`,
      );
    } catch (requestError) {
      setError(formatApiError(requestError));
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
      setMessage('密保信息已更新。');
    } catch (requestError) {
      setError(formatApiError(requestError));
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
      setError('请填写显示名称，方便团队成员识别账号归属。');
      return;
    }

    if (setupRequirements.needsPassword && newPassword.length < 8) {
      setError('登录密码至少 8 位，建议使用“字母+数字”的组合。');
      return;
    }

    if (setupRequirements.needsPassword && newPassword !== confirmPassword) {
      setError('两次输入的登录密码不一致，请重新确认。');
      return;
    }

    if (setupRequirements.needsSecurity && trimmedSecurityQuestion.length < 2) {
      setError('请先选择或填写一个密保问题。');
      return;
    }

    if (setupRequirements.needsSecurity && trimmedSecurityAnswer.length < 2) {
      setError('请填写密保答案（至少 2 个字），用于手机号不可用时找回账号。');
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
      setError(toBusinessSetupError(requestError));
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
          <p className="text-sm text-neutral-600">正在加载账户信息…</p>
        </Card>
      ) : null}

      {!loading && activeTab === 'profile' ? (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <UserRound size={18} />
                个人资料
              </CardTitle>
              <CardDescription>
                显示名称用于页面展示；登录账号与绑定手机号分开展示，避免混淆。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="account-login-id">登录账号</Label>
                <Input id="account-login-id" value={loginAccountValue} disabled />
                <p className="text-xs text-neutral-500">{loginAccountHint}</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="account-name">显示名称 / 昵称</Label>
                <Input
                  id="account-name"
                  value={nameDraft}
                  placeholder="例如：Siri 的龟舍"
                  onChange={(event) => setNameDraft(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="account-phone">绑定手机号</Label>
                <Input
                  id="account-phone"
                  value={phoneDraft}
                  inputMode="numeric"
                  maxLength={11}
                  placeholder="请输入 11 位手机号"
                  onChange={(event) =>
                    setPhoneDraft(event.target.value.replace(/\D/g, '').slice(0, 11))
                  }
                />
                <p className="text-xs text-neutral-500">
                  当前绑定：{boundPhoneNumber ? maskPhoneNumber(boundPhoneNumber) : '未绑定'}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="account-phone-code">短信验证码</Label>
                <Input
                  id="account-phone-code"
                  value={phoneCodeDraft}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="请输入 6 位验证码"
                  onChange={(event) =>
                    setPhoneCodeDraft(event.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                />
              </div>
              {isReplacingBoundPhone ? (
                <div className="grid gap-2">
                  <Label htmlFor="account-old-phone-code">原手机号验证码</Label>
                  <Input
                    id="account-old-phone-code"
                    value={oldPhoneCodeDraft}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="请输入原手机号收到的 6 位验证码"
                    onChange={(event) =>
                      setOldPhoneCodeDraft(event.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                  />
                  <p className="text-xs text-neutral-500">
                    正在更换绑定，需验证原手机号：
                    {boundPhoneNumber ? maskPhoneNumber(boundPhoneNumber) : '-'}
                  </p>
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  disabled={sendingPhoneCode || phoneCodeCooldown > 0}
                  onClick={() => void handleSendPhoneCode()}
                >
                  {sendingPhoneCode
                    ? '发送中…'
                    : phoneCodeCooldown > 0
                      ? `${phoneCodeCooldown}s 后重发`
                      : '发送验证码'}
                </Button>
                {isReplacingBoundPhone ? (
                  <Button
                    variant="secondary"
                    disabled={sendingOldPhoneCode || oldPhoneCodeCooldown > 0 || !boundPhoneNumber}
                    onClick={() => void handleSendOldPhoneCode()}
                  >
                    {sendingOldPhoneCode
                      ? '发送中…'
                      : oldPhoneCodeCooldown > 0
                        ? `${oldPhoneCodeCooldown}s 后重发`
                        : '发送原号验证码'}
                  </Button>
                ) : null}
                <Button
                  variant="secondary"
                  disabled={savingPhoneBinding}
                  onClick={() => void handleBindPhone()}
                >
                  {savingPhoneBinding ? '绑定中…' : '绑定手机号'}
                </Button>
              </div>
              <div className="grid gap-1 text-xs text-neutral-500">
                <p>账号创建时间：{formatDate(profile?.createdAt)}</p>
                <p>最近改密时间：{formatDate(profile?.passwordUpdatedAt)}</p>
              </div>
              <Button
                variant="primary"
                disabled={savingProfile}
                onClick={() => void handleSaveProfile()}
              >
                {savingProfile ? '保存中…' : '保存资料'}
              </Button>
            </CardContent>
          </Card>

          <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <KeyRound size={18} />
                修改密码
              </CardTitle>
              <CardDescription>
                首次设置可直接填写新密码；已有密码需先输入当前密码。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="current-password">当前密码</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  placeholder="已有密码时必填"
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-password">新密码</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  placeholder="至少 8 位"
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirm-password">确认新密码</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  placeholder="再次输入新密码"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </div>
              <Button
                variant="secondary"
                disabled={savingPassword}
                onClick={() => void handleChangePassword()}
              >
                {savingPassword ? '更新中…' : '更新密码'}
              </Button>
            </CardContent>
          </Card>

          <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <KeyRound size={18} />
                密保信息
              </CardTitle>
              <CardDescription>
                用于手机号不可用时找回账号，建议设置易记但不易猜的问答。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="security-question-select">密保问题</Label>
                <select
                  id="security-question-select"
                  className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900"
                  value={selectedSecurityQuestion}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setSecurityQuestionDraft(
                      nextValue === CUSTOM_SECURITY_QUESTION_VALUE ? '' : nextValue,
                    );
                  }}
                >
                  {SECURITY_QUESTION_OPTIONS.map((item) => (
                    <option key={`security-option-${item}`} value={item}>
                      {item}
                    </option>
                  ))}
                  <option value={CUSTOM_SECURITY_QUESTION_VALUE}>自定义问题</option>
                </select>
                {selectedSecurityQuestion === CUSTOM_SECURITY_QUESTION_VALUE ? (
                  <Input
                    id="security-question-custom"
                    value={securityQuestionDraft}
                    placeholder="请输入自定义密保问题"
                    onChange={(event) => setSecurityQuestionDraft(event.target.value)}
                  />
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="security-answer">密保答案</Label>
                <Input
                  id="security-answer"
                  value={securityAnswerDraft}
                  placeholder="至少 2 个字符"
                  onChange={(event) => setSecurityAnswerDraft(event.target.value)}
                />
              </div>
              <Button
                variant="secondary"
                disabled={savingSecurity}
                onClick={() => void handleSaveSecurityProfile()}
              >
                {savingSecurity ? '保存中…' : '保存密保'}
              </Button>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {!loading && activeTab === 'subscription' ? (
        <section className="rounded-3xl border border-neutral-200/90 bg-white p-2">
          <SubscriptionPageContent />
        </section>
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

      {!loading && activeTab === 'profile' ? (
        <Card className="rounded-2xl border-neutral-200/90 bg-white p-2 lg:hidden">
          <Button
            variant="ghost"
            className="w-full justify-start text-neutral-700 hover:text-neutral-900"
            onClick={handleLogout}
          >
            <LogOut size={16} />
            <span>退出登录</span>
          </Button>
        </Card>
      ) : null}
    </main>
  );
}
