import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Platform, Dimensions, TextInput,
  FlatList, KeyboardAvoidingView, SafeAreaView, ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { RideMap, DisplayRider } from '../../src/components/map/RideMap';
import { useRideStore } from '../../src/store/rideStore';
import { subscribeToRide, unsubscribeFromRide } from '../../src/services/realtimeService';
import {
  startLocationBroadcast, stopLocationBroadcast,
  requestForegroundPermission, requestBackgroundPermission,
  getCurrentLocation,
} from '../../src/services/locationService';
import { supabase } from '../../src/services/supabase';
import { Ride, RideMember, ChatMessage } from '../../src/types';
import { fetchRoutes, RideStop, RouteStep } from '../../src/services/routingService';
import {
  calcDistanceM, formatDistance, getRelativePosition,
} from '../../src/utils/location';
import { showAppAlert } from '../../src/utils/alert';

const { height } = Dimensions.get('window');

export default function ActiveRideScreen() {
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const { user } = useAuthStore();
  const { riderMarkers, activeRide, members, messages, addMessage, setMessages } = useRideStore();

  const mapRef = useRef<any>(null);
  const iframeRef = useRef<any>(null);
  const chatChannelRef = useRef<any>(null);

  const [myLat, setMyLat] = useState(22.7196);
  const [myLng, setMyLng] = useState(75.8577);
  const [ride, setRide] = useState<Ride | null>(activeRide);
  const [rideMembers, setRideMembers] = useState<RideMember[]>(members);
  const [routeCoordinates, setRouteCoordinates] = useState<{ lat: number; lng: number }[]>([]);
  const [rideStops, setRideStops] = useState<RideStop[]>([]);
  const [totalDistanceKm, setTotalDistanceKm] = useState<number>(0);
  const [durationText, setDurationText] = useState<string>('');

  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [amLeader, setAmLeader] = useState(false);
  const [sosActive, setSosActive] = useState(false);
  const [hudExpanded, setHudExpanded] = useState(true);

  // Turn-by-turn navigation state
  const [routeSteps, setRouteSteps] = useState<RouteStep[]>([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [distToNextStep, setDistToNextStep] = useState(0);
  const [navCentered, setNavCentered] = useState(true); // auto-follow my location

  useEffect(() => {
    if (!rideId) return;
    initRide();
    return () => {
      stopLocationBroadcast();
      unsubscribeFromRide();
      if (chatChannelRef.current) {
        supabase.removeChannel(chatChannelRef.current);
        chatChannelRef.current = null;
      }
    };
  }, [rideId]);

  // Track which nav step we're on as position changes
  useEffect(() => {
    if (routeSteps.length === 0) return;

    // Find the closest upcoming step that's ahead of us
    let bestIdx = currentStepIdx;
    let bestDist = Infinity;

    for (let i = currentStepIdx; i < routeSteps.length; i++) {
      const step = routeSteps[i];
      if (!step.lat || !step.lng) continue;
      const d = calcDistanceM(myLat, myLng, step.lat, step.lng);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
      // Once steps are more than 2km ahead, stop searching
      if (d > 2000 && i > currentStepIdx) break;
    }

    // Advance step if we're within 30m of the next maneuver point
    const nextStep = routeSteps[currentStepIdx];
    if (nextStep?.lat && nextStep?.lng) {
      const distToNext = calcDistanceM(myLat, myLng, nextStep.lat, nextStep.lng);
      setDistToNextStep(distToNext);

      if (distToNext < 30 && currentStepIdx < routeSteps.length - 1) {
        setCurrentStepIdx((prev) => prev + 1);
      }
    }

    // Send navigation step + recenter postMessage to Leaflet iframe
    if (iframeRef.current?.contentWindow) {
      try {
        // Recenter map on user if navCentered mode is on
        if (navCentered) {
          iframeRef.current.contentWindow.postMessage(
            { type: 'RECENTER', lat: myLat, lng: myLng },
            '*'
          );
        }
        // Send current nav step to show turn arrow
        if (routeSteps[currentStepIdx]) {
          iframeRef.current.contentWindow.postMessage(
            {
              type: 'NAV_STEP',
              step: routeSteps[currentStepIdx],
              distToNext: distToNextStep,
            },
            '*'
          );
        }
      } catch (_) {}
    }
  }, [myLat, myLng, routeSteps, navCentered]);

  const initRide = async () => {
    // 1. Resolve user ID (store or Supabase session)
    let currentUserId = user?.id;
    let currentUserName = user?.name || 'Rider';
    let currentUserAvatar = user?.avatar_url;

    if (!currentUserId) {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        currentUserId = authData.user.id;
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUserId)
          .single();
        if (prof) {
          currentUserName = prof.name || currentUserName;
          currentUserAvatar = prof.avatar_url;
          useAuthStore.getState().setUser(prof);
        }
      }
    }

    // 2. Fetch ride, members, messages
    const [rideRes, membersRes, msgsRes] = await Promise.all([
      supabase.from('rides').select('*').eq('id', rideId).single(),
      supabase.from('ride_members').select('*, profile:profiles(*)').eq('ride_id', rideId),
      supabase.from('ride_messages').select('*, profile:profiles(*)').eq('ride_id', rideId).order('created_at', { ascending: true }),
    ]);

    if (rideRes.data) {
      const r = rideRes.data as Ride;
      setRide(r);
      setMyLat(r.meeting_lat);
      setMyLng(r.meeting_lng);

      // Fetch full driving route polyline from OSRM
      const stops: RideStop[] = Array.isArray(r.stops) ? r.stops : [];
      setRideStops(stops);
      try {
        const routes = await fetchRoutes(
          r.meeting_lat,
          r.meeting_lng,
          r.destination_lat,
          r.destination_lng,
          stops
        );
        if (routes.length > 0) {
          setRouteCoordinates(routes[0].coordinates);
          setTotalDistanceKm(routes[0].distanceKm);
          setDurationText(routes[0].durationText);
          setRouteSteps(routes[0].steps ?? []);
          setCurrentStepIdx(0);
        }
      } catch (e) {
        console.warn('Error fetching route:', e);
      }
    }

    if (membersRes.data) {
      setRideMembers(membersRes.data);
      const isLeaderMember = membersRes.data.some(
        (m: RideMember) => m.user_id === currentUserId && m.role === 'leader'
      );
      const isCreator = rideRes.data && currentUserId === rideRes.data.creator_id;
      setAmLeader(Boolean(isLeaderMember || isCreator));
    }

    if (msgsRes.data) {
      setMessages(msgsRes.data);
    }

    // 3. Request GPS permissions safely
    try {
      await requestForegroundPermission();
      await requestBackgroundPermission();
    } catch (e) {
      console.warn('GPS permission prompt notice:', e);
    }

    // 4. Get current position
    const loc = await getCurrentLocation();
    if (loc) {
      setMyLat(loc.coords.latitude);
      setMyLng(loc.coords.longitude);
      try {
        mapRef.current?.animateToRegion?.({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      } catch (_) {}
    }

    // 5. Start broadcasting location
    if (currentUserId) {
      await startLocationBroadcast(rideId, currentUserId, membersRes.data?.length ?? 1);

      // 6. Subscribe to realtime channel
      subscribeToRide(rideId, currentUserId, currentUserName, currentUserAvatar, (status) => {
        if (status === 'completed' || status === 'cancelled') {
          router.replace(`/ride/summary?rideId=${rideId}`);
        }
      });
    }

    // 7. Listen for new chat messages safely
    const chatTopic = `realtime:chat:${rideId}`;
    const existingChat = supabase.getChannels().find((c) => c.topic === chatTopic);
    if (existingChat) {
      supabase.removeChannel(existingChat);
    }

    const chatChannel = supabase.channel(`chat:${rideId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'ride_messages', filter: `ride_id=eq.${rideId}`,
      }, async ({ new: row }) => {
        const { data: msgWithProfile } = await supabase
          .from('ride_messages')
          .select('*, profile:profiles(*)')
          .eq('id', row.id)
          .single();
        if (msgWithProfile) addMessage(msgWithProfile as ChatMessage);
      })
      .subscribe();

    chatChannelRef.current = chatChannel;
  };

  const handleSendChat = async () => {
    const text = chatInput.trim();
    if (!text || !rideId) return;
    const authorId = user?.id || (await supabase.auth.getUser()).data?.user?.id;
    if (!authorId) return;

    setChatInput('');
    await supabase.from('ride_messages').insert({
      ride_id: rideId,
      user_id: authorId,
      message: text,
    });
  };

  const handleSOS = () => {
    showAppAlert(
      '🆘 Emergency SOS',
      'This will alert ALL riders of your emergency location.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SOS',
          style: 'destructive',
          onPress: async () => {
            setSosActive(true);
            const authorId = user?.id || (await supabase.auth.getUser()).data?.user?.id;
            if (authorId) {
              await supabase.from('emergency_events').insert({
                ride_id: rideId,
                user_id: authorId,
                latitude: myLat,
                longitude: myLng,
              });
            }
            showAppAlert('SOS Sent', 'All riders have been alerted of your emergency!');
            setTimeout(() => setSosActive(false), 30000);
          },
        },
      ]
    );
  };

  const handleEndRide = () => {
    showAppAlert('End Ride?', 'This will end the active ride for all participants.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Ride',
        style: 'destructive',
        onPress: async () => {
          await supabase
            .from('rides')
            .update({
              status: 'completed',
              ended_at: new Date().toISOString(),
            })
            .eq('id', rideId);

          router.replace(`/ride/summary?rideId=${rideId}`);
        },
      },
    ]);
  };

  // Compute full list of all riders with coordinates & mutual distances
  const displayRiders: DisplayRider[] = rideMembers.map((member) => {
    const isSelf = member.user_id === user?.id;
    const liveMarker = riderMarkers[member.user_id];
    const name = member.profile?.name ?? (isSelf ? (user?.name || 'You') : 'Rider');
    const role = member.role;

    // Live position or fallback to meeting point
    const lat = isSelf ? myLat : (liveMarker?.lat ?? ride?.meeting_lat ?? myLat);
    const lng = isSelf ? myLng : (liveMarker?.lng ?? ride?.meeting_lng ?? myLng);
    const speed = isSelf ? 0 : (liveMarker?.speed ?? 0);
    const heading = isSelf ? 0 : (liveMarker?.heading ?? 0);
    const isLive = Boolean(isSelf || liveMarker);
    const status = isSelf
      ? 'riding'
      : (liveMarker ? (liveMarker.speed < 5 ? 'stopped' : 'riding') : member.status);

    const distFromMe = isSelf ? 0 : calcDistanceM(myLat, myLng, lat, lng);

    return {
      userId: member.user_id,
      name,
      role,
      status,
      lat,
      lng,
      speed,
      heading,
      isLive,
      isSelf,
      distanceFromMe: distFromMe,
      distanceFromLeader: 0,
      relativeToLeader: 'together',
    };
  });

  // Calculate gaps relative to the group leader
  const leaderRider = displayRiders.find((r) => r.role === 'leader') || displayRiders[0];
  if (leaderRider) {
    displayRiders.forEach((r) => {
      r.distanceFromLeader = calcDistanceM(leaderRider.lat, leaderRider.lng, r.lat, r.lng);
      r.relativeToLeader = getRelativePosition(leaderRider.lat, leaderRider.lng, leaderRider.heading, r.lat, r.lng);
    });
  }

  // Calculate distance to destination from current position
  const remainingDistToDest = ride
    ? calcDistanceM(myLat, myLng, ride.destination_lat, ride.destination_lng)
    : 0;

  // Get turn arrow emoji based on OSRM maneuver type + modifier
  function getTurnArrow(type: string = '', modifier: string = ''): string {
    if (type === 'arrive') return '🏁';
    if (type === 'depart') return '🚀';
    if (type === 'roundabout' || type === 'rotary') return '🔄';
    if (modifier === 'left') return '⬅️';
    if (modifier === 'right') return '➡️';
    if (modifier === 'slight left') return '↖️';
    if (modifier === 'slight right') return '↗️';
    if (modifier === 'sharp left') return '↩️';
    if (modifier === 'sharp right') return '↪️';
    if (modifier === 'uturn') return '🔁';
    return '⬆️';
  }

  // Format distance for the nav banner (100 m, 1.2 km, etc.)
  function formatNavDist(metres: number): string {
    if (metres <= 0) return '–';
    if (metres < 1000) return `${Math.round(metres / 10) * 10} m`;
    return `${(metres / 1000).toFixed(1)} km`;
  }

  return (
    <View style={styles.container}>
      {/* 1. FULL INTERACTIVE MAP WITH ROUTE & ALL RIDERS */}
      <RideMap
        ref={mapRef}
        iframeRef={iframeRef}
        myLat={myLat}
        myLng={myLng}
        startLat={ride?.meeting_lat ?? myLat}
        startLng={ride?.meeting_lng ?? myLng}
        startName={ride?.meeting_name ?? 'Meeting Point'}
        destLat={ride?.destination_lat ?? myLat}
        destLng={ride?.destination_lng ?? myLng}
        destName={ride?.destination_name ?? 'Destination'}
        routeCoordinates={routeCoordinates}
        stops={rideStops}
        riders={displayRiders}
      />

      {/* 2. TOP STATUS BAR */}
      <SafeAreaView style={styles.topBar}>
        <View style={styles.topBarContent}>
          <TouchableOpacity
            onPress={() => router.replace(`/ride/lobby?rideId=${rideId}&isLeader=${amLeader}`)}
            style={styles.lobbyBtn}
          >
            <Text style={styles.lobbyBtnText}>📋 Lobby</Text>
          </TouchableOpacity>

          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>

          <View style={styles.headerInfo}>
            <Text style={styles.rideName} numberOfLines={1}>
              {ride?.name ?? 'Active Ride'}
            </Text>
            {ride && (
              <Text style={styles.rideRouteText} numberOfLines={1}>
                🏁 {formatDistance(remainingDistToDest)} to {ride.destination_name}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={styles.hudToggleBtn}
            onPress={() => setHudExpanded(!hudExpanded)}
          >
            <Text style={styles.hudToggleText}>
              🏍 {displayRiders.length} {hudExpanded ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* 2b. TURN-BY-TURN NAV BANNER (Google Maps style) */}
      {routeSteps.length > 0 && currentStepIdx < routeSteps.length && (
        <View style={styles.navBanner}>
          {/* Turn arrow icon */}
          <View style={styles.navArrowBox}>
            <Text style={styles.navArrowIcon}>
              {getTurnArrow(routeSteps[currentStepIdx]?.maneuverType, routeSteps[currentStepIdx]?.maneuverModifier)}
            </Text>
          </View>

          {/* Instruction text */}
          <View style={styles.navTextBox}>
            <Text style={styles.navDistText}>
              {formatNavDist(distToNextStep)}
            </Text>
            <Text style={styles.navInstrText} numberOfLines={2}>
              {routeSteps[currentStepIdx]?.instruction ?? 'Continue on route'}
            </Text>
            {routeSteps[currentStepIdx + 1] && (
              <Text style={styles.navNextText} numberOfLines={1}>
                Then: {routeSteps[currentStepIdx + 1]?.instruction}
              </Text>
            )}
          </View>

          {/* Step counter */}
          <Text style={styles.navStepCounter}>
            {currentStepIdx + 1}/{routeSteps.length}
          </Text>
        </View>
      )}

      {/* RECENTER BUTTON (floating, bottom-right above controls) */}
      <TouchableOpacity
        style={[styles.recenterBtn, navCentered && styles.recenterBtnActive]}
        onPress={() => {
          setNavCentered(true);
          // Immediately recenter on tap
          if (iframeRef.current?.contentWindow) {
            try {
              iframeRef.current.contentWindow.postMessage(
                { type: 'RECENTER', lat: myLat, lng: myLng, zoom: 16 },
                '*'
              );
            } catch (_) {}
          }
        }}
      >
        <Text style={styles.recenterBtnText}>{navCentered ? '📍' : '🎯'}</Text>
      </TouchableOpacity>

      {/* 3. RIDERS & DISTANCES HUD OVERLAY */}
      {hudExpanded && (
        <View style={styles.hudCard}>
          <View style={styles.hudHeader}>
            <Text style={styles.hudTitle}>
              👥 Group Members ({displayRiders.length})
            </Text>
            <Text style={styles.hudSub}>Distances from you & leader</Text>
          </View>

          <ScrollView style={styles.hudScroll} showsVerticalScrollIndicator={false}>
            {displayRiders.map((r) => {
              const isLeader = r.role === 'leader';
              const relText = r.relativeToLeader === 'ahead' ? '▲ Ahead' : r.relativeToLeader === 'behind' ? '▼ Behind' : 'Together';
              const relColor = r.relativeToLeader === 'ahead' ? '#16a34a' : r.relativeToLeader === 'behind' ? '#dc2626' : '#4b5563';

              return (
                <View key={r.userId} style={[styles.riderRow, r.isSelf && styles.riderRowSelf]}>
                  {/* Avatar Icon */}
                  <View style={[styles.riderAvatar, isLeader && styles.avatarLeader, r.isSelf && styles.avatarSelf]}>
                    <Text style={styles.avatarEmoji}>{r.isSelf ? '📍' : isLeader ? '👑' : '🏍'}</Text>
                  </View>

                  {/* Rider Info */}
                  <View style={styles.riderMeta}>
                    <View style={styles.riderNameRow}>
                      <Text style={styles.riderNameText}>
                        {r.name} {r.isSelf ? '(You)' : ''}
                      </Text>
                      {isLeader && <Text style={styles.leaderBadge}>LEADER</Text>}
                    </View>
                    <Text style={styles.riderSpeedText}>
                      {r.status === 'riding' ? `🟢 Riding • ${r.speed} km/h` : '🟡 At Start / Waiting'}
                    </Text>
                  </View>

                  {/* Distance Metrics */}
                  <View style={styles.riderMetrics}>
                    <Text style={styles.distFromMeText}>
                      {r.isSelf ? 'Here' : `📏 ${formatDistance(r.distanceFromMe)}`}
                    </Text>
                    {!r.isSelf && !isLeader && (
                      <Text style={[styles.leaderGapText, { color: relColor }]}>
                        {relText} ({formatDistance(r.distanceFromLeader)})
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* 4. BOTTOM ACTION CONTROLS */}
      {!showChat && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.sosBtn, sosActive && styles.sosBtnActive]}
            onPress={handleSOS}
          >
            <Text style={styles.sosBtnText}>🆘 SOS</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.chatBtn} onPress={() => setShowChat(true)}>
            <Text style={styles.chatBtnText}>💬 Chat</Text>
            {messages.length > 0 && (
              <View style={styles.chatBadge}>
                <Text style={styles.chatBadgeText}>{messages.length}</Text>
              </View>
            )}
          </TouchableOpacity>

          {amLeader && (
            <TouchableOpacity style={styles.endBtn} onPress={handleEndRide}>
              <Text style={styles.endBtnText}>🏁 End Ride</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* 5. GROUP CHAT PANEL */}
      {showChat && (
        <KeyboardAvoidingView
          style={styles.chatPanel}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.chatHeader}>
            <Text style={styles.chatTitle}>💬 Ride Group Chat</Text>
            <TouchableOpacity onPress={() => setShowChat(false)}>
              <Text style={styles.chatClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: 12 }}
            renderItem={({ item }) => {
              const isMe = item.user_id === user?.id;
              return (
                <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
                  <View style={[styles.msgBubble, isMe && styles.msgBubbleMe]}>
                    {!isMe && (
                      <Text style={styles.msgSender}>{(item.profile as any)?.name ?? 'Rider'}</Text>
                    )}
                    <Text style={[styles.msgText, isMe && styles.msgTextMe]}>
                      {item.message}
                    </Text>
                  </View>
                </View>
              );
            }}
          />

          <View style={styles.chatInputRow}>
            <TextInput
              style={styles.chatInput}
              placeholder="Type message to all riders..."
              placeholderTextColor="#999"
              value={chatInput}
              onChangeText={setChatInput}
              multiline
              maxLength={500}
            />
            <TouchableOpacity style={styles.sendBtn} onPress={handleSendChat}>
              <Text style={styles.sendBtnText}>Send</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  // Top Bar
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    backgroundColor: 'rgba(17, 24, 39, 0.88)',
    zIndex: 100,
  },
  topBarContent: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14,
    paddingVertical: 10, gap: 10,
  },
  lobbyBtn: {
    backgroundColor: '#374151',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  lobbyBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#ef4444',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, gap: 4,
  },
  liveDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff',
  },
  liveText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  headerInfo: { flex: 1 },
  rideName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  rideRouteText: { color: '#9ca3af', fontSize: 11, fontWeight: '600', marginTop: 1 },
  hudToggleBtn: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  hudToggleText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  // HUD Card Overlay
  hudCard: {
    position: 'absolute',
    top: 75,
    right: 14,
    width: Math.min(Dimensions.get('window').width - 28, 320),
    maxHeight: height * 0.45,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 16,
    padding: 12,
    zIndex: 90,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  hudHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingBottom: 8,
    marginBottom: 8,
  },
  hudTitle: { fontSize: 14, fontWeight: '800', color: '#111827' },
  hudSub: { fontSize: 11, color: '#6b7280', marginTop: 1 },
  hudScroll: { maxHeight: height * 0.35 },
  riderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  riderRowSelf: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    paddingHorizontal: 6,
  },
  riderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarLeader: { backgroundColor: '#ffedd5' },
  avatarSelf: { backgroundColor: '#dbeafe' },
  avatarEmoji: { fontSize: 16 },
  riderMeta: { flex: 1 },
  riderNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  riderNameText: { fontSize: 13, fontWeight: '700', color: '#1f2937' },
  leaderBadge: {
    backgroundColor: '#fef3c7',
    color: '#d97706',
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  riderSpeedText: { fontSize: 11, color: '#4b5563', marginTop: 1 },
  riderMetrics: { alignItems: 'flex-end' },
  distFromMeText: { fontSize: 12, fontWeight: '800', color: '#111827' },
  leaderGapText: { fontSize: 10, fontWeight: '700', marginTop: 1 },

  // Bottom Controls
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', padding: 14, paddingBottom: 26,
    backgroundColor: 'rgba(255,255,255,0.95)', gap: 10,
    zIndex: 100,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  sosBtn: {
    flex: 1, backgroundColor: '#ef4444', borderRadius: 12,
    padding: 13, alignItems: 'center',
  },
  sosBtnActive: { backgroundColor: '#7f1d1d' },
  sosBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  chatBtn: {
    flex: 1.5, backgroundColor: '#1a1a1a', borderRadius: 12,
    padding: 13, alignItems: 'center',
    position: 'relative',
  },
  chatBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  chatBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: '#FF6B35', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  chatBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  endBtn: {
    flex: 1.2, backgroundColor: '#374151', borderRadius: 12,
    padding: 13, alignItems: 'center',
  },
  endBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Chat Panel
  chatPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: height * 0.6, backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 20,
    zIndex: 200,
  },
  chatHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  chatTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
  chatClose: { fontSize: 20, color: '#999', padding: 4 },
  msgRow: { marginBottom: 10 },
  msgRowMe: { alignItems: 'flex-end' },
  msgBubble: {
    maxWidth: '75%', backgroundColor: '#f3f4f6',
    borderRadius: 14, borderBottomLeftRadius: 4, padding: 10,
  },
  msgBubbleMe: { backgroundColor: '#FF6B35', borderBottomLeftRadius: 14, borderBottomRightRadius: 4 },
  msgSender: { fontSize: 11, fontWeight: '700', color: '#888', marginBottom: 3 },
  msgText: { fontSize: 14, color: '#1a1a1a' },
  msgTextMe: { color: '#fff' },
  chatInputRow: {
    flexDirection: 'row', padding: 12, gap: 8,
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },
  chatInput: {
    flex: 1, borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 12,
    padding: 10, fontSize: 14, maxHeight: 80,
  },
  sendBtn: {
    backgroundColor: '#FF6B35', borderRadius: 12,
    paddingHorizontal: 18, justifyContent: 'center',
  },
  sendBtnText: { color: '#fff', fontWeight: '700' },

  // Turn-by-turn Nav Banner (Google Maps style)
  navBanner: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1f36',
    paddingHorizontal: 14,
    paddingVertical: 10,
    zIndex: 110,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 12,
    gap: 12,
  },
  navArrowBox: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  navArrowIcon: {
    fontSize: 26,
  },
  navTextBox: {
    flex: 1,
  },
  navDistText: {
    color: '#60a5fa',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  navInstrText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  navNextText: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  navStepCounter: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 0,
  },

  // Floating Recenter Button
  recenterBtn: {
    position: 'absolute',
    bottom: 90,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  recenterBtnActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  recenterBtnText: {
    fontSize: 22,
  },
});
