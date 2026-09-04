import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { radius, spacing, useTheme } from '../theme/theme';

export type SegmentOption<T extends string> = {
  readonly value: T;
  readonly label: string;
};

type Props<T extends string> = {
  readonly options: readonly SegmentOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
};

/** Horizontal pill selector. Scrolls, because eight time signatures do not fit a phone. */
const SegmentedControlView = <T extends string>({ options, value, onChange }: Props<T>) => {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[
        styles.container,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.segment, { backgroundColor: selected ? theme.accent : 'transparent' }]}
          >
            {/* onAccent, not white: the dark palette's accent wants dark ink on it. */}
            <Text style={[styles.label, { color: selected ? theme.onAccent : theme.textMuted }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

/**
 * Memoised, and the cast is what keeps it generic: `memo` erases the type parameter, so
 * without re-asserting the original signature every caller would infer `unknown`.
 *
 * It earns its place because the metronome screen re-renders on every beat while running,
 * and the meter and subdivision options never change.
 */
export const SegmentedControl = memo(SegmentedControlView) as typeof SegmentedControlView;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
  },
  segment: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
});
