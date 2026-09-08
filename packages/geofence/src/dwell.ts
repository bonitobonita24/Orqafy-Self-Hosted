// App-side dwell-timer state machine.
//
// The OS emits only Enter / Exit — **there is no native dwell event** (R6 §2).
// The product requirement (PRODUCT Workflow 2) is to alert once a worker has
// genuinely ARRIVED, not on a drive-by clip of the radius. So we run the dwell
// timer ourselves: on Enter we start a ~3-minute countdown; if the worker is
// still Inside when it elapses we emit a single `dwelled` transition (which the
// app turns into the grouped "you have N things to do here" notification); an
// Exit before it elapses cancels it.
//
// This is modelled as a PURE, poll-driven state machine: events carry their own
// timestamps and `collectDwelled(now)` is called on a tick. No real timers live
// here, which keeps it fully deterministic and unit-testable.

/** Default dwell threshold: 3 minutes (R6 — the arrival debounce). */
export const DEFAULT_DWELL_MS = 3 * 60 * 1000;

/** Per-region lifecycle within the dwell machine. */
export type DwellPhase = 'outside' | 'pending' | 'dwelled';

/** A native geofence transition, normalised to our vocabulary. */
export interface GeofenceEvent {
  regionId: string;
  type: 'enter' | 'exit';
  /** Epoch milliseconds the OS reported the event. */
  at: number;
}

/** Emitted when a region's dwell threshold is satisfied. */
export interface DwellTransition {
  regionId: string;
  /** When the worker entered (dwell start). */
  enteredAt: number;
  /** When the threshold was satisfied (`collectDwelled` tick time). */
  dwelledAt: number;
}

interface RegionDwellState {
  phase: DwellPhase;
  enteredAt: number;
}

export interface DwellTrackerOptions {
  /** Threshold before a pending region becomes `dwelled`. */
  dwellMs?: number;
}

/**
 * Tracks dwell state for a set of regions. Feed it native events with
 * {@link DwellTracker.handleEvent}, then call
 * {@link DwellTracker.collectDwelled} on each tick to drain regions whose dwell
 * threshold has just elapsed. Each region fires `dwelled` at most once per stay
 * (re-arming requires an Exit then a fresh Enter).
 */
export class DwellTracker {
  private readonly dwellMs: number;
  private readonly states = new Map<string, RegionDwellState>();

  constructor(options: DwellTrackerOptions = {}) {
    this.dwellMs = options.dwellMs ?? DEFAULT_DWELL_MS;
  }

  /** Apply a native Enter/Exit event. */
  handleEvent(event: GeofenceEvent): void {
    if (event.type === 'enter') {
      const existing = this.states.get(event.regionId);
      // A fresh Enter always (re)starts the dwell countdown, unless we are
      // already counting for this region (ignore duplicate Enters).
      if (existing === undefined || existing.phase === 'outside') {
        this.states.set(event.regionId, { phase: 'pending', enteredAt: event.at });
      }
      return;
    }
    // Exit: cancel any pending dwell and reset to outside.
    this.states.set(event.regionId, { phase: 'outside', enteredAt: 0 });
  }

  /** Current phase for a region (defaults to `outside` if never seen). */
  phaseOf(regionId: string): DwellPhase {
    return this.states.get(regionId)?.phase ?? 'outside';
  }

  /**
   * Drain every region whose dwell threshold has elapsed by `now`. Transitions
   * those regions to `dwelled` and returns one {@link DwellTransition} each.
   * Idempotent within a stay: a region already `dwelled` is not re-emitted.
   */
  collectDwelled(now: number): DwellTransition[] {
    const fired: DwellTransition[] = [];
    for (const [regionId, state] of this.states) {
      if (state.phase !== 'pending') {
        continue;
      }
      if (now - state.enteredAt >= this.dwellMs) {
        this.states.set(regionId, { phase: 'dwelled', enteredAt: state.enteredAt });
        fired.push({ regionId, enteredAt: state.enteredAt, dwelledAt: now });
      }
    }
    return fired;
  }

  /** Drop all tracked state (e.g. on logout / re-arm from a fresh sync). */
  reset(): void {
    this.states.clear();
  }
}
