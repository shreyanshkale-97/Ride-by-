import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../src/services/supabase';
import { useAuthStore } from '../../src/store/authStore';
import { Ride } from '../../src/types';

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
    <View style={styles.center}><ActivityIndicator color="#FF6B35" size="large" /></View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.celebrationHeader}>
        <Text style={styles.celebrationEmoji}>🏁</Text>
        <Text style={styles.celebrationTitle}>Ride Complete!</Text>
        <Text style={styles.celebrationSub}>{ride?.name}</Text>
      </View>

      <View style={styles.statsCard}>
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statEmoji}>⏱</Text>
            <Text style={styles.statValue}>{getDuration()}</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statEmoji}>👥</Text>
            <Text style={styles.statValue}>{memberCount}</Text>
            <Text style={styles.statLabel}>Riders</Text>
          </View>
        </View>

        <View style={styles.routeSummary}>
          <Text style={styles.routeLabel}>Route</Text>
          <Text style={styles.routeText}>
            {ride?.meeting_name} → {ride?.destination_name}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.homeBtn}
        onPress={() => router.replace('/(tabs)/home')}
      >
        <Text style={styles.homeBtnText}>Back to Home</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  celebrationHeader: {
    backgroundColor: '#FF6B35', paddingVertical: 48, alignItems: 'center',
  },
  celebrationEmoji: { fontSize: 64, marginBottom: 12 },
  celebrationTitle: { fontSize: 30, fontWeight: '800', color: '#fff' },
  celebrationSub: { fontSize: 16, color: 'rgba(255,255,255,0.85)', marginTop: 6 },
  statsCard: {
    backgroundColor: '#fff', margin: 20, borderRadius: 20,
    padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  statRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  stat: { flex: 1, alignItems: 'center' },
  statEmoji: { fontSize: 32, marginBottom: 8 },
  statValue: { fontSize: 32, fontWeight: '800', color: '#1a1a1a' },
  statLabel: { fontSize: 13, color: '#888', marginTop: 4 },
  statDivider: { width: 1, height: 60, backgroundColor: '#f0f0f0' },
  routeSummary: {
    borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 20,
  },
  routeLabel: { fontSize: 12, color: '#999', fontWeight: '600', letterSpacing: 1, marginBottom: 6 },
  routeText: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  homeBtn: {
    backgroundColor: '#1a1a1a', borderRadius: 14, margin: 20,
    padding: 18, alignItems: 'center',
  },
  homeBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
