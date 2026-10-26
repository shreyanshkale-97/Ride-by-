import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useAuthStore } from '../../src/store/authStore';
import { supabase } from '../../src/services/supabase';
import { RideHistory } from '../../src/types';

const C = {
  bg: '#0A0E1A',
  surface: '#12172B',
  surface2: '#1A2035',
  surface3: '#232B45',
  border: 'rgba(255,255,255,0.08)',
  primary: '#FF6B35',
  primaryLight: '#FF8C5A',
  green: '#10B981',
  textPrimary: '#F9FAFB',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
};

export default function HistoryScreen() {
  const { user } = useAuthStore();
  const [history, setHistory] = useState<RideHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('ride_history')
      .select('*, ride:rides(name, meeting_name, destination_name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setHistory(data ?? []);
    setLoading(false);
  };

  const formatDuration = (mins?: number) => {
    if (!mins) return '—';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator color={C.primary} size="large" />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ride History</Text>
        <Text style={styles.subtitle}>Your past adventures and group logs</Text>
      </View>

      {history.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconCircle}>
            <Text style={styles.emptyIcon}>🏁</Text>
          </View>
          <Text style={styles.emptyText}>No rides logged yet</Text>
          <Text style={styles.emptySubtext}>Once you complete or join a ride, telemetry summaries will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 18 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.accentBorder} />
              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{item.ride?.name ?? 'Completed Ride'}</Text>
                  <Text style={styles.cardDate}>
                    {new Date(item.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </Text>
                </View>

                {item.ride && (
                  <Text style={styles.cardRoute}>
                    📍 {item.ride.meeting_name} → 🏁 {item.ride.destination_name}
                  </Text>
                )}

                <View style={styles.stats}>
                  <View style={styles.stat}>
                    <Text style={styles.statValue}>
                      {item.total_distance ? `${item.total_distance.toFixed(1)} km` : '—'}
                    </Text>
                    <Text style={styles.statLabel}>Distance</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.stat}>
                    <Text style={styles.statValue}>{formatDuration(item.duration_min)}</Text>
                    <Text style={styles.statLabel}>Duration</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.stat}>
                    <Text style={styles.statValue}>{item.member_count ?? '1'}</Text>
                    <Text style={styles.statLabel}>Riders</Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: C.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: C.textSecondary,
    marginTop: 4,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 38,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '800',
    color: C.textPrimary,
  },
  emptySubtext: {
    fontSize: 13,
    color: C.textSecondary,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: 18,
    marginBottom: 14,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  accentBorder: {
    width: 4,
    backgroundColor: C.primary,
  },
  cardContent: {
    flex: 1,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: C.textPrimary,
    flex: 1,
  },
  cardDate: {
    fontSize: 11,
    fontWeight: '600',
    color: C.textMuted,
    marginLeft: 8,
  },
  cardRoute: {
    fontSize: 13,
    color: C.textSecondary,
    marginTop: 6,
    marginBottom: 16,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface2,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: C.primaryLight,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: C.textMuted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: C.border,
  },
});
