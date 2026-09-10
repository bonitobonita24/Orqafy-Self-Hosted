// Notifications center (mobile chunk 5). Reads the signed-in user's feed via the
// vanilla tRPC client from useAuth(); marking-read is routed through the OFFLINE
// OUTBOX (never a direct notifications.markRead/markAllRead mutation) so it works
// with no connectivity — the reconcile/drain layer syncs it later. Rule 13: this
// screen imports only @/* + @orqafy/api-client types — never @orqafy/{db,jobs,
// storage,sync,web}. UI-only; no native module beyond RN + safe-area.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { useOutbox } from '@/offline';
import { colors } from '@/theme/colors';

// --- Notification model (mirrors the server row; payload is untyped JSON) ------

// Known server types: task_assigned | geofence_alert | leave_requested |
// leave_decided | milestone_signoff | document_review | mention | system.
// Kept as `string` so an unmapped future type still renders (see metaFor).
interface NotificationRow {
  id: string;
  userId: string;
  type: string;
  payload: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: Date | string | number;
}

// --- Type → presentation. geofence_alert is the product's signature event and
// reads visually distinct (warm accent glyph + tinted card + left rail). --------

interface TypeMeta {
  title: string;
  glyph: string;
  tint: string;
  /** Signature styling for the geofenced-notification differentiator. */
  signature?: boolean;
}

const TYPE_META: Record<string, TypeMeta> = {
  task_assigned: { title: 'New task assigned', glyph: '\u{1F4CB}', tint: colors.primary },
  geofence_alert: {
    title: 'Site geofence alert',
    glyph: '\u{1F4CD}',
    tint: colors.warning,
    signature: true,
  },
  leave_requested: { title: 'Leave requested', glyph: '\u{1F5D3}', tint: colors.accent },
  leave_decided: { title: 'Leave decision', glyph: '✅', tint: colors.success },
  milestone_signoff: { title: 'Milestone sign-off', glyph: '\u{1F3C1}', tint: colors.primary },
  document_review: { title: 'Document to review', glyph: '\u{1F4C4}', tint: colors.accent },
  mention: { title: 'You were mentioned', glyph: '\u{1F4AC}', tint: colors.primary },
  system: { title: 'System notice', glyph: '\u{1F514}', tint: colors.mutedForeground },
};

function metaFor(type: string): TypeMeta {
  return TYPE_META[type] ?? { title: prettyType(type), glyph: '\u{1F514}', tint: colors.mutedForeground };
}

function prettyType(type: string): string {
  const s = type.replace(/[_-]+/g, ' ').trim();
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : 'Notification';
}

// Payload is untyped — read the first present common key, defensively. -----------
function summaryFrom(payload: Record<string, unknown> | null, fallback: string): string {
  if (payload) {
    for (const key of ['message', 'title', 'name', 'description', 'summary', 'body'] as const) {
      const v = payload[key];
      if (typeof v === 'string' && v.trim().length > 0) return v.trim();
    }
  }
  return fallback;
}

function relativeTime(value: Date | string | number): string {
  const then = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  if (diff < 45_000) return 'just now';
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(then).toLocaleDateString();
}

// -------------------------------------------------------------------------------

export default function NotificationsScreen() {
  const { client } = useAuth();
  // Singleton runtime (stable identity) — kept as an object so the `enqueue`
  // method is never referenced unbound. Marks read via the OFFLINE OUTBOX.
  const outbox = useOutbox(client);

  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (mode === 'initial') setStatus('loading');
      else setRefreshing(true);
      try {
        const [list, count] = await Promise.all([
          client.notifications.list.query({ unreadOnly: false }),
          client.notifications.unreadCount.query(),
        ]);
        setItems(list as NotificationRow[]);
        setUnreadCount(typeof count === 'number' ? count : 0);
        setStatus('ready');
      } catch {
        if (mode === 'initial') setStatus('error');
      } finally {
        if (mode === 'refresh') setRefreshing(false);
      }
    },
    [client],
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  // Tap an unread row → queue the read through the outbox, then optimistically flip.
  const markOneRead = useCallback(
    (id: string) => {
      setItems((prev) => {
        const row = prev.find((n) => n.id === id);
        if (!row || row.isRead) return prev;
        setUnreadCount((c) => Math.max(0, c - 1));
        void outbox.enqueue('notification', 'update', { id });
        return prev.map((n) => (n.id === id ? { ...n, isRead: true } : n));
      });
    },
    [outbox],
  );

  // Mark all read: enqueue one outbox update per unread id (offline-safe; NOT the
  // direct markAllRead mutation), then optimistically clear the whole list.
  const markAllRead = useCallback(() => {
    setItems((prev) => {
      const unread = prev.filter((n) => !n.isRead);
      if (unread.length === 0) return prev;
      for (const n of unread) void outbox.enqueue('notification', 'update', { id: n.id });
      setUnreadCount(0);
      return prev.map((n) => (n.isRead ? n : { ...n, isRead: true }));
    });
  }, [outbox]);

  const hasUnread = unreadCount > 0;

  const header = useMemo(
    () => (
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>Activity</Text>
          {hasUnread ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          ) : null}
        </View>
        <Pressable
          onPress={markAllRead}
          disabled={!hasUnread}
          hitSlop={8}
          style={({ pressed }) => [
            styles.markAll,
            !hasUnread && styles.markAllDisabled,
            pressed && hasUnread && styles.markAllPressed,
          ]}
        >
          <Text style={[styles.markAllText, !hasUnread && styles.markAllTextDisabled]}>
            Mark all read
          </Text>
        </Pressable>
      </View>
    ),
    [hasUnread, unreadCount, markAllRead],
  );

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.centerMuted}>Loading notifications…</Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.centerGlyph}>{'⚠'}</Text>
        <Text style={styles.centerTitle}>{"Couldn't load notifications"}</Text>
        <Text style={styles.centerMuted}>Check your connection and try again.</Text>
        <Pressable
          onPress={() => void load('initial')}
          style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        ListHeaderComponent={header}
        contentContainerStyle={items.length === 0 ? styles.listEmpty : styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load('refresh')}
            tintColor={colors.mutedForeground}
            colors={[colors.primary]}
          />
        }
        renderItem={({ item }) => <NotificationCard item={item} onPress={markOneRead} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.centerGlyph}>{'\u{1F515}'}</Text>
            <Text style={styles.centerTitle}>{"You're all caught up"}</Text>
            <Text style={styles.centerMuted}>No notifications.</Text>
          </View>
        }
      />
    </View>
  );
}

function NotificationCard({
  item,
  onPress,
}: {
  item: NotificationRow;
  onPress: (id: string) => void;
}) {
  const meta = metaFor(item.type);
  const unread = !item.isRead;
  const summary = summaryFrom(item.payload, meta.title);
  const distinct = meta.signature ?? false;

  return (
    <Pressable
      onPress={() => onPress(item.id)}
      android_ripple={{ color: colors.muted }}
      style={({ pressed }) => [
        styles.card,
        distinct && styles.cardSignature,
        unread && styles.cardUnread,
        pressed && styles.cardPressed,
      ]}
    >
      {distinct ? <View style={styles.signatureRail} /> : null}
      <View style={[styles.iconWrap, { backgroundColor: withAlpha(meta.tint) }]}>
        <Text style={styles.icon}>{meta.glyph}</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text
            style={[styles.cardTitle, unread && styles.cardTitleUnread]}
            numberOfLines={1}
          >
            {meta.title}
          </Text>
          {unread ? <View style={styles.unreadDot} /> : null}
        </View>
        <Text style={styles.cardSummary} numberOfLines={2}>
          {summary}
        </Text>
        <Text style={styles.cardTime}>{relativeTime(item.createdAt)}</Text>
      </View>
    </Pressable>
  );
}

/** Soft tint of a token color for the icon chip background. RN parses the 8-digit
 *  hex/hsla poorly across platforms, so fall back to the muted surface. */
function withAlpha(color: string): string {
  return color.startsWith('hsl(') ? color.replace('hsl(', 'hsla(').replace(')', ', 0.14)') : colors.muted;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  listEmpty: { flexGrow: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingBottom: 12,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5, color: colors.foreground },
  badge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: colors.primaryForeground },
  markAll: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  markAllPressed: { backgroundColor: colors.muted },
  markAllDisabled: {},
  markAllText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  markAllTextDisabled: { color: colors.mutedForeground },

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
    overflow: 'hidden',
  },
  cardPressed: { opacity: 0.85 },
  cardUnread: { backgroundColor: colors.card, borderColor: colors.primary },
  cardSignature: { borderColor: colors.warning, paddingLeft: 18 },
  signatureRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.warning,
  },

  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 20 },

  cardBody: { flex: 1, gap: 3 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.cardForeground },
  cardTitleUnread: { fontWeight: '700' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  cardSummary: { fontSize: 13, lineHeight: 19, color: colors.mutedForeground },
  cardTime: { marginTop: 2, fontSize: 11, fontWeight: '500', color: colors.mutedForeground },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
    backgroundColor: colors.background,
  },
  centerGlyph: { fontSize: 34, marginBottom: 4 },
  centerTitle: { fontSize: 17, fontWeight: '600', color: colors.foreground },
  centerMuted: { fontSize: 14, color: colors.mutedForeground, textAlign: 'center' },
  retry: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  retryPressed: { opacity: 0.85 },
  retryText: { fontSize: 14, fontWeight: '600', color: colors.primaryForeground },
});
