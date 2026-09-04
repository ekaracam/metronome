import { memo, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { useTranslate } from '../i18n/i18n';
import { TAP_TARGET, radius, spacing, useTheme } from '../theme/theme';

type Props = {
  readonly beatsPerBar: number;
  readonly subdivisionsPerBeat: number;
  /** Step currently sounding, or -1 when stopped. */
  readonly currentStep: number;
  readonly accents: readonly number[];
  readonly onToggleAccent: (beat: number) => void;
};

/**
 * The bar, drawn as one circle per step.
 *
 * Filled circles are beats, hollow ones are the subdivisions between them, so the shape of
 * the bar is readable without counting: 6/8 in triplets is two groups of three, and you
 * can see that it is two groups of three. Circles are grouped by beat with a wider gap
 * between groups, because a flat row of twelve identical dots communicates nothing.
 */

/**
 * Circle size from the space available, not a fixed ladder.
 *
 * The step count swings from 2 (2/4 on beats) to 28 (7/8 in sixteenths), and the width
 * swings from a phone to a tablet. A fixed size that fits 28 steps on a phone leaves 2
 * steps as specks on a tablet, so it is derived from both.
 */
const MIN_DOT = 8;
const MAX_DOT = 40;

/**
 * How dim a circle sits when it is not the one sounding.
 *
 * Colour and brightness carry different meanings and must not be swapped: the accent
 * colour says *what kind of beat this is* and never changes, while brightness says *this
 * one is sounding now* and lasts a fifth of a second. Lighting a plain beat up in the
 * accent colour made it indistinguishable from an accented beat — the bar looked like it
 * had picked up an extra accent wherever the playhead happened to be.
 */
const RESTING_OPACITY = 0.42;

const sizeFor = (steps: number, width: number): number => {
  if (width <= 0 || steps <= 0) return MIN_DOT;
  // Each step gets a slot; the circle uses a little over half of it so the gaps read.
  const slot = width / steps;
  return Math.max(MIN_DOT, Math.min(MAX_DOT, Math.floor(slot * 0.55)));
};

const Step = memo(function Step({
  size,
  slot,
  isBeat,
  accented,
  active,
}: {
  readonly size: number;
  readonly slot: number;
  readonly isBeat: boolean;
  readonly accented: boolean;
  readonly active: boolean;
}) {
  const theme = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    pulse.setValue(1);
    Animated.timing(pulse, {
      toValue: 0,
      // Subdivisions can arrive twenty times a second; they get the brightness lift but
      // decay faster, so the bar reads as a travelling highlight rather than a smear.
      duration: isBeat ? 220 : 120,
      useNativeDriver: true,
    }).start();
  }, [active, isBeat, pulse]);

  const diameter = isBeat ? size : size * 0.6;
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [RESTING_OPACITY, 1] });

  return (
    <View style={[styles.slot, { width: slot }]}>
      {/* Only beats bloom. A halo on every sixteenth is a strobe, not a pulse. */}
      {isBeat ? (
        <Animated.View
          style={[
            styles.halo,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: theme.accentGlow,
              opacity: pulse,
              transform: [
                { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.2] }) },
              ],
            },
          ]}
        />
      ) : null}
      <Animated.View
        style={{
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          borderWidth: isBeat ? 0 : 1.5,
          // Filled beats, hollow subdivisions; accented beats in the accent colour. All
          // three are fixed properties of the bar — none of them react to the playhead.
          backgroundColor: isBeat ? (accented ? theme.accent : theme.textMuted) : 'transparent',
          borderColor: accented ? theme.accent : theme.textMuted,
          opacity,
          transform: [
            { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, isBeat ? 1.4 : 1.25] }) },
          ],
        }}
      />
    </View>
  );
});

export const BeatDots = memo(function BeatDots({
  beatsPerBar,
  subdivisionsPerBeat,
  currentStep,
  accents,
  onToggleAccent,
}: Props) {
  const t = useTranslate();
  const [width, setWidth] = useState(0);
  const steps = beatsPerBar * subdivisionsPerBeat;
  // The gaps between beat groups eat into what the circles can use.
  const usable = Math.max(0, width - beatsPerBar * spacing.md);
  const slot = steps > 0 ? usable / steps : 0;
  const size = sizeFor(steps, usable);

  return (
    <View
      style={styles.row}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {Array.from({ length: beatsPerBar }, (_, beat) => {
        const accented = beat === 0 || accents.includes(beat);
        return (
          <Pressable
            key={beat}
            onPress={() => onToggleAccent(beat)}
            accessibilityRole="button"
            accessibilityLabel={t(accented ? 'bar.beatAccented' : 'bar.beat', {
              number: beat + 1,
            })}
            accessibilityHint={beat === 0 ? undefined : t('bar.toggleAccent')}
            // The group is the tap target, so an accent stays easy to hit even when the
            // circles shrink to nine pixels.
            style={styles.group}
          >
            {Array.from({ length: subdivisionsPerBeat }, (_, offset) => {
              const step = beat * subdivisionsPerBeat + offset;
              return (
                <Step
                  key={offset}
                  size={size}
                  slot={slot}
                  isBeat={offset === 0}
                  accented={accented}
                  active={step === currentStep}
                />
              );
            })}
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: spacing.md,
    minHeight: TAP_TARGET,
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TAP_TARGET,
    paddingHorizontal: spacing.xs,
  },
  slot: {
    height: TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    borderRadius: radius.pill,
  },
});
