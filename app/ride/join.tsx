import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../src/services/supabase';
import { useAuthStore } from '../../src/store/authStore';
import { useRideStore } from '../../src/store/rideStore';
import { RidePreview } from '../../src/types';
import { showAppAlert } from '../../src/utils/alert';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  bg:           '#0A0E1A',
  surface:      '#12172B',
  surface2:     '#1A2035',
  surface3:     '#232B45',
  border:       'rgba(255,255,255,0.08)',
  primary:      '#FF6B35',
  primaryLight: '#FF8C5A',
  green:        '#10B981',
  textPrimary:  '#F9FAFB',
  textSecondary:'#9CA3AF',
  textMuted:    '#4B5563',
};

export default function JoinRideScreen() {
  const [code, setCode]         = useState('');
  const [preview, setPreview]   = useState<RidePreview | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [joining, setJoining]   = useState(false);
  const [codeActive, setCodeActive] = useState(false);
  const { user, fetchProfile }  = useAuthStore();
  const { joinRide }            = useRideStore();

  const handleLookup = async () => {
    if (code.length < 6) {
      showAppAlert('Invalid Code', 'Ride codes are 6 characters long.');
      return;
    }
    setLookingUp(true);
    setPreview(null);

    const { data, error } = await supabase.rpc('get_ride_by_code', {
      p_code: code.toUpperCase().trim(),
    });

    setLookingUp(false);
    if (error || !data || data.length === 0) {
      // Fallback: check rides directly
      const { data: rideDirect } = await supabase
        .from('rides')
        .select('*')
        .eq('join_code', code.toUpperCase().trim())
        .maybeSingle();

      if (rideDirect) {
        setPreview({
          ride_id: rideDirect.id,
          ride_name: rideDirect.name,
          meeting_name: rideDirect.meeting_name,
          destination_name: rideDirect.destination_name,
          meeting_time: rideDirect.meeting_time,
          status: rideDirect.status,
          member_count: 1,
        });
        return;
      }

      showAppAlert('Not Found', 'No active ride found with that code.');
      return;
    }
    setPreview(data[0] as RidePreview);
  };

  const handleJoin = async () => {
    if (!preview) return;

    let riderId = user?.id;
    if (!riderId) {
      const { data: authData } = await supabase.auth.getUser();
      riderId = authData?.user?.id;
      if (riderId) fetchProfile(riderId);
    }

    if (!riderId) {
      showAppAlert('Login Required', 'Please log in to join this ride.');
      router.replace('/(auth)/login');
      return;
    }

    setJoining(true);
    const error = await joinRide(riderId, preview.ride_id, code);
    setJoining(false);

    if (error) {
      if (error.includes('unique') || error.includes('duplicate')) {
        // Already a member — navigate to lobby
        router.replace(`/ride/lobby?rideId=${preview.ride_id}`);
      } else {
        showAppAlert('Error', error);
      }
      return;
    }

    router.replace(`/ride/lobby?rideId=${preview.ride_id}`);
  };

  const codeReady = code.length === 6;

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Join Ride</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <Text style={s.heroTitle}>Join a Ride</Text>
        <Text style={s.heroSub}>Enter the 6-character code from your ride leader to hop in.</Text>

        {/* Big Code Input */}
        <View style={s.codeWrap}>
          <TextInput
            style={[s.codeInput, codeActive && s.codeInputFocused]}
            placeholder="AB1234"
            placeholderTextColor={C.textMuted}
            value={code}
            onChangeText={(t) => {
              setCode(t.toUpperCase());
              setPreview(null);
            }}
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect={false}
            onFocus={() => setCodeActive(true)}
            onBlur={() => setCodeActive(false)}
          />
          {/* Character progress dots */}
          <View style={s.codeDotsRow}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View
                key={i}
                style={[s.codeDot, i < code.length && s.codeDotFilled]}
              />
            ))}
          </View>
        </View>

        {/* Find Ride Button */}
        <TouchableOpacity
          style={[s.findBtn, (!codeReady || lookingUp) && s.btnDisabled]}
          onPress={handleLookup}
          disabled={lookingUp || !codeReady}
          activeOpacity={0.85}
        >
          {lookingUp
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.findBtnText}>Find Ride 🔍</Text>
          }
        </TouchableOpacity>

        {/* Divider */}
        <View style={s.dividerRow}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>Ride Preview</Text>
          <View style={s.dividerLine} />
        </View>

        {/* Ride Preview Card */}
        {preview ? (
          <View style={s.previewCard}>
            {/* Status pill */}
            <View style={s.statusPill}>
              <View style={s.statusDot} />
              <Text style={s.statusText}>{preview.status?.toUpperCase() ?? 'ACTIVE'}</Text>
            </View>

            <Text style={s.previewTitle}>{preview.ride_name}</Text>

            <View style={s.previewRow}>
              <View style={s.previewIconWrap}>
                <Text style={s.previewEmoji}>📍</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.previewRowLabel}>MEETING POINT</Text>
                <Text style={s.previewRowValue}>{preview.meeting_name}</Text>
              </View>
            </View>

            <View style={s.previewDivider} />

            <View style={s.previewRow}>
              <View style={s.previewIconWrap}>
                <Text style={s.previewEmoji}>🏁</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.previewRowLabel}>DESTINATION</Text>
                <Text style={s.previewRowValue}>{preview.destination_name}</Text>
              </View>
            </View>

            <View style={s.previewDivider} />

            <View style={s.previewRow}>
              <View style={s.previewIconWrap}>
                <Text style={s.previewEmoji}>👥</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.previewRowLabel}>RIDERS</Text>
                <Text style={s.previewRowValue}>
                  {preview.member_count} rider{preview.member_count !== 1 ? 's' : ''} joined
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[s.joinBtn, joining && s.btnDisabled]}
              onPress={handleJoin}
              disabled={joining}
              activeOpacity={0.85}
            >
              {joining
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.joinBtnText}>🏍  Join This Ride →</Text>
              }
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.emptyPreview}>
            <Text style={s.emptyPreviewEmoji}>🏍</Text>
            <Text style={s.emptyPreviewText}>Enter the ride code above{'\n'}to see ride details</Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn:     { minWidth: 60, minHeight: 44, justifyContent: 'center' },
  backText:    { fontSize: 16, color: C.primary, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.textPrimary },

  content: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 40 },

  heroTitle: { fontSize: 30, fontWeight: '800', color: C.textPrimary, letterSpacing: -0.5, marginBottom: 8 },
  heroSub:   { fontSize: 14, color: C.textSecondary, lineHeight: 22, marginBottom: 32 },

  // Code Input
  codeWrap: { alignItems: 'center', marginBottom: 20 },
  codeInput: {
    width: '100%',
    backgroundColor: C.surface3,
    borderWidth: 2, borderColor: C.border,
    borderRadius: 20, height: 90,
    textAlign: 'center',
    fontSize: 40, fontWeight: '800',
    color: C.primary,
    letterSpacing: 10,
    fontVariant: ['tabular-nums'],
  },
  codeInputFocused: { borderColor: C.primary, borderWidth: 2.5 },
  codeDotsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  codeDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: C.surface3, borderWidth: 1, borderColor: C.border },
  codeDotFilled: { backgroundColor: C.primary, borderColor: C.primary },

  findBtn: {
    backgroundColor: C.primary, borderRadius: 14,
    height: 54, alignItems: 'center', justifyContent: 'center',
    marginBottom: 28,
    shadowColor: C.primary, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  btnDisabled:  { opacity: 0.45 },
  findBtnText:  { color: '#fff', fontSize: 17, fontWeight: '800' },

  dividerRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerText: { fontSize: 12, fontWeight: '600', color: C.textMuted, letterSpacing: 0.5 },

  // Preview Card
  previewCard: {
    backgroundColor: C.surface2, borderRadius: 20,
    borderWidth: 1, borderColor: C.border,
    padding: 20,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 20, elevation: 12,
  },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16,185,129,0.12)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4, marginBottom: 12,
  },
  statusDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  statusText: { fontSize: 11, fontWeight: '700', color: C.green, letterSpacing: 0.8 },

  previewTitle: { fontSize: 22, fontWeight: '800', color: C.textPrimary, marginBottom: 18, letterSpacing: -0.3 },

  previewRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  previewIconWrap:{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.surface3, alignItems: 'center', justifyContent: 'center' },
  previewEmoji:   { fontSize: 18 },
  previewRowLabel:{ fontSize: 10, fontWeight: '700', color: C.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' },
  previewRowValue:{ fontSize: 14, fontWeight: '600', color: C.textPrimary, marginTop: 2 },
  previewDivider: { height: 1, backgroundColor: C.border },

  joinBtn: {
    backgroundColor: C.primary, borderRadius: 14,
    height: 54, alignItems: 'center', justifyContent: 'center',
    marginTop: 20,
    shadowColor: C.primary, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  joinBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },

  // Empty State
  emptyPreview: {
    backgroundColor: C.surface2, borderRadius: 20,
    borderWidth: 1, borderColor: C.border,
    padding: 40, alignItems: 'center',
  },
  emptyPreviewEmoji: { fontSize: 40, marginBottom: 12 },
  emptyPreviewText:  { fontSize: 15, color: C.textMuted, textAlign: 'center', lineHeight: 24 },
});
