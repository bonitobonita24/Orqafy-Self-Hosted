// Site-photo capture (D-28, task-scoped). Route: /capture?taskId=<id>, hidden
// from the tab bar (see _layout.tsx).
//
// OFFLINE-FIRST (D-15): capture never needs the network. The shot is copied out
// of the camera cache into the app's document dir (cache can be purged before
// the outbox drains), GPS is best-effort (<= 5 s, omitted on denial/failure),
// and the upload is queued as an outbox `photo/create` entry — the drain does
// the multipart upload + photos.create when a connection is available.
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthContext';
import { buildPhotoPayload, getOutboxRuntime } from '@/offline';
import { getBestEffortGps, persistCapturedPhoto } from '@/photos/capture';
import { colors } from '@/theme/colors';

export default function CaptureScreen() {
  const { taskId } = useLocalSearchParams<{ taskId?: string }>();
  const { client } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);

  const capture = useCallback(async () => {
    if (typeof taskId !== 'string' || taskId.length === 0) return;
    const camera = cameraRef.current;
    if (camera === null || saving) return;
    setSaving(true);
    try {
      const shot = await camera.takePictureAsync({ quality: 0.7, base64: false, exif: false });
      const localUri = persistCapturedPhoto(shot.uri);
      const gps = await getBestEffortGps();
      const outbox = getOutboxRuntime();
      await outbox.enqueue(
        'photo',
        'create',
        buildPhotoPayload({ taskId, localUri, capturedAt: Date.now(), gps }),
      );
      // Opportunistic upload if we're online; no-op cost offline (entry stays pending).
      void outbox.drain(client);
      Alert.alert('Photo saved', 'Saved — will upload when online.', [
        { text: 'OK', onPress: goBack },
      ]);
    } catch (err) {
      console.warn('[capture] failed to capture photo', err);
      Alert.alert('Photo not saved', 'Something went wrong capturing the photo. Try again.');
    } finally {
      setSaving(false);
    }
  }, [client, goBack, saving, taskId]);

  if (typeof taskId !== 'string' || taskId.length === 0) {
    return (
      <Centered>
        <Text style={styles.title}>No task selected</Text>
        <Text style={styles.body}>Open the camera from a task in My Tasks.</Text>
        <PrimaryButton label="Back" onPress={goBack} />
      </Centered>
    );
  }

  if (permission === null) {
    return (
      <Centered>
        <ActivityIndicator size="large" color={colors.primary} />
      </Centered>
    );
  }

  if (!permission.granted) {
    return (
      <Centered>
        <Text style={styles.title}>Camera access needed</Text>
        {permission.canAskAgain ? (
          <>
            <Text style={styles.body}>Allow camera access to attach site photos to this task.</Text>
            <PrimaryButton label="Allow camera" onPress={() => void requestPermission()} />
          </>
        ) : (
          <>
            <Text style={styles.body}>
              Camera access is turned off for Orqafy. Enable it in your device Settings, then come
              back.
            </Text>
            <PrimaryButton label="Open Settings" onPress={() => void Linking.openSettings()} />
          </>
        )}
        <TouchableOpacity accessibilityRole="button" onPress={goBack} style={styles.linkButton}>
          <Text style={styles.linkText}>Cancel</Text>
        </TouchableOpacity>
      </Centered>
    );
  }

  return (
    <View style={styles.cameraContainer}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        mode="picture"
        onCameraReady={() => setReady(true)}
      />
      <SafeAreaView style={styles.controls} edges={['bottom']}>
        <TouchableOpacity accessibilityRole="button" onPress={goBack} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Take photo"
          disabled={!ready || saving}
          onPress={() => void capture()}
          style={[styles.shutter, !ready || saving ? styles.shutterBusy : null]}
        >
          {saving ? <ActivityIndicator color={colors.primary} /> : <View style={styles.shutterInner} />}
        </TouchableOpacity>
        <View style={styles.controlSpacer} />
      </SafeAreaView>
    </View>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centered}>{children}</View>
    </SafeAreaView>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity accessibilityRole="button" style={styles.primaryButton} onPress={onPress}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 18, fontWeight: '600', color: colors.foreground, textAlign: 'center' },
  body: { fontSize: 14, color: colors.mutedForeground, textAlign: 'center' },
  primaryButton: {
    marginTop: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  primaryButtonText: { color: colors.primaryForeground, fontWeight: '600', fontSize: 15 },
  linkButton: { padding: 12, minHeight: 44, justifyContent: 'center' },
  linkText: { color: colors.mutedForeground, fontSize: 15, fontWeight: '500' },

  cameraContainer: { flex: 1, backgroundColor: 'black' },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  cancelButton: { minWidth: 72, minHeight: 44, justifyContent: 'center' },
  cancelText: { color: 'white', fontSize: 16, fontWeight: '600' },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterBusy: { opacity: 0.5 },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'white' },
  controlSpacer: { minWidth: 72 },
});
