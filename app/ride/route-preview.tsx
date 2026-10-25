import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, Alert, ScrollView,
  TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  fetchRoutes, fetchSuggestedStops,
  RouteOption, RideStop, StopType,
} from '../../src/services/routingService';
import { RoutePreviewMap } from '../../src/components/map/RoutePreviewMap';
import { useAuthStore } from '../../src/store/authStore';
import { useRideStore } from '../../src/store/rideStore';

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
  const [loadingStops, setLoadingStops] = useState(false);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [creating, setCreating] = useState(false);

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
          <Text style={styles.backText}>← Edit</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>{params.name || 'Route Navigation'}</Text>
          <Text style={styles.headerSub}>
            {selectedStops.length > 0
              ? `${selectedStops.length} stop${selectedStops.length > 1 ? 's' : ''} added`
              : 'Add optional stops along the route'}
          </Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

      {/* Main Map View */}
      <View style={styles.mapContainer}>
        {loadingRoutes ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#FF6B35" />
            <Text style={styles.loadingText}>Recalculating route & navigation...</Text>
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
                <Text style={styles.statLbl}>Duration</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statVal}>{selectedStops.length}</Text>
                <Text style={styles.statLbl}>Stops</Text>
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
              🗺 Routes
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollSection}>
            {routes.map((route, i) => {
              const isSelected = route.id === selectedRouteId;
              return (
                <TouchableOpacity
                  key={route.id}
                  style={[styles.routeCard, isSelected && styles.routeCardSelected]}
                  onPress={() => setSelectedRouteId(route.id)}
                >
                  <View style={styles.cardHeader}>
                    <Text style={[styles.cardTag, isSelected && styles.cardTagSelected]}>
                      {i === 0 ? 'RECOMMENDED' : `OPTION ${i + 1}`}
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollSection}>
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
                      {isAdded ? '✓ Added to Route' : '+ Add to Route'}
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
        >
          <Text style={styles.confirmBtnText}>Next: Ride Details & Rules ⚙️ →</Text>
        </TouchableOpacity>
      </View>
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
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  headerSub: { fontSize: 12, color: '#666', marginTop: 1 },

  mapContainer: { flex: 1, position: 'relative' },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: { marginTop: 12, fontSize: 15, color: '#6b7280', fontWeight: '500' },

  floatingStopsList: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    zIndex: 50,
  },
  stopChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  stopChipText: { fontSize: 13, fontWeight: '700', color: '#1f2937' },
  chipRemoveBtn: { marginLeft: 8, padding: 2 },
  chipRemoveText: { color: '#ef4444', fontWeight: '800', fontSize: 12 },

  bottomCard: {
    backgroundColor: '#fff',
    padding: 16,
    paddingBottom: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  summaryBar: {
    backgroundColor: '#fff8f3',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#FF6B35',
  },
  summaryStatsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  statLbl: { fontSize: 11, color: '#6b7280', marginTop: 1 },
  statDivider: { width: 1, height: 24, backgroundColor: '#fed7aa' },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 3,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#FF6B35', fontWeight: '800' },

  scrollSection: { marginBottom: 14, minHeight: 90 },

  // Route Cards
  routeCard: {
    width: 170,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 12,
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  routeCardSelected: {
    backgroundColor: '#fff',
    borderColor: '#FF6B35',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTag: { fontSize: 10, fontWeight: '800', color: '#6b7280' },
  cardTagSelected: { color: '#FF6B35' },
  checkMark: { color: '#FF6B35', fontWeight: '900', fontSize: 14 },
  cardName: { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },
  cardMetrics: { fontSize: 12, color: '#4b5563', marginTop: 3 },

  // Stop Cards
  stopCard: {
    width: 200,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    justifyContent: 'space-between',
  },
  stopCardAdded: {
    borderColor: '#10b981',
    backgroundColor: '#ecfdf5',
  },
  stopCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  stopEmoji: { fontSize: 20 },
  stopCategoryBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#6b7280',
    letterSpacing: 0.5,
  },
  stopCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 10,
    lineHeight: 18,
  },
  addStopBtn: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#FF6B35',
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  addStopBtnAdded: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  addStopBtnText: {
    color: '#FF6B35',
    fontSize: 12,
    fontWeight: '700',
  },
  addStopBtnTextAdded: {
    color: '#fff',
  },

  confirmBtn: {
    backgroundColor: '#FF6B35',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  confirmBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
