import { useCallback } from 'react';
import { I18nManager } from 'react-native';

import { useSettings, type Language } from '../settings/store';

/**
 * Two languages, one dictionary shape.
 *
 * `en` is left unannotated so its keys *are* the key type, and `tr` is annotated against
 * that type — so a missing or misspelled Turkish string is a compile error rather than a
 * blank label discovered on a device. Italian tempo markings (Allegro, Presto) are not
 * here: they are the same words in both languages and belong to the music, not the UI.
 */
const en = {
  'app.title': 'Metronome',
  'nav.settings': 'Settings',

  'settings.behaviour': 'Behaviour',
  'settings.appearance': 'Appearance',
  'settings.haptics': 'Haptic feedback',
  'settings.hapticsHint': 'A tap on every downbeat.',
  'settings.keepAwake': 'Keep screen awake',
  'settings.keepAwakeHint': 'While the metronome is running.',
  'settings.theme': 'Theme',
  'settings.themeSystem': 'System',
  'settings.themeLight': 'Light',
  'settings.themeDark': 'Dark',
  'settings.language': 'Language',
  'settings.languageSystem': 'System',

  'metronome.timeSignature': 'Time signature',
  'metronome.subdivision': 'Subdivision',
  'metronome.tapTempo': 'Tap tempo',
  'metronome.tapsNeeded': '{count} more',
  'metronome.start': 'Start metronome',
  'metronome.stop': 'Stop metronome',
  'metronome.tempo': 'Tempo',

  'bar.accentHint': 'Tap a beat to accent it',
  'bar.beat': 'Beat {number}',
  'bar.beatAccented': 'Beat {number}, accented',
  'bar.toggleAccent': 'Tap to toggle the accent',

  'subdivision.quarter': 'Beat',
  'subdivision.eighth': 'Eighths',
  'subdivision.triplet': 'Triplets',
  'subdivision.sixteenth': 'Sixteenths',

  'meter.hint.twoDotted': 'Two dotted-quarter beats',
  'meter.hint.threeDotted': 'Three dotted-quarter beats',
  'meter.hint.fourDotted': 'Four dotted-quarter beats',
  'meter.hint.eighthCount': 'BPM counts eighth notes',
};

export type StringKey = keyof typeof en;

const tr: Record<StringKey, string> = {
  'app.title': 'Metronom',
  'nav.settings': 'Ayarlar',

  'settings.behaviour': 'Davranış',
  'settings.appearance': 'Görünüm',
  'settings.haptics': 'Titreşim',
  'settings.hapticsHint': 'Her ölçü başında bir dokunuş.',
  'settings.keepAwake': 'Ekranı açık tut',
  'settings.keepAwakeHint': 'Metronom çalışırken.',
  'settings.theme': 'Tema',
  'settings.themeSystem': 'Sistem',
  'settings.themeLight': 'Açık',
  'settings.themeDark': 'Koyu',
  'settings.language': 'Dil',
  'settings.languageSystem': 'Sistem',

  'metronome.timeSignature': 'Ölçü',
  'metronome.subdivision': 'Bölünme',
  'metronome.tapTempo': 'Tempo vur',
  'metronome.tapsNeeded': '{count} daha',
  'metronome.start': 'Metronomu başlat',
  'metronome.stop': 'Metronomu durdur',
  'metronome.tempo': 'Tempo',

  'bar.accentHint': 'Vurgulamak için bir vuruşa dokun',
  'bar.beat': '{number}. vuruş',
  'bar.beatAccented': '{number}. vuruş, vurgulu',
  'bar.toggleAccent': 'Vurguyu açıp kapatmak için dokun',

  'subdivision.quarter': 'Vuruş',
  'subdivision.eighth': 'Sekizlik',
  'subdivision.triplet': 'Triole',
  'subdivision.sixteenth': 'Onaltılık',

  'meter.hint.twoDotted': 'İki noktalı dörtlük vuruş',
  'meter.hint.threeDotted': 'Üç noktalı dörtlük vuruş',
  'meter.hint.fourDotted': 'Dört noktalı dörtlük vuruş',
  'meter.hint.eighthCount': 'BPM sekizlikleri sayar',
};

export type Locale = Exclude<Language, 'system'>;

const DICTIONARIES: Record<Locale, Record<StringKey, string>> = { en, tr };

/**
 * The device's language tag, read once at import rather than per render.
 *
 * `I18nManager` first because it is the platform's own answer — Android reads it straight
 * off the resource configuration — while Intl depends on whatever ICU the JS engine was
 * built with. Both returned `tr` on the test tablet; the order is about which one is
 * still right on an engine built without full ICU.
 */
const platformLocaleTag = (): string | null => {
  const identifier = I18nManager.getConstants().localeIdentifier;
  if (typeof identifier === 'string' && identifier.length > 0) return identifier;
  try {
    return new Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return null;
  }
};

// Underscores and hyphens both appear (`tr_TR`, `tr-TR`); only the language matters here.
const DEVICE_LOCALE: Locale =
  platformLocaleTag()?.toLowerCase().startsWith('tr') === true ? 'tr' : 'en';


export const resolveLocale = (language: Language): Locale =>
  language === 'system' ? DEVICE_LOCALE : language;

type Params = Readonly<Record<string, string | number>>;

/** Translate a key, substituting `{name}` placeholders. */
export type Translate = (key: StringKey, params?: Params) => string;

const format = (template: string, params?: Params): string => {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match: string, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
};

export const useTranslate = (): Translate => {
  const { settings } = useSettings();
  const locale = resolveLocale(settings.language);

  return useCallback(
    (key, params) => format(DICTIONARIES[locale][key], params),
    [locale],
  );
};
