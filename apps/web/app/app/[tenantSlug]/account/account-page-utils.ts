import type { MeProfile } from '@eggturtle/shared';

import { formatApiError } from '@/lib/error-utils';

export type AccountTab = 'profile' | 'subscription';

export type SetupRequirements = {
  needsDisplayName: boolean;
  needsPassword: boolean;
  needsSecurity: boolean;
};

export const CUSTOM_SECURITY_QUESTION_VALUE = '__custom__';

export const SECURITY_QUESTION_OPTIONS = [
  '我第一只宠物的名字是？',
  '我最常去的城市是？',
  '我小学班主任的姓名是？',
  '我母亲的姓名是？',
  '我父亲的姓名是？',
] as const;

export const EMPTY_SETUP_REQUIREMENTS: SetupRequirements = {
  needsDisplayName: false,
  needsPassword: false,
  needsSecurity: false,
};

export function resolveProfileSetupRequirements(
  profile: MeProfile,
  securityProfile: { question: string } | null,
): SetupRequirements {
  return {
    needsDisplayName: !profile.name?.trim(),
    needsPassword: !profile.passwordUpdatedAt,
    needsSecurity: !securityProfile?.question?.trim(),
  };
}

export function formatLoginAccount(account: string | null | undefined, boundPhoneNumber: string | null) {
  if (account) {
    return account;
  }

  if (boundPhoneNumber) {
    return `仅手机号登录 (${maskPhoneNumber(boundPhoneNumber)})`;
  }

  return '-';
}

export function describeLoginAccount(account: string | null | undefined, boundPhoneNumber: string | null) {
  if (account) {
    return '该账号用于“账号 + 密码”登录，当前不支持直接修改。';
  }

  if (boundPhoneNumber) {
    return `当前请使用手机号 ${maskPhoneNumber(boundPhoneNumber)} 登录。`;
  }

  return '当前未设置独立登录账号，请先绑定手机号登录。';
}

export function getSetupChecklistItems(setupRequirements: SetupRequirements) {
  const items: string[] = [];

  if (setupRequirements.needsDisplayName) {
    items.push('显示名称');
  }
  if (setupRequirements.needsPassword) {
    items.push('登录密码');
  }
  if (setupRequirements.needsSecurity) {
    items.push('密保信息');
  }

  return items;
}

export function getSetupSubmitLabel(setupRequirements: SetupRequirements) {
  if (
    setupRequirements.needsSecurity &&
    !setupRequirements.needsDisplayName &&
    !setupRequirements.needsPassword
  ) {
    return '保存密保并进入工作台';
  }
  if (
    setupRequirements.needsPassword &&
    !setupRequirements.needsDisplayName &&
    !setupRequirements.needsSecurity
  ) {
    return '保存密码并进入工作台';
  }
  if (
    setupRequirements.needsDisplayName &&
    !setupRequirements.needsPassword &&
    !setupRequirements.needsSecurity
  ) {
    return '保存资料并进入工作台';
  }

  return '完成设置并进入工作台';
}

export function toBusinessSetupError(error: unknown) {
  const rawMessage = formatApiError(error);

  if (
    rawMessage.includes('Password must be at least 8 characters') ||
    rawMessage.includes('newPassword')
  ) {
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

export function normalizeAccountTab(value: string | null): AccountTab {
  if (value === 'subscription') {
    return 'subscription';
  }

  return 'profile';
}

export function maskPhoneNumber(phoneNumber: string): string {
  if (!/^1\d{10}$/.test(phoneNumber)) {
    return phoneNumber;
  }

  return `${phoneNumber.slice(0, 3)}****${phoneNumber.slice(-4)}`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}
