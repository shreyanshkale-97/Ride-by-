import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { useRideStore } from '../../src/store/rideStore';
import { supabase } from '../../src/services/supabase';
import { generateRideCode } from '../../src/utils/location';
import { RideStop } from '../../src/services/routingService';
import { showAppAlert } from '../../src/utils/alert';

export default function RideSettingsScreen() {
  const params = useLocalSearchParams<{
    name: string;
    meetingName: string;
    meetingLat: string;
    meetingLng: string;
    destName: string;
    destLat: string;
    destLng: string;
    distanceKm: string;
    durationText: string;
    stopsJson: string;
  }>();

  const { user } = useAuthStore();
  const { createRide } = useRideStore();

  // Generated Ride Code with regeneration option
  const [rideCode, setRideCode] = useState(generateRideCode());

  // Max members
  const [maxMembers, setMaxMembers] = useState(20);

  // Description
  const [description, setDescription] = useState(
    'Group motorcycle ride. Full riding gear (helmet, jacket, shoes) mandatory. We ride together, stay together!'
  );

  // Dates & Times
  const defaultStartDate = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [startTime, setStartTime] = useState('06:00 AM');
  const [endDate, setEndDate] = useState(defaultStartDate);
  const [endTime, setEndTime] = useState('06:00 PM');
  const [joinDeadlineDate, setJoinDeadlineDate] = useState(defaultStartDate);
  const [joinDeadlineTime, setJoinDeadlineTime] = useState('04:00 AM');

  // Optional Estimated Cost
  const [estimatedCost, setEstimatedCost] = useState('₹1,500 / rider (Fuel + Food)');

  const [creating, setCreating] = useState(false);

  // Parse stops
  let stops: RideStop[] = [];
  try {
    stops = params.stopsJson ? JSON.parse(params.stopsJson) : [];
  } catch (_) {}

  const handleRegenerateCode = () => {
    setRideCode(generateRideCode());
  };

  const handleCreateRide = async () => {
    setCreating(true);

    let creatorId = user?.id;
    if (!creatorId) {
      const { data: authData } = await supabase.auth.getUser();
      creatorId = authData?.user?.id;
    }

    if (!creatorId) {
      setCreating(false);
      showAppAlert('Login Required', 'Please log in to create and host a ride.');
      router.replace('/(auth)/login');
      return;
    }

    const result = await createRide({
      creatorId,
      name: params.name || 'Group Ride 🏍',
      meetingName: params.meetingName,
      meetingLat: parseFloat(params.meetingLat) || 0,
      meetingLng: parseFloat(params.meetingLng) || 0,
      destinationName: params.destName,
      destinationLat: parseFloat(params.destLat) || 0,
      destinationLng: parseFloat(params.destLng) || 0,
      customCode: rideCode,
      description: description.trim(),
      maxMembers,
      startTime: `${startDate} ${startTime}`,
      endTime: `${endDate} ${endTime}`,
      joinDeadline: `${joinDeadlineDate} ${joinDeadlineTime}`,
      estimatedCost: estimatedCost.trim(),
      stops,
      totalDistance: parseFloat(params.distanceKm) || 0,
      totalDuration: params.durationText || '',
    });

    setCreating(false);

    if (!result) {
      showAppAlert('Error', 'Failed to create ride. Please check connection and try again.');
      return;
    }

    router.replace(`/ride/lobby?rideId=${result.rideId}&code=${result.code}&isLeader=true`);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Ride Settings & Rules</Text>
          <Text style={styles.headerSub}>Step 3 of 3</Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Route Summary Pill */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{params.name}</Text>
          <Text style={styles.summaryRoute}>
            📍 {params.meetingName} → 🏁 {params.destName}
          </Text>
          <View style={styles.summaryMetricsRow}>
            <Text style={styles.metricBadge}>🛣 {params.distanceKm} km</Text>
            <Text style={styles.metricBadge}>⏱ {params.durationText}</Text>
            {stops.length > 0 && (
              <Text style={styles.metricBadge}>🛑 {stops.length} Stops</Text>
            )}
          </View>
        </View>

        {/* 1. RIDE CODE SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>🔑 Generated Ride Code</Text>
          <Text style={styles.sectionHint}>
            Friends will enter this 6-character code to join your ride
          </Text>
          <View style={styles.codeContainer}>
            <Text style={styles.codeDisplay}>{rideCode}</Text>
            <TouchableOpacity onPress={handleRegenerateCode} style={styles.regenBtn}>
              <Text style={styles.regenBtnText}>🔄 Change</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. MAX MEMBERS */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>👥 Maximum Members Allowed</Text>
          <Text style={styles.sectionHint}>Limit group size for coordination & safety</Text>
          <View style={styles.memberPillsRow}>
            {[5, 10, 15, 20].map((num) => (
              <TouchableOpacity
                key={num}
                style={[styles.memberPill, maxMembers === num && styles.memberPillActive]}
                onPress={() => setMaxMembers(num)}
              >
                <Text style={[styles.memberPillText, maxMembers === num && styles.memberPillTextActive]}>
                  {num} Riders
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 3. DATES & TIMINGS */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>📅 Ride Schedule & Deadlines</Text>

          {/* Start Date & Time */}
          <Text style={styles.subLabel}>🚀 Ride Starts:</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="YYYY-MM-DD"
              value={startDate}
              onChangeText={setStartDate}
            />
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="06:00 AM"
              value={startTime}
              onChangeText={setStartTime}
            />
          </View>

          {/* End Date & Time */}
          <Text style={styles.subLabel}>🏁 Expected Finish:</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="YYYY-MM-DD"
              value={endDate}
              onChangeText={setEndDate}
            />
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="06:00 PM"
              value={endTime}
              onChangeText={setEndTime}
            />
          </View>

          {/* Last Date/Time to Join */}
          <Text style={styles.subLabel}>⏰ Last Date & Time to Join (Join Deadline):</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="YYYY-MM-DD"
              value={joinDeadlineDate}
              onChangeText={setJoinDeadlineDate}
            />
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="04:00 AM"
              value={joinDeadlineTime}
              onChangeText={setJoinDeadlineTime}
            />
          </View>
        </View>

        {/* 4. ESTIMATED COST */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>💰 Estimated Total Cost (Optional)</Text>
          <Text style={styles.sectionHint}>Approximate budget for fuel, food, and tolls</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. ₹1,500 / person or ₹5,000 total"
            placeholderTextColor="#999"
            value={estimatedCost}
            onChangeText={setEstimatedCost}
          />
        </View>

        {/* 5. RIDE DESCRIPTION & RULES */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>📝 Ride Description & Guidelines</Text>
          <Text style={styles.sectionHint}>Notes, required gear, cruising speed, and instructions</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Write guidelines, required gear, pace, notes..."
            placeholderTextColor="#999"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* CREATE BUTTON */}
        <TouchableOpacity
          style={[styles.createBtn, creating && styles.btnDisabled]}
          onPress={handleCreateRide}
          disabled={creating}
        >
          {creating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.createBtnText}>🚀 Create Ride & Open Dashboard</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
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
  backText: { fontSize: 16, color: '#FF6B35', fontWeight: '600' },
  headerTitleContainer: { alignItems: 'center', flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  headerSub: { fontSize: 12, color: '#666', marginTop: 1 },
  content: { padding: 16, paddingBottom: 40 },

  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  summaryRoute: { fontSize: 14, color: '#4b5563', marginTop: 4, marginBottom: 10 },
  summaryMetricsRow: { flexDirection: 'row', gap: 8 },
  metricBadge: {
    backgroundColor: '#fff8f3',
    color: '#FF6B35',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },

  section: { marginBottom: 22 },
  sectionLabel: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  sectionHint: { fontSize: 13, color: '#6b7280', marginBottom: 10 },
  subLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 8, marginBottom: 4 },

  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff8f3',
    borderWidth: 2,
    borderColor: '#FF6B35',
    borderRadius: 14,
    padding: 14,
  },
  codeDisplay: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 4,
    color: '#1a1a1a',
  },
  regenBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FF6B35',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  regenBtnText: { color: '#FF6B35', fontWeight: '700', fontSize: 13 },

  memberPillsRow: { flexDirection: 'row', gap: 8 },
  memberPill: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  memberPillActive: {
    borderColor: '#FF6B35',
    backgroundColor: '#fff8f3',
  },
  memberPillText: { fontSize: 13, fontWeight: '600', color: '#4b5563' },
  memberPillTextActive: { color: '#FF6B35', fontWeight: '800' },

  input: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#1a1a1a',
    backgroundColor: '#fff',
  },
  row: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  halfInput: { flex: 1 },
  textArea: { height: 90, textAlignVertical: 'top' },

  createBtn: {
    backgroundColor: '#FF6B35',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: { opacity: 0.6 },
  createBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },
});
