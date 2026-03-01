'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { cn } from '../lib/utils';

export type UiLocale = 'zh' | 'en';
export type UiTheme = 'light' | 'dark';

type UiPreferencesContextValue = {
  locale: UiLocale;
  setLocale: (locale: UiLocale) => void;
  theme: UiTheme;
  setTheme: (theme: UiTheme) => void;
  hydrated: boolean;
};

const STORAGE_KEYS = {
  locale: 'eggturtle.ui.locale',
  theme: 'eggturtle.ui.theme'
} as const;

const DEFAULT_LOCALE: UiLocale = 'zh';
const DEFAULT_THEME: UiTheme = 'light';

const UiPreferencesContext = createContext<UiPreferencesContextValue | null>(null);

const CONTROLS_COPY = {
  zh: {
    localeLabel: '语言',
    themeLabel: '主题',
    localeZh: '中文',
    localeEn: 'English',
    themeLight: '日间',
    themeDark: '夜间'
  },
  en: {
    localeLabel: 'Language',
    themeLabel: 'Theme',
    localeZh: 'Chinese',
    localeEn: 'English',
    themeLight: 'Light',
    themeDark: 'Dark'
  }
} as const;

function normalizeLocale(value: string | null): UiLocale {
  return value === 'en' ? 'en' : 'zh';
}

function normalizeTheme(value: string | null): UiTheme {
  return value === 'dark' ? 'dark' : 'light';
}

function applyDocumentPreferences(locale: UiLocale, theme: UiTheme) {
  const root = document.documentElement;
  root.lang = locale === 'zh' ? 'zh-CN' : 'en';
  root.dataset.locale = locale;
  root.dataset.theme = theme;
  root.classList.toggle('dark', theme === 'dark');

  const { body } = document;
  body.dataset.locale = locale;
  body.dataset.theme = theme;
}

export function UiPreferencesProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<UiLocale>(DEFAULT_LOCALE);
  const [theme, setThemeState] = useState<UiTheme>(DEFAULT_THEME);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const nextLocale = normalizeLocale(window.localStorage.getItem(STORAGE_KEYS.locale));
    const nextTheme = normalizeTheme(window.localStorage.getItem(STORAGE_KEYS.theme));

    setLocaleState(nextLocale);
    setThemeState(nextTheme);
    applyDocumentPreferences(nextLocale, nextTheme);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEYS.locale, locale);
    window.localStorage.setItem(STORAGE_KEYS.theme, theme);
    applyDocumentPreferences(locale, theme);
  }, [hydrated, locale, theme]);

  const setLocale = useCallback((nextLocale: UiLocale) => {
    setLocaleState(nextLocale);
  }, []);

  const setTheme = useCallback((nextTheme: UiTheme) => {
    setThemeState(nextTheme);
  }, []);

  const value = useMemo<UiPreferencesContextValue>(
    () => ({
      locale,
      setLocale,
      theme,
      setTheme,
      hydrated
    }),
    [locale, setLocale, theme, setTheme, hydrated]
  );

  return <UiPreferencesContext.Provider value={value}>{children}</UiPreferencesContext.Provider>;
}

export function useUiPreferences() {
  const context = useContext(UiPreferencesContext);

  if (!context) {
    throw new Error('useUiPreferences must be used within UiPreferencesProvider');
  }

  return context;
}

type UiPreferenceControlsProps = {
  className?: string;
};

export function UiPreferenceControls({ className }: UiPreferenceControlsProps) {
  const { locale, setLocale, theme, setTheme } = useUiPreferences();
  const copy = CONTROLS_COPY[locale];
  const localeValue = locale === 'zh' ? copy.localeZh : copy.localeEn;
  const themeValue = theme === 'light' ? copy.themeLight : copy.themeDark;

  return (
    <div className={cn('ui-pref-controls', className)}>
      <PreferenceToggleButton
        ariaLabel={`${copy.localeLabel}: ${localeValue}`}
        icon="locale"
        onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
      />
      <PreferenceToggleButton
        ariaLabel={`${copy.themeLabel}: ${themeValue}`}
        icon={theme === 'light' ? 'theme-light' : 'theme-dark'}
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      />
    </div>
  );
}

type PreferenceToggleButtonProps = {
  ariaLabel: string;
  icon: 'locale' | 'theme-light' | 'theme-dark';
  onClick: () => void;
};

function PreferenceToggleButton({ ariaLabel, icon, onClick }: PreferenceToggleButtonProps) {
  return (
    <button type="button" className="ui-pref-icon-btn" onClick={onClick} aria-label={ariaLabel} title={ariaLabel}>
      <PreferenceIcon type={icon} />
    </button>
  );
}

type PreferenceIconProps = {
  type: 'locale' | 'theme-light' | 'theme-dark';
};

function PreferenceIcon({ type }: PreferenceIconProps) {
  if (type === 'locale') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3 12h18M12 3a14 14 0 0 0 0 18M12 3a14 14 0 0 1 0 18" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }

  if (type === 'theme-light') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
        <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
      <path
        d="M21 13.5A8.9 8.9 0 1 1 10.5 3a8 8 0 0 0 10.5 10.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}
