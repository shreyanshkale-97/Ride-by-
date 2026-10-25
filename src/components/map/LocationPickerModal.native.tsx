import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, ActivityIndicator, FlatList, SafeAreaView,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { searchPlaces, reverseGeocode, GeocodeResult } from '../../services/geocoding';
import { getCurrentLocation } from '../../services/locationService';

interface LocationPickerProps {
  visible: boolean;
  title: string;
  initialLat?: number;
  initialLng?: number;
  initialName?: string;
  onSelect: (location: { name: string; lat: number; lng: number }) => void;
  onClose: () => void;
}

export function LocationPickerModal({
  visible,
  title,
  initialLat = 22.7196,
  initialLng = 75.8577,
  initialName = '',
  onSelect,
  onClose,
}: LocationPickerProps) {
  const [selectedLat, setSelectedLat] = useState(initialLat || 22.7196);
  const [selectedLng, setSelectedLng] = useState(initialLng || 75.8577);
  const [selectedName, setSelectedName] = useState(initialName || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolvingName, setResolvingName] = useState(false);

  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (visible) {
      const lat = initialLat || 22.7196;
      const lng = initialLng || 75.8577;
      setSelectedLat(lat);
      setSelectedLng(lng);
      setSelectedName(initialName || '');
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [visible, initialLat, initialLng, initialName]);

  const handleMapPress = async (lat: number, lng: number) => {
    setSelectedLat(lat);
    setSelectedLng(lng);
    setResolvingName(true);
    const name = await reverseGeocode(lat, lng);
    setSelectedName(name);
    setResolvingName(false);
  };

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.trim().length >= 2) {
      setSearching(true);
      const results = await searchPlaces(text);
      setSearchResults(results);
      setSearching(false);
    } else {
      setSearchResults([]);
    }
  };

  const handleSelectSearchResult = (result: GeocodeResult) => {
    setSelectedLat(result.lat);
    setSelectedLng(result.lng);
    setSelectedName(result.name);
    setSearchResults([]);
    setSearchQuery('');

    mapRef.current?.animateToRegion({
      latitude: result.lat,
      longitude: result.lng,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    });
  };

  const handleUseCurrentLocation = async () => {
    const loc = await getCurrentLocation();
    if (loc) {
      const { latitude, longitude } = loc.coords;
      setSelectedLat(latitude);
      setSelectedLng(longitude);
      setResolvingName(true);
      const name = await reverseGeocode(latitude, longitude);
      setSelectedName(name);
      setResolvingName(false);

      mapRef.current?.animateToRegion({
        latitude,
        longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    }
  };

  const handleConfirm = () => {
    onSelect({
      name: selectedName || `${selectedLat.toFixed(4)}, ${selectedLng.toFixed(4)}`,
      lat: selectedLat,
      lng: selectedLng,
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕ Close</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <TouchableOpacity onPress={handleUseCurrentLocation} style={styles.gpsBtn}>
            <Text style={styles.gpsBtnText}>🎯 My GPS</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="🔍 Search place (e.g. Rajwada, Indore)"
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searching && <ActivityIndicator size="small" color="#FF6B35" style={styles.searchSpinner} />}
        </View>

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <View style={styles.resultsDropdown}>
            <FlatList
              data={searchResults}
              keyExtractor={(_, i) => String(i)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.resultItem}
                  onPress={() => handleSelectSearchResult(item)}
                >
                  <Text style={styles.resultIcon}>📍</Text>
                  <Text style={styles.resultText} numberOfLines={2}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Native MapView */}
        <View style={styles.mapWrapper}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_DEFAULT}
            initialRegion={{
              latitude: selectedLat,
              longitude: selectedLng,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
            onPress={(e) => {
              const { latitude, longitude } = e.nativeEvent.coordinate;
              handleMapPress(latitude, longitude);
            }}
          >
            <Marker
              coordinate={{ latitude: selectedLat, longitude: selectedLng }}
              draggable
              onDragEnd={(e) => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                handleMapPress(latitude, longitude);
              }}
              title="Selected Location"
            />
          </MapView>
          <View style={styles.mapTip}>
            <Text style={styles.mapTipText}>👆 Tap anywhere to place marker</Text>
          </View>
        </View>

        {/* Bottom Selection Bar */}
        <View style={styles.bottomBar}>
          <View style={styles.locationInfo}>
            <Text style={styles.locationLabel}>Selected Location:</Text>
            {resolvingName ? (
              <ActivityIndicator size="small" color="#FF6B35" style={{ alignSelf: 'flex-start', marginVertical: 4 }} />
            ) : (
              <Text style={styles.locationName} numberOfLines={2}>
                {selectedName || `${selectedLat.toFixed(5)}, ${selectedLng.toFixed(5)}`}
              </Text>
            )}
            <Text style={styles.coordsText}>
              Lat: {selectedLat.toFixed(5)}, Lng: {selectedLng.toFixed(5)}
            </Text>
          </View>

          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
            <Text style={styles.confirmBtnText}>Confirm Location ✓</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  closeBtn: { padding: 6 },
  closeBtnText: { fontSize: 15, color: '#666', fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  gpsBtn: {
    backgroundColor: '#fff8f3',
    borderWidth: 1,
    borderColor: '#FF6B35',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  gpsBtnText: { color: '#FF6B35', fontSize: 13, fontWeight: '700' },

  searchContainer: {
    padding: 12,
    backgroundColor: '#fff',
    position: 'relative',
    zIndex: 10,
  },
  searchInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1a1a1a',
  },
  searchSpinner: {
    position: 'absolute',
    right: 24,
    top: 22,
  },
  resultsDropdown: {
    position: 'absolute',
    top: 110,
    left: 12,
    right: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: 220,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  resultIcon: { fontSize: 18, marginRight: 8 },
  resultText: { fontSize: 14, color: '#374151', flex: 1 },

  mapWrapper: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  mapTip: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  mapTipText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  bottomBar: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  locationInfo: { marginBottom: 12 },
  locationLabel: { fontSize: 12, color: '#6b7280', fontWeight: '600', textTransform: 'uppercase' },
  locationName: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginTop: 2 },
  coordsText: { fontSize: 12, color: '#9ca3af', marginTop: 3 },
  confirmBtn: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
