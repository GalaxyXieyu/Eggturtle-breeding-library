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
import {
  CUSTOM_SECURITY_QUESTION_VALUE,
  SECURITY_QUESTION_OPTIONS,
  maskPhoneNumber,
  type SetupRequirements,
} from '@/app/app/[tenantSlug]/account/account-page-utils';

type AccountSetupCardProps = {
  setupChecklistItems: string[];
  loginAccountValue: string;
  loginAccountHint: string;
  boundPhoneNumber: string | null;
  setupRequirements: SetupRequirements;
  selectedSecurityQuestion: string;
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
  return (
    <Card className="overflow-hidden rounded-3xl border-[#FFD400]/75 bg-[linear-gradient(145deg,rgba(255,247,213,0.96),rgba(255,255,255,0.98))]">
      <CardHeader className="space-y-3">
        <CardTitle className="text-2xl text-neutral-900">完成首次登录设置</CardTitle>
        <CardDescription className="text-neutral-700">
          {setupChecklistItems.length > 0
            ? `仅需补全 ${setupChecklistItems.join('、')}，完成后即可进入工作台。`
            : '账号资料已完整，正在为你进入工作台。'}
        </CardDescription>
        {setupChecklistItems.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {setupChecklistItems.map((item) => (
              <span
                key={item}
                className="rounded-full border border-[#e1bb35] bg-white/80 px-3 py-1 text-xs font-semibold text-[#7a5b00]"
              >
                待完成：{item}
              </span>
            ))}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="setup-login-account">登录账号</Label>
          <Input id="setup-login-account" value={loginAccountValue} disabled />
          <p className="text-xs text-neutral-500">{loginAccountHint}</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="setup-bound-phone">已绑定手机号</Label>
          <Input
            id="setup-bound-phone"
            value={boundPhoneNumber ? maskPhoneNumber(boundPhoneNumber) : '未绑定'}
            disabled
          />
          <p className="text-xs text-neutral-500">手机号可用于“手机号 + 密码 / 验证码”登录。</p>
        </div>

        {setupRequirements.needsDisplayName ? (
          <div className="grid gap-2 xl:col-span-2">
            <Label htmlFor="setup-name">显示名称（必填）</Label>
            <Input
              id="setup-name"
              value={nameDraft}
              placeholder="例如：Siri 的龟舍"
              onChange={(event) => onNameDraftChange(event.target.value)}
            />
            <p className="text-xs text-neutral-500">显示名称用于团队识别与页面展示，可后续随时修改。</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-700 xl:col-span-2">
            显示名称已准备好，后续可在“账号”页继续修改昵称。
          </div>
        )}

        {setupRequirements.needsPassword ? (
          <>
            <div className="grid gap-2">
              <Label htmlFor="setup-password">登录密码（必填）</Label>
              <Input
                id="setup-password"
                type="password"
                value={newPassword}
                placeholder="至少 8 位"
                onChange={(event) => onNewPasswordChange(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="setup-password-confirm">确认密码（必填）</Label>
              <Input
                id="setup-password-confirm"
                type="password"
                value={confirmPassword}
                placeholder="再次输入密码"
                onChange={(event) => onConfirmPasswordChange(event.target.value)}
              />
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-700 xl:col-span-2">
            登录密码已创建，可直接使用“账号/手机号 + 密码”登录。
          </div>
        )}

        {setupRequirements.needsSecurity ? (
          <>
            <div className="grid gap-2 xl:col-span-2">
              <Label htmlFor="setup-security-question-select">密保问题（必填）</Label>
              <select
                id="setup-security-question-select"
                className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900"
                value={selectedSecurityQuestion}
                onChange={(event) => onSelectedSecurityQuestionChange(event.target.value)}
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
                  onChange={(event) => onSecurityQuestionDraftChange(event.target.value)}
                />
              ) : null}
            </div>
            <div className="grid gap-2 xl:col-span-2">
              <Label htmlFor="setup-security-answer">密保答案（必填）</Label>
              <Input
                id="setup-security-answer"
                value={securityAnswerDraft}
                placeholder="至少 2 个字符"
                onChange={(event) => onSecurityAnswerDraftChange(event.target.value)}
              />
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-700 xl:col-span-2">
            密保信息已完善，当前账号无需补充其他首次设置项。
          </div>
        )}

        <div className="xl:col-span-2">
          <Button
            variant="default"
            className="bg-neutral-900 text-white hover:bg-neutral-800 disabled:bg-neutral-900 disabled:text-white"
            disabled={completingSetup}
            onClick={onCompleteSetup}
          >
            {completingSetup ? '提交中…' : setupSubmitLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
