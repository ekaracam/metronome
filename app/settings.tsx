import { useMemo } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { useTranslate } from '../src/i18n/i18n';
import { useSettings, type Language, type ThemeMode } from '../src/settings/store';
import { spacing, useTheme } from '../src/theme/theme';
import { SegmentedControl } from '../src/ui/SegmentedControl';

const SettingsScreen = () => {
  const theme = useTheme();
  const t = useTranslate();
  const { settings, update } = useSettings();

  const themeOptions = useMemo(
    () => [
      { value: 'system' as ThemeMode, label: t('settings.themeSystem') },
      { value: 'light' as ThemeMode, label: t('settings.themeLight') },
      { value: 'dark' as ThemeMode, label: t('settings.themeDark') },
    ],
    [t],
  );

  const languageOptions = useMemo(
    () => [
      { value: 'system' as Language, label: t('settings.languageSystem') },
      // Endonyms, untranslated on purpose: someone who has landed in the wrong language
      // needs to recognise their own, and "İngilizce" helps nobody looking for English.
      { value: 'en' as Language, label: 'English' },
      { value: 'tr' as Language, label: 'Türkçe' },
    ],
    [t],
  );

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
          {t('settings.appearance')}
        </Text>

        <View style={styles.field}>
          <Text style={[styles.toggleLabel, { color: theme.text }]}>{t('settings.theme')}</Text>
          <SegmentedControl
            options={themeOptions}
            value={settings.themeMode}
            onChange={(themeMode) => update({ themeMode })}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.toggleLabel, { color: theme.text }]}>{t('settings.language')}</Text>
          <SegmentedControl
            options={languageOptions}
            value={settings.language}
            onChange={(language) => update({ language })}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
          {t('settings.behaviour')}
        </Text>

        <View style={[styles.toggleRow, { borderColor: theme.border }]}>
          <View style={styles.toggleText}>
            <Text style={[styles.toggleLabel, { color: theme.text }]}>{t('settings.haptics')}</Text>
            <Text style={[styles.hint, { color: theme.textMuted }]}>
              {t('settings.hapticsHint')}
            </Text>
          </View>
          {/* Tinted: the platform default is a green that belongs to no palette here. */}
          <Switch
            value={settings.haptics}
            onValueChange={(haptics) => update({ haptics })}
            accessibilityLabel={t('settings.haptics')}
            trackColor={{ false: theme.border, true: theme.accent }}
            thumbColor={theme.surface}
          />
        </View>

        <View style={[styles.toggleRow, { borderColor: theme.border }]}>
          <View style={styles.toggleText}>
            <Text style={[styles.toggleLabel, { color: theme.text }]}>
              {t('settings.keepAwake')}
            </Text>
            <Text style={[styles.hint, { color: theme.textMuted }]}>
              {t('settings.keepAwakeHint')}
            </Text>
          </View>
          <Switch
            value={settings.keepScreenAwake}
            onValueChange={(keepScreenAwake) => update({ keepScreenAwake })}
            accessibilityLabel={t('settings.keepAwake')}
            trackColor={{ false: theme.border, true: theme.accent }}
            thumbColor={theme.surface}
          />
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.xl,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  field: {
    gap: spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  toggleText: {
    flex: 1,
    gap: spacing.xs,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
    lineHeight: 19,
  },
});

export default SettingsScreen;
