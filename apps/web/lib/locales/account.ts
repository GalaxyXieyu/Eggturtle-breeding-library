import type { UiLocale } from '@/components/ui-preferences';

export const ACCOUNT_SECURITY_QUESTIONS: Record<UiLocale, readonly string[]> = {
  zh: [
    '我第一只宠物的名字是？',
    '我最常去的城市是？',
    '我小学班主任的姓名是？',
    '我母亲的姓名是？',
    '我父亲的姓名是？',
  ],
  en: [
    'What was the name of my first pet?',
    'Which city do I visit most often?',
    'What is the name of my primary school teacher?',
    "What is my mother's name?",
    "What is my father's name?",
  ],
};

export const ACCOUNT_SETUP_LABELS: Record<
  UiLocale,
  { displayName: string; password: string; security: string }
> = {
  zh: {
    displayName: '显示名称',
    password: '登录密码',
    security: '密保信息',
  },
  en: {
    displayName: 'Display name',
    password: 'Password',
    security: 'Security Q&A',
  },
};

export const ACCOUNT_SETUP_SUBMIT_LABELS: Record<
  UiLocale,
  {
    securityOnly: string;
    passwordOnly: string;
    profileOnly: string;
    all: string;
  }
> = {
  zh: {
    securityOnly: '保存密保并进入工作台',
    passwordOnly: '保存密码并进入工作台',
    profileOnly: '保存资料并进入工作台',
    all: '完成设置并进入工作台',
  },
  en: {
    securityOnly: 'Save security info and enter workspace',
    passwordOnly: 'Save password and enter workspace',
    profileOnly: 'Save profile and enter workspace',
    all: 'Complete setup and enter workspace',
  },
};

export const ACCOUNT_LOGIN_ACCOUNT_MESSAGES: Record<
  UiLocale,
  {
    phoneOnly: (phone: string) => string;
    accountHint: string;
    phoneHint: (phone: string) => string;
    missingHint: string;
  }
> = {
  zh: {
    phoneOnly: (phone) => `仅手机号登录 (${phone})`,
    accountHint: '该账号用于“账号 + 密码”登录，当前不支持直接修改。',
    phoneHint: (phone) => `当前请使用手机号 ${phone} 登录。`,
    missingHint: '当前未设置独立登录账号，请先绑定手机号登录。',
  },
  en: {
    phoneOnly: (phone) => `Phone-only login (${phone})`,
    accountHint: 'This account is used for password sign-in and cannot be changed here.',
    phoneHint: (phone) => `Please sign in with the bound phone number ${phone}.`,
    missingHint: 'No account is set yet. Please bind a phone number to sign in.',
  },
};

export const ACCOUNT_PAGE_MESSAGES: Record<
  UiLocale,
  {
    loading: string;
    missingTenant: string;
    profileUpdated: string;
    passwordUpdated: string;
    securityUpdated: string;
    phoneInvalid: string;
    codeInvalid: string;
    oldCodeRequired: string;
    phoneMissing: string;
    displayNameRequired: string;
    passwordTooShort: string;
    passwordMismatch: string;
    securityQuestionRequired: string;
    securityAnswerRequired: string;
    smsSentTo: (phone: string) => string;
    oldSmsSentTo: (phone: string) => string;
    phoneBoundSuccess: (phone: string) => string;
    phoneReplacedSuccess: (phone: string) => string;
  }
> = {
  zh: {
    loading: '正在加载账户信息…',
    missingTenant: '缺少 tenantSlug。',
    profileUpdated: '账户资料已更新。',
    passwordUpdated: '密码已更新。',
    securityUpdated: '密保信息已更新。',
    phoneInvalid: '请输入正确的 11 位手机号。',
    codeInvalid: '请输入 6 位验证码。',
    oldCodeRequired: '更换手机号前，请先输入原手机号收到的 6 位验证码。',
    phoneMissing: '当前账号未绑定可用手机号，请先完成绑定。',
    displayNameRequired: '请填写显示名称，方便团队成员识别账号归属。',
    passwordTooShort: '登录密码至少 8 位，建议使用“字母+数字”的组合。',
    passwordMismatch: '两次输入的登录密码不一致，请重新确认。',
    securityQuestionRequired: '请先选择或填写一个密保问题。',
    securityAnswerRequired: '请填写密保答案（至少 2 个字），用于手机号不可用时找回账号。',
    smsSentTo: (phone) => `验证码已发送到 ${phone}。`,
    oldSmsSentTo: (phone) => `原绑定手机号 ${phone} 的验证码已发送。`,
    phoneBoundSuccess: (phone) => `手机号 ${phone} 绑定成功。`,
    phoneReplacedSuccess: (phone) => `手机号已更换为 ${phone}。`,
  },
  en: {
    loading: 'Loading account details…',
    missingTenant: 'Missing tenantSlug.',
    profileUpdated: 'Profile updated.',
    passwordUpdated: 'Password updated.',
    securityUpdated: 'Security info updated.',
    phoneInvalid: 'Please enter a valid 11-digit phone number.',
    codeInvalid: 'Please enter a valid 6-digit code.',
    oldCodeRequired: 'Enter the 6-digit code sent to your old phone number first.',
    phoneMissing: 'No bound phone number found. Please bind a phone number first.',
    displayNameRequired: 'Enter a display name so your team can recognize this account.',
    passwordTooShort: 'Password must be at least 8 characters.',
    passwordMismatch: 'Passwords do not match.',
    securityQuestionRequired: 'Select or enter a security question first.',
    securityAnswerRequired: 'Enter an answer (at least 2 characters) for account recovery.',
    smsSentTo: (phone) => `Verification code sent to ${phone}.`,
    oldSmsSentTo: (phone) => `Code sent to the previous phone number ${phone}.`,
    phoneBoundSuccess: (phone) => `Phone number ${phone} bound successfully.`,
    phoneReplacedSuccess: (phone) => `Phone number updated to ${phone}.`,
  },
};

export const ACCOUNT_PROFILE_MESSAGES: Record<
  UiLocale,
  {
    title: string;
    description: string;
    loginAccountLabel: string;
    displayNameLabel: string;
    displayNameEmpty: string;
    displayNamePlaceholder: string;
    displayNameDetail: string;
    saveProfile: string;
    savingProfile: string;
    phoneLabel: string;
    phoneDetail: string;
    phoneFieldLabel: string;
    phonePlaceholder: string;
    phoneBoundLabel: (phone: string) => string;
    phoneUnbound: string;
    phoneCodeLabel: string;
    phoneCodePlaceholder: string;
    oldPhoneCodeLabel: string;
    oldPhoneCodePlaceholder: string;
    send: string;
    sending: string;
    bindPhone: string;
    bindingPhone: string;
    passwordLabel: string;
    passwordDetail: string;
    currentPasswordLabel: string;
    currentPasswordPlaceholder: string;
    newPasswordLabel: string;
    newPasswordPlaceholder: string;
    confirmPasswordLabel: string;
    confirmPasswordPlaceholder: string;
    updatePassword: string;
    updatingPassword: string;
    securityLabel: string;
    securityDetail: string;
    securityQuestionLabel: string;
    securityQuestionCustom: string;
    securityQuestionCustomPlaceholder: string;
    securityAnswerLabel: string;
    securityAnswerPlaceholder: string;
    saveSecurity: string;
    savingSecurity: string;
    logout: string;
    phoneSummaryEmpty: string;
    passwordSummaryEmpty: string;
    passwordSummaryUpdated: (value: string) => string;
    securitySummaryEmpty: string;
    createdAt: (value: string) => string;
  }
> = {
  zh: {
    title: '我的资料',
    description: '先看当前信息，再点某一项进去修改。',
    loginAccountLabel: '登录账号',
    displayNameLabel: '显示名称 / 昵称',
    displayNameEmpty: '未设置显示名称',
    displayNamePlaceholder: '例如：Siri 的龟舍',
    displayNameDetail: '用于页面展示和团队成员识别。',
    saveProfile: '保存资料',
    savingProfile: '保存中…',
    phoneLabel: '绑定手机号',
    phoneDetail: '点击修改手机号、发送验证码或更换绑定。',
    phoneFieldLabel: '手机号',
    phonePlaceholder: '请输入 11 位手机号',
    phoneBoundLabel: (phone) => `当前绑定：${phone}`,
    phoneUnbound: '未绑定',
    phoneCodeLabel: '短信验证码',
    phoneCodePlaceholder: '请输入 6 位验证码',
    oldPhoneCodeLabel: '原手机号验证码',
    oldPhoneCodePlaceholder: '请输入原手机号收到的 6 位验证码',
    send: '发送',
    sending: '发送中…',
    bindPhone: '绑定手机号',
    bindingPhone: '绑定中…',
    passwordLabel: '登录密码',
    passwordDetail: '点击修改密码；已有密码时需先填写当前密码。',
    currentPasswordLabel: '当前密码',
    currentPasswordPlaceholder: '已有密码时必填',
    newPasswordLabel: '新密码',
    newPasswordPlaceholder: '至少 8 位',
    confirmPasswordLabel: '确认新密码',
    confirmPasswordPlaceholder: '再次输入新密码',
    updatePassword: '更新密码',
    updatingPassword: '更新中…',
    securityLabel: '密保信息',
    securityDetail: '用于手机号不可用时找回账号。',
    securityQuestionLabel: '密保问题',
    securityQuestionCustom: '自定义问题',
    securityQuestionCustomPlaceholder: '请输入自定义密保问题',
    securityAnswerLabel: '密保答案',
    securityAnswerPlaceholder: '至少 2 个字符',
    saveSecurity: '保存密保',
    savingSecurity: '保存中…',
    logout: '退出登录',
    phoneSummaryEmpty: '未绑定手机号',
    passwordSummaryEmpty: '尚未设置登录密码',
    passwordSummaryUpdated: (value) => `最近更新：${value}`,
    securitySummaryEmpty: '尚未设置密保',
    createdAt: (value) => `创建于 ${value}`,
  },
  en: {
    title: 'My profile',
    description: 'Review your info first, then tap a section to edit.',
    loginAccountLabel: 'Login account',
    displayNameLabel: 'Display name',
    displayNameEmpty: 'No display name',
    displayNamePlaceholder: 'e.g., Siri Turtle Farm',
    displayNameDetail: 'Shown on pages and used for team recognition.',
    saveProfile: 'Save profile',
    savingProfile: 'Saving…',
    phoneLabel: 'Bound phone',
    phoneDetail: 'Update the phone number or request verification codes.',
    phoneFieldLabel: 'Phone number',
    phonePlaceholder: 'Enter 11-digit phone number',
    phoneBoundLabel: (phone) => `Bound: ${phone}`,
    phoneUnbound: 'Not bound',
    phoneCodeLabel: 'SMS code',
    phoneCodePlaceholder: 'Enter 6-digit code',
    oldPhoneCodeLabel: 'Old phone code',
    oldPhoneCodePlaceholder: 'Enter the 6-digit code from your old phone',
    send: 'Send',
    sending: 'Sending…',
    bindPhone: 'Bind phone',
    bindingPhone: 'Binding…',
    passwordLabel: 'Password',
    passwordDetail: 'Enter the current password before updating.',
    currentPasswordLabel: 'Current password',
    currentPasswordPlaceholder: 'Required if a password exists',
    newPasswordLabel: 'New password',
    newPasswordPlaceholder: 'At least 8 characters',
    confirmPasswordLabel: 'Confirm password',
    confirmPasswordPlaceholder: 'Enter the new password again',
    updatePassword: 'Update password',
    updatingPassword: 'Updating…',
    securityLabel: 'Security Q&A',
    securityDetail: 'Used for account recovery when phone is unavailable.',
    securityQuestionLabel: 'Security question',
    securityQuestionCustom: 'Custom question',
    securityQuestionCustomPlaceholder: 'Enter a custom security question',
    securityAnswerLabel: 'Security answer',
    securityAnswerPlaceholder: 'At least 2 characters',
    saveSecurity: 'Save security info',
    savingSecurity: 'Saving…',
    logout: 'Sign out',
    phoneSummaryEmpty: 'No phone bound',
    passwordSummaryEmpty: 'Password not set',
    passwordSummaryUpdated: (value) => `Last updated: ${value}`,
    securitySummaryEmpty: 'Security info not set',
    createdAt: (value) => `Created ${value}`,
  },
};

export const ACCOUNT_SETUP_MESSAGES: Record<
  UiLocale,
  {
    title: string;
    checklist: (items: string) => string;
    ready: string;
    pendingPrefix: string;
    loginAccountLabel: string;
    boundPhoneLabel: string;
    boundPhoneUnbound: string;
    boundPhoneHint: string;
    displayNameLabel: string;
    displayNamePlaceholder: string;
    displayNameHint: string;
    displayNameDone: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    confirmPasswordLabel: string;
    confirmPasswordPlaceholder: string;
    passwordDone: string;
    securityQuestionLabel: string;
    securityQuestionCustom: string;
    securityQuestionCustomPlaceholder: string;
    securityAnswerLabel: string;
    securityAnswerPlaceholder: string;
    securityDone: string;
    submitting: string;
  }
> = {
  zh: {
    title: '完成首次登录设置',
    checklist: (items) => `仅需补全 ${items}，完成后即可进入工作台。`,
    ready: '账号资料已完整，正在为你进入工作台。',
    pendingPrefix: '待完成：',
    loginAccountLabel: '登录账号',
    boundPhoneLabel: '已绑定手机号',
    boundPhoneUnbound: '未绑定',
    boundPhoneHint: '手机号可用于“手机号 + 密码 / 验证码”登录。',
    displayNameLabel: '显示名称（必填）',
    displayNamePlaceholder: '例如：Siri 的龟舍',
    displayNameHint: '显示名称用于团队识别与页面展示，可后续随时修改。',
    displayNameDone: '显示名称已准备好，后续可在“账号”页继续修改昵称。',
    passwordLabel: '登录密码（必填）',
    passwordPlaceholder: '至少 8 位',
    confirmPasswordLabel: '确认密码（必填）',
    confirmPasswordPlaceholder: '再次输入密码',
    passwordDone: '登录密码已创建，可直接使用“账号/手机号 + 密码”登录。',
    securityQuestionLabel: '密保问题（必填）',
    securityQuestionCustom: '自定义问题',
    securityQuestionCustomPlaceholder: '请输入自定义密保问题',
    securityAnswerLabel: '密保答案（必填）',
    securityAnswerPlaceholder: '至少 2 个字符',
    securityDone: '密保信息已完善，当前账号无需补充其他首次设置项。',
    submitting: '提交中…',
  },
  en: {
    title: 'Complete first-time setup',
    checklist: (items) => `Complete ${items} to enter your workspace.`,
    ready: 'Your profile is complete. Redirecting to the workspace…',
    pendingPrefix: 'Pending: ',
    loginAccountLabel: 'Login account',
    boundPhoneLabel: 'Bound phone',
    boundPhoneUnbound: 'Not bound',
    boundPhoneHint: 'Phone supports password or SMS code sign-in.',
    displayNameLabel: 'Display name (required)',
    displayNamePlaceholder: 'e.g., Siri Turtle Farm',
    displayNameHint: 'Shown on pages and used for team recognition.',
    displayNameDone: 'Display name is ready. You can update it in Account.',
    passwordLabel: 'Password (required)',
    passwordPlaceholder: 'At least 8 characters',
    confirmPasswordLabel: 'Confirm password (required)',
    confirmPasswordPlaceholder: 'Enter the password again',
    passwordDone: 'Password created. You can sign in with account/phone + password.',
    securityQuestionLabel: 'Security question (required)',
    securityQuestionCustom: 'Custom question',
    securityQuestionCustomPlaceholder: 'Enter a custom security question',
    securityAnswerLabel: 'Security answer (required)',
    securityAnswerPlaceholder: 'At least 2 characters',
    securityDone: 'Security info complete. No additional setup is required.',
    submitting: 'Submitting…',
  },
};

export const ACCOUNT_NAV_MESSAGES: Record<
  UiLocale,
  { profile: string; subscription: string; referral: string; certificates: string }
> = {
  zh: {
    profile: '账号',
    subscription: '订阅',
    referral: '邀请',
    certificates: '证书',
  },
  en: {
    profile: 'Account',
    subscription: 'Subscription',
    referral: 'Referral',
    certificates: 'Certificates',
  },
};

export const ACCOUNT_REFERRAL_MESSAGES: Record<
  UiLocale,
  {
    badge: string;
    heroTitle: (days: number) => string;
    heroDesc: string;
    invitedCount: (count: number) => string;
    metrics: {
      awarded: string;
      remaining: string;
      total: string;
      activated: string;
    };
    loading: string;
    days: string;
    people: string;
    shareLinkLabel: string;
    copyLink: string;
    copySuccess: (days: number) => string;
    copyFailed: string;
    bindTitle: string;
    bindingCode: (code: string) => string;
    bindWindow: (hours: number) => string;
    bindPlaceholder: string;
    binding: string;
    bindConfirm: string;
    progressTitle: string;
    progressDesc: string;
    progressEmpty: string;
    rewardsTitle: string;
    rewardsDesc: string;
    rewardsEmpty: string;
    inviteCode: (code: string) => string;
    firstUploadAt: (value: string) => string;
    uploadPending: string;
    rewardAwardedAt: (value: string) => string;
    rewardDelta: (referrerDays: number, inviteeDays: number) => string;
    rewardClipped: string;
    rewardCapped: string;
    statusBound: string;
    statusUploaded: string;
    statusAwarded: string;
    statusSkipped: string;
    triggerFirstUpload: string;
    triggerFirstPayment: string;
    triggerRenewal: string;
  }
> = {
  zh: {
    badge: '邀请奖励',
    heroTitle: (days) => `邀请好友上传首只乌龟，双方各得 ${days} 天`,
    heroDesc:
      '新用户从公开页注册后会自动绑定邀请关系；首次成功上传一只乌龟后，奖励直接延长双方 PRO 到期时间。',
    invitedCount: (count) => `已邀请 ${count} 人`,
    metrics: {
      awarded: '本月已获',
      remaining: '本月剩余',
      total: '累计奖励',
      activated: '已完成上传',
    },
    loading: '加载中…',
    days: '天',
    people: '人',
    shareLinkLabel: '我的邀请链接',
    copyLink: '复制链接',
    copySuccess: (days) => `邀请链接已复制。好友上传首只乌龟后，双方各得 ${days} 天。`,
    copyFailed: '复制失败，请稍后再试。',
    bindTitle: '绑定邀请人',
    bindingCode: (code) => `已绑定邀请码 ${code}`,
    bindWindow: (hours) => `新注册 ${hours} 小时内可手动补绑一次`,
    bindPlaceholder: '填写好友邀请码',
    binding: '绑定中…',
    bindConfirm: '确认绑定',
    progressTitle: '邀请进度',
    progressDesc: '注册即锁定邀请关系；首只乌龟上传成功后，再发放奖励。',
    progressEmpty: '还没有邀请记录。先复制邀请链接，让好友从公开页进入并完成注册。',
    rewardsTitle: '奖励记录',
    rewardsDesc: '兼容展示历史首付/续费奖励，以及新的首只上传奖励。',
    rewardsEmpty: '还没有奖励记录。邀请好友从公开页注册并上传首只乌龟后，就会开始累计。',
    inviteCode: (code) => `邀请码 ${code}`,
    firstUploadAt: (value) => `首只乌龟上传时间：${value}`,
    uploadPending: '尚未完成首只乌龟上传',
    rewardAwardedAt: (value) => `奖励到账时间：${value}`,
    rewardDelta: (referrerDays, inviteeDays) => `邀请人 +${referrerDays} 天，被邀请者 +${inviteeDays} 天`,
    rewardClipped: '本次奖励受月上限裁剪。',
    rewardCapped: '本月奖励已达上限。',
    statusBound: '已绑定',
    statusUploaded: '已上传首只',
    statusAwarded: '已发奖',
    statusSkipped: '奖励跳过',
    triggerFirstUpload: '首只上传奖励',
    triggerFirstPayment: '首付奖励',
    triggerRenewal: '续费奖励',
  },
  en: {
    badge: 'Invite Rewards',
    heroTitle: (days) => `Invite friends to upload their first turtle and both get ${days} days`,
    heroDesc:
      'New users who register from the public page are linked automatically. Once they upload their first turtle, both PRO expiries are extended directly.',
    invitedCount: (count) => `${count} invited`,
    metrics: {
      awarded: 'Awarded This Month',
      remaining: 'Remaining This Month',
      total: 'Total Rewards',
      activated: 'Uploads Completed',
    },
    loading: 'Loading…',
    days: 'days',
    people: 'people',
    shareLinkLabel: 'My invite link',
    copyLink: 'Copy link',
    copySuccess: (days) => `Invite link copied. Both sides get ${days} days after the first upload.`,
    copyFailed: 'Copy failed. Please try again.',
    bindTitle: 'Bind inviter',
    bindingCode: (code) => `Bound invite code ${code}`,
    bindWindow: (hours) => `Manual binding is available once within ${hours} hours after sign-up`,
    bindPlaceholder: 'Enter your friend\'s invite code',
    binding: 'Binding…',
    bindConfirm: 'Confirm binding',
    progressTitle: 'Invite progress',
    progressDesc: 'The invite link is locked at registration. Reward is granted after the first turtle upload.',
    progressEmpty: 'No invite records yet. Copy your invite link and ask your friend to sign up from the public page.',
    rewardsTitle: 'Reward history',
    rewardsDesc: 'Shows historical first-payment/renewal rewards together with the new first-upload reward.',
    rewardsEmpty: 'No reward history yet. Rewards start after invited friends sign up and complete their first upload.',
    inviteCode: (code) => `Invite code ${code}`,
    firstUploadAt: (value) => `First upload: ${value}`,
    uploadPending: 'First upload not completed yet',
    rewardAwardedAt: (value) => `Reward granted: ${value}`,
    rewardDelta: (referrerDays, inviteeDays) => `Inviter +${referrerDays} days, invitee +${inviteeDays} days`,
    rewardClipped: 'This reward was clipped by the monthly cap.',
    rewardCapped: 'The monthly reward cap has been reached.',
    statusBound: 'Bound',
    statusUploaded: 'First upload done',
    statusAwarded: 'Reward granted',
    statusSkipped: 'Reward skipped',
    triggerFirstUpload: 'First upload reward',
    triggerFirstPayment: 'First payment reward',
    triggerRenewal: 'Renewal reward',
  },
};
