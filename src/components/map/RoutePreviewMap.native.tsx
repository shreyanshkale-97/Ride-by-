import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { RouteOption, RideStop } from '../../services/routingService';

interface RoutePreviewMapProps {
  startLat: number;
  startLng: number;
  destLat: number;
  destLng: number;
  routes: RouteOption[];
  selectedRouteId: string;
  stops?: RideStop[];
}

export function RoutePreviewMap({
  startLat,
  startLng,
  destLat,
  destLng,
  routes,
  selectedRouteId,
  stops = [],
}: RoutePreviewMapProps) {
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (routes.length > 0) {
      const selected = routes.find((r) => r.id === selectedRouteId) || routes[0];
      const allCoords = [
        { latitude: startLat, longitude: startLng },
        ...stops.map((s) => ({ latitude: s.lat, longitude: s.lng })),
        ...selected.coordinates.map((c) => ({ latitude: c.lat, longitude: c.lng })),
        { latitude: destLat, longitude: destLng },
      ];
      mapRef.current?.fitToCoordinates(allCoords, {
        edgePadding: { top: 60, right: 40, bottom: 60, left: 40 },
        animated: true,
      });
    }
  }, [routes, selectedRouteId, startLat, startLng, destLat, destLng, stops]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: (startLat + destLat) / 2,
          longitude: (startLng + destLng) / 2,
          latitudeDelta: Math.abs(destLat - startLat) * 1.5 || 0.1,
          longitudeDelta: Math.abs(destLng - startLng) * 1.5 || 0.1,
        }}
      >
        {/* Draw non-selected routes */}
        {routes
          .filter((r) => r.id !== selectedRouteId)
          .map((route) => (
            <Polyline
              key={route.id}
              coordinates={route.coordinates.map((c) => ({
                latitude: c.lat,
                longitude: c.lng,
              }))}
              strokeColor="#94a3b8"
              strokeWidth={4}
              lineDashPattern={[6, 6]}
            />
          ))}

        {/* Draw selected route */}
        {routes
          .filter((r) => r.id === selectedRouteId)
          .map((route) => (
            <Polyline
              key={route.id}
              coordinates={route.coordinates.map((c) => ({
                latitude: c.lat,
                longitude: c.lng,
              }))}
              strokeColor="#FF6B35"
              strokeWidth={6}
            />
          ))}

        {/* Start Marker */}
        <Marker
          coordinate={{ latitude: startLat, longitude: startLng }}
          title="Meeting Point"
        >
          <View style={[styles.markerBadge, { backgroundColor: '#16a34a' }]}>
            <Text style={styles.markerEmoji}>📍</Text>
          </View>
        </Marker>

        {/* Stops Markers */}
        {stops.map((s) => {
          const color = s.type === 'fuel' ? '#f59e0b' : s.type === 'cafe' ? '#b45309' : '#3b82f6';
          const emoji = s.type === 'fuel' ? '⛽' : s.type === 'cafe' ? '☕' : '🛑';
          return (
            <Marker
              key={s.id}
              coordinate={{ latitude: s.lat, longitude: s.lng }}
              title={s.name}
            >
              <View style={[styles.markerBadge, { backgroundColor: color }]}>
                <Text style={styles.markerEmoji}>{emoji}</Text>
              </View>
            </Marker>
          );
        })}

        {/* Destination Marker */}
        <Marker
          coordinate={{ latitude: destLat, longitude: destLng }}
          title="Destination"
        >
          <View style={[styles.markerBadge, { backgroundColor: '#ef4444' }]}>
            <Text style={styles.markerEmoji}>🏁</Text>
          </View>
        </Marker>
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  markerBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  markerEmoji: { fontSize: 18 },
});
