import { Link, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useTranslate } from '../src/i18n/i18n';
import { SettingsProvider } from '../src/settings/store';
import { spacing, useTheme, useThemeName } from '../src/theme/theme';

/**
 * Everything themed or translated lives below the provider.
 *
 * Both the palette and the dictionary are now stored preferences, so a component that
 * reads either one has to sit inside `SettingsProvider` — including the navigator's own
 * header. Hence the split: the shell mounts the providers, this renders the app.
 */
const ThemedStack = () => {
  const theme = useTheme();
  const themeName = useThemeName();
  const t = useTranslate();

  return (
    <>
      {/* Not "auto": that follows the device, which is wrong the moment the user
          overrides the theme. Light content on a dark background, and vice versa. */}
      <StatusBar style={themeName === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        {/* One screen, so no tab bar: a single tab is just a header that costs height. */}
        <Stack.Screen
          name="index"
          options={{
            title: t('app.title'),
            headerRight: () => (
              <Link href="/settings" asChild>
                <Pressable accessibilityRole="button" accessibilityLabel={t('nav.settings')}>
                  <Text style={{ color: theme.accent, fontSize: 16, marginRight: spacing.md }}>
                    {t('nav.settings')}
                  </Text>
                </Pressable>
              </Link>
            ),
          }}
        />
        <Stack.Screen
          name="settings"
          options={{ presentation: 'modal', title: t('nav.settings') }}
        />
      </Stack>
    </>
  );
};

const RootLayout = () => (
  <GestureHandlerRootView style={{ flex: 1 }}>
    {/* The metronome screen reads the bottom inset to keep the transport clear of the
        home indicator, and useSafeAreaInsets throws without this provider. */}
    <SafeAreaProvider>
      <SettingsProvider>
        <ThemedStack />
      </SettingsProvider>
    </SafeAreaProvider>
  </GestureHandlerRootView>
);

// Route files are the one place this project uses a default export — expo-router
// resolves screens by the module's default, so a named export would not register.
export default RootLayout;
