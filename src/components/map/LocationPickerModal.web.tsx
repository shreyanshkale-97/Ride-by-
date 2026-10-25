import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, ActivityIndicator, FlatList, Dimensions,
} from 'react-native';
import { searchPlaces, reverseGeocode, GeocodeResult } from '../../services/geocoding';

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

  const iframeRef = useRef<any>(null);

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

  // Listen for click/drag messages from the iframe Leaflet map
  useEffect(() => {
    const handleMessage = async (e: MessageEvent) => {
      if (e.data && e.data.type === 'PICKED_LOCATION') {
        const { lat, lng } = e.data;
        setSelectedLat(lat);
        setSelectedLng(lng);
        setResolvingName(true);
        const name = await reverseGeocode(lat, lng);
        setSelectedName(name);
        setResolvingName(false);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }
  }, []);

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

    // Pan iframe map to this coordinate
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: 'PAN_TO', lat: result.lat, lng: result.lng },
        '*'
      );
    }
  };

  const handleUseCurrentLocation = () => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setSelectedLat(lat);
          setSelectedLng(lng);
          setResolvingName(true);
          const name = await reverseGeocode(lat, lng);
          setSelectedName(name);
          setResolvingName(false);

          if (iframeRef.current && iframeRef.current.contentWindow) {
            iframeRef.current.contentWindow.postMessage(
              { type: 'PAN_TO', lat, lng },
              '*'
            );
          }
        },
        (err) => console.warn('Geolocation error:', err.message),
        { enableHighAccuracy: true }
      );
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

  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; font-family: sans-serif; }
        .leaflet-container { width: 100%; height: 100%; cursor: crosshair !important; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var lat = ${selectedLat};
        var lng = ${selectedLng};
        var map = L.map('map').setView([lat, lng], 14);

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap'
        }).addTo(map);

        var marker = L.marker([lat, lng], { draggable: true }).addTo(map);

        function notify(lat, lng) {
          window.parent.postMessage({ type: 'PICKED_LOCATION', lat: lat, lng: lng }, '*');
        }

        map.on('click', function(e) {
          marker.setLatLng(e.latlng);
          notify(e.latlng.lat, e.latlng.lng);
        });

        marker.on('dragend', function(e) {
          var pos = marker.getLatLng();
          notify(pos.lat, pos.lng);
        });

        window.addEventListener('message', function(e) {
          if (e.data && e.data.type === 'PAN_TO') {
            map.setView([e.data.lat, e.data.lng], 15);
            marker.setLatLng([e.data.lat, e.data.lng]);
          }
        });
      </script>
    </body>
    </html>
  `;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
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

        {/* Interactive Leaflet Map */}
        <View style={styles.mapWrapper}>
          <iframe
            ref={iframeRef}
            srcDoc={mapHtml}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Location Picker Map"
          />
          <View style={styles.mapTip}>
            <Text style={styles.mapTipText}>👆 Tap or drag pin anywhere on map</Text>
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
      </View>
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
    paddingTop: 16,
    paddingBottom: 12,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
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
