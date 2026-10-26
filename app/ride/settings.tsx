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

const C = {
  bg: '#0A0E1A',
  surface: '#12172B',
  surface2: '#1A2035',
  surface3: '#232B45',
  border: 'rgba(255,255,255,0.08)',
  primary: '#FF6B35',
  primaryLight: '#FF8C5A',
  green: '#10B981',
  blue: '#2563EB',
  textPrimary: '#F9FAFB',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
};

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
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>FINAL STEP 3 OF 3</Text>
          </View>
          <Text style={styles.headerTitle}>Details & Guidelines</Text>
        </View>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Route Summary Card */}
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
        <View style={styles.cardSection}>
          <Text style={styles.sectionLabel}>🔑 RIDE ACCESS CODE</Text>
          <Text style={styles.sectionHint}>
            Friends will enter this unique code to join your pack lobby.
          </Text>
          <View style={styles.codeContainer}>
            <Text style={styles.codeDisplay}>{rideCode}</Text>
            <TouchableOpacity onPress={handleRegenerateCode} style={styles.regenBtn} activeOpacity={0.8}>
              <Text style={styles.regenBtnText}>🔄 Generate New</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. MAX MEMBERS */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionLabel}>👥 PACK CAPACITY LIMIT</Text>
          <Text style={styles.sectionHint}>Cap group size for maximum formation safety.</Text>
          <View style={styles.memberPillsRow}>
            {[5, 10, 15, 20].map((num) => (
              <TouchableOpacity
                key={num}
                style={[styles.memberPill, maxMembers === num && styles.memberPillActive]}
                onPress={() => setMaxMembers(num)}
                activeOpacity={0.8}
              >
                <Text style={[styles.memberPillText, maxMembers === num && styles.memberPillTextActive]}>
                  {num} Riders
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 3. DATES & TIMINGS */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionLabel}>📅 SCHEDULE & TIMELINE</Text>

          {/* Start Date & Time */}
          <Text style={styles.subLabel}>🚀 Meet & Rollout</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={C.textMuted}
              value={startDate}
              onChangeText={setStartDate}
            />
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="06:00 AM"
              placeholderTextColor={C.textMuted}
              value={startTime}
              onChangeText={setStartTime}
            />
          </View>

          {/* End Date & Time */}
          <Text style={styles.subLabel}>🏁 Target Arrival</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={C.textMuted}
              value={endDate}
              onChangeText={setEndDate}
            />
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="06:00 PM"
              placeholderTextColor={C.textMuted}
              value={endTime}
              onChangeText={setEndTime}
            />
          </View>

          {/* Last Date/Time to Join */}
          <Text style={styles.subLabel}>⏰ Join Cutoff Deadline</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={C.textMuted}
              value={joinDeadlineDate}
              onChangeText={setJoinDeadlineDate}
            />
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="04:00 AM"
              placeholderTextColor={C.textMuted}
              value={joinDeadlineTime}
              onChangeText={setJoinDeadlineTime}
            />
          </View>
        </View>

        {/* 4. ESTIMATED COST */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionLabel}>💰 ESTIMATED BUDGET (OPTIONAL)</Text>
          <Text style={styles.sectionHint}>Estimated split per rider for fuel, food, and tolls.</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. ₹1,500 / rider"
            placeholderTextColor={C.textMuted}
            value={estimatedCost}
            onChangeText={setEstimatedCost}
          />
        </View>

        {/* 5. RIDE DESCRIPTION & RULES */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionLabel}>📝 RIDE RULES & GEAR REQUIREMENT</Text>
          <Text style={styles.sectionHint}>Safety notes, mandatory riding gear, staggered formation instructions.</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Write guidelines, required gear, pace, notes..."
            placeholderTextColor={C.textMuted}
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
          activeOpacity={0.85}
        >
          {creating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.createBtnText}>🚀 Launch Ride & Open Dashboard</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: C.surface2,
    borderRadius: 8,
  },
  backText: {
    fontSize: 13,
    color: C.textPrimary,
    fontWeight: '700',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  stepBadge: {
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 2,
  },
  stepBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: C.primary,
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: C.textPrimary,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  summaryCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.3)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: C.textPrimary,
  },
  summaryRoute: {
    fontSize: 13,
    color: C.textSecondary,
    marginTop: 4,
    marginBottom: 12,
  },
  summaryMetricsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  metricBadge: {
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: '700',
    color: C.primaryLight,
  },
  cardSection: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: C.primaryLight,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 12,
    color: C.textSecondary,
    marginBottom: 14,
    lineHeight: 16,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textPrimary,
    marginTop: 8,
    marginBottom: 6,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.surface2,
    borderWidth: 1.5,
    borderColor: C.primary,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  codeDisplay: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 5,
    color: C.primary,
    fontFamily: 'monospace',
  },
  regenBtn: {
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    borderWidth: 1,
    borderColor: C.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  regenBtnText: {
    color: C.primaryLight,
    fontWeight: '700',
    fontSize: 12,
  },
  memberPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  memberPill: {
    flex: 1,
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  memberPillActive: {
    borderColor: C.primary,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
  },
  memberPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textMuted,
  },
  memberPillTextActive: {
    color: C.primary,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  halfInput: {
    flex: 1,
  },
  input: {
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 13,
    fontSize: 14,
    color: C.textPrimary,
  },
  textArea: {
    height: 86,
    textAlignVertical: 'top',
  },
  createBtn: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
