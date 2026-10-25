import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { supabase } from '../../src/services/supabase';
import { Ride } from '../../src/types';

export default function HomeScreen() {
  const { user } = useAuthStore();
  const [recentRides, setRecentRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentRides();
  }, [user]);

  const fetchRecentRides = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('rides')
      .select('*')
      .in('status', ['planned', 'meeting', 'active'])
      .order('created_at', { ascending: false })
      .limit(5);
    setRecentRides(data ?? []);
    setLoading(false);
  };

  const getRideStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#22c55e';
      case 'meeting': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getRideStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return '🟢 LIVE';
      case 'meeting': return '🟡 Gathering';
      default: return '📋 Planned';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hey, {user?.name?.split(' ')[0]} 👋</Text>
          <Text style={styles.subtitle}>Ready to ride?</Text>
        </View>
        <Text style={styles.logoSmall}>🏍</Text>
      </View>

      {/* Main Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => router.push('/ride/plan')}
        >
          <Text style={styles.createBtnIcon}>+</Text>
          <Text style={styles.createBtnText}>Create Ride</Text>
          <Text style={styles.createBtnSub}>Plan a new group ride</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.joinBtn}
          onPress={() => router.push('/ride/join')}
        >
          <Text style={styles.joinBtnIcon}>🔑</Text>
          <Text style={styles.joinBtnText}>Join Ride</Text>
          <Text style={styles.joinBtnSub}>Enter a ride code</Text>
        </TouchableOpacity>
      </View>

      {/* Active / Recent Rides */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active Rides</Text>

        {loading ? (
          <ActivityIndicator color="#FF6B35" style={{ marginTop: 20 }} />
        ) : recentRides.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🏍</Text>
            <Text style={styles.emptyText}>No active rides</Text>
            <Text style={styles.emptySubtext}>Create or join a ride to get started</Text>
          </View>
        ) : (
          <FlatList
            data={recentRides}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.rideCard}
                onPress={() => {
                  const isLeader = Boolean(user && item.creator_id === user.id);
                  if (item.status === 'active') {
                    router.push(`/ride/active?rideId=${item.id}`);
                  } else {
                    router.push(`/ride/lobby?rideId=${item.id}&isLeader=${isLeader}`);
                  }
                }}
              >
                <View style={styles.rideCardLeft}>
                  <Text style={styles.rideName}>{item.name}</Text>
                  <Text style={styles.rideRoute}>
                    {item.meeting_name} → {item.destination_name}
                  </Text>
                  <Text style={styles.rideCode}>Code: {item.join_code}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getRideStatusColor(item.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getRideStatusColor(item.status) }]}>
                    {getRideStatusLabel(item.status)}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16,
    backgroundColor: '#fff',
  },
  greeting: { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 2 },
  logoSmall: { fontSize: 36 },

  actions: { flexDirection: 'row', gap: 12, padding: 16 },
  createBtn: {
    flex: 1, backgroundColor: '#FF6B35', borderRadius: 16,
    padding: 20, alignItems: 'center',
  },
  createBtnIcon: { fontSize: 32, color: '#fff', fontWeight: '300' },
  createBtnText: { fontSize: 17, fontWeight: '700', color: '#fff', marginTop: 4 },
  createBtnSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  joinBtn: {
    flex: 1, backgroundColor: '#1a1a1a', borderRadius: 16,
    padding: 20, alignItems: 'center',
  },
  joinBtnIcon: { fontSize: 28 },
  joinBtnText: { fontSize: 17, fontWeight: '700', color: '#fff', marginTop: 4 },
  joinBtnSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  section: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#666' },
  emptySubtext: { fontSize: 14, color: '#999', marginTop: 4, textAlign: 'center' },

  rideCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06,
    shadowRadius: 4, elevation: 2,
  },
  rideCardLeft: { flex: 1 },
  rideName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  rideRoute: { fontSize: 13, color: '#666', marginTop: 3 },
  rideCode: { fontSize: 12, color: '#FF6B35', fontWeight: '600', marginTop: 4 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 12 },
  statusText: { fontSize: 12, fontWeight: '700' },
});
