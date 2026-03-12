import { ErrorCode } from '@eggturtle/shared';

import type { UiLocale } from '@/components/ui-preferences';

export const ERROR_CODE_MESSAGES: Record<UiLocale, Partial<Record<ErrorCode, string>>> = {
  zh: {
    [ErrorCode.ApiUnavailable]: '服务暂不可用，请稍后再试。',
    [ErrorCode.InvalidRequestPayload]: '请求参数不正确，请检查后重试。',
    [ErrorCode.InvalidCode]: '验证码不正确，请重新输入。',
    [ErrorCode.ExpiredCode]: '验证码已过期，请重新发送。',
    [ErrorCode.Unauthorized]: '登录状态已失效，请重新登录。',
    [ErrorCode.Forbidden]: '暂无权限访问此内容。',
    [ErrorCode.AuthInvalidCredentials]: '账号/手机号或密码不正确，请重新输入。',
    [ErrorCode.AuthPhoneNotRegistered]: '该手机号尚未注册，请先完成开户注册。',
    [ErrorCode.AuthPhoneAlreadyRegistered]: '该手机号已注册，请直接登录。',
    [ErrorCode.AuthAccountTaken]: '该账号已被占用，请更换后重试。',
    [ErrorCode.AuthPhoneBound]: '该手机号已绑定其他账号，请更换手机号后重试。',
    [ErrorCode.AuthPhoneNotAllowed]: '该手机号不可用于此账号，请使用绑定手机号登录。',
    [ErrorCode.AuthOldPhoneCodeRequired]: '更换手机号前，请先输入原手机号收到的验证码。',
    [ErrorCode.AuthCurrentPhoneMissing]: '当前账号未绑定可用手机号，请先完成绑定。',
    [ErrorCode.AuthCurrentPasswordIncorrect]: '当前密码不正确，请重新输入。',
    [ErrorCode.AuthPasswordSameAsCurrent]: '新密码不能和当前密码相同，请更换后重试。',
    [ErrorCode.TenantNotFound]: '当前空间不存在或已失效，正在为你切换到可用工作台。',
    [ErrorCode.NotTenantMember]: '当前登录链接对应的空间不可用，正在为你切换到可用工作台。',
    [ErrorCode.TenantMemberNotFound]: '当前登录链接对应的空间不可用，正在为你切换到可用工作台。',
    [ErrorCode.TenantNotSelected]: '当前账号还未绑定可用空间，请重新登录后重试。',
  },
  en: {
    [ErrorCode.ApiUnavailable]: 'Service unavailable. Please try again later.',
    [ErrorCode.InvalidRequestPayload]: 'Invalid input. Please check and try again.',
    [ErrorCode.InvalidCode]: 'The verification code is invalid.',
    [ErrorCode.ExpiredCode]: 'The verification code has expired.',
    [ErrorCode.Unauthorized]: 'Your session has expired. Please sign in again.',
    [ErrorCode.Forbidden]: "You don't have permission to access this.",
    [ErrorCode.AuthInvalidCredentials]: 'The account/phone or password is incorrect.',
    [ErrorCode.AuthPhoneNotRegistered]: 'This phone number has not been registered yet.',
    [ErrorCode.AuthPhoneAlreadyRegistered]: 'This phone number is already registered. Please sign in.',
    [ErrorCode.AuthAccountTaken]: 'This account is already taken.',
    [ErrorCode.AuthPhoneBound]: 'This phone number is already bound to another account.',
    [ErrorCode.AuthPhoneNotAllowed]:
      'This phone number cannot be used for this account. Please use the bound phone number.',
    [ErrorCode.AuthOldPhoneCodeRequired]:
      'Enter the verification code from the old phone number first.',
    [ErrorCode.AuthCurrentPhoneMissing]: 'No phone number is bound to this account yet.',
    [ErrorCode.AuthCurrentPasswordIncorrect]: 'The current password is incorrect.',
    [ErrorCode.AuthPasswordSameAsCurrent]:
      'Choose a new password that is different from the current one.',
    [ErrorCode.TenantNotFound]:
      'This workspace no longer exists. Redirecting you to an available workspace.',
    [ErrorCode.NotTenantMember]:
      'This workspace is no longer available. Redirecting you to an available workspace.',
    [ErrorCode.TenantMemberNotFound]:
      'This workspace is no longer available. Redirecting you to an available workspace.',
    [ErrorCode.TenantNotSelected]:
      'No workspace is bound to this account yet. Please sign in again.',
  },
};

export const GENERIC_ERROR_MESSAGES: Record<UiLocale, string> = {
  zh: '请求失败，请稍后重试。',
  en: 'Request failed. Please try again.',
};

export const NETWORK_ERROR_MESSAGES: Record<UiLocale, { network: string; timeout: string }> = {
  zh: {
    network: '网络请求失败，请检查网络后重试。',
    timeout: '请求超时，请稍后再试。',
  },
  en: {
    network: 'Network request failed. Please check your connection and try again.',
    timeout: 'Request timed out. Please try again later.',
  },
};
