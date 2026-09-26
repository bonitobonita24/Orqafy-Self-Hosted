// Apply-for-leave screen (chunk 5, D-21).
//
// A site worker requests their own leave here: pick a leave type (with its
// remaining balance in view), enter a start/end date and an optional reason,
// and submit. The submission goes through the OFFLINE OUTBOX
// (`useOutbox(client).enqueue('leave','create', …)`), so applying works with no
// connection — the entry drains to `leave.submitRequest` when the device is back
// online. On submit we optimistically prepend a pending row to the list below.
//
// Date inputs are plain controlled YYYY-MM-DD text fields — no native datepicker
// dependency (HARD HOLD: no `pnpm install`). We validate them ourselves (real
// calendar date + end ≥ start); the server re-checks end ≥ start as a backstop.
//
// Rule 13: imports only `@orqafy/api-client` (types) + local `@/` modules — never a
// server-only workspace package (the restricted db/jobs/storage/sync/web set).
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { OrqafyApiClient } from '@orqafy/api-client';

import { useAuth } from '@/auth/AuthContext';
import { useOutbox } from '@/offline';
import { colors } from '@/theme/colors';

// --- Server-inferred row shapes (no hand-written contract drift) --------------
type LeaveTypeRow = Awaited<ReturnType<OrqafyApiClient['leave']['types']['query']>>[number];
type BalanceRow = Awaited<ReturnType<OrqafyApiClient['leave']['myBalances']['query']>>[number];
type ServerRequestRow = Awaited<ReturnType<OrqafyApiClient['leave']['myRequests']['query']>>[number];

type RequestStatus = 'pending' | 'approved' | 'rejected';

/** A request row as rendered — server rows + not-yet-synced optimistic rows. */
interface DisplayRequest {
  id: string;
  typeName: string;
  startDate: Date;
  endDate: Date;
  status: RequestStatus;
  /** True for an optimistic row queued locally, not yet confirmed by the server. */
  optimistic: boolean;
}

/** Status -> theme token for the badge. */
const STATUS_COLOR: Record<RequestStatus, string> = {
  pending: colors.warning,
  approved: colors.success,
  rejected: colors.destructive,
};

const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

/** Format a Date as YYYY-MM-DD in UTC (dates are stored UTC-midnight, date-only). */
function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Parse a strict YYYY-MM-DD string into a UTC-midnight Date, or null when the
 * shape is wrong or the calendar date is invalid (e.g. 2026-02-30). Round-tripping
 * the components rejects overflow dates the Date constructor would otherwise absorb.
 */
function parseYmd(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (match === null) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

/** Map a server request row into the render shape. */
function toDisplay(row: ServerRequestRow): DisplayRequest {
  return {
    id: row.id,
    typeName: row.leaveType.name,
    startDate: new Date(row.startDate),
    endDate: new Date(row.endDate),
    status: row.status,
    optimistic: false,
  };
}

export default function LeaveScreen() {
  const { client } = useAuth();
  // Keep the runtime object (not a destructured `enqueue`) so the method stays bound
  // to its `this` — `@typescript-eslint/unbound-method` flags the destructured form.
  const outbox = useOutbox(client);

  // Loaded data.
  const [types, setTypes] = useState<LeaveTypeRow[]>([]);
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [requests, setRequests] = useState<DisplayRequest[]>([]);

  // Load lifecycle.
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form state.
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [startText, setStartText] = useState('');
  const [endText, setEndText] = useState('');
  const [reason, setReason] = useState('');
  const [focused, setFocused] = useState<'start' | 'end' | 'reason' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh'): Promise<void> => {
      if (mode === 'initial') {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setLoadError(null);
      try {
        const [typeRows, balanceRows, requestRows] = await Promise.all([
          client.leave.types.query(),
          client.leave.myBalances.query(),
          client.leave.myRequests.query(),
        ]);
        setTypes(typeRows);
        setBalances(balanceRows);
        // A refresh replaces the list with server truth, dropping any optimistic
        // rows that have since been confirmed (or are now real server rows).
        setRequests(requestRows.map(toDisplay));
        setSelectedTypeId((current) => {
          if (current !== null && typeRows.some((t) => t.id === current)) {
            return current;
          }
          return typeRows[0]?.id ?? null;
        });
      } catch {
        setLoadError('Could not load leave data — pull to retry.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [client],
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  const selectedType = useMemo(
    () => types.find((t) => t.id === selectedTypeId) ?? null,
    [types, selectedTypeId],
  );

  // Latest-year balance for the selected type (myBalances is ordered year desc).
  const selectedBalance = useMemo(
    () => (selectedTypeId === null ? null : balances.find((b) => b.leaveTypeId === selectedTypeId) ?? null),
    [balances, selectedTypeId],
  );

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (submitting) {
      return;
    }
    setFormError(null);
    setSuccess(null);

    if (selectedTypeId === null || selectedType === null) {
      setFormError('Choose a leave type.');
      return;
    }
    const start = parseYmd(startText);
    if (start === null) {
      setFormError('Start date must be a real date in YYYY-MM-DD format.');
      return;
    }
    const end = parseYmd(endText);
    if (end === null) {
      setFormError('End date must be a real date in YYYY-MM-DD format.');
      return;
    }
    if (end.getTime() < start.getTime()) {
      setFormError('End date cannot be before the start date.');
      return;
    }

    const trimmedReason = reason.trim();
    const payload: Record<string, string> = {
      leaveTypeId: selectedTypeId,
      // ISO strings; the outbox send-handler revives them to Date (server input is z.date()).
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
    if (trimmedReason.length > 0) {
      payload.reason = trimmedReason;
    }

    setSubmitting(true);
    try {
      await outbox.enqueue('leave', 'create', payload);
      // Optimistically prepend a pending row so the request is visible immediately,
      // even offline. A later refresh reconciles it with the server row.
      setRequests((current) => [
        {
          id: `local-${Date.now()}`,
          typeName: selectedType.name,
          startDate: start,
          endDate: end,
          status: 'pending',
          optimistic: true,
        },
        ...current,
      ]);
      setStartText('');
      setEndText('');
      setReason('');
      setSuccess('Leave request submitted. It will sync when you are online.');
    } catch {
      setFormError('Could not queue the request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, selectedTypeId, selectedType, startText, endText, reason, outbox]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const canSubmit = selectedTypeId !== null && startText.length > 0 && endText.length > 0 && !submitting;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load('refresh')}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {loadError !== null ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{loadError}</Text>
          </View>
        ) : null}

        {/* Balance for the selected type */}
        <View style={styles.balanceCard}>
          <Text style={styles.eyebrow}>Remaining balance</Text>
          {selectedBalance !== null ? (
            <>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceNumber}>{formatDays(selectedBalance.remaining)}</Text>
                <Text style={styles.balanceUnit}>
                  of {formatDays(selectedBalance.entitled)} days
                </Text>
              </View>
              <Text style={styles.balanceMeta}>
                {selectedType?.name ?? 'Leave'} · {selectedBalance.year}
                {selectedType && !selectedType.isPaid ? ' · unpaid' : ''}
              </Text>
            </>
          ) : (
            <Text style={styles.balanceEmpty}>
              No balance on record for {selectedType?.name ?? 'this type'}.
            </Text>
          )}
        </View>

        {/* Apply form */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Apply for leave</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Leave type</Text>
            {types.length === 0 ? (
              <Text style={styles.helper}>No leave types are configured yet.</Text>
            ) : (
              <View style={styles.chips}>
                {types.map((type) => {
                  const active = type.id === selectedTypeId;
                  return (
                    <Pressable
                      key={type.id}
                      onPress={() => setSelectedTypeId(type.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={({ pressed }) => [
                        styles.chip,
                        active && styles.chipActive,
                        pressed && styles.chipPressed,
                      ]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {type.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.dates}>
            <View style={[styles.field, styles.dateField]}>
              <Text style={styles.label}>Start date</Text>
              <TextInput
                style={[styles.input, focused === 'start' && styles.inputFocused]}
                value={startText}
                onChangeText={setStartText}
                onFocus={() => setFocused('start')}
                onBlur={() => setFocused(null)}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                editable={!submitting}
                accessibilityLabel="Start date, format year dash month dash day"
              />
            </View>
            <View style={[styles.field, styles.dateField]}>
              <Text style={styles.label}>End date</Text>
              <TextInput
                style={[styles.input, focused === 'end' && styles.inputFocused]}
                value={endText}
                onChangeText={setEndText}
                onFocus={() => setFocused('end')}
                onBlur={() => setFocused(null)}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                editable={!submitting}
                accessibilityLabel="End date, format year dash month dash day"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Reason <Text style={styles.optional}>(optional)</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.multiline, focused === 'reason' && styles.inputFocused]}
              value={reason}
              onChangeText={setReason}
              onFocus={() => setFocused('reason')}
              onBlur={() => setFocused(null)}
              placeholder="Add a short note for your approver"
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={!submitting}
            />
          </View>

          {formError !== null ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {formError}
            </Text>
          ) : null}
          {success !== null ? (
            <Text style={styles.success} accessibilityLiveRegion="polite">
              {success}
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
              <Text style={styles.buttonText}>Submit request</Text>
            )}
          </Pressable>
        </View>

        {/* Existing requests */}
        <View style={styles.requests}>
          <Text style={styles.eyebrow}>Your requests</Text>
          {requests.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No leave requests yet.</Text>
              <Text style={styles.emptyHint}>Submitted requests appear here.</Text>
            </View>
          ) : (
            requests.map((req) => <RequestItem key={req.id} request={req} />)
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** One request row: type name, date range, status badge. */
function RequestItem({ request }: { request: DisplayRequest }) {
  const badgeColor = STATUS_COLOR[request.status];
  return (
    <View style={styles.requestRow}>
      <View style={styles.requestMain}>
        <Text style={styles.requestType}>{request.typeName}</Text>
        <Text style={styles.requestDates}>
          {ymd(request.startDate)} → {ymd(request.endDate)}
        </Text>
      </View>
      <View style={styles.requestRight}>
        <View style={[styles.badge, { borderColor: badgeColor }]}>
          <View style={[styles.badgeDot, { backgroundColor: badgeColor }]} />
          <Text style={[styles.badgeText, { color: badgeColor }]}>
            {STATUS_LABEL[request.status]}
          </Text>
        </View>
        {request.optimistic ? <Text style={styles.syncTag}>not synced</Text> : null}
      </View>
    </View>
  );
}

/** Render a day count without trailing zeros (e.g. 12, or 12.5 for a half day). */
function formatDays(value: number): string {
  return String(Math.round(value * 100) / 100);
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  banner: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.destructive,
    padding: 12,
  },
  bannerText: {
    color: colors.destructive,
    fontSize: 14,
    lineHeight: 20,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
  },

  // Balance card
  balanceCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 20,
    gap: 10,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  balanceNumber: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
    color: colors.foreground,
    lineHeight: 44,
  },
  balanceUnit: {
    fontSize: 15,
    color: colors.mutedForeground,
    paddingBottom: 6,
  },
  balanceMeta: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  balanceEmpty: {
    fontSize: 15,
    color: colors.mutedForeground,
    lineHeight: 22,
  },

  // Form card
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 20,
    gap: 18,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.cardForeground,
  },
  field: { gap: 8 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.cardForeground,
  },
  optional: {
    fontWeight: '400',
    color: colors.mutedForeground,
  },
  helper: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  chipPressed: { opacity: 0.7 },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  chipTextActive: {
    color: colors.primaryForeground,
  },
  dates: {
    flexDirection: 'row',
    gap: 12,
  },
  dateField: { flex: 1 },
  input: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.foreground,
  },
  inputFocused: { borderColor: colors.primary },
  multiline: {
    minHeight: 84,
    paddingTop: 12,
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.destructive,
  },
  success: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.success,
  },
  button: {
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.85 },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryForeground,
  },

  // Requests list
  requests: { gap: 10 },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 16,
  },
  requestMain: {
    flex: 1,
    gap: 4,
  },
  requestType: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  requestDates: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  requestRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  syncTag: {
    fontSize: 11,
    color: colors.mutedForeground,
    fontStyle: 'italic',
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
    gap: 6,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  emptyHint: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
});
