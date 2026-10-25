import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../src/services/supabase';
import { useAuthStore } from '../../src/store/authStore';
import { useRideStore } from '../../src/store/rideStore';
import { RidePreview } from '../../src/types';
import { showAppAlert } from '../../src/utils/alert';

export default function JoinRideScreen() {
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<RidePreview | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [joining, setJoining] = useState(false);
  const { user, fetchProfile } = useAuthStore();
  const { joinRide } = useRideStore();

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Join Ride</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>Enter Ride Code</Text>
        <Text style={styles.hint}>Ask your ride leader for the 6-character code</Text>

        <TextInput
          style={styles.codeInput}
          placeholder="AB1234"
          placeholderTextColor="#ccc"
          value={code}
          onChangeText={(t) => {
            setCode(t.toUpperCase());
            setPreview(null);
          }}
          maxLength={6}
          autoCapitalize="characters"
          autoCorrect={false}
        />

        <TouchableOpacity
          style={[styles.lookupBtn, lookingUp && styles.btnDisabled]}
          onPress={handleLookup}
          disabled={lookingUp || code.length < 6}
        >
          {lookingUp
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.lookupBtnText}>Find Ride</Text>
          }
        </TouchableOpacity>

        {/* Ride Preview */}
        {preview && (
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>{preview.ride_name}</Text>
            <View style={styles.previewRow}>
              <Text style={styles.previewIcon}>📍</Text>
              <Text style={styles.previewText}>{preview.meeting_name}</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewIcon}>🏁</Text>
              <Text style={styles.previewText}>{preview.destination_name}</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewIcon}>👥</Text>
              <Text style={styles.previewText}>{preview.member_count} rider{preview.member_count !== 1 ? 's' : ''}</Text>
            </View>

            <TouchableOpacity
              style={[styles.joinBtn, joining && styles.btnDisabled]}
              onPress={handleJoin}
              disabled={joining}
            >
              {joining
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.joinBtnText}>Join This Ride →</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', padding: 16, paddingTop: 12,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 16, color: '#FF6B35', fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  content: { padding: 24, flex: 1 },
  label: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  hint: { fontSize: 14, color: '#888', marginBottom: 24 },
  codeInput: {
    borderWidth: 2, borderColor: '#FF6B35', borderRadius: 16,
    padding: 18, fontSize: 32, fontWeight: '800', color: '#1a1a1a',
    textAlign: 'center', letterSpacing: 6, backgroundColor: '#fff',
    marginBottom: 16,
  },
  lookupBtn: {
    backgroundColor: '#1a1a1a', borderRadius: 14,
    padding: 16, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  lookupBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  previewCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20,
    marginTop: 24, shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08,
    shadowRadius: 8, elevation: 3,
  },
  previewTitle: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginBottom: 16 },
  previewRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  previewIcon: { fontSize: 18, width: 28 },
  previewText: { fontSize: 15, color: '#444' },
  joinBtn: {
    backgroundColor: '#FF6B35', borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 20,
  },
  joinBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
