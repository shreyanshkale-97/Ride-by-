import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  FlatList, Share, ActivityIndicator, ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../src/services/supabase';
import { useAuthStore } from '../../src/store/authStore';
import { useRideStore } from '../../src/store/rideStore';
import { Ride, RideMember } from '../../src/types';
import { RoutePreviewMap } from '../../src/components/map/RoutePreviewMap';
import { fetchRoutes, RouteOption, RideStop } from '../../src/services/routingService';
import { showAppAlert } from '../../src/utils/alert';

export default function LobbyScreen() {
  const { rideId, code, isLeader } = useLocalSearchParams<{
    rideId: string; code?: string; isLeader?: string;
  }>();

  const { user, fetchProfile } = useAuthStore();
  const { setActiveRide, setMembers } = useRideStore();

  const [ride, setRide] = useState<Ride | null>(null);
  const [members, setLocalMembers] = useState<RideMember[]>([]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [starting, setStarting] = useState(false);
  const [loadingMap, setLoadingMap] = useState(true);

  // Robust leader calculation
  const isMemberLeader = members.some((m) => m.user_id === user?.id && m.role === 'leader');
  const isCreator = Boolean(ride && user && ride.creator_id === user.id);
  const amLeader = isLeader === 'true' || isCreator || isMemberLeader;

  useEffect(() => {
    if (!rideId) return;

    // Check user auth if not in store
    if (!user) {
      supabase.auth.getUser().then(({ data: authData }) => {
        if (authData?.user) {
          fetchProfile(authData.user.id);
        }
      });
    }

    fetchRideData();

    // Clean up any stale channels before re-subscribing
    const memberTopic = `realtime:lobby-members:${rideId}`;
    const existingMember = supabase.getChannels().find((c) => c.topic === memberTopic);
    if (existingMember) supabase.removeChannel(existingMember);

    const rideTopic = `realtime:lobby-ride:${rideId}`;
    const existingRide = supabase.getChannels().find((c) => c.topic === rideTopic);
    if (existingRide) supabase.removeChannel(existingRide);

    // Listen for real-time member joins / leaves
    const memberChannel = supabase
      .channel(`lobby-members:${rideId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'ride_members',
        filter: `ride_id=eq.${rideId}`,
      }, () => fetchRideData())
      .subscribe();

    // Listen for ride start from leader
    const rideChannel = supabase
      .channel(`lobby-ride:${rideId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'rides',
        filter: `id=eq.${rideId}`,
      }, ({ new: updatedRide }: any) => {
        if (updatedRide?.status === 'active') {
          router.replace(`/ride/active?rideId=${rideId}`);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(memberChannel);
      supabase.removeChannel(rideChannel);
    };
  }, [rideId]);

  const fetchRideData = async () => {
    const [rideRes, membersRes] = await Promise.all([
      supabase.from('rides').select('*').eq('id', rideId).single(),
      supabase.from('ride_members').select('*, profile:profiles(*)').eq('ride_id', rideId),
    ]);

    if (rideRes.data) {
      const r = rideRes.data as Ride;
      setRide(r);
      setActiveRide(r);

      if (r.status === 'active') {
        router.replace(`/ride/active?rideId=${rideId}`);
        return;
      }

      // Load route preview for the map
      if (routes.length === 0) {
        setLoadingMap(true);
        const stops: RideStop[] = Array.isArray(r.stops) ? r.stops : [];
        const fetched = await fetchRoutes(
          r.meeting_lat,
          r.meeting_lng,
          r.destination_lat,
          r.destination_lng,
          stops
        );
        setRoutes(fetched);
        setLoadingMap(false);
      }
    }

    if (membersRes.data) {
      setLocalMembers(membersRes.data);
      setMembers(membersRes.data);
    }
  };

  const handleShare = () => {
    const shareCode = code ?? ride?.join_code ?? '';
    Share.share({
      message: `Join my RideBy group ride! 🏍\n\nRide: ${ride?.name}\nCode: ${shareCode}\nMeeting at: ${ride?.meeting_name}\nDestination: ${ride?.destination_name}\n\nEnter code "${shareCode}" in RideBy to join!`,
    });
  };

  const handleStartRide = async () => {
    if (!rideId) return;

    showAppAlert(
      'Start Group Ride? 🏍',
      'All riders will be notified and live GPS tracking will begin immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Ride!',
          onPress: async () => {
            setStarting(true);
            const { error } = await supabase
              .from('rides')
              .update({
                status: 'active',
                started_at: new Date().toISOString(),
              })
              .eq('id', rideId);

            setStarting(false);
            if (error) {
              showAppAlert('Error', error.message || 'Could not start ride.');
            } else {
              router.replace(`/ride/active?rideId=${rideId}`);
            }
          },
        },
      ]
    );
  };

  if (!ride) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#FF6B35" size="large" />
        <Text style={styles.loadingText}>Loading Ride Dashboard...</Text>
      </View>
    );
  }

  const rideStops: RideStop[] = Array.isArray(ride.stops) ? ride.stops : [];

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/home')} style={styles.backBtn}>
          <Text style={styles.backText}>🏠 Home</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ride Dashboard</Text>
        <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
          <Text style={styles.shareBtnText}>📢 Share</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* RIDE CODE HERO CARD */}
        <View style={styles.codeCard}>
          <View style={styles.codeHeader}>
            <Text style={styles.codeLabel}>JOIN CODE</Text>
            <View style={styles.memberBadge}>
              <Text style={styles.memberBadgeText}>
                {members.length} / {ride.max_members || 20} Riders
              </Text>
            </View>
          </View>
          <Text style={styles.codeValue}>{code ?? ride.join_code}</Text>
          <Text style={styles.codeInstruction}>
            Share this 6-character code with riders to join this ride
          </Text>
          <TouchableOpacity onPress={handleShare} style={styles.copyBtn}>
            <Text style={styles.copyBtnText}>📋 Share Code / Invite Link</Text>
          </TouchableOpacity>
        </View>

        {/* RIDE TITLE & ROUTE SUMMARY */}
        <View style={styles.infoCard}>
          <Text style={styles.rideTitle}>{ride.name}</Text>
          <View style={styles.routeRow}>
            <Text style={styles.routePoint}>📍 {ride.meeting_name}</Text>
            <Text style={styles.routeArrow}>→</Text>
            <Text style={styles.routePoint}>🏁 {ride.destination_name}</Text>
          </View>

          {/* Quick Metrics */}
          <View style={styles.metricsPillsRow}>
            {ride.total_distance ? (
              <Text style={styles.metricPill}>🛣 {ride.total_distance} km</Text>
            ) : null}
            {ride.total_duration ? (
              <Text style={styles.metricPill}>⏱ {ride.total_duration}</Text>
            ) : null}
            {ride.estimated_cost ? (
              <Text style={styles.metricPill}>💰 {ride.estimated_cost}</Text>
            ) : null}
          </View>
        </View>

        {/* EMBEDDED NAVIGATION MAP */}
        <View style={styles.mapCard}>
          <Text style={styles.cardSectionHeader}>🗺 Route & Planned Stops</Text>
          <View style={styles.embeddedMap}>
            {loadingMap ? (
              <View style={styles.mapLoading}>
                <ActivityIndicator color="#FF6B35" />
              </View>
            ) : (
              <RoutePreviewMap
                startLat={ride.meeting_lat}
                startLng={ride.meeting_lng}
                destLat={ride.destination_lat}
                destLng={ride.destination_lng}
                routes={routes}
                selectedRouteId={routes[0]?.id || ''}
                stops={rideStops}
              />
            )}
          </View>

          {/* Stops List */}
          {rideStops.length > 0 && (
            <View style={styles.stopsList}>
              <Text style={styles.stopsListTitle}>Planned Waypoints:</Text>
              {rideStops.map((s, idx) => (
                <View key={s.id || idx} style={styles.stopItem}>
                  <Text style={styles.stopItemEmoji}>
                    {s.type === 'fuel' ? '⛽' : s.type === 'cafe' ? '☕' : '🛑'}
                  </Text>
                  <Text style={styles.stopItemName}>{s.name}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* SCHEDULE & TIMINGS */}
        {(ride.start_time || ride.join_deadline) && (
          <View style={styles.infoCard}>
            <Text style={styles.cardSectionHeader}>📅 Schedule</Text>
            {ride.start_time && (
              <View style={styles.scheduleRow}>
                <Text style={styles.scheduleLabel}>🚀 Starts:</Text>
                <Text style={styles.scheduleValue}>{ride.start_time}</Text>
              </View>
            )}
            {ride.end_time && (
              <View style={styles.scheduleRow}>
                <Text style={styles.scheduleLabel}>🏁 Expected End:</Text>
                <Text style={styles.scheduleValue}>{ride.end_time}</Text>
              </View>
            )}
            {ride.join_deadline && (
              <View style={styles.scheduleRow}>
                <Text style={styles.scheduleLabel}>⏰ Join Deadline:</Text>
                <Text style={styles.scheduleValue}>{ride.join_deadline}</Text>
              </View>
            )}
          </View>
        )}

        {/* DESCRIPTION & RULES */}
        {ride.description ? (
          <View style={styles.infoCard}>
            <Text style={styles.cardSectionHeader}>📝 Guidelines & Rules</Text>
            <Text style={styles.descriptionText}>{ride.description}</Text>
          </View>
        ) : null}

        {/* MEMBERS JOINED LIST */}
        <View style={styles.infoCard}>
          <View style={styles.membersHeader}>
            <Text style={styles.cardSectionHeader}>
              👥 Riders Joined ({members.length})
            </Text>
            <Text style={styles.liveIndicator}>🟢 Real-time</Text>
          </View>

          {members.map((m) => {
            const isMe = m.user_id === user?.id;
            const profile = m.profile as any;
            const isMemberLeader = m.role === 'leader';

            return (
              <View key={m.id} style={styles.memberRow}>
                <View style={[styles.avatar, isMemberLeader && styles.avatarLeader]}>
                  <Text style={styles.avatarText}>
                    {profile?.name?.charAt(0)?.toUpperCase() ?? '?'}
                  </Text>
                </View>
                <View style={styles.memberMeta}>
                  <Text style={styles.memberName}>
                    {profile?.name ?? 'Rider'} {isMe && '(You)'}
                  </Text>
                  <Text style={styles.memberRole}>
                    {isMemberLeader ? '👑 Ride Leader' : '🏍 Group Rider'}
                  </Text>
                </View>
                <View style={styles.memberStatusBadge}>
                  <Text style={styles.memberStatusBadgeText}>✓ Ready</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FIXED BOTTOM ACTION BAR */}
      <View style={styles.bottomBar}>
        {amLeader ? (
          <TouchableOpacity
            style={[styles.startBtn, starting && styles.btnDisabled]}
            onPress={handleStartRide}
            disabled={starting}
          >
            {starting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.startBtnText}>🏍 START RIDE NOW</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.waitingNotice}>
            <Text style={styles.waitingNoticeText}>
              ⏳ Waiting for the ride leader to start the ride...
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 15, color: '#666' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 15, color: '#FF6B35', fontWeight: '700' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#1a1a1a' },
  shareBtn: { padding: 4 },
  shareBtnText: { fontSize: 15, color: '#FF6B35', fontWeight: '700' },

  scrollContent: { padding: 16 },

  // HERO CODE CARD
  codeCard: {
    backgroundColor: '#fff8f3',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF6B35',
    marginBottom: 16,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  codeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    alignItems: 'center',
  },
  codeLabel: { fontSize: 11, color: '#FF6B35', fontWeight: '800', letterSpacing: 1.5 },
  memberBadge: {
    backgroundColor: '#fed7aa',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  memberBadgeText: { fontSize: 12, fontWeight: '700', color: '#9a3412' },
  codeValue: {
    fontSize: 46,
    fontWeight: '900',
    color: '#1a1a1a',
    letterSpacing: 6,
    marginVertical: 10,
  },
  codeInstruction: { fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 14 },
  copyBtn: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  copyBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  // INFO CARD
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  rideTitle: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
  routeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 12 },
  routePoint: { fontSize: 14, color: '#4b5563', fontWeight: '600', flex: 1 },
  routeArrow: { fontSize: 16, color: '#9ca3af', marginHorizontal: 8 },
  metricsPillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metricPill: {
    backgroundColor: '#f3f4f6',
    color: '#374151',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },

  // EMBEDDED MAP CARD
  mapCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardSectionHeader: { fontSize: 15, fontWeight: '800', color: '#1a1a1a', marginBottom: 10 },
  embeddedMap: {
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
  },
  mapLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  stopsList: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  stopsListTitle: { fontSize: 12, fontWeight: '700', color: '#6b7280', marginBottom: 6 },
  stopItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  stopItemEmoji: { fontSize: 14, marginRight: 6 },
  stopItemName: { fontSize: 13, color: '#374151', fontWeight: '600' },

  // SCHEDULE
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  scheduleLabel: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  scheduleValue: { fontSize: 13, color: '#1a1a1a', fontWeight: '700' },

  descriptionText: { fontSize: 14, color: '#4b5563', lineHeight: 20 },

  // MEMBERS LIST
  membersHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liveIndicator: { fontSize: 12, fontWeight: '700', color: '#16a34a' },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarLeader: { backgroundColor: '#FF6B35' },
  avatarText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  memberMeta: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  memberRole: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  memberStatusBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  memberStatusBadgeText: { fontSize: 11, fontWeight: '800', color: '#059669' },

  // BOTTOM BAR
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 24,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 8,
  },
  startBtn: {
    backgroundColor: '#FF6B35',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: { opacity: 0.6 },
  startBtnText: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  waitingNotice: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  waitingNoticeText: { fontSize: 14, color: '#6b7280', fontWeight: '600' },
});
