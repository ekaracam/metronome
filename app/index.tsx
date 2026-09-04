import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  METERS,
  SUBDIVISIONS,
  TAP_TIMEOUT_MS,
  bpmFromTaps,
  clampBpm,
  getMeter,
  getSubdivision,
} from '../src/metronome/patterns';
import { tempoTerm } from '../src/metronome/tempoTerms';
import { useMetronome } from '../src/metronome/useMetronome';
import { useTranslate } from '../src/i18n/i18n';
import { useSettings } from '../src/settings/store';
import { TAP_TARGET, radius, spacing, type, useTheme } from '../src/theme/theme';
import { BeatDots } from '../src/ui/BeatDots';
import { SegmentedControl } from '../src/ui/SegmentedControl';
import { TempoWheel } from '../src/ui/TempoWheel';

const KEEP_AWAKE_TAG = 'metronome';

// Time-signature labels are numerals — the same in every language.
const METER_OPTIONS = METERS.map((m) => ({ value: m.id, label: m.label }));

const MetronomeScreen = () => {
  const theme = useTheme();
  const t = useTranslate();
  const insets = useSafeAreaInsets();
  const { settings, update } = useSettings();

  const subdivisionOptions = useMemo(
    () => SUBDIVISIONS.map((s) => ({ value: s.id, label: t(s.labelKey) })),
    [t],
  );
  const [taps, setTaps] = useState<number[]>([]);
  const tapsRef = useRef<number[]>([]);

  const meter = getMeter(settings.meterId);
  const subdivision = getSubdivision(settings.subdivisionId);

  const config = useMemo(
    () => ({
      bpm: settings.bpm,
      beatsPerBar: meter.beatsPerBar,
      subdivisionsPerBeat: subdivision.perBeat,
      accents: settings.accents,
    }),
    [settings.bpm, settings.accents, meter.beatsPerBar, subdivision.perBeat],
  );

  const { running, currentStep, toggle } = useMetronome(config);

  useEffect(() => {
    if (!running || !settings.keepScreenAwake) return;
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, [running, settings.keepScreenAwake]);

  // A tap you can feel on the downbeat, so the bar can be followed without looking. Only
  // the downbeat: buzzing every subdivision would be a continuous rattle at any real tempo.
  useEffect(() => {
    if (!settings.haptics || currentStep !== 0) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [currentStep, settings.haptics]);

  const onTap = useCallback(() => {
    const now = Date.now();
    // Deliberately not computed inside a setTaps updater: React runs updaters during
    // render, so calling update() there wrote to the settings store mid-render and
    // triggered "cannot update a component while rendering a different component".
    const recent = tapsRef.current.filter((t) => now - t < TAP_TIMEOUT_MS);
    const next = [...recent, now].slice(-8);
    tapsRef.current = next;
    setTaps(next);

    const bpm = bpmFromTaps(next);
    if (bpm !== null) update({ bpm });
  }, [update]);

  const toggleAccent = useCallback(
    (beat: number) => {
      // The downbeat is always accented; there is nothing to toggle there.
      if (beat === 0) return;
      const accents = settings.accents.includes(beat)
        ? settings.accents.filter((b) => b !== beat)
        : [...settings.accents, beat].sort((a, b) => a - b);
      update({ accents });
    },
    [settings.accents, update],
  );

  const onMeterChange = useCallback(
    (meterId: string) => {
      const next = getMeter(meterId);
      update({
        meterId,
        // Compound meters imply their own subdivision; carrying over a mismatched one
        // would make 6/8 sound like 6 beats rather than two groups of three.
        subdivisionId: next.defaultSubdivisionId,
        accents: settings.accents.filter((beat) => beat < next.beatsPerBar),
      });
    },
    [update, settings.accents],
  );

  const onSubdivisionChange = useCallback(
    (subdivisionId: string) => update({ subdivisionId }),
    [update],
  );

  const setBpm = useCallback((bpm: number) => update({ bpm: clampBpm(bpm) }), [update]);

  const tapsNeeded = taps.length > 0 && taps.length < 3 ? 3 - taps.length : 0;

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      {/* The bar, in its own panel: this is the thing you watch while playing. */}
      <View style={[styles.barPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <BeatDots
          beatsPerBar={meter.beatsPerBar}
          subdivisionsPerBeat={subdivision.perBeat}
          currentStep={currentStep}
          accents={settings.accents}
          onToggleAccent={toggleAccent}
        />
        <Text style={[type.caption, styles.hint, { color: theme.textMuted }]}>
          {meter.hintKey ? t(meter.hintKey) : t('bar.accentHint')}
        </Text>
      </View>

      <View style={styles.tempo}>
        <TempoWheel bpm={settings.bpm} onChange={setBpm} />
        <Text style={[type.caption, { color: theme.textMuted }]}>
          BPM · {tempoTerm(settings.bpm)}
        </Text>
      </View>

      {/* Free space sits here, between what you watch and what you set up, so neither
          the bar nor the transport drifts away from where the eye and thumb expect it. */}
      <View style={styles.spacer} />


      {/* Setup and transport: the transport sits last so it lands under the thumb. */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.setup}>
          <Text style={[type.caption, styles.label, { color: theme.textMuted }]}>
            {t('metronome.timeSignature')}
          </Text>
          <SegmentedControl
            options={METER_OPTIONS}
            value={settings.meterId}
            onChange={onMeterChange}
          />
        </View>

        <View style={styles.setup}>
          <Text style={[type.caption, styles.label, { color: theme.textMuted }]}>
            {t('metronome.subdivision')}
          </Text>
          <SegmentedControl
            options={subdivisionOptions}
            value={settings.subdivisionId}
            onChange={onSubdivisionChange}
          />
        </View>

        <View style={styles.transport}>
          <Pressable
            onPress={onTap}
            accessibilityRole="button"
            accessibilityLabel={t('metronome.tapTempo')}
            style={({ pressed }) => [
              styles.tapButton,
              {
                backgroundColor: pressed ? theme.accentGlow : theme.accentSoft,
                borderColor: theme.accent,
              },
            ]}
          >
            <Text style={[type.body, { color: theme.accent }]}>
              {tapsNeeded > 0
                ? t('metronome.tapsNeeded', { count: tapsNeeded })
                : t('metronome.tapTempo')}
            </Text>
          </Pressable>

          <Pressable
            onPress={toggle}
            accessibilityRole="button"
            accessibilityState={{ selected: running }}
            accessibilityLabel={running ? t('metronome.stop') : t('metronome.start')}
            style={({ pressed }) => [
              styles.playButton,
              {
                backgroundColor: theme.accent,
                shadowColor: theme.shadow,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            {/* Drawn rather than typed: a glyph font can substitute, a View cannot. */}
            {running ? (
              <View style={styles.pauseGlyph}>
                <View style={[styles.pauseBar, { backgroundColor: theme.onAccent }]} />
                <View style={[styles.pauseBar, { backgroundColor: theme.onAccent }]} />
              </View>
            ) : (
              <View style={[styles.playGlyph, { borderLeftColor: theme.onAccent }]} />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const PLAY_SIZE = 88;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  barPanel: {
    margin: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    alignItems: 'center',
  },
  tempo: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  spacer: {
    flex: 1,
  },
  hint: {
    textAlign: 'center',
  },
  controls: {
    gap: spacing.md,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  setup: {
    gap: spacing.sm,
  },
  label: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  tapButton: {
    flex: 1,
    minHeight: TAP_TARGET + 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  playButton: {
    width: PLAY_SIZE,
    height: PLAY_SIZE,
    borderRadius: PLAY_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  playGlyph: {
    width: 0,
    height: 0,
    borderTopWidth: 16,
    borderBottomWidth: 16,
    borderLeftWidth: 26,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    // Optical centring: a triangle's visual centre sits left of its bounding box.
    marginLeft: 6,
  },
  pauseGlyph: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pauseBar: {
    width: 8,
    height: 30,
    borderRadius: 2,
  },
});

export default MetronomeScreen;
