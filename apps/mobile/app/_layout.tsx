import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';

// Root navigator. DESIGN §6/§8: the web sidebar collapses to a bottom tab bar on
// mobile. Three primary destinations for CHUNK 1; screens are placeholders until
// the data/auth chunks land.
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: colors.card },
          headerTitleStyle: { color: colors.foreground },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.mutedForeground,
          tabBarStyle: {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
          },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'My Tasks' }} />
        <Tabs.Screen name="calendar" options={{ title: 'Calendar' }} />
        <Tabs.Screen name="notifications" options={{ title: 'Notifications' }} />
      </Tabs>
    </SafeAreaProvider>
  );
}
