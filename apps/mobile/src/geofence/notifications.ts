// Thin native notifications layer (chunk 4) — the ONLY runtime `expo-notifications`
// surface. It owns: the foreground presentation handler, permission prompting, and
// scheduling/cancelling the app-side DWELL notification.
//
// Dwell mechanism ([HOW], decided by PM): the OS emits only ENTER/EXIT — there is no
// native dwell event, and a JS poll-loop cannot tick while the app is asleep. So the
// 3-minute dwell is a scheduled TIME_INTERVAL local notification: ENTER schedules one
// keyed by `dwellNotificationId(regionId)`; EXIT cancels that same id. The scheduled
// notification is therefore the SINGLE source of a fired dwell alert (no double-fire).
//
// Every native call is wrapped so a failure LOGS and does not throw up the stack — a
// geofence event handler must never crash the background task on a transient RN error.
import * as Notifications from 'expo-notifications';

import { dwellNotificationId } from './constants';

/**
 * Install the foreground presentation handler. Without it, a notification that fires
 * while the app is open is silently dropped. SDK 54 uses `shouldShowBanner` /
 * `shouldShowList` (the older `shouldShowAlert` is deprecated).
 */
export function configureNotifications(): void {
  Notifications.setNotificationHandler({
    // Return a resolved Promise (not an `async` fn with no await) — the handler is
    // synchronous but the API requires a Promise<NotificationBehavior>.
    handleNotification: () =>
      Promise.resolve({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
  });
}

/**
 * Prompt for notification permission. Returns whether notifications are granted;
 * a denied or errored request resolves to `false` (never throws) so arming can
 * proceed with geofencing even if alerts are muted.
 */
export async function ensureNotificationPermissions(): Promise<boolean> {
  try {
    const status = await Notifications.requestPermissionsAsync();
    return status.granted;
  } catch (err) {
    console.warn('[geofence] notification permission request failed', err);
    return false;
  }
}

/**
 * Schedule the single dwell notification for a region. Fires `delaySeconds` after
 * ENTER (180s per `DEFAULT_DWELL_MS`); a matching EXIT cancels it first. Uses the
 * deterministic `dwellNotificationId` so schedule/cancel target the same request.
 */
export async function scheduleDwellNotification(
  regionIdentifier: string,
  delaySeconds: number,
  content: { title: string; body: string },
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: dwellNotificationId(regionIdentifier),
      content: { title: content.title, body: content.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: delaySeconds,
      },
    });
  } catch (err) {
    console.warn('[geofence] failed to schedule dwell notification', regionIdentifier, err);
  }
}

/**
 * Cancel a region's pending dwell notification (called on EXIT, or when re-arming).
 * A no-op if none is scheduled for that id.
 */
export async function cancelDwellNotification(regionIdentifier: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(dwellNotificationId(regionIdentifier));
  } catch (err) {
    console.warn('[geofence] failed to cancel dwell notification', regionIdentifier, err);
  }
}

/**
 * Cancel EVERY pending scheduled notification. Used on sign-out: a dwell timer armed
 * before logout must not fire afterwards (it would leak the previous user's site
 * presence to whoever holds the device).
 *
 * ASSUMPTION: dwell notifications are currently the ONLY thing this app schedules, so
 * cancel-all is exact. If another scheduled notification type is added later, switch
 * to `getAllScheduledNotificationsAsync()` + filter on the `dwell:` id prefix.
 */
export async function cancelAllDwellNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (err) {
    console.warn('[geofence] failed to cancel scheduled dwell notifications', err);
  }
}
