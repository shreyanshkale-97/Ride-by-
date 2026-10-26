import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  fetchRoutes, fetchSuggestedStops,
  RouteOption, RideStop, StopType,
} from '../../src/services/routingService';
import { RoutePreviewMap } from '../../src/components/map/RoutePreviewMap';
import { useAuthStore } from '../../src/store/authStore';
import { useRideStore } from '../../src/store/rideStore';

const C = {
  bg: '#0A0E1A',
  surface: '#12172B',
  surface2: '#1A2035',
  surface3: '#232B45',
  border: 'rgba(255,255,255,0.08)',
  primary: '#FF6B35',
  primaryLight: '#FF8C5A',
  blue: '#2563EB',
  blueLight: '#60A5FA',
  green: '#10B981',
  textPrimary: '#F9FAFB',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
};

type ActiveTab = 'routes' | 'fuel' | 'cafe' | 'rest_stop';

export default function RoutePreviewScreen() {
  const params = useLocalSearchParams<{
    name: string;
    meetingName: string;
    meetingLat: string;
    meetingLng: string;
    destName: string;
    destLat: string;
    destLng: string;
  }>();

  const { user } = useAuthStore();
  const { createRide } = useRideStore();

  const startLat = parseFloat(params.meetingLat) || 22.7196;
  const startLng = parseFloat(params.meetingLng) || 75.8577;
  const destLat = parseFloat(params.destLat) || 23.2585;
  const destLng = parseFloat(params.destLng) || 77.4020;

  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [selectedStops, setSelectedStops] = useState<RideStop[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('routes');

  const [suggestedStops, setSuggestedStops] = useState<Record<StopType, RideStop[]>>({
    fuel: [],
    cafe: [],
    rest_stop: [],
  });
  const [loadingRoutes, setLoadingRoutes] = useState(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoadingRoutes(true);
    const fetchedRoutes = await fetchRoutes(startLat, startLng, destLat, destLng, []);
    setRoutes(fetchedRoutes);
    if (fetchedRoutes.length > 0) {
      setSelectedRouteId(fetchedRoutes[0].id);
    }
    setLoadingRoutes(false);

    // Preload suggested POIs in background
    loadSuggestions('fuel');
    loadSuggestions('cafe');
    loadSuggestions('rest_stop');
  };

  const loadSuggestions = async (type: StopType) => {
    const list = await fetchSuggestedStops(startLat, startLng, destLat, destLng, type);
    setSuggestedStops((prev) => ({ ...prev, [type]: list }));
  };

  const handleToggleStop = async (stop: RideStop) => {
    const isAlreadyAdded = selectedStops.some((s) => s.id === stop.id);
    let updated: RideStop[];

    if (isAlreadyAdded) {
      updated = selectedStops.filter((s) => s.id !== stop.id);
    } else {
      updated = [...selectedStops, stop];
    }

    setSelectedStops(updated);

    // Recalculate route through the new waypoints
    setLoadingRoutes(true);
    const newRoutes = await fetchRoutes(startLat, startLng, destLat, destLng, updated);
    setRoutes(newRoutes);
    if (newRoutes.length > 0) {
      setSelectedRouteId(newRoutes[0].id);
    }
    setLoadingRoutes(false);
  };

  const handleProceedToSettings = () => {
    const selected = routes.find((r) => r.id === selectedRouteId) || routes[0];

    router.push({
      pathname: '/ride/settings',
      params: {
        name: params.name || 'Group Ride 🏍',
        meetingName: params.meetingName,
        meetingLat: String(startLat),
        meetingLng: String(startLng),
        destName: params.destName,
        destLat: String(destLat),
        destLng: String(destLng),
        distanceKm: selected ? String(selected.distanceKm) : '0',
        durationText: selected ? selected.durationText : '',
        stopsJson: JSON.stringify(selectedStops),
      },
    });
  };

  const selectedRoute = routes.find((r) => r.id === selectedRouteId) || routes[0];

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>STEP 2 OF 3</Text>
          </View>
          <Text style={styles.headerTitle} numberOfLines={1}>{params.name || 'Choose Route'}</Text>
        </View>
        <View style={{ width: 50 }} />
      </View>

      {/* Main Map View */}
      <View style={styles.mapContainer}>
        {loadingRoutes ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={C.primary} />
            <Text style={styles.loadingText}>Recalculating live OSRM navigation...</Text>
          </View>
        ) : (
          <RoutePreviewMap
            startLat={startLat}
            startLng={startLng}
            destLat={destLat}
            destLng={destLng}
            routes={routes}
            selectedRouteId={selectedRouteId}
            stops={selectedStops}
          />
        )}

        {/* Selected Stops Floating Chips */}
        {selectedStops.length > 0 && (
          <View style={styles.floatingStopsList}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
              {selectedStops.map((s) => (
                <View key={s.id} style={styles.stopChip}>
                  <Text style={styles.stopChipText}>
                    {s.type === 'fuel' ? '⛽' : s.type === 'cafe' ? '☕' : '🛑'} {s.name.split(',')[0]}
                  </Text>
                  <TouchableOpacity onPress={() => handleToggleStop(s)} style={styles.chipRemoveBtn}>
                    <Text style={styles.chipRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Bottom Panel */}
      <View style={styles.bottomCard}>
        {/* Route Metrics Summary */}
        {selectedRoute && (
          <View style={styles.summaryBar}>
            <View style={styles.summaryStatsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statVal}>{selectedRoute.distanceKm} km</Text>
                <Text style={styles.statLbl}>Distance</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statVal}>{selectedRoute.durationText}</Text>
                <Text style={styles.statLbl}>Estimated Time</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statVal}>{selectedStops.length}</Text>
                <Text style={styles.statLbl}>Stops Added</Text>
              </View>
            </View>
          </View>
        )}

        {/* Navigation / Stop Category Tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'routes' && styles.tabBtnActive]}
            onPress={() => setActiveTab('routes')}
          >
            <Text style={[styles.tabText, activeTab === 'routes' && styles.tabTextActive]}>
              🗺 Routes ({routes.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'fuel' && styles.tabBtnActive]}
            onPress={() => setActiveTab('fuel')}
          >
            <Text style={[styles.tabText, activeTab === 'fuel' && styles.tabTextActive]}>
              ⛽ Fuel
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'cafe' && styles.tabBtnActive]}
            onPress={() => setActiveTab('cafe')}
          >
            <Text style={[styles.tabText, activeTab === 'cafe' && styles.tabTextActive]}>
              ☕ Cafe
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'rest_stop' && styles.tabBtnActive]}
            onPress={() => setActiveTab('rest_stop')}
          >
            <Text style={[styles.tabText, activeTab === 'rest_stop' && styles.tabTextActive]}>
              🛑 Rest
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'routes' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollSection} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {routes.map((route, i) => {
              const isSelected = route.id === selectedRouteId;
              return (
                <TouchableOpacity
                  key={route.id}
                  style={[styles.routeCard, isSelected && styles.routeCardSelected]}
                  onPress={() => setSelectedRouteId(route.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.cardHeader}>
                    <Text style={[styles.cardTag, isSelected && styles.cardTagSelected]}>
                      {i === 0 ? 'FASTEST' : `ALT ${i}`}
                    </Text>
                    {isSelected && <Text style={styles.checkMark}>✓</Text>}
                  </View>
                  <Text style={styles.cardName} numberOfLines={1}>{route.name}</Text>
                  <Text style={styles.cardMetrics}>
                    {route.distanceKm} km • {route.durationText}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollSection} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {suggestedStops[activeTab].map((stop) => {
              const isAdded = selectedStops.some((s) => s.id === stop.id);
              const emoji = activeTab === 'fuel' ? '⛽' : activeTab === 'cafe' ? '☕' : '🛑';
              return (
                <View key={stop.id} style={[styles.stopCard, isAdded && styles.stopCardAdded]}>
                  <View style={styles.stopCardHeader}>
                    <Text style={styles.stopEmoji}>{emoji}</Text>
                    <Text style={styles.stopCategoryBadge}>{stop.type.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.stopCardTitle} numberOfLines={2}>{stop.name}</Text>
                  <TouchableOpacity
                    style={[styles.addStopBtn, isAdded && styles.addStopBtnAdded]}
                    onPress={() => handleToggleStop(stop)}
                  >
                    <Text style={[styles.addStopBtnText, isAdded && styles.addStopBtnTextAdded]}>
                      {isAdded ? '✓ Added' : '+ Add Stop'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Action Button */}
        <TouchableOpacity
          style={[styles.confirmBtn, loadingRoutes && styles.btnDisabled]}
          onPress={handleProceedToSettings}
          disabled={loadingRoutes}
          activeOpacity={0.85}
        >
          <Text style={styles.confirmBtnText}>Continue to Details & Rules →</Text>
        </TouchableOpacity>
      </View>
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
  mapContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000',
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.bg,
    gap: 12,
  },
  loadingText: {
    color: C.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  floatingStopsList: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  stopChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(18, 23, 43, 0.94)',
    borderWidth: 1,
    borderColor: C.green,
    borderRadius: 20,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 6,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  stopChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textPrimary,
    marginRight: 6,
  },
  chipRemoveBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipRemoveText: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '800',
  },
  bottomCard: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  summaryBar: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  summaryStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface2,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statVal: {
    fontSize: 16,
    fontWeight: '800',
    color: C.primary,
  },
  statLbl: {
    fontSize: 10,
    fontWeight: '600',
    color: C.textMuted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: C.border,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: C.surface2,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    borderColor: C.primary,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textMuted,
  },
  tabTextActive: {
    color: C.primary,
    fontWeight: '800',
  },
  scrollSection: {
    marginBottom: 14,
  },
  routeCard: {
    width: 180,
    backgroundColor: C.surface2,
    borderRadius: 14,
    padding: 12,
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  routeCardSelected: {
    borderColor: C.primary,
    backgroundColor: C.surface3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTag: {
    fontSize: 9,
    fontWeight: '800',
    color: C.textMuted,
    letterSpacing: 0.6,
  },
  cardTagSelected: {
    color: C.primary,
  },
  checkMark: {
    color: C.primary,
    fontWeight: '900',
    fontSize: 14,
  },
  cardName: {
    fontSize: 13,
    fontWeight: '700',
    color: C.textPrimary,
  },
  cardMetrics: {
    fontSize: 11,
    color: C.textSecondary,
    marginTop: 4,
    fontWeight: '600',
  },
  stopCard: {
    width: 200,
    backgroundColor: C.surface2,
    borderRadius: 14,
    padding: 12,
    marginRight: 10,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: 'space-between',
  },
  stopCardAdded: {
    borderColor: C.green,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  stopCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  stopEmoji: {
    fontSize: 18,
  },
  stopCategoryBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: C.textMuted,
    letterSpacing: 0.5,
  },
  stopCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textPrimary,
    marginBottom: 10,
    lineHeight: 16,
  },
  addStopBtn: {
    backgroundColor: C.surface3,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
  },
  addStopBtnAdded: {
    backgroundColor: C.green,
    borderColor: C.green,
  },
  addStopBtnText: {
    color: C.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  addStopBtnTextAdded: {
    color: '#fff',
  },
  confirmBtn: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 16,
    marginHorizontal: 16,
    alignItems: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
