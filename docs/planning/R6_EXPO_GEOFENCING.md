# R-6 · Expo Background Geofencing — Capability Verification

> **Status:** RESEARCH DONE (2026-09-08). Verifies SEED_BRIEF §4 constraint 1 ("Geofencing is
> native-only") and PRODUCT.md Workflow 2 (the geofenced-task differentiator) against **current**
> Expo docs via `context7`. Evidence-first: every capability claim below cites the Expo doc it came
> from. Anything context7 did not confirm is called out in **§7 Unverified / gaps**.
> **Source library (context7):** `/websites/expo_dev_versions_unversioned` (Expo SDK, "unversioned" =
> current docs; High source reputation). Cross-checked against `/expo/expo` branches `sdk-54/55/56`.

---

## 1. Verdict

**Background geofencing is fully supported** by `expo-location` + `expo-task-manager`, on both iOS and
Android, in a **development / self-built native binary** (not Expo Go, not a PWA). This confirms the
seed-brief constraint: the geofence carrier **must** be the Expo native app. Geofence evaluation is
performed by the **OS location subsystem on the device** (see §5 for the on-device / offline caveat).

---

## 2. Core API surface (verified)

- **`Location.startGeofencingAsync(taskName, regions)`** — starts monitoring an array of regions and
  binds them to a named background task. Calling it again with a new array **replaces** the monitored
  set (how we re-arm as tasks change). Returns `Promise<void>`.
  *(context7: docs.expo.dev/versions/unversioned/sdk/location — "Location.startGeofencingAsync")*
- **`Location.stopGeofencingAsync(taskName)`** — implied counterpart to stop monitoring. *(named in the
  geofencing method group; see §7 — full signature not returned by context7 this pass)*
- **`TaskManager.defineTask(taskName, cb)`** — the background handler. Callback receives
  `{ data: { eventType, region }, error }`. **Must be registered at module/global scope**, not inside a
  React component, so the background runtime can find it on wake.
  *(context7: sdk/location — "Define a Geofencing Task"; sdk/task-manager — "Define and register a
  background task")*
- **`GeofencingEventType`** → `Enter` / `Exit` — the only two event types. **There is no native "dwell"
  event.** *(context7: sdk/location — "Define a Geofencing Task")*
- **`GeofencingRegionState`** enum → `Unknown = 0`, `Inside = 1`, `Outside = 2`.
  *(context7: sdk/location — "GeofencingRegionState Enum Values")*
- **`TaskManager.isAvailableAsync()`** → `Promise<boolean>`; gate calls behind it. **Not available in
  Expo Go on Android; no background execution in Expo Go on iOS; not supported on web.** Requires a
  **development build**. *(context7: sdk/task-manager — "isAvailableAsync")*

Minimal wiring (from the verified snippets):

```ts
// module scope — not inside a component
import { GeofencingEventType } from 'expo-location';
import * as TaskManager from 'expo-task-manager';

const GEOFENCE_TASK = 'orqafy-geofence';

TaskManager.defineTask(GEOFENCE_TASK, ({ data: { eventType, region }, error }) => {
  if (error) return;                       // inspect error.message
  if (eventType === GeofencingEventType.Enter) {
    // arrived at a site → app-side dwell timer → grouped local notification
  }
});
```

```ts
// after permissions granted (see §3)
import * as Location from 'expo-location';
await Location.startGeofencingAsync(GEOFENCE_TASK, regions); // regions: LocationRegion[]
```

---

## 3. Permissions & config (verified)

- **iOS categories:** "When In Use" = **foreground**; "Always" = **background**. Background geofencing
  needs **Always**. "Allow Once" is temporary (current session only, revoked on app close).
  *(context7: sdk/location — "Background permissions > Expo and iOS permissions")*
- **Request flow:** `Location.requestForegroundPermissionsAsync()` → then
  `Location.requestBackgroundPermissionsAsync()`; hook form `Location.useBackgroundPermissions()`.
  *(context7: sdk/location — "useBackgroundPermissions", "requestForegroundPermissionsAsync"; sdk/
  task-manager — "Define and register a background task")*
- **iOS background mode:** add to Info.plist / Expo.plist:
  ```xml
  <key>UIBackgroundModes</key>
  <array><string>location</string></array>
  ```
  *(context7: sdk/location — "Configure UIBackgroundModes in Info.plist")*
- **Config plugin (CNG, set in `app.json`):** permission strings & background settings are set via the
  `expo-location` plugin, e.g. `locationAlwaysAndWhenInUsePermission`:
  ```json
  { "expo": { "plugins": [
    ["expo-location", { "locationAlwaysAndWhenInUsePermission": "Allow $(PRODUCT_NAME) to use your location." }]
  ] } }
  ```
  The plugin also exposes iOS background-location toggles and **Android background-location + foreground-
  service** options, with **specific Android 14+ foreground-service requirements**.
  *(context7: sdk/location — "Configure expo-location in app.json"; "Configurable properties";
  "Configuration in app config")*
- **Android permissions:** approximate + precise location are auto-included. **Foreground and background
  location are optional and, when enabled in a build, trigger additional app-store review/approval.**
  (Not blocking for Orqafy — D-6 ships sideload/self-build, no store submission.)
  *(context7: sdk/location — "Permissions > Android")*

---

## 4. Per-platform behaviour matrix (verified)

| Capability | iOS | Android |
|---|---|---|
| Background geofencing (Enter/Exit) | ✅ | ✅ |
| Max regions monitored simultaneously | **20** | **100** active geofences |
| Wakes a **backgrounded** app on geofence event | ✅ | ✅ |
| Wakes / restarts a **terminated** app | ✅ system **may restart** the app on a new geofence event | ⚠️ terminated app **generally does NOT auto-restart**; behaviour when swiped from recents is **vendor-dependent** |
| Initial region state at startup | ✅ system reports initial state of registered geofences at app start | (not stated) |
| Runs in Expo Go | ❌ (no background in Expo Go) | ❌ (TaskManager unavailable in Expo Go) |
| Requires development / self-built binary | ✅ | ✅ |
| Native "dwell/linger" event | ❌ Enter/Exit only | ❌ Enter/Exit only |

*(context7: sdk/location — "Geofencing methods" [20 iOS / 100 Android limits, iOS initial-state],
"Background location" / "Background location methods" [terminated-app + restart behaviour], sdk/
task-manager — "isAvailableAsync" [Expo Go / dev-build])*

**Implication for the 20-region iOS cap:** Orqafy can have far more than 20 open site-tasks. The app
must **actively manage the monitored set** — register only the ≤20 nearest/most-relevant active-from
regions and re-`startGeofencingAsync` as the worker moves or tasks change. Design item for Phase 3.

**Implication for the ~3-min dwell (PRODUCT Workflow 2):** the OS fires only **Enter/Exit**. The
"dwell ~3 minutes before alerting" is **app-side logic** — start a timer on `Enter`, cancel on `Exit`,
fire the grouped local notification if still inside after the dwell window. Not a native geofence param.

---

## 5. On-device / offline evaluation

- The geofence Enter/Exit decision is made by the **OS location manager on the device** (iOS
  CoreLocation region monitoring; Android geofencing service). The `expo-location` geofencing API takes
  local coordinates + radius and delivers events through a local background task — **no
  `expo-location` call in this flow posts to a network/server.** This is consistent with the docs
  describing geofencing purely as device region-monitoring with no service endpoint.
- **⚠️ Caveat (flagged):** context7 does **not** contain an explicit sentence stating "geofencing makes
  no network/server contact." The offline/on-device conclusion is **inferred** from the API shape (all
  inputs are local; events arrive via a local TaskManager task) and platform knowledge of CoreLocation/
  Android geofencing — **treat the literal "zero network" claim as UNVERIFIED via context7** (see §7).
  Practically: assisted-GPS/location fixes on the device may use cached cell/wifi data, but that is the
  OS positioning layer, not Orqafy contacting a server. Orqafy's own alert (dwell timer + local
  notification) is fully local and offline-capable, matching the offline-first design.

---

## 6. iOS PWA has no background geolocation (seed-brief claim)

- **This is a web-platform fact, outside context7's Expo-doc scope — context7 neither confirms nor
  denies it** (§7). It is not an Expo capability question; it is an iOS Safari / web-standards
  limitation: iOS Safari and home-screen PWAs get **no Geolocation API access while backgrounded** and
  **no background geofence/region API at all** (the W3C Geolocation API only runs while the page is
  foregrounded and alive). Android PWA background location is unreliable and vendor-throttled.
- **Conclusion unchanged and reinforced by §2–§4:** background geofence wake-ups exist **only** through
  the native OS region-monitoring path, which `expo-location`/`expo-task-manager` expose to a **native
  build**. Therefore the **Expo native app is mandatory** as the geofence carrier; the PWA remains a
  complementary desk/tablet surface only. *(Established constraint; verify the specific iOS-PWA claim
  against a web-platform source if the owner wants a hard citation — context7 is the wrong tool for it.)*

---

## 7. Unverified / gaps (context7 did not confirm)

1. **Exact SDK version constraint.** Queried the "unversioned" (current) docs; `/expo/expo` lists
   branches **sdk-54 / sdk-55 / sdk-56**. The API above is current as of these; a precise minimum
   version and any recent signature change were **not** pinned this pass. Confirm the target SDK
   (likely 54+) at Phase 3 and re-query the versioned doc id then.
2. **`LocationRegion` object field names** (`identifier`, `latitude`, `longitude`, `radius`,
   `notifyOnEnter`, `notifyOnExit`) were **not returned verbatim** by context7 — inferred from the
   Task/PRODUCT `location{lat,lng,radiusMeters}` shape. Pull the exact `LocationRegion` type from the
   SDK typings before coding.
3. **`stopGeofencingAsync` / `hasStartedGeofencingAsync` signatures** — named/implied but full
   signatures not returned this pass.
4. **Raw `NSLocation*UsageDescription` key names** — the config plugin generates the usage-description
   strings from `locationAlwaysAndWhenInUsePermission` (and related props); context7 confirmed the
   **plugin property**, not the literal Info.plist key each maps to. Confirm the generated keys
   (`NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`) from the
   config-plugin reference at build time.
5. **Android `FOREGROUND_SERVICE_LOCATION` exact manifest wiring for Android 14+** — docs confirm the
   plugin has foreground-service options and that Android 14+ has specific requirements, but the exact
   permission/service-type manifest entries were not returned. Confirm from the config-plugin
   "Configurable properties" table at Phase 3.
6. **"Zero network / fully offline" literal claim** — inferred, not stated by context7 (see §5).
7. **iOS-PWA-no-background-geolocation claim** — a web-standards fact, **outside context7's scope**
   (§6); not citable from Expo docs.

---

## 8. Citations

All via context7 library **`/websites/expo_dev_versions_unversioned`** (Expo SDK, current/unversioned):

- `docs.expo.dev/versions/unversioned/sdk/location` — "Location.startGeofencingAsync(taskName,
  regions)"; "Define a Geofencing Task"; "Geofencing methods" (20 iOS / 100 Android limits + iOS
  initial-state); "Background location" & "Background location methods" (terminated-app + iOS restart);
  "Background permissions > Expo and iOS permissions" (When-In-Use/Always/Allow-Once);
  "useBackgroundPermissions"; "requestForegroundPermissionsAsync"; "Configure UIBackgroundModes in
  Info.plist"; "Configure expo-location in app.json"; "Configurable properties"; "Configuration in app
  config"; "Permissions > Android"; "GeofencingRegionState Enum Values".
- `docs.expo.dev/versions/unversioned/sdk/task-manager` — "TaskManager.isAvailableAsync()" (Expo Go /
  dev-build / web); "Define and register a background task" (module-scope defineTask + permission flow).
- Library resolution cross-check: context7 `/expo/expo` (branches sdk-54/55/56).

*Local only — not committed (per HARD HOLD).*
