'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  createShareRequestSchema,
  createShareResponseSchema,
  meProfileResponseSchema,
  meResponseSchema,
  meSubscriptionResponseSchema,
  type MeProfile,
  type TenantSubscription,
  updateMeProfileRequestSchema,
  updateMeProfileResponseSchema,
  updateMyPasswordRequestSchema,
  updateMyPasswordResponseSchema
} from '@eggturtle/shared';
import { Copy, KeyRound, Link2, UserRound, Wallet } from 'lucide-react';

import { ApiError, apiRequest, getAccessToken } from '../../../../lib/api-client';
import { switchTenantBySlug } from '../../../../lib/tenant-session';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';

export default function AccountPage() {
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = useMemo(() => params.tenantSlug ?? '', [params.tenantSlug]);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [generatingShare, setGeneratingShare] = useState(false);

  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [subscription, setSubscription] = useState<TenantSubscription | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);

  const [nameDraft, setNameDraft] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantSlug) {
      setLoading(false);
      setError('缺少 tenantSlug。');
      return;
    }

    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setMessage(null);

    void (async () => {
      try {
        await switchTenantBySlug(tenantSlug);

        const [me, profileResponse, subscriptionResponse] = await Promise.all([
          apiRequest('/me', { responseSchema: meResponseSchema }),
          apiRequest('/me/profile', { responseSchema: meProfileResponseSchema }),
          apiRequest('/me/subscription', { responseSchema: meSubscriptionResponseSchema })
        ]);

        if (cancelled) {
          return;
        }

        setTenantId(me.tenantId ?? null);
        setProfile(profileResponse.profile);
        setNameDraft(profileResponse.profile.name ?? '');
        setSubscription(subscriptionResponse.subscription);
      } catch (requestError) {
        if (!cancelled) {
          setError(formatError(requestError));
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

  async function handleSaveProfile() {
    setSavingProfile(true);
    setError(null);
    setMessage(null);

    try {
      const payload = updateMeProfileRequestSchema.parse({
        name: nameDraft.trim() ? nameDraft.trim() : null
      });
      const response = await apiRequest('/me/profile', {
        method: 'PUT',
        body: payload,
        requestSchema: updateMeProfileRequestSchema,
        responseSchema: updateMeProfileResponseSchema
      });

      setProfile(response.profile);
      setNameDraft(response.profile.name ?? '');
      setMessage('账户资料已更新。');
    } catch (requestError) {
      setError(formatError(requestError));
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
        newPassword
      });
      await apiRequest('/me/password', {
        method: 'PUT',
        body: payload,
        requestSchema: updateMyPasswordRequestSchema,
        responseSchema: updateMyPasswordResponseSchema
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('密码已更新。');
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleGenerateShareLink() {
    if (!tenantId) {
      setError('当前会话没有 tenantId，无法生成分享链接。');
      return;
    }

    setGeneratingShare(true);
    setError(null);
    setMessage(null);

    try {
      const payload = createShareRequestSchema.parse({
        resourceType: 'tenant_feed',
        resourceId: tenantId
      });
      const response = await apiRequest('/shares', {
        method: 'POST',
        body: payload,
        requestSchema: createShareRequestSchema,
        responseSchema: createShareResponseSchema
      });

      setShareLink(response.share.entryUrl);
      setMessage('分享链接已生成，可直接复制。');
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setGeneratingShare(false);
    }
  }

  async function handleCopyShareLink() {
    if (!shareLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(shareLink);
      setMessage('分享链接已复制。');
      setError(null);
    } catch (requestError) {
      setError(formatError(requestError));
    }
  }

  return (
    <main className="space-y-4 pb-10 sm:space-y-6">
      <Card className="rounded-2xl border-neutral-200/90 bg-white/90 p-4">
        <p className="text-sm text-neutral-600">管理个人资料、密码、套餐状态和公开分享链接。</p>
      </Card>

      {loading ? (
        <Card className="rounded-2xl border-neutral-200/90 bg-white p-6">
          <p className="text-sm text-neutral-600">正在加载账户信息...</p>
        </Card>
      ) : (
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
              <Button variant="primary" disabled={savingProfile} onClick={() => void handleSaveProfile()}>
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
              <CardDescription>首次设置可直接填写新密码；已有密码需先输入当前密码。</CardDescription>
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
              <Button variant="secondary" disabled={savingPassword} onClick={() => void handleChangePassword()}>
                {savingPassword ? '更新中...' : '更新密码'}
              </Button>
            </CardContent>
          </Card>

          <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Wallet size={18} />
                套餐状态
              </CardTitle>
              <CardDescription>当前租户订阅与配额信息。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="accent">{subscription?.plan ?? '-'}</Badge>
                <Badge variant={subscription?.status === 'ACTIVE' ? 'success' : 'warning'}>
                  {subscription?.status ?? '-'}
                </Badge>
              </div>
              <div className="grid gap-1 text-neutral-600">
                <p>开始时间：{formatDate(subscription?.startsAt ?? null)}</p>
                <p>到期时间：{formatDate(subscription?.expiresAt ?? null)}</p>
                <p>图片上限：{toDisplayValue(subscription?.maxImages)}</p>
                <p>存储上限：{toDisplayBytes(subscription?.maxStorageBytes)}</p>
                <p>分享上限：{toDisplayValue(subscription?.maxShares)}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Link2 size={18} />
                分享链接
              </CardTitle>
              <CardDescription>一键生成租户公开图鉴入口。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="break-all rounded-2xl border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
                {shareLink ?? '还未生成分享链接，点击下面按钮即可创建。'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" disabled={generatingShare} onClick={() => void handleGenerateShareLink()}>
                  {generatingShare ? '生成中...' : '生成分享链接'}
                </Button>
                <Button variant="secondary" disabled={!shareLink} onClick={() => void handleCopyShareLink()}>
                  <Copy size={14} />
                  复制链接
                </Button>
                <Button variant="secondary" onClick={() => router.push(`/app/${tenantSlug}/share-presentation`)}>
                  分享展示
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

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

function toDisplayValue(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return '不限';
  }

  return `${value}`;
}

function toDisplayBytes(value: string | null | undefined) {
  if (!value) {
    return '不限';
  }

  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return value;
  }

  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(2)} GB`;
}

function formatError(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '未知错误';
}
