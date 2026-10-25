import React, { forwardRef } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { RideStop } from '../../services/routingService';
import { DisplayRider, RideMapProps } from './RideMap.web';
import { formatDistance } from '../../utils/location';

export const RideMap = forwardRef<MapView, RideMapProps>(({
  myLat,
  myLng,
  startLat,
  startLng,
  startName = 'Meeting Point',
  destLat,
  destLng,
  destName = 'Destination',
  routeCoordinates = [],
  stops = [],
  riders = [],
}, ref) => {
  return (
    <MapView
      ref={ref}
      style={styles.map}
      provider={PROVIDER_DEFAULT}
      initialRegion={{
        latitude: myLat,
        longitude: myLng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
      showsUserLocation
      showsMyLocationButton={false}
      followsUserLocation
    >
      {/* Route Polyline */}
      {routeCoordinates.length > 0 && (
        <Polyline
          coordinates={routeCoordinates.map((c) => ({
            latitude: c.lat,
            longitude: c.lng,
          }))}
          strokeColor="#FF6B35"
          strokeWidth={5}
        />
      )}

      {/* Start / Meeting Point Marker */}
      <Marker
        coordinate={{ latitude: startLat, longitude: startLng }}
        title={`📍 Start: ${startName}`}
        pinColor="green"
      />

      {/* Destination Marker */}
      <Marker
        coordinate={{ latitude: destLat, longitude: destLng }}
        title={`🏁 Finish: ${destName}`}
        pinColor="red"
      />

      {/* Stops Markers */}
      {stops.map((s) => (
        <Marker
          key={s.id}
          coordinate={{ latitude: s.lat, longitude: s.lng }}
          title={`${s.type === 'fuel' ? '⛽' : s.type === 'cafe' ? '☕' : '🛑'} ${s.name}`}
          description={`${s.type.toUpperCase()} STOP`}
        >
          <View style={styles.stopBadge}>
            <Text style={{ fontSize: 18 }}>
              {s.type === 'fuel' ? '⛽' : s.type === 'cafe' ? '☕' : '🛑'}
            </Text>
          </View>
        </Marker>
      ))}

      {/* Rider Markers */}
      {riders.map((r) => {
        if (r.isSelf) return null; // Native MapView already shows user location blue dot

        return (
          <Marker
            key={r.userId}
            coordinate={{ latitude: r.lat, longitude: r.lng }}
            title={r.role === 'leader' ? `👑 ${r.name} (Leader)` : `🏍 ${r.name}`}
            description={`${r.status.toUpperCase()} • ${formatDistance(r.distanceFromMe)} from you`}
            rotation={r.heading}
          >
            <View style={styles.markerContainer}>
              <View
                style={[
                  styles.markerBubble,
                  { backgroundColor: r.role === 'leader' ? '#ea580c' : '#4f46e5' },
                ]}
              >
                <Text style={styles.markerEmoji}>
                  {r.role === 'leader' ? '👑' : '🏍'}
                </Text>
              </View>
              <Text style={styles.markerName}>{r.name.split(' ')[0]}</Text>
              <Text style={styles.markerDist}>
                {formatDistance(r.distanceFromMe)}
              </Text>
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
});

const styles = StyleSheet.create({
  map: { flex: 1 },
  stopBadge: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 4,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    elevation: 3,
  },
  markerContainer: { alignItems: 'center' },
  markerBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 4,
  },
  markerEmoji: { fontSize: 18 },
  markerName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1a1a1a',
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 4,
    borderRadius: 4,
    marginTop: 2,
  },
  markerDist: {
    fontSize: 10,
    fontWeight: '700',
    color: '#374151',
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 3,
    borderRadius: 3,
    marginTop: 1,
  },
});
