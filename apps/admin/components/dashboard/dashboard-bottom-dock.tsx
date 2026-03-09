'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useUiPreferences } from '@/components/ui-preferences';
import { DashboardNavIconGlyph } from '@/components/dashboard/dashboard-nav-icon';
import { dashboardNavGroups, type DashboardNavItem } from '@/components/dashboard/nav-config';

const DOCK_COPY = {
  zh: {
    navAriaLabel: '后台移动导航',
    dataLabel: '数据',
    managementLabel: '管理',
    settingsLabel: '设置',
    settingsPanelTitle: '设置',
    closePanel: '关闭面板',
    switchToDark: '切换夜间主题',
    switchToLight: '切换日间主题',
    signOut: '退出登录'
  },
  en: {
    navAriaLabel: 'Admin mobile navigation',
    dataLabel: 'Data',
    managementLabel: 'Management',
    settingsLabel: 'Settings',
    settingsPanelTitle: 'Settings',
    closePanel: 'Close panel',
    switchToDark: 'Switch to dark theme',
    switchToLight: 'Switch to light theme',
    signOut: 'Sign out'
  }
} as const;

const dataItems = dashboardNavGroups.find((group) => group.id === 'data')?.items ?? [];
const managementItems = dashboardNavGroups.find((group) => group.id === 'users')?.items ?? [];

const dataMatchItems = [...dataItems];
const dataEntry = '/dashboard';
const managementEntry = '/dashboard/tenant-management';

export function DashboardBottomDock() {
  const pathname = usePathname();
  const { locale, theme, setTheme } = useUiPreferences();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const copy = DOCK_COPY[locale];

  const isDataActive = dataMatchItems.some((item) => isNavItemActive(pathname, item));
  const isManagementActive = managementItems.some((item) => isNavItemActive(pathname, item));

  useEffect(() => {
    setSettingsOpen(false);
  }, [pathname]);

  return (
    <>
      <nav className="dashboard-bottom-dock" aria-label={copy.navAriaLabel}>
        <ul className="dashboard-bottom-dock-list">
          <li className="dashboard-bottom-dock-item">
            <Link
              href={dataEntry}
              className={`dashboard-bottom-dock-link${isDataActive ? ' active' : ''}`}
              aria-current={isDataActive ? 'page' : undefined}
            >
              <span className="dashboard-bottom-dock-icon" aria-hidden="true">
                <DashboardNavIconGlyph icon="overview" />
              </span>
              <span className="dashboard-bottom-dock-label">{copy.dataLabel}</span>
            </Link>
          </li>

          <li className="dashboard-bottom-dock-item">
            <Link
              href={managementEntry}
              className={`dashboard-bottom-dock-link${isManagementActive ? ' active' : ''}`}
              aria-current={isManagementActive ? 'page' : undefined}
            >
              <span className="dashboard-bottom-dock-icon" aria-hidden="true">
                <DashboardNavIconGlyph icon="tenantManagement" />
              </span>
              <span className="dashboard-bottom-dock-label">{copy.managementLabel}</span>
            </Link>
          </li>

          <li className="dashboard-bottom-dock-item">
            <button
              type="button"
              className={`dashboard-bottom-dock-link${settingsOpen ? ' active' : ''}`}
              onClick={() => setSettingsOpen((current) => !current)}
              aria-expanded={settingsOpen}
              aria-controls="dashboard-bottom-dock-sheet-panel"
            >
              <span className="dashboard-bottom-dock-icon" aria-hidden="true">
                <SettingsIcon />
              </span>
              <span className="dashboard-bottom-dock-label">{copy.settingsLabel}</span>
            </button>
          </li>
        </ul>
      </nav>

      <div className={`dashboard-bottom-dock-sheet${settingsOpen ? ' is-open' : ''}`} aria-hidden={!settingsOpen}>
        <button
          type="button"
          className="dashboard-bottom-dock-backdrop"
          onClick={() => setSettingsOpen(false)}
          tabIndex={settingsOpen ? 0 : -1}
          aria-label={copy.closePanel}
        />
        <div
          id="dashboard-bottom-dock-sheet-panel"
          className="dashboard-bottom-dock-sheet-panel"
          role="dialog"
          aria-modal="true"
          aria-label={copy.settingsPanelTitle}
        >
          <div className="dashboard-bottom-dock-sheet-header">
            <p className="dashboard-bottom-dock-sheet-title">{copy.settingsPanelTitle}</p>
            <button
              type="button"
              className="dashboard-bottom-dock-close"
              onClick={() => setSettingsOpen(false)}
              aria-label={copy.closePanel}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>

          <ul className="dashboard-bottom-dock-secondary-list is-single-column">
            <li>
              <button
                type="button"
                className="dashboard-bottom-dock-secondary-link dashboard-bottom-dock-setting-action"
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              >
                <span className="dashboard-bottom-dock-secondary-icon" aria-hidden="true">
                  <ThemeIcon theme={theme} />
                </span>
                <span>{theme === 'light' ? copy.switchToDark : copy.switchToLight}</span>
              </button>
            </li>
            <li>
              <Link
                href="/logout"
                className="dashboard-bottom-dock-secondary-link dashboard-bottom-dock-setting-action"
                onClick={() => setSettingsOpen(false)}
              >
                <span className="dashboard-bottom-dock-secondary-icon" aria-hidden="true">
                  <LogoutIcon />
                </span>
                <span>{copy.signOut}</span>
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}

function isNavItemActive(pathname: string, item: DashboardNavItem) {
  if (item.matchStrategy === 'exact') {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14">
      <path
        d="M8 3.2a.9.9 0 0 1 .9-.9h.5a.9.9 0 0 1 .9.9v.6c.4.1.8.3 1.1.6l.5-.3a.9.9 0 0 1 1.2.3l.2.4a.9.9 0 0 1-.3 1.2l-.5.3c.1.4.1.8 0 1.2l.5.3a.9.9 0 0 1 .3 1.2l-.2.4a.9.9 0 0 1-1.2.3l-.5-.3c-.3.3-.7.5-1.1.6v.6a.9.9 0 0 1-.9.9h-.5a.9.9 0 0 1-.9-.9v-.6a3.6 3.6 0 0 1-1.1-.6l-.5.3a.9.9 0 0 1-1.2-.3l-.2-.4a.9.9 0 0 1 .3-1.2l.5-.3a3.6 3.6 0 0 1 0-1.2l-.5-.3a.9.9 0 0 1-.3-1.2l.2-.4a.9.9 0 0 1 1.2-.3l.5.3c.3-.3.7-.5 1.1-.6z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <circle cx="8" cy="8" r="1.8" fill="none" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

function ThemeIcon({ theme }: { theme: 'light' | 'dark' }) {
  if (theme === 'light') {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14">
        <path
          d="M9.6 2.6A5.3 5.3 0 1 0 13.4 10 4.8 4.8 0 0 1 9.6 2.6Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 16 16" width="14" height="14">
      <circle cx="8" cy="8" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M8 1.6v1.5M8 12.9v1.5M14.4 8h-1.5M3.1 8H1.6M12.5 3.5l-1.1 1.1M4.6 11.4l-1.1 1.1M12.5 12.5l-1.1-1.1M4.6 4.6 3.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14">
      <path
        d="M9.5 3.2h2.3a1 1 0 0 1 1 1v7.6a1 1 0 0 1-1 1H9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M7.8 11.1 10.9 8 7.8 4.9M10.7 8H3.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
