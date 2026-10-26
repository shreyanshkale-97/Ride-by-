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
        body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; font-family: sans-serif; background: #0A0E1A; }
        .leaflet-container { width: 100%; height: 100%; cursor: crosshair !important; background: #0A0E1A; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var lat = ${selectedLat};
        var lng = ${selectedLng};
        var map = L.map('map', { zoomControl: false }).setView([lat, lng], 14);

        L.tileLayer('https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=cb1_4uw2_1_70414a8f502607f82f75477d', {
          maxZoom: 19,
          attribution: '© OpenStreetMap, © CARTO'
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
    backgroundColor: '#12172B',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  closeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#1A2035',
    borderRadius: 8,
  },
  closeBtnText: { fontSize: 13, color: '#F9FAFB', fontWeight: '700' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#F9FAFB' },
  gpsBtn: {
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    borderWidth: 1,
    borderColor: '#FF6B35',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  gpsBtnText: { color: '#FF6B35', fontSize: 12, fontWeight: '800' },

  searchContainer: {
    padding: 12,
    backgroundColor: '#12172B',
    position: 'relative',
    zIndex: 10,
  },
  searchInput: {
    backgroundColor: '#1A2035',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#F9FAFB',
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
    backgroundColor: '#1A2035',
    borderRadius: 14,
    maxHeight: 220,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  resultIcon: { fontSize: 18, marginRight: 8 },
  resultText: { fontSize: 13, color: '#F9FAFB', flex: 1, fontWeight: '600' },

  mapWrapper: { flex: 1, position: 'relative', backgroundColor: '#0A0E1A' },
  mapTip: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(18, 23, 43, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  mapTipText: { color: '#F9FAFB', fontSize: 12, fontWeight: '700' },

  bottomBar: {
    backgroundColor: '#12172B',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  locationInfo: { marginBottom: 12 },
  locationLabel: { fontSize: 11, color: '#60A5FA', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  locationName: { fontSize: 15, fontWeight: '800', color: '#F9FAFB', marginTop: 2 },
  coordsText: { fontSize: 11, color: '#9CA3AF', marginTop: 3 },
  confirmBtn: {
    backgroundColor: '#FF6B35',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});

