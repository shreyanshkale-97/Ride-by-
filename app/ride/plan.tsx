import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { useRideStore } from '../../src/store/rideStore';
import { LocationPickerModal } from '../../src/components/map/LocationPickerModal';
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
  green:       '#10B981',
  blue:        '#2563EB',
  textPrimary: '#F9FAFB',
  textSecondary:'#9CA3AF',
  textMuted:   '#4B5563',
};

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function StepBar({ current }: { current: 1 | 2 | 3 }) {
  const steps = ['Plan', 'Route', 'Settings'];
  return (
    <View style={pb.wrap}>
      {steps.map((label, i) => {
        const idx = i + 1;
        const active  = idx === current;
        const done    = idx < current;
        return (
          <View key={label} style={pb.stepWrap}>
            <View style={[pb.dot, active && pb.dotActive, done && pb.dotDone]}>
              <Text style={[pb.dotText, (active || done) && pb.dotTextActive]}>
                {done ? '✓' : idx}
              </Text>
            </View>
            <Text style={[pb.label, active && pb.labelActive]}>{label}</Text>
            {i < 2 && <View style={[pb.line, done && pb.lineDone]} />}
          </View>
        );
      })}
    </View>
  );
}

const pb = StyleSheet.create({
  wrap:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 24 },
  stepWrap:     { alignItems: 'center', flexDirection: 'row', gap: 6 },
  dot:          { width: 28, height: 28, borderRadius: 14, backgroundColor: C.surface3, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  dotActive:    { backgroundColor: C.primary, borderColor: C.primary },
  dotDone:      { backgroundColor: C.green,   borderColor: C.green   },
  dotText:      { fontSize: 12, fontWeight: '700', color: C.textMuted },
  dotTextActive:{ color: '#fff' },
  label:        { fontSize: 12, fontWeight: '600', color: C.textMuted, letterSpacing: 0.3 },
  labelActive:  { color: C.primary },
  line:         { width: 28, height: 2, backgroundColor: C.surface3, marginHorizontal: 4 },
  lineDone:     { backgroundColor: C.green },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function PlanRideScreen() {
  const { user } = useAuthStore();
  const { createRide } = useRideStore();

  const [rideName, setRideName]       = useState('');
  const [meetingName, setMeetingName] = useState('');
  const [meetingLat, setMeetingLat]   = useState('22.7196');
  const [meetingLng, setMeetingLng]   = useState('75.8577');
  const [destName, setDestName]       = useState('');
  const [destLat, setDestLat]         = useState('');
  const [destLng, setDestLng]         = useState('');
  const [loading, setLoading]         = useState(false);

  const [nameActive, setNameActive]       = useState(false);
  const [meetActive, setMeetActive]       = useState(false);
  const [meetLatActive, setMeetLatActive] = useState(false);
  const [meetLngActive, setMeetLngActive] = useState(false);
  const [destActive, setDestActive]       = useState(false);
  const [destLatActive, setDestLatActive] = useState(false);
  const [destLngActive, setDestLngActive] = useState(false);

  // Map Picker State
  const [pickerVisible, setPickerVisible]   = useState(false);
  const [pickerTarget, setPickerTarget]     = useState<'meeting' | 'destination'>('meeting');

  const handleOpenPicker = (target: 'meeting' | 'destination') => {
    setPickerTarget(target);
    setPickerVisible(true);
  };

  const handleLocationPicked = (loc: { name: string; lat: number; lng: number }) => {
    if (pickerTarget === 'meeting') {
      setMeetingName(loc.name);
      setMeetingLat(loc.lat.toFixed(5));
      setMeetingLng(loc.lng.toFixed(5));
    } else {
      setDestName(loc.name);
      setDestLat(loc.lat.toFixed(5));
      setDestLng(loc.lng.toFixed(5));
    }
  };

  const handleNextReviewRoute = () => {
    if (!rideName.trim()) {
      showAppAlert('Missing Ride Name', 'Please enter a name for your ride.');
      return;
    }
    if (!meetingName.trim() || !meetingLat || !meetingLng) {
      showAppAlert('Missing Meeting Point', 'Please select or enter the start/meeting point.');
      return;
    }
    if (!destName.trim() || !destLat || !destLng) {
      showAppAlert('Missing Destination', 'Please select or enter the ride destination.');
      return;
    }

    router.push({
      pathname: '/ride/route-preview',
      params: {
        name: rideName.trim(),
        meetingName: meetingName.trim(),
        meetingLat,
        meetingLng,
        destName: destName.trim(),
        destLat,
        destLng,
      },
    });
  };

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Create Ride</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Progress */}
      <View style={s.progressWrap}>
        <StepBar current={1} />
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <Text style={s.heroTitle}>Plan Your Ride</Text>
        <Text style={s.heroSub}>Set the stage — name it, map it, ride it.</Text>

        {/* Ride Name */}
        <Text style={s.fieldLabel}>RIDE NAME</Text>
        <TextInput
          style={[s.input, nameActive && s.inputFocused]}
          placeholder="e.g. Indore to Bhopal Ride 🏍"
          placeholderTextColor={C.textMuted}
          value={rideName}
          onChangeText={setRideName}
          maxLength={100}
          onFocus={() => setNameActive(true)}
          onBlur={() => setNameActive(false)}
        />

        {/* ── Meeting Point ── */}
        <View style={s.locationCard}>
          <View style={[s.locationAccent, { backgroundColor: C.green }]} />
          <View style={s.locationBody}>
            <View style={s.locationTopRow}>
              <View style={s.locationMeta}>
                <Text style={s.locationEmoji}>📍</Text>
                <View>
                  <Text style={s.locationKind}>MEETING POINT</Text>
                  <Text style={[s.locationName, !meetingName && s.locationPlaceholder]} numberOfLines={1}>
                    {meetingName || 'Tap to set location'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={s.mapPickBtn} onPress={() => handleOpenPicker('meeting')}>
                <Text style={s.mapPickBtnText}>🗺 Pick</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.locationHint}>Where riders gather before the start</Text>
            <TextInput
              style={[s.subInput, meetActive && s.subInputFocused]}
              placeholder="Location name (or pick on map)"
              placeholderTextColor={C.textMuted}
              value={meetingName}
              onChangeText={setMeetingName}
              onFocus={() => setMeetActive(true)}
              onBlur={() => setMeetActive(false)}
            />
            <View style={s.coordRow}>
              <TextInput
                style={[s.coordInput, meetLatActive && s.subInputFocused]}
                placeholder="Latitude"
                placeholderTextColor={C.textMuted}
                value={meetingLat}
                onChangeText={setMeetingLat}
                keyboardType="numeric"
                onFocus={() => setMeetLatActive(true)}
                onBlur={() => setMeetLatActive(false)}
              />
              <TextInput
                style={[s.coordInput, meetLngActive && s.subInputFocused]}
                placeholder="Longitude"
                placeholderTextColor={C.textMuted}
                value={meetingLng}
                onChangeText={setMeetingLng}
                keyboardType="numeric"
                onFocus={() => setMeetLngActive(true)}
                onBlur={() => setMeetLngActive(false)}
              />
            </View>
          </View>
        </View>

        {/* ── Destination ── */}
        <View style={s.locationCard}>
          <View style={[s.locationAccent, { backgroundColor: C.primary }]} />
          <View style={s.locationBody}>
            <View style={s.locationTopRow}>
              <View style={s.locationMeta}>
                <Text style={s.locationEmoji}>🏁</Text>
                <View>
                  <Text style={s.locationKind}>DESTINATION</Text>
                  <Text style={[s.locationName, !destName && s.locationPlaceholder]} numberOfLines={1}>
                    {destName || 'Tap to set location'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={[s.mapPickBtn, s.mapPickBtnOrange]} onPress={() => handleOpenPicker('destination')}>
                <Text style={s.mapPickBtnText}>🗺 Pick</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.locationHint}>Where the group ride finishes</Text>
            <TextInput
              style={[s.subInput, destActive && s.subInputFocused]}
              placeholder="Destination name (or pick on map)"
              placeholderTextColor={C.textMuted}
              value={destName}
              onChangeText={setDestName}
              onFocus={() => setDestActive(true)}
              onBlur={() => setDestActive(false)}
            />
            <View style={s.coordRow}>
              <TextInput
                style={[s.coordInput, destLatActive && s.subInputFocused]}
                placeholder="Latitude"
                placeholderTextColor={C.textMuted}
                value={destLat}
                onChangeText={setDestLat}
                keyboardType="numeric"
                onFocus={() => setDestLatActive(true)}
                onBlur={() => setDestLatActive(false)}
              />
              <TextInput
                style={[s.coordInput, destLngActive && s.subInputFocused]}
                placeholder="Longitude"
                placeholderTextColor={C.textMuted}
                value={destLng}
                onChangeText={setDestLng}
                keyboardType="numeric"
                onFocus={() => setDestLngActive(true)}
                onBlur={() => setDestLngActive(false)}
              />
            </View>
          </View>
        </View>

        {/* Tip */}
        <View style={s.tip}>
          <Text style={s.tipIcon}>💡</Text>
          <Text style={s.tipText}>
            Tap <Text style={s.tipBold}>"🗺 Pick"</Text> to search any landmark or drop a pin directly on the interactive map!
          </Text>
        </View>

        {/* CTA */}
        <TouchableOpacity style={s.ctaBtn} onPress={handleNextReviewRoute} activeOpacity={0.85}>
          <Text style={s.ctaBtnText}>Continue  →</Text>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Interactive Map Picker Modal */}
      <LocationPickerModal
        visible={pickerVisible}
        title={pickerTarget === 'meeting' ? 'Select Meeting Point 📍' : 'Select Destination 🏁'}
        initialLat={
          pickerTarget === 'meeting'
            ? parseFloat(meetingLat) || 22.7196
            : parseFloat(destLat) || 23.2599
        }
        initialLng={
          pickerTarget === 'meeting'
            ? parseFloat(meetingLng) || 75.8577
            : parseFloat(destLng) || 77.4126
        }
        initialName={pickerTarget === 'meeting' ? meetingName : destName}
        onSelect={handleLocationPicked}
        onClose={() => setPickerVisible(false)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn:     { minWidth: 60, minHeight: 44, justifyContent: 'center' },
  backText:    { fontSize: 16, color: C.primary, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.textPrimary },

  progressWrap: { borderBottomWidth: 1, borderBottomColor: C.border },

  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },

  heroTitle: { fontSize: 28, fontWeight: '800', color: C.textPrimary, letterSpacing: -0.5, marginBottom: 6 },
  heroSub:   { fontSize: 14, color: C.textSecondary, marginBottom: 28 },

  fieldLabel: {
    fontSize: 11, fontWeight: '700', color: C.textMuted,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8,
  },

  input: {
    backgroundColor: C.surface3, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, height: 54, paddingHorizontal: 16,
    fontSize: 15, color: C.textPrimary, marginBottom: 24,
  },
  inputFocused: { borderColor: C.primary, borderWidth: 1.5 },

  // Location Cards
  locationCard: {
    flexDirection: 'row', backgroundColor: C.surface2, borderRadius: 16,
    borderWidth: 1, borderColor: C.border, marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  locationAccent: { width: 4 },
  locationBody:   { flex: 1, padding: 16 },
  locationTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  locationMeta:   { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  locationEmoji:  { fontSize: 22 },
  locationKind:   { fontSize: 10, fontWeight: '700', color: C.textMuted, letterSpacing: 1, textTransform: 'uppercase' },
  locationName:   { fontSize: 14, fontWeight: '700', color: C.textPrimary, marginTop: 2 },
  locationPlaceholder: { color: C.textMuted },
  locationHint:   { fontSize: 12, color: C.textMuted, marginBottom: 10 },

  mapPickBtn: {
    backgroundColor: 'rgba(16,185,129,0.12)', borderWidth: 1, borderColor: C.green,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, minHeight: 36, justifyContent: 'center',
  },
  mapPickBtnOrange: {
    backgroundColor: 'rgba(255,107,53,0.12)', borderColor: C.primary,
  },
  mapPickBtnText: { fontSize: 12, fontWeight: '700', color: C.textPrimary },

  subInput: {
    backgroundColor: C.surface3, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, height: 44, paddingHorizontal: 12,
    fontSize: 14, color: C.textPrimary, marginBottom: 8,
  },
  subInputFocused: { borderColor: C.primary },

  coordRow:  { flexDirection: 'row', gap: 8 },
  coordInput: {
    flex: 1, backgroundColor: C.surface3, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, height: 40, paddingHorizontal: 12,
    fontSize: 13, color: C.textPrimary,
  },

  tip: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: C.surface2, borderRadius: 12, padding: 14,
    marginVertical: 20, borderLeftWidth: 3, borderLeftColor: C.primary,
    gap: 10,
  },
  tipIcon: { fontSize: 16, marginTop: 1 },
  tipText: { flex: 1, fontSize: 13, color: C.textSecondary, lineHeight: 20 },
  tipBold: { fontWeight: '700', color: C.textPrimary },

  ctaBtn: {
    backgroundColor: C.primary, borderRadius: 14,
    height: 54, alignItems: 'center', justifyContent: 'center',
    shadowColor: C.primary, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  ctaBtnText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
});
