import { ErrorCode } from '@eggturtle/shared';

import type { UiLocale } from '@/components/ui-preferences';

export const ADMIN_ERROR_MESSAGES: Record<UiLocale, Partial<Record<ErrorCode, string>>> = {
  zh: {
    [ErrorCode.ApiUnavailable]: '后台服务暂不可用，请稍后再试。',
    [ErrorCode.InvalidRequestPayload]: '提交的信息不完整或格式不正确，请检查后重试。',
    [ErrorCode.Unauthorized]: '登录状态已失效，请重新登录。',
    [ErrorCode.Forbidden]: '当前账号没有后台超级管理员权限，请使用超级管理员账号登录。',
    [ErrorCode.InvalidCode]: '验证码不正确，请重新输入。',
    [ErrorCode.ExpiredCode]: '验证码已过期，请重新获取。',
    [ErrorCode.AuthInvalidCredentials]: '账号、手机号、邮箱或密码不正确，请重新输入。',
    [ErrorCode.AuthPhoneNotRegistered]: '该手机号尚未绑定后台账号，请先确认超级管理员手机号绑定。',
    [ErrorCode.AuthCurrentPasswordIncorrect]: '当前密码不正确，请重新输入。',
    [ErrorCode.AuthPasswordSameAsCurrent]: '新密码不能与当前密码相同，请更换后重试。',
  },
  en: {
    [ErrorCode.ApiUnavailable]: 'Admin service is unavailable. Please try again later.',
    [ErrorCode.InvalidRequestPayload]: 'The submitted data is incomplete or invalid. Please review it and try again.',
    [ErrorCode.Unauthorized]: 'Your admin session has expired. Please sign in again.',
    [ErrorCode.Forbidden]: 'This account does not have super-admin access.',
    [ErrorCode.InvalidCode]: 'The verification code is invalid.',
    [ErrorCode.ExpiredCode]: 'The verification code has expired.',
    [ErrorCode.AuthInvalidCredentials]: 'The account, phone number, email, or password is incorrect.',
    [ErrorCode.AuthPhoneNotRegistered]: 'This phone number is not bound to an admin account.',
    [ErrorCode.AuthCurrentPasswordIncorrect]: 'The current password is incorrect.',
    [ErrorCode.AuthPasswordSameAsCurrent]: 'The new password must be different from the current password.',
  },
};

export const GENERIC_ERROR_MESSAGES: Record<UiLocale, string> = {
  zh: '请求失败，请稍后重试。',
  en: 'Request failed. Please try again.',
};

export const NETWORK_ERROR_MESSAGES: Record<UiLocale, { network: string; timeout: string }> = {
  zh: {
    network: '网络请求失败，请检查网络连接后重试。',
    timeout: '请求超时，请稍后重试。',
  },
  en: {
    network: 'Network request failed. Please check your connection and try again.',
    timeout: 'Request timed out. Please try again later.',
  },
};

export const VALIDATION_FIELD_MESSAGES: Record<UiLocale, Record<string, string>> = {
  zh: {
    account: '账号名',
    login: '账号名、手机号或邮箱',
    email: '邮箱',
    password: '密码',
    phoneNumber: '手机号',
    code: '验证码',
    currentPassword: '当前密码',
    newPassword: '新密码',
  },
  en: {
    account: 'Account',
    login: 'Account, phone, or email',
    email: 'Email',
    password: 'Password',
    phoneNumber: 'Phone number',
    code: 'Verification code',
    currentPassword: 'Current password',
    newPassword: 'New password',
  },
};
