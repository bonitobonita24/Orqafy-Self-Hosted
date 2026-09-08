// @orqafy/geofence — shared, pure, on-device geofence logic (D-19 / R6).
//
// Consumed primarily by the Expo native app (the geofence carrier — iOS PWAs
// have no background location), and available to the server for reasoning about
// the same region set. PURE TypeScript: no Expo, React Native, DOM, or network
// imports, so it is unit-testable in plain Node and shared across surfaces.
export * from './region';
export * from './distance';
export * from './prioritize';
export * from './dwell';
