import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView,
} from 'react-native';
import { useAuthStore } from '../../src/store/authStore';
import { showAppAlert } from '../../src/utils/alert';

const C = {
  bg: '#0A0E1A',
  surface: '#12172B',
  surface2: '#1A2035',
  surface3: '#232B45',
  border: 'rgba(255,255,255,0.08)',
  primary: '#FF6B35',
  primaryLight: '#FF8C5A',
  blue: '#2563EB',
  green: '#10B981',
  red: '#EF4444',
  textPrimary: '#F9FAFB',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
};

export default function ProfileScreen() {
  const { user, signOut } = useAuthStore();

  const handleSignOut = () => {
    showAppAlert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Rider Profile</Text>
          <View style={styles.badgePro}>
            <Text style={styles.badgeProText}>PRO RIDER</Text>
          </View>
        </View>

        {/* Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0).toUpperCase() ?? 'R'}
              </Text>
            </View>
            <View style={styles.onlineDot} />
          </View>
          <Text style={styles.name}>{user?.name ?? 'Rider'}</Text>
          <Text style={styles.roleTag}>🏍 Community Member • Joined 2026</Text>

          {/* Quick Stats Grid */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>14</Text>
              <Text style={styles.statLabel}>Rides</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>840</Text>
              <Text style={styles.statLabel}>km Tracked</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>4.9★</Text>
              <Text style={styles.statLabel}>Safety</Text>
            </View>
          </View>
        </View>

        {/* Details Section */}
        <Text style={styles.sectionHeading}>ACCOUNT INFO</Text>
        <View style={styles.cardGroup}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Full Name</Text>
            <Text style={styles.infoValue}>{user?.name || '—'}</Text>
          </View>
          <View style={styles.rowBorder} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Account Status</Text>
            <View style={styles.verifiedChip}>
              <Text style={styles.verifiedText}>✓ Verified</Text>
            </View>
          </View>
          <View style={styles.rowBorder} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Emergency SOS</Text>
            <Text style={styles.infoValueActive}>Active (Broadcast ON)</Text>
          </View>
        </View>

        {/* Preferences */}
        <Text style={styles.sectionHeading}>PREFERENCES</Text>
        <View style={styles.cardGroup}>
          <TouchableOpacity style={styles.navRow}>
            <View style={styles.navRowLeft}>
              <Text style={styles.navIcon}>🗺</Text>
              <Text style={styles.navLabel}>Map Navigation Mode</Text>
            </View>
            <Text style={styles.navVal}>Google Dark ›</Text>
          </TouchableOpacity>
          <View style={styles.rowBorder} />
          <TouchableOpacity style={styles.navRow}>
            <View style={styles.navRowLeft}>
              <Text style={styles.navIcon}>⚡</Text>
              <Text style={styles.navLabel}>GPS Update Rate</Text>
            </View>
            <Text style={styles.navVal}>Every 2s (High Accuracy) ›</Text>
          </TouchableOpacity>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <Text style={styles.signOutText}>🚪 Log Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>RideBy v1.2.0 • Ultra Low Latency Group Mesh</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scroll: {
    padding: 18,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: C.textPrimary,
    letterSpacing: -0.5,
  },
  badgePro: {
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    borderWidth: 1,
    borderColor: C.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeProText: {
    color: C.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  heroCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 14,
  },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: C.surface3,
    borderWidth: 3,
    borderColor: C.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 34,
    fontWeight: '900',
    color: C.textPrimary,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.green,
    borderWidth: 3,
    borderColor: C.surface,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: C.textPrimary,
  },
  roleTag: {
    fontSize: 13,
    color: C.textSecondary,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: C.surface2,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNum: {
    fontSize: 19,
    fontWeight: '800',
    color: C.primaryLight,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: C.textMuted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: C.border,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: C.textMuted,
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 6,
  },
  cardGroup: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 22,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  rowBorder: {
    height: 1,
    backgroundColor: C.border,
    marginHorizontal: 16,
  },
  infoLabel: {
    fontSize: 14,
    color: C.textSecondary,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: C.textPrimary,
  },
  infoValueActive: {
    fontSize: 13,
    fontWeight: '700',
    color: C.green,
  },
  verifiedChip: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  verifiedText: {
    color: C.green,
    fontSize: 12,
    fontWeight: '700',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  navRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navIcon: {
    fontSize: 17,
  },
  navLabel: {
    fontSize: 14,
    color: C.textPrimary,
    fontWeight: '600',
  },
  navVal: {
    fontSize: 12,
    color: C.textMuted,
    fontWeight: '600',
  },
  signOutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  signOutText: {
    color: C.red,
    fontSize: 15,
    fontWeight: '800',
  },
  version: {
    textAlign: 'center',
    fontSize: 11,
    color: C.textMuted,
    marginTop: 20,
    fontWeight: '500',
  },
});
