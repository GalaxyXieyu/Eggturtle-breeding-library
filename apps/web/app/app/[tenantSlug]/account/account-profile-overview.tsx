'use client';

import { useMemo, useState } from 'react';
import { KeyRound, LogOut, Smartphone, UserRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const [activeEditor, setActiveEditor] = useState<EditorKey>(null);

  const phoneSummary = boundPhoneNumber ? maskPhoneNumber(boundPhoneNumber) : '未绑定手机号';
  const passwordSummary = passwordUpdatedAt
    ? `最近更新：${formatDate(passwordUpdatedAt)}`
    : '尚未设置登录密码';
  const securitySummary = securityQuestionDraft.trim()
    ? securityQuestionDraft.trim()
    : '尚未设置密保';
  const loginAccountDetail = useMemo(() => {
    const parts = [loginAccountHint];
    if (profileCreatedAt) {
      parts.push(`创建于 ${formatDate(profileCreatedAt)}`);
    }
    return parts.filter(Boolean).join(' · ');
  }, [loginAccountHint, profileCreatedAt]);

  function toggleEditor(nextEditor: Exclude<EditorKey, null>) {
    setActiveEditor((current) => (current === nextEditor ? null : nextEditor));
  }

  return (
    <section className="relative mx-auto w-full max-w-3xl space-y-3 overflow-x-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top_right,rgba(255,212,0,0.16),transparent_36%),radial-gradient(circle_at_top_left,rgba(255,255,255,0.9),transparent_34%)]" />
      <MobileSettingsHeader
        className="relative"
        eyebrow="Profile Settings"
        title="我的资料"
        titleAs="h2"
        description="先看当前信息，再点某一项进去修改。"
      />

      <SettingsCard>
        <AccountSettingRow
          icon={<UserRound size={16} />}
          label="登录账号"
          summary={loginAccountValue}
          detail={loginAccountDetail}
        />
        <AccountSettingRow
          active={activeEditor === 'name'}
          icon={<UserRound size={16} />}
          label="显示名称 / 昵称"
          summary={nameDraft.trim() || '未设置显示名称'}
          detail="用于页面展示和团队成员识别。"
          onClick={() => toggleEditor('name')}
        />
        {activeEditor === 'name' ? (
          <AccountEditorPanel onClose={() => setActiveEditor(null)}>
            <div className="space-y-2">
              <Label htmlFor="account-name">显示名称 / 昵称</Label>
              <Input
                id="account-name"
                value={nameDraft}
                placeholder="例如：Siri 的龟舍"
                onChange={(event) => onNameDraftChange(event.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Button disabled={savingProfile} onClick={() => void onSaveProfile()}>
                {savingProfile ? '保存中…' : '保存资料'}
              </Button>
            </div>
          </AccountEditorPanel>
        ) : null}

        <AccountSettingRow
          active={activeEditor === 'phone'}
          icon={<Smartphone size={16} />}
          label="绑定手机号"
          summary={phoneSummary}
          detail="点击修改手机号、发送验证码或更换绑定。"
          onClick={() => toggleEditor('phone')}
        />
        {activeEditor === 'phone' ? (
          <AccountEditorPanel onClose={() => setActiveEditor(null)}>
            <div className="space-y-2">
              <Label htmlFor="account-phone">手机号</Label>
              <Input
                id="account-phone"
                value={phoneDraft}
                inputMode="numeric"
                maxLength={11}
                placeholder="请输入 11 位手机号"
                onChange={(event) =>
                  onPhoneDraftChange(event.target.value.replace(/\D/g, '').slice(0, 11))
                }
              />
              <p className="text-xs text-neutral-500">
                当前绑定：{boundPhoneNumber ? maskPhoneNumber(boundPhoneNumber) : '未绑定'}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-phone-code">短信验证码</Label>
              <div className="flex gap-2">
                <Input
                  id="account-phone-code"
                  value={phoneCodeDraft}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="请输入 6 位验证码"
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
                    ? '发送中…'
                    : phoneCodeCooldown > 0
                      ? `${phoneCodeCooldown}s`
                      : '发送'}
                </Button>
              </div>
            </div>
            {isReplacingBoundPhone ? (
              <div className="space-y-2">
                <Label htmlFor="account-old-phone-code">原手机号验证码</Label>
                <div className="flex gap-2">
                  <Input
                    id="account-old-phone-code"
                    value={oldPhoneCodeDraft}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="请输入原手机号收到的 6 位验证码"
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
                      ? '发送中…'
                      : oldPhoneCodeCooldown > 0
                        ? `${oldPhoneCodeCooldown}s`
                        : '发送'}
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="flex justify-end">
              <Button disabled={savingPhoneBinding} onClick={() => void onBindPhone()}>
                {savingPhoneBinding ? '绑定中…' : '绑定手机号'}
              </Button>
            </div>
          </AccountEditorPanel>
        ) : null}
      </SettingsCard>

      <SettingsCard>
        <AccountSettingRow
          active={activeEditor === 'password'}
          icon={<KeyRound size={16} />}
          label="登录密码"
          summary={passwordSummary}
          detail="点击修改密码；已有密码时需先填写当前密码。"
          onClick={() => toggleEditor('password')}
        />
        {activeEditor === 'password' ? (
          <AccountEditorPanel onClose={() => setActiveEditor(null)}>
            <div className="space-y-2">
              <Label htmlFor="current-password">当前密码</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                placeholder="已有密码时必填"
                onChange={(event) => onCurrentPasswordChange(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">新密码</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                placeholder="至少 8 位"
                onChange={(event) => onNewPasswordChange(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">确认新密码</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                placeholder="再次输入新密码"
                onChange={(event) => onConfirmPasswordChange(event.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Button
                variant="secondary"
                disabled={savingPassword}
                onClick={() => void onSavePassword()}
              >
                {savingPassword ? '更新中…' : '更新密码'}
              </Button>
            </div>
          </AccountEditorPanel>
        ) : null}

        <AccountSettingRow
          active={activeEditor === 'security'}
          icon={<KeyRound size={16} />}
          label="密保信息"
          summary={securitySummary}
          detail="用于手机号不可用时找回账号。"
          onClick={() => toggleEditor('security')}
        />
        {activeEditor === 'security' ? (
          <AccountEditorPanel onClose={() => setActiveEditor(null)}>
            <div className="space-y-2">
              <Label htmlFor="security-question-select">密保问题</Label>
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
                <option value={CUSTOM_SECURITY_QUESTION_VALUE}>自定义问题</option>
              </select>
              {selectedSecurityQuestion === CUSTOM_SECURITY_QUESTION_VALUE ? (
                <Input
                  id="security-question-custom"
                  value={securityQuestionDraft}
                  placeholder="请输入自定义密保问题"
                  onChange={(event) => onSecurityQuestionDraftChange(event.target.value)}
                />
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="security-answer">密保答案</Label>
              <Input
                id="security-answer"
                value={securityAnswerDraft}
                placeholder="至少 2 个字符"
                onChange={(event) => onSecurityAnswerDraftChange(event.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Button
                variant="secondary"
                disabled={savingSecurity}
                onClick={() => void onSaveSecurity()}
              >
                {savingSecurity ? '保存中…' : '保存密保'}
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
            <span>退出登录</span>
          </Button>
        </div>
      </SettingsCard>
    </section>
  );
}
