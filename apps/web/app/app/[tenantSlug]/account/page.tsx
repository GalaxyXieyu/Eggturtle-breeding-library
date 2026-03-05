'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
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

import { Button } from '../../../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../../components/ui/card';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { apiRequest, clearAccessToken } from '../../../../lib/api-client';
import { formatApiError } from '../../../../lib/error-utils';
import { ensureTenantRouteSession } from '../../../../lib/tenant-route-session';
import { cn } from '../../../../lib/utils';
import SubscriptionPageContent from '../subscription/page';

type AccountTab = 'profile' | 'subscription';

const ACCOUNT_TABS: Array<{ key: AccountTab; label: string }> = [
  { key: 'profile', label: '账号' },
  { key: 'subscription', label: '订阅' },
];
const CUSTOM_SECURITY_QUESTION_VALUE = '__custom__';
const SECURITY_QUESTION_OPTIONS = [
  '我第一只宠物的名字是？',
  '我最常去的城市是？',
  '我小学班主任的姓名是？',
  '我母亲的姓名是？',
  '我父亲的姓名是？',
] as const;

export default function AccountPage() {
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tenantSlug = useMemo(() => params.tenantSlug ?? '', [params.tenantSlug]);

  const [activeTab, setActiveTab] = useState<AccountTab>('profile');
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [sendingPhoneCode, setSendingPhoneCode] = useState(false);
  const [savingPhoneBinding, setSavingPhoneBinding] = useState(false);
  const [completingSetup, setCompletingSetup] = useState(false);
  const [mustCompleteSetup, setMustCompleteSetup] = useState(false);

  const [profile, setProfile] = useState<MeProfile | null>(null);

  const [nameDraft, setNameDraft] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [boundPhoneNumber, setBoundPhoneNumber] = useState<string | null>(null);
  const [phoneDraft, setPhoneDraft] = useState('');
  const [phoneCodeDraft, setPhoneCodeDraft] = useState('');
  const [phoneCodeCooldown, setPhoneCodeCooldown] = useState(0);
  const [securityQuestionDraft, setSecurityQuestionDraft] = useState('');
  const [securityAnswerDraft, setSecurityAnswerDraft] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const needsSetup = searchParams.get('setup') === '1';
  const shouldShowSetup = needsSetup || mustCompleteSetup;
  const selectedSecurityQuestion = SECURITY_QUESTION_OPTIONS.includes(securityQuestionDraft as (typeof SECURITY_QUESTION_OPTIONS)[number])
    ? securityQuestionDraft
    : CUSTOM_SECURITY_QUESTION_VALUE;

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
        const requireSetup = shouldRequireProfileSetup(profileResponse.profile, securityResponse.profile);
        setMustCompleteSetup(requireSetup);
        setSecurityQuestionDraft(
          securityResponse.profile?.question ?? (requireSetup ? SECURITY_QUESTION_OPTIONS[0] : ''),
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

  function switchTab(nextTab: AccountTab) {
    if (nextTab === activeTab) {
      return;
    }

    setActiveTab(nextTab);
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    if (nextTab === 'profile') {
      nextSearchParams.delete('tab');
    } else {
      nextSearchParams.set('tab', nextTab);
    }

    const query = nextSearchParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

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

  async function handleBindPhone() {
    if (!/^1\d{10}$/.test(phoneDraft)) {
      setError('请输入正确的 11 位手机号。');
      return;
    }

    if (!/^\d{6}$/.test(phoneCodeDraft)) {
      setError('请输入 6 位验证码。');
      return;
    }

    setSavingPhoneBinding(true);
    setError(null);
    setMessage(null);

    try {
      const payload = upsertMyPhoneBindingRequestSchema.parse({
        phoneNumber: phoneDraft,
        code: phoneCodeDraft,
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
      setMessage(`手机号 ${maskPhoneNumber(response.binding.phoneNumber)} 绑定成功。`);
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
    if (!trimmedName) {
      setError('请填写用户名，方便团队成员识别账号归属。');
      return;
    }

    if (newPassword.length < 8) {
      setError('登录密码至少 8 位，建议使用“字母+数字”的组合。');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('两次输入的登录密码不一致，请重新确认。');
      return;
    }

    if (trimmedSecurityQuestion.length < 2) {
      setError('请先选择或填写一个密保问题。');
      return;
    }

    if (trimmedSecurityAnswer.length < 2) {
      setError('请填写密保答案（至少 2 个字），用于手机号不可用时找回账号。');
      return;
    }

    setCompletingSetup(true);
    setError(null);
    setMessage(null);

    try {
      const profilePayload = updateMeProfileRequestSchema.parse({
        name: trimmedName,
      });
      const passwordPayload = updateMyPasswordRequestSchema.parse({
        newPassword,
      });
      const securityPayload = upsertMySecurityProfileRequestSchema.parse({
        question: trimmedSecurityQuestion,
        answer: trimmedSecurityAnswer,
      });

      const profileResponse = await apiRequest('/me/profile', {
        method: 'PUT',
        body: profilePayload,
        requestSchema: updateMeProfileRequestSchema,
        responseSchema: updateMeProfileResponseSchema,
      });
      await apiRequest('/me/password', {
        method: 'PUT',
        body: passwordPayload,
        requestSchema: updateMyPasswordRequestSchema,
        responseSchema: updateMyPasswordResponseSchema,
      });
      await apiRequest('/me/security-profile', {
        method: 'PUT',
        body: securityPayload,
        requestSchema: upsertMySecurityProfileRequestSchema,
        responseSchema: upsertMySecurityProfileResponseSchema,
      });

      setProfile(profileResponse.profile);
      setNameDraft(profileResponse.profile.name ?? '');
      setNewPassword('');
      setConfirmPassword('');
      setSecurityQuestionDraft(securityPayload.question);
      setSecurityAnswerDraft('');
      setMustCompleteSetup(false);
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
        <Card className="overflow-hidden rounded-3xl border-[#FFD400]/75 bg-[linear-gradient(145deg,rgba(255,247,213,0.96),rgba(255,255,255,0.98))]">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl text-neutral-900">完成首次登录设置</CardTitle>
            <CardDescription className="text-neutral-700">
              仅需补全必填信息：用户名、登录密码、密保。完成后即可进入工作台。
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="setup-email">登录账号</Label>
              <Input id="setup-email" value={profile?.email ?? ''} disabled />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="setup-name">用户名（必填）</Label>
              <Input
                id="setup-name"
                value={nameDraft}
                placeholder="请输入用户名"
                onChange={(event) => setNameDraft(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="setup-password">登录密码（必填）</Label>
              <Input
                id="setup-password"
                type="password"
                value={newPassword}
                placeholder="至少 8 位"
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="setup-password-confirm">确认密码（必填）</Label>
              <Input
                id="setup-password-confirm"
                type="password"
                value={confirmPassword}
                placeholder="再次输入密码"
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
            <div className="grid gap-2 xl:col-span-2">
              <Label htmlFor="setup-security-question-select">密保问题（必填）</Label>
              <select
                id="setup-security-question-select"
                className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900"
                value={selectedSecurityQuestion}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setSecurityQuestionDraft(nextValue === CUSTOM_SECURITY_QUESTION_VALUE ? '' : nextValue);
                }}
              >
                {SECURITY_QUESTION_OPTIONS.map((item) => (
                  <option key={`setup-security-option-${item}`} value={item}>
                    {item}
                  </option>
                ))}
                <option value={CUSTOM_SECURITY_QUESTION_VALUE}>自定义问题</option>
              </select>
              {selectedSecurityQuestion === CUSTOM_SECURITY_QUESTION_VALUE ? (
                <Input
                  id="setup-security-question-custom"
                  value={securityQuestionDraft}
                  placeholder="请输入自定义密保问题"
                  onChange={(event) => setSecurityQuestionDraft(event.target.value)}
                />
              ) : null}
            </div>
            <div className="grid gap-2 xl:col-span-2">
              <Label htmlFor="setup-security-answer">密保答案（必填）</Label>
              <Input
                id="setup-security-answer"
                value={securityAnswerDraft}
                placeholder="至少 2 个字符"
                onChange={(event) => setSecurityAnswerDraft(event.target.value)}
              />
            </div>
            <div className="xl:col-span-2">
              <Button
                variant="default"
                className="bg-neutral-900 text-white hover:bg-neutral-800 disabled:bg-neutral-900 disabled:text-white"
                disabled={completingSetup}
                onClick={() => void handleCompleteSetup()}
              >
                {completingSetup ? '提交中...' : '完成并进入工作台'}
              </Button>
            </div>
          </CardContent>
        </Card>

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
      <section className="flex flex-wrap gap-2">
        {ACCOUNT_TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => switchTab(item.key)}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm font-semibold transition',
              activeTab === item.key
                ? 'border-neutral-900 bg-neutral-900 text-white'
                : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:text-neutral-900',
            )}
          >
            {item.label}
          </button>
        ))}
      </section>

      {loading ? (
        <Card className="rounded-2xl border-neutral-200/90 bg-white p-6">
          <p className="text-sm text-neutral-600">正在加载账户信息...</p>
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
              <CardDescription>姓名可编辑，邮箱为登录账号。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="account-email">邮箱</Label>
                <Input id="account-email" value={profile?.email ?? ''} disabled />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="account-name">显示名称</Label>
                <Input
                  id="account-name"
                  value={nameDraft}
                  placeholder="请输入姓名或昵称"
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
                  onChange={(event) => setPhoneDraft(event.target.value.replace(/\D/g, '').slice(0, 11))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="account-phone-code">短信验证码</Label>
                <Input
                  id="account-phone-code"
                  value={phoneCodeDraft}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="请输入 6 位验证码"
                  onChange={(event) => setPhoneCodeDraft(event.target.value.replace(/\D/g, '').slice(0, 6))}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  disabled={sendingPhoneCode || phoneCodeCooldown > 0}
                  onClick={() => void handleSendPhoneCode()}
                >
                  {sendingPhoneCode
                    ? '发送中...'
                    : phoneCodeCooldown > 0
                      ? `${phoneCodeCooldown}s 后重发`
                      : '发送验证码'}
                </Button>
                <Button
                  variant="secondary"
                  disabled={savingPhoneBinding}
                  onClick={() => void handleBindPhone()}
                >
                  {savingPhoneBinding ? '绑定中...' : '绑定手机号'}
                </Button>
              </div>
              <p className="text-xs text-neutral-500">
                当前绑定：{boundPhoneNumber ? maskPhoneNumber(boundPhoneNumber) : '未绑定'}
              </p>
              <div className="grid gap-1 text-xs text-neutral-500">
                <p>账号创建时间：{formatDate(profile?.createdAt)}</p>
                <p>最近改密时间：{formatDate(profile?.passwordUpdatedAt)}</p>
              </div>
              <Button
                variant="primary"
                disabled={savingProfile}
                onClick={() => void handleSaveProfile()}
              >
                {savingProfile ? '保存中...' : '保存资料'}
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
                {savingPassword ? '更新中...' : '更新密码'}
              </Button>
            </CardContent>
          </Card>

          <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <KeyRound size={18} />
                密保信息
              </CardTitle>
              <CardDescription>用于手机号不可用时找回账号，建议设置易记但不易猜的问答。</CardDescription>
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
                    setSecurityQuestionDraft(nextValue === CUSTOM_SECURITY_QUESTION_VALUE ? '' : nextValue);
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
              <Button variant="secondary" disabled={savingSecurity} onClick={() => void handleSaveSecurityProfile()}>
                {savingSecurity ? '保存中...' : '保存密保'}
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

function shouldRequireProfileSetup(profile: MeProfile, securityProfile: { question: string } | null) {
  const hasName = Boolean(profile.name?.trim());
  const hasPassword = Boolean(profile.passwordUpdatedAt);
  const hasSecurityProfile = Boolean(securityProfile?.question?.trim());
  return !(hasName && hasPassword && hasSecurityProfile);
}

function toBusinessSetupError(error: unknown) {
  const rawMessage = formatApiError(error);

  if (rawMessage.includes('Password must be at least 8 characters') || rawMessage.includes('newPassword')) {
    return '登录密码至少 8 位，建议使用“字母+数字”的组合。';
  }
  if (rawMessage.includes('question')) {
    return '请先选择或填写一个密保问题。';
  }
  if (rawMessage.includes('answer')) {
    return '请填写密保答案（至少 2 个字），用于手机号不可用时找回账号。';
  }

  return rawMessage;
}

function normalizeAccountTab(value: string | null): AccountTab {
  if (value === 'subscription') {
    return 'subscription';
  }

  return 'profile';
}

function maskPhoneNumber(phoneNumber: string): string {
  if (!/^1\d{10}$/.test(phoneNumber)) {
    return phoneNumber;
  }

  return `${phoneNumber.slice(0, 3)}****${phoneNumber.slice(-4)}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}
