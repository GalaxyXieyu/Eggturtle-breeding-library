import type { MeProfile } from '@eggturtle/shared';

import type { UiLocale } from '@/components/ui-preferences';

import { formatApiError } from '@/lib/error-utils';
import {
  ACCOUNT_LOGIN_ACCOUNT_MESSAGES,
  ACCOUNT_SECURITY_QUESTIONS,
  ACCOUNT_SETUP_LABELS,
  ACCOUNT_SETUP_SUBMIT_LABELS,
} from '@/lib/locales/account';

export type AccountTab = 'profile' | 'referral';

export type SetupRequirements = {
  needsDisplayName: boolean;
  needsPassword: boolean;
  needsSecurity: boolean;
};

export const CUSTOM_SECURITY_QUESTION_VALUE = '__custom__';


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

export function getSecurityQuestionOptions(locale: UiLocale) {
  return ACCOUNT_SECURITY_QUESTIONS[locale];
}

export function formatLoginAccount(
  account: string | null | undefined,
  boundPhoneNumber: string | null,
  locale: UiLocale,
) {
  if (account) {
    return account;
  }

  if (boundPhoneNumber) {
    return ACCOUNT_LOGIN_ACCOUNT_MESSAGES[locale].phoneOnly(maskPhoneNumber(boundPhoneNumber));
  }

  return '-';
}

export function describeLoginAccount(
  account: string | null | undefined,
  boundPhoneNumber: string | null,
  locale: UiLocale,
) {
  if (account) {
    return ACCOUNT_LOGIN_ACCOUNT_MESSAGES[locale].accountHint;
  }

  if (boundPhoneNumber) {
    return ACCOUNT_LOGIN_ACCOUNT_MESSAGES[locale].phoneHint(maskPhoneNumber(boundPhoneNumber));
  }

  return ACCOUNT_LOGIN_ACCOUNT_MESSAGES[locale].missingHint;
}

export function getSetupChecklistItems(setupRequirements: SetupRequirements, locale: UiLocale) {
  const labels = ACCOUNT_SETUP_LABELS[locale];
  const items: string[] = [];

  if (setupRequirements.needsDisplayName) {
    items.push(labels.displayName);
  }
  if (setupRequirements.needsPassword) {
    items.push(labels.password);
  }
  if (setupRequirements.needsSecurity) {
    items.push(labels.security);
  }

  return items;
}

export function getSetupSubmitLabel(setupRequirements: SetupRequirements, locale: UiLocale) {
  const labels = ACCOUNT_SETUP_SUBMIT_LABELS[locale];
  if (
    setupRequirements.needsSecurity &&
    !setupRequirements.needsDisplayName &&
    !setupRequirements.needsPassword
  ) {
    return labels.securityOnly;
  }
  if (
    setupRequirements.needsPassword &&
    !setupRequirements.needsDisplayName &&
    !setupRequirements.needsSecurity
  ) {
    return labels.passwordOnly;
  }
  if (
    setupRequirements.needsDisplayName &&
    !setupRequirements.needsPassword &&
    !setupRequirements.needsSecurity
  ) {
    return labels.profileOnly;
  }

  return labels.all;
}

export function toBusinessSetupError(error: unknown, locale: UiLocale) {
  return formatApiError(error, undefined, locale);
}

export function normalizeAccountTab(value: string | null): AccountTab {
  if (value === 'referral') {
    return 'referral';
  }

  return 'profile';
}

export function maskPhoneNumber(phoneNumber: string): string {
  if (!/^1\d{10}$/.test(phoneNumber)) {
    return phoneNumber;
  }

  return `${phoneNumber.slice(0, 3)}****${phoneNumber.slice(-4)}`;
}

export function formatDate(value: string | null | undefined, locale?: UiLocale) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const localeCode = locale === 'en' ? 'en-US' : 'zh-CN';

  return `${date.toLocaleDateString(localeCode)} ${date.toLocaleTimeString(localeCode)}`;

}
