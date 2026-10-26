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
      case 'active': return '#10B981';
      case 'meeting': return '#FF6B35';
      default: return '#2563EB';
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
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Hey, {user?.name?.split(' ')[0]} 👋</Text>
          <Text style={styles.subtitle}>Ready to ride?</Text>
        </View>
        <View style={styles.logoBadge}>
          <Text style={styles.logoEmoji}>🏍</Text>
        </View>
      </View>

      {/* Main Actions */}
      <View style={styles.actions}>
        {/* Create Ride Card */}
        <TouchableOpacity
          style={styles.createCard}
          onPress={() => router.push('/ride/plan')}
          activeOpacity={0.85}
        >
          <View style={styles.cardIconWrap}>
            <Text style={styles.cardIcon}>＋</Text>
          </View>
          <Text style={styles.createCardLabel}>Create Ride</Text>
          <Text style={styles.createCardSub}>Plan a group ride</Text>
        </TouchableOpacity>

        {/* Join Ride Card */}
        <TouchableOpacity
          style={styles.joinCard}
          onPress={() => router.push('/ride/join')}
          activeOpacity={0.85}
        >
          <View style={styles.cardIconWrapBlue}>
            <Text style={styles.cardIcon}>🔑</Text>
          </View>
          <Text style={styles.joinCardLabel}>Join Ride</Text>
          <Text style={styles.joinCardSub}>Enter a ride code</Text>
        </TouchableOpacity>
      </View>

      {/* Active Rides Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.orangeDot} />
          <Text style={styles.sectionTitle}>Active Rides</Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#FF6B35" style={{ marginTop: 32 }} />
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
            contentContainerStyle={{ paddingBottom: 20 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.rideCard}
                activeOpacity={0.8}
                onPress={() => {
                  const isLeader = Boolean(user && item.creator_id === user.id);
                  if (item.status === 'active') {
                    router.push(`/ride/active?rideId=${item.id}`);
                  } else {
                    router.push(`/ride/lobby?rideId=${item.id}&isLeader=${isLeader}`);
                  }
                }}
              >
                <View style={styles.rideCardAccent} />
                <View style={styles.rideCardContent}>
                  <View style={styles.rideCardLeft}>
                    <Text style={styles.rideName}>{item.name}</Text>
                    <Text style={styles.rideRoute}>
                      {item.meeting_name} → {item.destination_name}
                    </Text>
                    <Text style={styles.rideCode}>Code: {item.join_code}</Text>
                  </View>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: getRideStatusColor(item.status) + '22' }
                  ]}>
                    <Text style={[styles.statusText, { color: getRideStatusColor(item.status) }]}>
                      {getRideStatusLabel(item.status)}
                    </Text>
                  </View>
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
  container: { flex: 1, backgroundColor: '#0A0E1A' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 20, paddingBottom: 20,
  },
  headerLeft: { flex: 1 },
  greeting: {
    fontSize: 26, fontWeight: '800', color: '#F9FAFB',
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 14, color: '#9CA3AF', marginTop: 3, fontWeight: '500' },
  logoBadge: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: '#1A2035',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  logoEmoji: { fontSize: 24 },

  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 24, marginBottom: 28 },

  createCard: {
    flex: 1, height: 120,
    backgroundColor: '#FF6B35',
    borderRadius: 20,
    padding: 16,
    justifyContent: 'space-between',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  joinCard: {
    flex: 1, height: 120,
    backgroundColor: '#1A2035',
    borderRadius: 20,
    padding: 16,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.4)',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  cardIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  cardIconWrapBlue: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(37,99,235,0.25)',
    justifyContent: 'center', alignItems: 'center',
  },
  cardIcon: { fontSize: 18 },
  createCardLabel: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  createCardSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  joinCardLabel: { fontSize: 16, fontWeight: '800', color: '#F9FAFB', letterSpacing: -0.2 },
  joinCardSub: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },

  section: { flex: 1, paddingHorizontal: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  orangeDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#FF6B35',
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#F9FAFB', letterSpacing: -0.3 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 48 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#F9FAFB' },
  emptySubtext: { fontSize: 14, color: '#4B5563', marginTop: 6, textAlign: 'center', fontWeight: '500' },

  rideCard: {
    backgroundColor: '#12172B',
    borderRadius: 20,
    marginBottom: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  rideCardAccent: {
    width: 4,
    backgroundColor: '#FF6B35',
  },
  rideCardContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  rideCardLeft: { flex: 1 },
  rideName: { fontSize: 16, fontWeight: '700', color: '#F9FAFB', letterSpacing: -0.2 },
  rideRoute: { fontSize: 13, color: '#9CA3AF', marginTop: 4, fontWeight: '500' },
  rideCode: { fontSize: 12, color: '#FF6B35', fontWeight: '700', marginTop: 6, letterSpacing: 0.3 },
  statusBadge: {
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 12,
  },
  statusText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
});
