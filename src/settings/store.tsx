import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { DEFAULT_METER_ID, DEFAULT_SUBDIVISION_ID, clampBpm } from '../metronome/patterns';

/**
 * The two "follow the device" preferences live here rather than beside the theme and the
 * dictionary, because both of those need to read the stored choice — putting the union
 * next to its consumer would make the store and the consumer import each other.
 */
export const THEME_MODES = ['system', 'light', 'dark'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export const LANGUAGES = ['system', 'en', 'tr'] as const;
export type Language = (typeof LANGUAGES)[number];

export type Settings = {
  readonly haptics: boolean;
  readonly keepScreenAwake: boolean;
  readonly bpm: number;
  readonly meterId: string;
  readonly subdivisionId: string;
  /** Beat indices (0-based) that are accented, beyond the always-accented downbeat. */
  readonly accents: readonly number[];
  readonly themeMode: ThemeMode;
  readonly language: Language;
};

export const DEFAULT_SETTINGS: Settings = {
  haptics: true,
  keepScreenAwake: true,
  bpm: 120,
  meterId: '4/4',
  subdivisionId: DEFAULT_SUBDIVISION_ID,
  accents: [],
  // Both default to the device so the app arrives looking and speaking like everything
  // else on the phone, and the picker is there for when it guesses wrong.
  themeMode: 'system',
  language: 'system',
};

// Bumped from v1: the stored shape changed, and sanitize() would otherwise keep reading
// v1 blobs that no longer describe this app.
const STORAGE_KEY = 'settings.v2';

type SettingsContextValue = {
  readonly settings: Settings;
  readonly update: (patch: Partial<Settings>) => void;
  /** False until persisted settings have been read, so the UI can avoid a flash of defaults. */
  readonly loaded: boolean;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

/** Stored JSON is untrusted — an older build may have written a different shape. */
const sanitize = (raw: unknown): Settings => {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_SETTINGS;
  const value = raw as Record<string, unknown>;

  const pickString = (key: keyof Settings, fallback: string): string =>
    typeof value[key] === 'string' ? (value[key] as string) : fallback;
  const pickBoolean = (key: keyof Settings, fallback: boolean): boolean =>
    typeof value[key] === 'boolean' ? (value[key] as boolean) : fallback;
  const pickUnion = <T extends string>(
    key: keyof Settings,
    allowed: readonly T[],
    fallback: T,
  ): T => {
    const candidate = value[key];
    return typeof candidate === 'string' && (allowed as readonly string[]).includes(candidate)
      ? (candidate as T)
      : fallback;
  };

  return {
    haptics: pickBoolean('haptics', DEFAULT_SETTINGS.haptics),
    keepScreenAwake: pickBoolean('keepScreenAwake', DEFAULT_SETTINGS.keepScreenAwake),
    bpm: typeof value.bpm === 'number' ? clampBpm(value.bpm) : DEFAULT_SETTINGS.bpm,
    meterId: pickString('meterId', DEFAULT_METER_ID),
    subdivisionId: pickString('subdivisionId', DEFAULT_SUBDIVISION_ID),
    accents: Array.isArray(value.accents)
      ? value.accents.filter((n): n is number => typeof n === 'number')
      : DEFAULT_SETTINGS.accents,
    themeMode: pickUnion('themeMode', THEME_MODES, DEFAULT_SETTINGS.themeMode),
    language: pickUnion('language', LANGUAGES, DEFAULT_SETTINGS.language),
  };
};

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (cancelled || !stored) return;
        setSettings(sanitize(JSON.parse(stored)));
      })
      .catch(() => {
        // Corrupt or unreadable storage falls back to defaults rather than failing.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((previous) => {
      const next = { ...previous, ...patch };
      // Debounced so dragging a BPM slider does not hammer the disk.
      if (writeTimer.current) clearTimeout(writeTimer.current);
      writeTimer.current = setTimeout(() => {
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      }, 300);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ settings, update, loaded }), [settings, update, loaded]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = (): SettingsContextValue => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used inside a SettingsProvider');
  return context;
};
