// Sign-in screen (chunk 5).
//
// Rendered directly by app/_layout.tsx's auth gate when `user === null` — it is
// NOT a navigable Tabs.Screen (expo-router still registers app/login.tsx as a
// route, but nothing pushes to it; the gate swaps it in for the tab tree). Talks
// only to `useAuth().signIn`, mapping the typed AuthError to human copy.
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthContext';
import { AuthError } from '@/auth/auth';
import { colors } from '@/theme/colors';

/** Turn a signIn rejection into copy a site worker can act on. */
function messageFor(error: unknown): string {
  if (error instanceof AuthError) {
    if (error.message === 'Invalid credentials') {
      return 'Incorrect email or password.';
    }
    if (error.message === 'Login failed') {
      return 'Could not reach the server — check your connection.';
    }
  }
  return 'Something went wrong. Please try again.';
}

export default function LoginScreen() {
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);

  const trimmedEmail = email.trim();
  const canSubmit = trimmedEmail.length > 0 && password.length > 0 && !submitting;

  async function handleSubmit(): Promise<void> {
    if (submitting) {
      return;
    }
    setError(null);
    if (trimmedEmail.length === 0 || password.length === 0) {
      setError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    try {
      await signIn(trimmedEmail, password);
      // On success the auth gate re-renders into the tab tree; nothing to do here.
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <View style={styles.brand}>
            <View style={styles.mark}>
              <Text style={styles.markText}>O</Text>
            </View>
            <Text style={styles.wordmark}>Orqafy</Text>
            <Text style={styles.tagline}>Sign in to your site workspace</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, focused === 'email' && styles.inputFocused]}
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                placeholder="you@example.com"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                textContentType="username"
                returnKeyType="next"
                editable={!submitting}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={[styles.input, focused === 'password' && styles.inputFocused]}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                placeholder="••••••••"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={() => void handleSubmit()}
                editable={!submitting}
              />
            </View>

            {error !== null ? (
              <Text style={styles.error} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}

            <Pressable
              onPress={() => void handleSubmit()}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSubmit, busy: submitting }}
              style={({ pressed }) => [
                styles.button,
                !canSubmit && styles.buttonDisabled,
                pressed && canSubmit && styles.buttonPressed,
              ]}
            >
              {submitting ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={styles.buttonText}>Sign in</Text>
              )}
            </Pressable>
          </View>

          <Text style={styles.footnote}>
            Connects to your team&apos;s self-hosted Orqafy server.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    gap: 40,
  },
  brand: { alignItems: 'center', gap: 12 },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: {
    fontSize: 34,
    fontWeight: '700',
    color: colors.primaryForeground,
  },
  wordmark: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: colors.foreground,
  },
  tagline: {
    fontSize: 15,
    color: colors.mutedForeground,
  },
  form: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 20,
    gap: 16,
  },
  field: { gap: 6 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.cardForeground,
  },
  input: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.foreground,
  },
  inputFocused: {
    borderColor: colors.primary,
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.destructive,
  },
  button: {
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.85 },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  footnote: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    color: colors.mutedForeground,
  },
});
