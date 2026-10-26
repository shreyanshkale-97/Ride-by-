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

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  bg:          '#0A0E1A',
  surface:     '#12172B',
  surface2:    '#1A2035',
  surface3:    '#232B45',
  border:      'rgba(255,255,255,0.08)',
  primary:     '#FF6B35',
  primaryLight:'#FF8C5A',
  blue:        '#2563EB',
  blueLight:   '#60A5FA',
  green:       '#10B981',
  red:         '#EF4444',
  textPrimary: '#F9FAFB',
  textSecondary:'#9CA3AF',
  textMuted:   '#4B5563',
};

// Avatar colour palette for member initials
const AVATAR_COLORS = ['#2563EB','#7C3AED','#10B981','#F59E0B','#EF4444','#EC4899'];

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
        <ActivityIndicator color={C.primary} size="large" />
        <Text style={styles.loadingText}>Loading Ride Dashboard...</Text>
      </View>
    );
  }

  const rideStops: RideStop[] = Array.isArray(ride.stops) ? ride.stops : [];
  const joinCode = code ?? ride.join_code ?? '';

  return (
    <SafeAreaView style={styles.container}>

      {/* ── TOP NAV BAR ──────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/home')} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ride Lobby</Text>
        <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
          <Text style={styles.shareBtnText}>📢 Share</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── HERO CARD (ride name + join code) ────────────────── */}
        <View style={styles.heroCard}>
          {/* Left: Ride name + route */}
          <View style={styles.heroLeft}>
            <Text style={styles.heroRideName} numberOfLines={2}>{ride.name}</Text>
            <Text style={styles.heroRoute} numberOfLines={1}>
              📍 {ride.meeting_name}
            </Text>
            <Text style={styles.heroRouteArrow}>↓</Text>
            <Text style={styles.heroRoute} numberOfLines={1}>
              🏁 {ride.destination_name}
            </Text>

            {/* Metric pills */}
            <View style={styles.metricPillsRow}>
              {ride.total_distance ? (
                <View style={styles.metricPill}><Text style={styles.metricPillText}>🛣 {ride.total_distance} km</Text></View>
              ) : null}
              {ride.total_duration ? (
                <View style={styles.metricPill}><Text style={styles.metricPillText}>⏱ {ride.total_duration}</Text></View>
              ) : null}
              {ride.estimated_cost ? (
                <View style={styles.metricPill}><Text style={styles.metricPillText}>💰 {ride.estimated_cost}</Text></View>
              ) : null}
            </View>
          </View>

          {/* Right: Join code box */}
          <View style={styles.joinCodeBox}>
            <Text style={styles.joinCodeLabel}>JOIN CODE</Text>
            <Text style={styles.joinCodeValue}>{joinCode}</Text>
            <TouchableOpacity onPress={handleShare} style={styles.copyBtn}>
              <Text style={styles.copyBtnText}>📋 Copy</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── MAP PREVIEW ─────────────────────────────────────────── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>🗺 Route & Planned Stops</Text>
          <View style={styles.mapContainer}>
            {loadingMap ? (
              <View style={styles.mapLoading}>
                <ActivityIndicator color={C.primary} />
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

          {/* Stops list */}
          {rideStops.length > 0 && (
            <View style={styles.stopsList}>
              <Text style={styles.stopsListTitle}>PLANNED WAYPOINTS</Text>
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

        {/* ── MEMBERS SECTION ──────────────────────────────────────── */}
        <View style={styles.sectionCard}>
          <View style={styles.membersHeaderRow}>
            <View style={styles.membersHeaderLeft}>
              <View style={styles.liveStatusDot} />
              <Text style={styles.sectionHeader}>Riders ({members.length})</Text>
            </View>
            <Text style={styles.liveLabel}>🟢 Real-time</Text>
          </View>

          {members.map((m, idx) => {
            const isMe = m.user_id === user?.id;
            const profile = m.profile as any;
            const isRoleLeader = m.role === 'leader';
            const initial = profile?.name?.charAt(0)?.toUpperCase() ?? '?';
            const avatarBg = AVATAR_COLORS[idx % AVATAR_COLORS.length];

            return (
              <View
                key={m.id}
                style={[styles.memberRow, isRoleLeader && styles.memberRowLeader]}
              >
                {/* Leader accent bar */}
                {isRoleLeader && <View style={styles.leaderAccentBar} />}

                {/* Avatar */}
                <View style={[styles.memberAvatar, { backgroundColor: avatarBg }]}>
                  <Text style={styles.memberAvatarText}>{initial}</Text>
                </View>

                {/* Name + role */}
                <View style={styles.memberMeta}>
                  <Text style={styles.memberName}>
                    {profile?.name ?? 'Rider'}{isMe ? ' (You)' : ''}
                  </Text>
                  {isRoleLeader ? (
                    <View style={styles.leaderPill}>
                      <Text style={styles.leaderPillText}>LEADER</Text>
                    </View>
                  ) : (
                    <View style={styles.memberPill}>
                      <Text style={styles.memberPillText}>MEMBER</Text>
                    </View>
                  )}
                </View>

                {/* Status dot */}
                <View style={styles.readyBadge}>
                  <Text style={styles.readyBadgeText}>✓ Ready</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ── SCHEDULE CARD ────────────────────────────────────────── */}
        {(ride.start_time || ride.join_deadline) && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeader}>📅 Schedule</Text>
            {ride.start_time && (
              <View style={styles.scheduleRow}>
                <Text style={styles.scheduleIcon}>🚀</Text>
                <Text style={styles.scheduleLabel}>Starts</Text>
                <Text style={styles.scheduleValue}>{ride.start_time}</Text>
              </View>
            )}
            {ride.end_time && (
              <View style={styles.scheduleRow}>
                <Text style={styles.scheduleIcon}>🏁</Text>
                <Text style={styles.scheduleLabel}>Expected End</Text>
                <Text style={styles.scheduleValue}>{ride.end_time}</Text>
              </View>
            )}
            {ride.join_deadline && (
              <View style={styles.scheduleRow}>
                <Text style={styles.scheduleIcon}>⏰</Text>
                <Text style={styles.scheduleLabel}>Join Deadline</Text>
                <Text style={styles.scheduleValue}>{ride.join_deadline}</Text>
              </View>
            )}
          </View>
        )}

        {/* ── DESCRIPTION ──────────────────────────────────────────── */}
        {ride.description ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeader}>📝 Guidelines & Rules</Text>
            <Text style={styles.descriptionText}>{ride.description}</Text>
          </View>
        ) : null}

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ── FIXED BOTTOM ACTION BAR ──────────────────────────────── */}
      <View style={styles.bottomBar}>
        {amLeader ? (
          <TouchableOpacity
            style={[styles.startBtn, starting && styles.btnDisabled]}
            onPress={handleStartRide}
            disabled={starting}
            activeOpacity={0.85}
          >
            {starting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.startBtnText}>🏁  Start Ride</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.waitingBox}>
            <ActivityIndicator color={C.primary} size="small" style={{ marginRight: 10 }} />
            <Text style={styles.waitingText}>Waiting for leader to start the ride…</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  loadingText: { marginTop: 14, fontSize: 15, color: C.textSecondary, fontWeight: '600' },

  // ── HEADER ────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.surface,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: C.surface3,
    justifyContent: 'center', alignItems: 'center',
  },
  backArrow: { fontSize: 20, color: C.textPrimary, fontWeight: '700' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: C.textPrimary, letterSpacing: -0.3 },
  shareBtn: {
    backgroundColor: 'rgba(255,107,53,0.15)',
    borderWidth: 1, borderColor: C.primary,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
  },
  shareBtnText: { fontSize: 13, color: C.primary, fontWeight: '700' },

  scrollContent: { padding: 16 },

  // ── HERO CARD ─────────────────────────────────────────────────────
  heroCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  heroLeft: { flex: 1, paddingRight: 16 },
  heroRideName: {
    fontSize: 22, fontWeight: '800', color: C.textPrimary,
    letterSpacing: -0.5, marginBottom: 10,
  },
  heroRoute: { fontSize: 13, color: C.textSecondary, fontWeight: '600', marginBottom: 2 },
  heroRouteArrow: { fontSize: 12, color: C.textMuted, marginLeft: 10, marginBottom: 2 },
  metricPillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  metricPill: {
    backgroundColor: C.surface3,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  metricPillText: { fontSize: 12, fontWeight: '700', color: C.textSecondary },

  // Join code box
  joinCodeBox: {
    backgroundColor: C.surface3,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.3)',
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  joinCodeLabel: {
    fontSize: 10, fontWeight: '800', color: C.primary,
    letterSpacing: 1.5, marginBottom: 6,
  },
  joinCodeValue: {
    fontSize: 32, fontWeight: '900', color: C.primary,
    letterSpacing: 4, fontVariant: ['tabular-nums'] as any,
    marginBottom: 10,
  },
  copyBtn: {
    backgroundColor: C.primary, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  copyBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  // ── SECTION CARD ──────────────────────────────────────────────────
  sectionCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  sectionHeader: {
    fontSize: 15, fontWeight: '800', color: C.textPrimary,
    letterSpacing: -0.3, marginBottom: 14,
  },

  // Map
  mapContainer: { height: 200, borderRadius: 16, overflow: 'hidden', backgroundColor: C.surface3 },
  mapLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  stopsList: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border },
  stopsListTitle: {
    fontSize: 11, fontWeight: '700', color: C.textMuted,
    letterSpacing: 1, marginBottom: 8,
  },
  stopItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  stopItemEmoji: { fontSize: 14, marginRight: 8 },
  stopItemName: { fontSize: 13, color: C.textSecondary, fontWeight: '600' },

  // Members
  membersHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14,
  },
  membersHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveStatusDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: C.green,
  },
  liveLabel: { fontSize: 12, fontWeight: '700', color: C.green },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  memberRowLeader: {
    backgroundColor: 'rgba(255,107,53,0.05)',
    borderRadius: 12,
    paddingHorizontal: 6,
    marginHorizontal: -6,
  },
  leaderAccentBar: {
    width: 3, height: 36, borderRadius: 2,
    backgroundColor: C.primary, marginRight: 10,
  },
  memberAvatar: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  memberAvatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  memberMeta: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  memberName: { fontSize: 15, fontWeight: '700', color: C.textPrimary },
  leaderPill: {
    backgroundColor: 'rgba(255,107,53,0.18)',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(255,107,53,0.4)',
  },
  leaderPillText: { fontSize: 10, fontWeight: '800', color: C.primary, letterSpacing: 0.5 },
  memberPill: {
    backgroundColor: C.surface3,
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  memberPillText: { fontSize: 10, fontWeight: '700', color: C.textMuted, letterSpacing: 0.5 },
  readyBadge: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)',
  },
  readyBadgeText: { fontSize: 11, fontWeight: '800', color: C.green },

  // Schedule
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  scheduleIcon: { fontSize: 16, marginRight: 10 },
  scheduleLabel: { fontSize: 13, color: C.textSecondary, fontWeight: '600', flex: 1 },
  scheduleValue: { fontSize: 13, color: C.textPrimary, fontWeight: '700' },

  descriptionText: { fontSize: 14, color: C.textSecondary, lineHeight: 22 },

  // ── BOTTOM BAR ────────────────────────────────────────────────────
  bottomBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    padding: 16, paddingBottom: 28,
    backgroundColor: 'rgba(10,14,26,0.97)',
    borderTopWidth: 1, borderTopColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 20,
  },
  startBtn: {
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
  btnDisabled: { opacity: 0.55 },
  startBtnText: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 0.3 },

  waitingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: C.surface2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  waitingText: { fontSize: 14, color: C.textSecondary, fontWeight: '600' },
});
