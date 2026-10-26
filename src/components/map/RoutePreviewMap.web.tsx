import React from 'react';
import { View, StyleSheet } from 'react-native';
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
  const routesJson = JSON.stringify(
    routes.map((r) => ({
      id: r.id,
      name: r.name,
      isSelected: r.id === selectedRouteId,
      coords: r.coordinates.map((c) => [c.lat, c.lng]),
    }))
  );

  const stopsJson = JSON.stringify(
    stops.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      lat: s.lat,
      lng: s.lng,
      emoji: s.type === 'fuel' ? '⛽' : s.type === 'cafe' ? '☕' : '🛑',
      color: s.type === 'fuel' ? '#f59e0b' : s.type === 'cafe' ? '#b45309' : '#3b82f6',
    }))
  );

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; font-family: sans-serif; background: #0A0E1A; }
        .custom-div-icon {
          background-color: transparent;
          border: none;
        }
        .leaflet-popup-content-wrapper {
          background: #12172B !important;
          color: #F9FAFB !important;
          border: 1px solid rgba(255, 255, 255, 0.12) !important;
          border-radius: 12px !important;
          box-shadow: 0 6px 18px rgba(0,0,0,0.5) !important;
        }
        .leaflet-popup-tip {
          background: #12172B !important;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', { zoomControl: false });
        L.tileLayer('https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=cb1_4uw2_1_70414a8f502607f82f75477d', {
          maxZoom: 19,
          attribution: '© OpenStreetMap, © CARTO'
        }).addTo(map);

        var bounds = L.latLngBounds([[${startLat}, ${startLng}], [${destLat}, ${destLng}]]);

        // Start Marker (Green)
        var startIcon = L.divIcon({
          className: 'custom-div-icon',
          html: '<div style="background-color:#16a34a;color:white;width:34px;height:34px;border-radius:17px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);font-size:18px;">📍</div>',
          iconSize: [34, 34],
          iconAnchor: [17, 34]
        });
        L.marker([${startLat}, ${startLng}], { icon: startIcon }).addTo(map).bindPopup('<b>Start / Meeting Point</b>');

        // Destination Marker (Red)
        var destIcon = L.divIcon({
          className: 'custom-div-icon',
          html: '<div style="background-color:#ef4444;color:white;width:34px;height:34px;border-radius:17px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);font-size:18px;">🏁</div>',
          iconSize: [34, 34],
          iconAnchor: [17, 34]
        });
        L.marker([${destLat}, ${destLng}], { icon: destIcon }).addTo(map).bindPopup('<b>Destination</b>');

        // Optional Stops Markers (Fuel, Cafe, Rest)
        var stopsData = ${stopsJson};
        stopsData.forEach(function(s) {
          var stopIcon = L.divIcon({
            className: 'custom-div-icon',
            html: '<div style="background-color:' + s.color + ';color:white;width:32px;height:32px;border-radius:16px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);font-size:16px;">' + s.emoji + '</div>',
            iconSize: [32, 32],
            iconAnchor: [16, 32]
          });
          L.marker([s.lat, s.lng], { icon: stopIcon }).addTo(map).bindPopup('<b>' + s.emoji + ' ' + s.name + '</b><br><small>' + s.type.toUpperCase() + ' STOP</small>');
          bounds.extend([s.lat, s.lng]);
        });

        // Routes
        var routesData = ${routesJson};
        routesData.filter(function(r) { return !r.isSelected; }).forEach(function(r) {
          var poly = L.polyline(r.coords, {
            color: '#94a3b8',
            weight: 4,
            opacity: 0.7,
            dashArray: '8, 8'
          }).addTo(map);
          bounds.extend(poly.getBounds());
        });

        routesData.filter(function(r) { return r.isSelected; }).forEach(function(r) {
          var poly = L.polyline(r.coords, {
            color: '#FF6B35',
            weight: 6,
            opacity: 0.95
          }).addTo(map);
          bounds.extend(poly.getBounds());
        });

        map.fitBounds(bounds, { padding: [50, 50] });
      </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <iframe
        srcDoc={html}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="Route Preview Map"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
