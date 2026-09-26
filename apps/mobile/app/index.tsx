// My Tasks (chunk 5) — the signed-in worker's assigned, not-yet-done tasks.
//
// Data: `tasks.myTasks` (assignee-filtered server-side). "Mark done" flows through the
// OFFLINE OUTBOX (`enqueue('task','update',{ status:'done' })`) so it works with no
// signal — the row is struck optimistically and the list refetched. "Photo" opens the
// task-scoped camera (/capture?taskId=…, D-28), which queues an outbox photo/create. On every task change
// `useTaskGeofencing` (re)arms OS geofencing for the in-window, located tasks only — the
// on-device half of the authorization boundary.
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { OrqafyApiClient } from '@orqafy/api-client';

import { useAuth } from '@/auth/AuthContext';
import { useOutbox } from '@/offline';
import { useTaskGeofencing } from '@/geofence/task-geofencing';
import { colors } from '@/theme/colors';

type MyTasksResponse = Awaited<ReturnType<OrqafyApiClient['tasks']['myTasks']['query']>>;
type MyTask = MyTasksResponse['tasks'][number];
type TaskCounts = MyTasksResponse['counts'];
type Priority = MyTask['priority'];
type LoadState = 'loading' | 'error' | 'ready';

const EMPTY_COUNTS: TaskCounts = { overdue: 0, due: 0, total: 0 };

const PRIORITY_COLOR: Record<Priority, string> = {
  urgent: colors.destructive,
  high: colors.accent,
  medium: colors.primary,
  low: colors.mutedForeground,
};

const DAY_MS = 86_400_000;

/** Human-friendly due label + whether it is overdue (drives colour). */
function formatDue(due: Date | null, nowMs: number): { label: string; overdue: boolean } | null {
  if (due === null) return null;
  const diffMs = due.getTime() - nowMs;
  if (diffMs < 0) {
    const days = Math.max(1, Math.round(-diffMs / DAY_MS));
    return { label: days === 1 ? 'Overdue by 1 day' : `Overdue by ${days} days`, overdue: true };
  }
  const days = Math.round(diffMs / DAY_MS);
  if (days === 0) return { label: 'Due today', overdue: false };
  if (days === 1) return { label: 'Due tomorrow', overdue: false };
  if (days <= 7) return { label: `Due in ${days} days`, overdue: false };
  return { label: `Due ${due.toLocaleDateString()}`, overdue: false };
}

export default function MyTasksScreen() {
  const { user, client } = useAuth();
  const outbox = useOutbox(client);

  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [counts, setCounts] = useState<TaskCounts>(EMPTY_COUNTS);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (mode === 'refresh') setRefreshing(true);
      else setLoadState('loading');
      try {
        const result = await client.tasks.myTasks.query();
        setTasks(result.tasks);
        setCounts(result.counts);
        setLoadState('ready');
      } catch (err) {
        console.warn('[my-tasks] failed to load tasks', err);
        if (mode === 'initial') setLoadState('error');
      } finally {
        if (mode === 'refresh') setRefreshing(false);
      }
    },
    [client],
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  // On-device authorization boundary: monitor only in-window, located, assigned tasks.
  useTaskGeofencing(client, tasks);

  const markDone = useCallback(
    async (id: string) => {
      setPendingId(id);
      try {
        await outbox.enqueue('task', 'update', { id, status: 'done' });
        setTasks((prev) => prev.filter((t) => t.id !== id)); // optimistic strike-through removal
        await load('refresh');
      } catch (err) {
        console.warn('[my-tasks] failed to mark task done', err);
      } finally {
        setPendingId(null);
      }
    },
    [outbox, load],
  );

  const nowMs = Date.now();

  const renderItem = useCallback(
    ({ item }: { item: MyTask }) => {
      const busy = pendingId === item.id;
      const due = formatDue(item.dueDate, nowMs);
      return (
        <View style={styles.card}>
          <View style={[styles.priorityBar, { backgroundColor: PRIORITY_COLOR[item.priority] }]} />
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.cardProject} numberOfLines={1}>
              {item.project.code} · {item.project.name}
            </Text>
            <View style={styles.metaRow}>
              <View style={[styles.badge, { borderColor: PRIORITY_COLOR[item.priority] }]}>
                <Text style={[styles.badgeText, { color: PRIORITY_COLOR[item.priority] }]}>
                  {item.priority.toUpperCase()}
                </Text>
              </View>
              {due !== null ? (
                <Text style={[styles.due, due.overdue ? styles.dueOverdue : null]}>{due.label}</Text>
              ) : null}
            </View>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Add photo to ${item.title}`}
            style={styles.photoButton}
            onPress={() => router.push({ pathname: '/capture', params: { taskId: item.id } })}
          >
            <Text style={styles.photoButtonText}>Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Mark ${item.title} done`}
            style={[styles.doneButton, busy ? styles.doneButtonBusy : null]}
            disabled={busy}
            onPress={() => void markDone(item.id)}
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Text style={styles.doneButtonText}>Done</Text>
            )}
          </TouchableOpacity>
        </View>
      );
    },
    [markDone, nowMs, pendingId],
  );

  if (loadState === 'loading') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centeredText}>Loading your tasks…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadState === 'error') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Couldn&apos;t load your tasks</Text>
          <Text style={styles.centeredText}>Check your connection and try again.</Text>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.retryButton}
            onPress={() => void load('initial')}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load('refresh')}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.greeting}>
              {user !== null ? `Hi, ${user.name.split(' ')[0] ?? user.name}` : 'My Tasks'}
            </Text>
            <View style={styles.statsRow}>
              <StatPill label="Overdue" value={counts.overdue} tone={colors.destructive} />
              <StatPill label="Due" value={counts.due} tone={colors.accent} />
              <StatPill label="Total" value={counts.total} tone={colors.primary} />
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>All clear</Text>
            <Text style={styles.emptyText}>No tasks assigned — you&apos;re all caught up.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function StatPill({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <View style={styles.statPill}>
      <Text style={[styles.statValue, { color: tone }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  centeredText: { fontSize: 14, color: colors.mutedForeground, textAlign: 'center' },
  errorTitle: { fontSize: 18, fontWeight: '600', color: colors.foreground },
  retryButton: {
    marginTop: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryButtonText: { color: colors.primaryForeground, fontWeight: '600', fontSize: 15 },

  listContent: { padding: 16, paddingBottom: 32, gap: 12, flexGrow: 1 },

  header: { marginBottom: 4, gap: 14 },
  greeting: { fontSize: 26, fontWeight: '700', color: colors.foreground, letterSpacing: -0.5 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statPill: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 2,
  },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 12, color: colors.mutedForeground, fontWeight: '500' },

  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: 'hidden',
  },
  priorityBar: { width: 5 },
  cardBody: { flex: 1, paddingVertical: 14, paddingHorizontal: 14, gap: 4 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.foreground, lineHeight: 21 },
  cardProject: { fontSize: 13, color: colors.mutedForeground },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  badge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  due: { fontSize: 12, color: colors.mutedForeground, fontWeight: '500' },
  dueOverdue: { color: colors.destructive, fontWeight: '600' },

  photoButton: {
    alignSelf: 'center',
    marginLeft: 4,
    minWidth: 64,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  photoButtonText: { color: colors.foreground, fontWeight: '600', fontSize: 14 },

  doneButton: {
    alignSelf: 'center',
    marginRight: 12,
    marginLeft: 4,
    minWidth: 64,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  doneButtonBusy: { opacity: 0.6 },
  doneButtonText: { color: colors.primaryForeground, fontWeight: '600', fontSize: 14 },

  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 64, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.foreground },
  emptyText: { fontSize: 14, color: colors.mutedForeground, textAlign: 'center' },
});
