import type { UiLocale } from '@/components/ui-preferences';

export const DASHBOARD_SETTINGS_TAB_MESSAGES: Record<
  UiLocale,
  {
    settingsNav: string;
    signingOut: string;
    signOut: string;
    signOutConfirm: string;
  }
> = {
  zh: {
    settingsNav: '设置二级导航',
    signingOut: '退出中...',
    signOut: '退出登录',
    signOutConfirm: '确定要退出登录吗？',
  },
  en: {
    settingsNav: 'Settings navigation',
    signingOut: 'Signing out...',
    signOut: 'Sign out',
    signOutConfirm: 'Are you sure you want to sign out?',
  },
};

export const DASHBOARD_TOP_TAB_MESSAGES: Record<UiLocale, { primaryNav: string }> = {
  zh: { primaryNav: '主导航' },
  en: { primaryNav: 'Primary navigation' },
};

export const DASHBOARD_SIDEBAR_MESSAGES: Record<
  UiLocale,
  {
    asideAriaLabel: string;
    navAriaLabel: string;
    brandTitle: string;
    brandSubtitle: string;
    hint: string;
  }
> = {
  zh: {
    asideAriaLabel: '后台导航',
    navAriaLabel: '后台主导航',
    brandTitle: '选育溯源档案 平台后台',
    brandSubtitle: '跨用户运维控制台',
    hint: '后台权限由服务端会话与超级管理员权限双重校验。',
  },
  en: {
    asideAriaLabel: 'Admin navigation',
    navAriaLabel: 'Admin primary navigation',
    brandTitle: 'Breeding Traceability Record Admin Console',
    brandSubtitle: 'Cross-tenant operations control',
    hint: 'Access control is enforced by session validation and super-admin permissions.',
  },
};

export const DASHBOARD_BOTTOM_DOCK_MESSAGES: Record<
  UiLocale,
  {
    navAriaLabel: string;
    dataLabel: string;
    managementLabel: string;
    settingsLabel: string;
  }
> = {
  zh: {
    navAriaLabel: '后台移动导航',
    dataLabel: '数据',
    managementLabel: '用户',
    settingsLabel: '设置',
  },
  en: {
    navAriaLabel: 'Admin mobile navigation',
    dataLabel: 'Data',
    managementLabel: 'Users',
    settingsLabel: 'Settings',
  },
};

export const DASHBOARD_TOPBAR_MESSAGES: Record<
  UiLocale,
  {
    collapseSidebar: string;
    expandSidebar: string;
    breadcrumbsLabel: string;
    currentAccount: string;
    signingOut: string;
    signOut: string;
    currentPageFallback: string;
    baseLabel: string;
    overviewLabel: string;
    dataLabel: string;
    usersLabel: string;
    settingsLabel: string;
    tenantLabel: (tenantId: string) => string;
  }
> = {
  zh: {
    collapseSidebar: '收起侧边栏',
    expandSidebar: '展开侧边栏',
    breadcrumbsLabel: '面包屑',
    currentAccount: '当前账号：',
    signingOut: '退出中...',
    signOut: '退出登录',
    currentPageFallback: '平台总览',
    baseLabel: '平台后台',
    overviewLabel: '数据',
    dataLabel: '数据',
    usersLabel: '用户',
    settingsLabel: '设置',
    tenantLabel: (tenantId) => `用户 ${tenantId.slice(0, 8)}`,
  },
  en: {
    collapseSidebar: 'Collapse sidebar',
    expandSidebar: 'Expand sidebar',
    breadcrumbsLabel: 'Breadcrumbs',
    currentAccount: 'Current account:',
    signingOut: 'Signing out...',
    signOut: 'Sign out',
    currentPageFallback: 'Overview',
    baseLabel: 'Admin Console',
    overviewLabel: 'Data',
    dataLabel: 'Data',
    usersLabel: 'Users',
    settingsLabel: 'Settings',
    tenantLabel: (tenantId) => `Tenant ${tenantId.slice(0, 8)}`,
  },
};

export const FORCE_PASSWORD_RESET_MESSAGES: Record<
  UiLocale,
  {
    title: string;
    description: string;
    currentPassword: string;
    currentPasswordPlaceholder: string;
    newPassword: string;
    newPasswordPlaceholder: string;
    confirmPassword: string;
    confirmPasswordPlaceholder: string;
    passwordMismatch: string;
    save: string;
    saving: string;
    accountLabel: string;
    unknownError: string;
  }
> = {
  zh: {
    title: '先修改初始密码',
    description: '这是系统初始化的临时管理员密码。继续使用后台前，请先改成你自己的密码。',
    currentPassword: '当前密码',
    currentPasswordPlaceholder: '请输入当前临时密码',
    newPassword: '新密码',
    newPasswordPlaceholder: '请输入新的后台密码',
    confirmPassword: '确认新密码',
    confirmPasswordPlaceholder: '请再次输入新密码',
    passwordMismatch: '两次输入的新密码不一致。',
    save: '保存并继续',
    saving: '保存中…',
    accountLabel: '当前账号',
    unknownError: '修改密码失败，请稍后重试。',
  },
  en: {
    title: 'Change the bootstrap password first',
    description:
      'This is the temporary admin password created during bootstrap. Change it before continuing to use the console.',
    currentPassword: 'Current password',
    currentPasswordPlaceholder: 'Enter the temporary password',
    newPassword: 'New password',
    newPasswordPlaceholder: 'Enter the new admin password',
    confirmPassword: 'Confirm new password',
    confirmPasswordPlaceholder: 'Enter the new password again',
    passwordMismatch: 'The two new password entries do not match.',
    save: 'Save and continue',
    saving: 'Saving…',
    accountLabel: 'Current account',
    unknownError: 'Failed to update password. Please try again.',
  },
};


export const DASHBOARD_SECTION_MESSAGES: Record<UiLocale, { data: string; users: string; settings: string }> = {
  zh: { data: '数据', users: '用户', settings: '设置' },
  en: { data: 'Data', users: 'Users', settings: 'Settings' },
};

export const DASHBOARD_SEGMENT_MESSAGES: Record<
  UiLocale,
  Record<string, string>
> = {
  zh: {
    'tenant-management': '用户',
    tenants: '用户详情',
    memberships: '成员权限',
    settings: '设置',
    'platform-branding': '平台品牌',
    'tenant-branding': '租户品牌',
    'audit-logs': '审计记录',
    analytics: '活跃度',
    usage: '用量',
    billing: '营收',
    activity: '活跃度视图',
    revenue: '营收视图',
  },
  en: {
    'tenant-management': 'Users',
    tenants: 'Tenant Detail',
    memberships: 'Member Access',
    settings: 'Settings',
    'platform-branding': 'Platform Branding',
    'tenant-branding': 'Tenant Branding',
    'audit-logs': 'Audit Logs',
    analytics: 'Activity',
    usage: 'Usage',
    billing: 'Revenue',
    activity: 'Activity View',
    revenue: 'Revenue View',
  },
};
