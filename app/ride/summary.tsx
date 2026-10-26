import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  TouchableOpacity, ActivityIndicator, ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../src/services/supabase';
import { useAuthStore } from '../../src/store/authStore';
import { Ride } from '../../src/types';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  bg:           '#0A0E1A',
  surface:      '#12172B',
  surface2:     '#1A2035',
  surface3:     '#232B45',
  border:       'rgba(255,255,255,0.08)',
  primary:      '#FF6B35',
  primaryLight: '#FF8C5A',
  blue:         '#2563EB',
  blueLight:    '#60A5FA',
  green:        '#10B981',
  red:          '#EF4444',
  textPrimary:  '#F9FAFB',
  textSecondary:'#9CA3AF',
  textMuted:    '#4B5563',
};

export default function SummaryScreen() {
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const { user } = useAuthStore();
  const [ride, setRide] = useState<Ride | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!rideId || !user) return;
    fetchAndSave();
  }, [rideId]);

  const fetchAndSave = async () => {
    const [rideRes, membersRes] = await Promise.all([
      supabase.from('rides').select('*').eq('id', rideId).single(),
      supabase.from('ride_members').select('id').eq('ride_id', rideId),
    ]);

    if (rideRes.data) setRide(rideRes.data);
    const count = membersRes.data?.length ?? 0;
    setMemberCount(count);

    // Save to ride history
    const start = rideRes.data?.started_at ? new Date(rideRes.data.started_at) : null;
    const end = rideRes.data?.ended_at ? new Date(rideRes.data.ended_at) : new Date();
    const durationMin = start ? Math.round((end.getTime() - start.getTime()) / 60000) : null;

    await supabase.from('ride_history').upsert({
      ride_id: rideId,
      user_id: user!.id,
      duration_min: durationMin,
      member_count: count,
    });

    setLoading(false);
  };

  const getDuration = () => {
    if (!ride?.started_at) return '—';
    const start = new Date(ride.started_at);
    const end = ride.ended_at ? new Date(ride.ended_at) : new Date();
    const mins = Math.round((end.getTime() - start.getTime()) / 60000);
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
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── CELEBRATION HERO ─────────────────────────────────── */}
        <View style={styles.heroSection}>
          <Text style={styles.heroEmoji}>🎉</Text>
          <Text style={styles.heroTitle}>Ride Complete!</Text>
          <Text style={styles.heroSubtitle}>{ride?.name}</Text>
        </View>

        {/* ── STATS GRID ────────────────────────────────────────── */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>⏱</Text>
            <Text style={styles.statValue}>{getDuration()}</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>👥</Text>
            <Text style={styles.statValue}>{memberCount}</Text>
            <Text style={styles.statLabel}>Riders</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>🛣</Text>
            <Text style={styles.statValue}>
              {ride?.total_distance ? `${ride.total_distance}` : '—'}
            </Text>
            <Text style={styles.statLabel}>km</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>⚡</Text>
            <Text style={styles.statValue}>—</Text>
            <Text style={styles.statLabel}>Avg Speed</Text>
          </View>
        </View>

        {/* ── ROUTE RECAP ──────────────────────────────────────── */}
        <View style={styles.routeCard}>
          <Text style={styles.routeCardLabel}>ROUTE RECAP</Text>

          <View style={styles.routeRow}>
            <View style={styles.routeDot} />
            <Text style={styles.routePointText} numberOfLines={1}>
              {ride?.meeting_name ?? 'Start'}
            </Text>
          </View>

          <View style={styles.routeLine} />

          <View style={styles.routeRow}>
            <View style={[styles.routeDot, styles.routeDotDest]} />
            <Text style={styles.routePointText} numberOfLines={1}>
              {ride?.destination_name ?? 'Destination'}
            </Text>
          </View>
        </View>

        {/* ── BACK TO HOME ─────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => router.replace('/(tabs)/home')}
          activeOpacity={0.85}
        >
          <Text style={styles.homeBtnText}>🏠  Back to Home</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  scroll: { padding: 24, paddingTop: 0 },

  // ── HERO ──────────────────────────────────────────────────────────
  heroSection: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 36,
  },
  heroEmoji: { fontSize: 72, marginBottom: 16 },
  heroTitle: {
    fontSize: 34, fontWeight: '800', color: C.textPrimary,
    letterSpacing: -0.5, marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 16, color: C.textSecondary, fontWeight: '500',
    textAlign: 'center',
  },

  // ── STATS GRID ────────────────────────────────────────────────────
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: '44%',
    backgroundColor: C.surface2,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  statEmoji: { fontSize: 28, marginBottom: 10 },
  statValue: {
    fontSize: 30, fontWeight: '800', color: C.textPrimary,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 12, color: C.textSecondary, fontWeight: '600',
    marginTop: 4, letterSpacing: 0.5,
  },

  // ── ROUTE CARD ────────────────────────────────────────────────────
  routeCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  routeCardLabel: {
    fontSize: 11, fontWeight: '800', color: C.textMuted,
    letterSpacing: 1.5, marginBottom: 16,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  routeDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: C.primary,
  },
  routeDotDest: { backgroundColor: C.green },
  routePointText: { fontSize: 15, fontWeight: '700', color: C.textPrimary, flex: 1 },
  routeLine: {
    width: 2, height: 24,
    backgroundColor: C.border,
    marginLeft: 5, marginVertical: 4,
  },

  // ── HOME BUTTON ───────────────────────────────────────────────────
  homeBtn: {
    backgroundColor: C.primary,
    borderRadius: 16,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  homeBtnText: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 0.2 },
});
