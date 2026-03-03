'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  meProfileResponseSchema,
  type MeProfile,
  updateMeProfileRequestSchema,
  updateMeProfileResponseSchema,
  updateMyPasswordRequestSchema,
  updateMyPasswordResponseSchema,
} from '@eggturtle/shared';
import { KeyRound, UserRound } from 'lucide-react';

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
import { apiRequest } from '../../../../lib/api-client';
import { formatApiError } from '../../../../lib/error-utils';
import { ensureTenantRouteSession } from '../../../../lib/tenant-route-session';
import { cn } from '../../../../lib/utils';
import SubscriptionPageContent from '../subscription/page';

type AccountTab = 'profile' | 'subscription';

const ACCOUNT_TABS: Array<{ key: AccountTab; label: string }> = [
  { key: 'profile', label: '账号' },
  { key: 'subscription', label: '订阅' },
];

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

  const [profile, setProfile] = useState<MeProfile | null>(null);

  const [nameDraft, setNameDraft] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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

        const profileResponse = await apiRequest('/me/profile', {
          responseSchema: meProfileResponseSchema,
        });

        if (cancelled) {
          return;
        }

        setProfile(profileResponse.profile);
        setNameDraft(profileResponse.profile.name ?? '');
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
  }, [router, tenantSlug]);

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
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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
    </main>
  );
}

function normalizeAccountTab(value: string | null): AccountTab {
  if (value === 'subscription') {
    return 'subscription';
  }

  return 'profile';
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
