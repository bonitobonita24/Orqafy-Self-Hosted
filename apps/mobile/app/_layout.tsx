import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { colors } from '@/theme/colors';

import LoginScreen from './login';

// Auth-gated tab navigator. Must be a CHILD of AuthProvider so it can call
// useAuth. While the initial token hydrate runs -> splash; signed-out -> the
// login screen (rendered directly, not as a Tabs.Screen); signed-in -> the tabs.
function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (user === null) {
    return <LoginScreen />;
  }

  return (
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
      <Tabs.Screen name="leave" options={{ title: 'Leave' }} />
    </Tabs>
  );
}

// Root layout. DESIGN §6/§8: the web sidebar collapses to a bottom tab bar on
// mobile. AuthProvider (chunk 3b) wraps the tree so `useAuth` is available
// app-wide; the login-screen UI + gate land in chunk 5 via RootNavigator.
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="auto" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
