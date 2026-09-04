import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { useTranslate } from '../i18n/i18n';
import { MAX_BPM, MIN_BPM } from '../metronome/patterns';
import { TAP_TARGET, radius, type, useTheme } from '../theme/theme';

/**
 * A horizontal tempo dial: values run low to high, left to right, and the one under the
 * centre marker is selected.
 *
 * Chosen over +/- steppers because picking a tempo is a *search*, not an increment. A
 * stepper makes 120 → 168 sixteen taps; here it is one flick, and single-BPM precision
 * survives because the list snaps per value. Neighbours stay visible and fade with
 * distance, so the scale around the current tempo is readable at a glance.
 */

type Props = {
  readonly bpm: number;
  readonly onChange: (bpm: number) => void;
};

const ITEM_WIDTH = 56;
/** Beyond this many items from centre a value is dim enough to read as a tick mark. */
const FADE_SPAN = 3;

const VALUES = Array.from({ length: MAX_BPM - MIN_BPM + 1 }, (_, i) => MIN_BPM + i);

const Tick = memo(function Tick({
  value,
  index,
  scrollX,
}: {
  readonly value: number;
  readonly index: number;
  readonly scrollX: Animated.Value;
}) {
  const theme = useTheme();
  const centre = index * ITEM_WIDTH;
  const range = [centre - FADE_SPAN * ITEM_WIDTH, centre, centre + FADE_SPAN * ITEM_WIDTH];

  // Driven by scroll position rather than by the committed value, so the dial reads as a
  // continuous scale while it is moving instead of snapping between two static states.
  const opacity = scrollX.interpolate({
    inputRange: range,
    outputRange: [0.18, 1, 0.18],
    extrapolate: 'clamp',
  });
  const scale = scrollX.interpolate({
    inputRange: range,
    outputRange: [0.7, 1, 0.7],
    extrapolate: 'clamp',
  });

  const major = value % 10 === 0;

  return (
    <Animated.View style={[styles.tick, { opacity, transform: [{ scale }] }]}>
      <Text style={[type.body, { color: major ? theme.text : theme.textMuted }]}>{value}</Text>
    </Animated.View>
  );
});

export const TempoWheel = ({ bpm, onChange }: Props) => {
  const theme = useTheme();
  const t = useTranslate();
  const listRef = useRef<Animated.FlatList<number>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);

  /** The value the dial last settled on, so an echo of our own change is not re-applied. */
  const settledRef = useRef(bpm);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);

  const sidePadding = Math.max(0, (width - ITEM_WIDTH) / 2);

  // Follow the tempo when something else sets it — tap tempo, or restored settings.
  useEffect(() => {
    if (width === 0 || bpm === settledRef.current) return;
    settledRef.current = bpm;
    listRef.current?.scrollToOffset({
      offset: (bpm - MIN_BPM) * ITEM_WIDTH,
      animated: true,
    });
  }, [bpm, width]);

  // Place the initial value without animating, once the width is known.
  const positioned = useRef(false);
  useEffect(() => {
    if (width === 0 || positioned.current) return;
    positioned.current = true;
    listRef.current?.scrollToOffset({ offset: (bpm - MIN_BPM) * ITEM_WIDTH, animated: false });
  }, [bpm, width]);

  const settle = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(event.nativeEvent.contentOffset.x / ITEM_WIDTH);
      const next = Math.min(MAX_BPM, Math.max(MIN_BPM, MIN_BPM + index));
      if (next === settledRef.current) return;
      settledRef.current = next;
      onChange(next);
    },
    [onChange],
  );

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
        useNativeDriver: true,
      }),
    [scrollX],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: number; index: number }) => (
      <Tick value={item} index={index} scrollX={scrollX} />
    ),
    [scrollX],
  );

  return (
    <View style={styles.container} onLayout={onLayout}>
      {/* The marker sits behind the numbers so the selected value reads on top of it. */}
      <View
        pointerEvents="none"
        style={[
          styles.marker,
          { borderColor: theme.accent, backgroundColor: theme.accentSoft, width: ITEM_WIDTH + 12 },
        ]}
      />
      {width > 0 ? (
        <Animated.FlatList
          ref={listRef}
          data={VALUES}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => String(item)}
          renderItem={renderItem}
          getItemLayout={(_, index) => ({
            length: ITEM_WIDTH,
            offset: ITEM_WIDTH * index,
            index,
          })}
          initialScrollIndex={bpm - MIN_BPM}
          snapToInterval={ITEM_WIDTH}
          disableIntervalMomentum
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: sidePadding }}
          onScroll={onScroll}
          scrollEventThrottle={16}
          // Both are needed: a flick ends with momentum, a slow drag ends without it and
          // would otherwise leave the dial parked on a value it never reported.
          onMomentumScrollEnd={settle}
          onScrollEndDrag={settle}
          accessibilityLabel={t('metronome.tempo')}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: TAP_TARGET + 8,
    justifyContent: 'center',
    // Must stretch: the dial measures itself to lay the list out, and a centring parent
    // would size it to its content instead — which is nothing until the list exists.
    alignSelf: 'stretch',
  },
  marker: {
    position: 'absolute',
    alignSelf: 'center',
    height: TAP_TARGET,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  tick: {
    width: ITEM_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
