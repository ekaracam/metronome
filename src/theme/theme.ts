import { useColorScheme, type TextStyle } from 'react-native';

import { useSettings } from '../settings/store';

/**
 * One accent, and everything else neutral.
 *
 * A metronome has exactly one thing worth colouring: the beat. Following 60/30/10 —
 * 60% background, 30% surfaces and text, 10% accent — keeps the pulse the only saturated
 * thing on screen, which is what the eye should catch from across a room while both hands
 * are on an instrument. Red stays out of the palette entirely: spending an alarm colour on
 * "stop", a routine action here, would make the app read as more urgent than it is.
 */
export type Palette = {
  readonly background: string;
  readonly surface: string;
  readonly surfaceRaised: string;
  readonly border: string;
  /** Headings and values. */
  readonly text: string;
  /** Labels and secondary copy. */
  readonly textMuted: string;
  readonly accent: string;
  /** Accent at ~10% — secondary buttons and the resting beat dot. */
  readonly accentSoft: string;
  /** Accent at ~25% — the halo behind a sounding beat. */
  readonly accentGlow: string;
  /** Ink for text sitting on the accent. */
  readonly onAccent: string;
  /** Tinted to the background rather than pure black, so shadows never look grey. */
  readonly shadow: string;
};

const dark: Palette = {
  background: '#0E1116',
  surface: '#171B22',
  surfaceRaised: '#212630',
  border: '#2C323D',
  text: '#F2F4F8',
  textMuted: '#8B93A3',
  accent: '#4C8DFF',
  accentSoft: 'rgba(76, 141, 255, 0.14)',
  accentGlow: 'rgba(76, 141, 255, 0.28)',
  onAccent: '#08101F',
  shadow: '#02040A',
};

const light: Palette = {
  background: '#F7F8FA',
  surface: '#FFFFFF',
  surfaceRaised: '#EDEFF3',
  border: '#DCE0E7',
  text: '#12161C',
  textMuted: '#5D6472',
  accent: '#1F6FEB',
  accentSoft: 'rgba(31, 111, 235, 0.10)',
  accentGlow: 'rgba(31, 111, 235, 0.20)',
  onAccent: '#FFFFFF',
  shadow: '#8A93A6',
};

/**
 * The scheme actually in force: the stored preference, or the device's when it says
 * "system". Exported on its own because the status bar needs the *name* of the scheme,
 * not the palette — its icons are drawn by the OS and only take 'light' or 'dark'.
 *
 * Dark wins the tie: `useColorScheme` returns null on a device that expresses no
 * preference, and this app is looked at on a music stand in a dim room.
 */
export const useThemeName = (): 'light' | 'dark' => {
  const device = useColorScheme();
  const { settings } = useSettings();
  if (settings.themeMode !== 'system') return settings.themeMode;
  return device === 'light' ? 'light' : 'dark';
};

export const useTheme = (): Palette => (useThemeName() === 'light' ? light : dark);

/** 8-point grid. Every gap and pad in the app comes from here. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/**
 * Four sizes, two weights — the whole app.
 *
 * More than that and nothing reads as more important than anything else. `display` is
 * tabular so the tempo does not jitter sideways as digits change.
 */
export const type: Record<'display' | 'title' | 'body' | 'caption', TextStyle> = {
  display: { fontSize: 88, fontWeight: '700', fontVariant: ['tabular-nums'] },
  title: { fontSize: 20, fontWeight: '700' },
  body: { fontSize: 17, fontWeight: '600' },
  caption: { fontSize: 13, fontWeight: '600' },
};

/** Minimum comfortable tap target, per platform accessibility guidance. */
export const TAP_TARGET = 48;
