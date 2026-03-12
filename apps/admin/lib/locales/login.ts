import type { UiLocale } from '@/components/ui-preferences';

export type AdminLoginMessages = {
  productTitle: string;
  productSubtitle: string;
  showcaseEyebrow: string;
  showcaseSecurity: string;
  showcaseOperations: string;
  showcaseInsights: string;
  cardTitle: string;
  cardSubtitle: string;
  checkingSession: string;
  modeLabel: string;
  modePassword: string;
  modeCode: string;
  passwordHint: string;
  codeHint: string;
  loginIdentifierLabel: string;
  loginIdentifierPlaceholder: string;
  phoneLabel: string;
  phonePlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  signingIn: string;
  signInButton: string;
  sending: string;
  requestCode: string;
  codeSentTo: string;
  devCode: string;
  verificationCode: string;
  codePlaceholder: string;
  verifying: string;
  verifyAndSignIn: string;
  changePhone: string;
  identifierRequired: string;
  emailInvalid: string;
  accountInvalid: string;
  phoneInvalid: string;
  passwordRequired: string;
  codeInvalid: string;
  unknownError: string;
};

export const ADMIN_LOGIN_MESSAGES: Record<UiLocale, AdminLoginMessages> = {
  zh: {
    productTitle: '选育溯源档案',
    productSubtitle: '用数据驱动选育优化，提升繁育决策效率。',
    showcaseEyebrow: 'Admin Console',
    showcaseSecurity: '超级管理员权限校验',
    showcaseOperations: '租户订阅 / 用量 / 活跃度总览',
    showcaseInsights: '跨租户运营、审计与数据治理能力',
    cardTitle: '管理后台登录',
    cardSubtitle: '仅超级管理员账号可访问，优先使用账号或手机号登录。',
    checkingSession: '正在检查会话状态…',
    modeLabel: '登录模式',
    modePassword: '账号密码',
    modeCode: '手机验证码',
    passwordHint: '推荐使用后台账号或手机号登录；旧邮箱密码仍兼容，但不再作为主入口。',
    codeHint: '短信验证码会发送到已绑定的后台手机号，仅允许超级管理员登录。',
    loginIdentifierLabel: '账号或手机号',
    loginIdentifierPlaceholder: '请输入后台账号或手机号，例如 galaxyxieyu / 13800138000',
    phoneLabel: '手机号',
    phonePlaceholder: '请输入已绑定的 11 位手机号',
    passwordLabel: '密码',
    passwordPlaceholder: '请输入后台登录密码…',
    signingIn: '登录中…',
    signInButton: '登录后台',
    sending: '发送中…',
    requestCode: '获取验证码',
    codeSentTo: '验证码已发送至',
    devCode: '开发验证码',
    verificationCode: '验证码',
    codePlaceholder: '请输入 6 位验证码…',
    verifying: '验证中…',
    verifyAndSignIn: '验证并登录',
    changePhone: '更换手机号',
    identifierRequired: '请输入后台账号、手机号，或旧邮箱。',
    emailInvalid: '请输入正确的邮箱地址。',
    accountInvalid: '请输入有效账号名：4-32 位、以字母开头、以字母或数字结尾，可包含数字、下划线、连字符。',
    phoneInvalid: '请输入正确的 11 位中国大陆手机号。',
    passwordRequired: '请输入登录密码。',
    codeInvalid: '请输入 6 位数字验证码。',
    unknownError: '登录失败，请稍后重试。',
  },
  en: {
    productTitle: 'Breeding Traceability Record',
    productSubtitle: 'Data-driven breeding optimization for higher quality and faster decisions.',
    showcaseEyebrow: 'Admin Console',
    showcaseSecurity: 'Super-admin permission enforcement',
    showcaseOperations: 'Tenant subscriptions, usage & activity overview',
    showcaseInsights: 'Cross-tenant operations, audit & governance tools',
    cardTitle: 'Admin Sign In',
    cardSubtitle: 'Only super-admin accounts can access this console.',
    checkingSession: 'Checking session status…',
    modeLabel: 'Login mode',
    modePassword: 'Password',
    modeCode: 'SMS code',
    passwordHint: 'Use your admin account or phone number. Legacy email password sign-in remains compatible.',
    codeHint: 'The verification code is sent to a bound admin phone number and only grants super-admin access.',
    loginIdentifierLabel: 'Account or phone',
    loginIdentifierPlaceholder: 'Enter your admin account or phone, e.g. galaxyxieyu / 13800138000',
    phoneLabel: 'Phone number',
    phonePlaceholder: 'Enter the bound 11-digit phone number',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Enter your admin password…',
    signingIn: 'Signing in…',
    signInButton: 'Sign in to Admin',
    sending: 'Sending…',
    requestCode: 'Request code',
    codeSentTo: 'Verification code sent to',
    devCode: 'Dev code',
    verificationCode: 'Verification code',
    codePlaceholder: 'Enter the 6-digit code…',
    verifying: 'Verifying…',
    verifyAndSignIn: 'Verify & Sign In',
    changePhone: 'Change phone',
    identifierRequired: 'Enter your admin account, phone number, or legacy email.',
    emailInvalid: 'Enter a valid email address.',
    accountInvalid:
      'Enter a valid account name: 4-32 chars, starts with a letter, ends with a letter or number, and only uses letters, numbers, underscores, or hyphens.',
    phoneInvalid: 'Enter a valid 11-digit mainland China mobile number.',
    passwordRequired: 'Enter your password.',
    codeInvalid: 'Enter the 6-digit verification code.',
    unknownError: 'Sign-in failed. Please try again.',
  },
};
