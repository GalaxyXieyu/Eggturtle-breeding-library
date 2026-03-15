import type { TenantShareAvatarPreset } from '@eggturtle/shared';

export type ShareAvatarTheme = {
  backgroundFrom: string;
  backgroundTo: string;
  foreground: string;
  ring: string;
  tint: string;
  label: string;
};

export type ShareAvatarPresetOption = {
  value: TenantShareAvatarPreset;
  label: string;
};

const PRESET_THEMES: Record<TenantShareAvatarPreset, ShareAvatarTheme> = {
  amber: {
    backgroundFrom: '#FDE68A',
    backgroundTo: '#F59E0B',
    foreground: '#78350F',
    ring: 'rgba(245, 158, 11, 0.28)',
    tint: 'rgba(251, 191, 36, 0.16)',
    label: '琥珀',
  },
  ocean: {
    backgroundFrom: '#BAE6FD',
    backgroundTo: '#0284C7',
    foreground: '#082F49',
    ring: 'rgba(2, 132, 199, 0.24)',
    tint: 'rgba(14, 165, 233, 0.16)',
    label: '海湾',
  },
  forest: {
    backgroundFrom: '#BBF7D0',
    backgroundTo: '#15803D',
    foreground: '#052E16',
    ring: 'rgba(34, 197, 94, 0.22)',
    tint: 'rgba(34, 197, 94, 0.14)',
    label: '松林',
  },
  plum: {
    backgroundFrom: '#E9D5FF',
    backgroundTo: '#9333EA',
    foreground: '#3B0764',
    ring: 'rgba(147, 51, 234, 0.22)',
    tint: 'rgba(192, 132, 252, 0.16)',
    label: '李紫',
  },
  graphite: {
    backgroundFrom: '#E5E7EB',
    backgroundTo: '#4B5563',
    foreground: '#111827',
    ring: 'rgba(71, 85, 105, 0.24)',
    tint: 'rgba(148, 163, 184, 0.16)',
    label: '石墨',
  },
  sunrise: {
    backgroundFrom: '#FBCFE8',
    backgroundTo: '#FB7185',
    foreground: '#881337',
    ring: 'rgba(251, 113, 133, 0.22)',
    tint: 'rgba(244, 114, 182, 0.16)',
    label: '朝霞',
  },
};

const PRESET_ORDER = Object.keys(PRESET_THEMES) as TenantShareAvatarPreset[];

export const SHARE_AVATAR_PRESET_OPTIONS: ShareAvatarPresetOption[] = PRESET_ORDER.map(
  (preset) => ({
    value: preset,
    label: PRESET_THEMES[preset].label,
  }),
);

export function resolveShareAvatarTheme(
  avatarPreset: TenantShareAvatarPreset | null | undefined,
  seed: string,
): ShareAvatarTheme {
  if (avatarPreset && PRESET_THEMES[avatarPreset]) {
    return PRESET_THEMES[avatarPreset];
  }

  const index = stableHash(seed || 'eggturtle-share-avatar') % PRESET_ORDER.length;
  return PRESET_THEMES[PRESET_ORDER[index] ?? 'amber'];
}

export function resolveShareAvatarLabel(
  avatarPreset: TenantShareAvatarPreset | null | undefined,
  seed: string,
): string {
  return resolveShareAvatarTheme(avatarPreset, seed).label;
}

export function resolveShareAvatarInitial(text: string | null | undefined, fallback = '龟') {
  const normalized = (text ?? '').trim();
  if (!normalized) {
    return fallback;
  }

  const compact = normalized.replace(/^@+/, '');
  const chars = Array.from(compact);
  return chars[0] ?? fallback;
}

function stableHash(input: string) {
  let value = 0;
  for (const char of Array.from(input)) {
    value = (value * 131 + char.charCodeAt(0)) >>> 0;
  }
  return value;
}
