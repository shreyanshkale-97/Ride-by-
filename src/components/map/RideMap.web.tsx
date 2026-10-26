import React, { forwardRef, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { RideStop } from '../../services/routingService';

export interface DisplayRider {
  userId: string;
  name: string;
  role: 'leader' | 'member';
  status: 'riding' | 'stopped' | 'at_meeting_point' | 'pending' | 'offline';
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  isLive: boolean;
  isSelf: boolean;
  distanceFromMe: number;
  distanceFromLeader: number;
  relativeToLeader: 'ahead' | 'behind' | 'together';
}

export interface RideMapProps {
  myLat: number;
  myLng: number;
  startLat: number;
  startLng: number;
  startName?: string;
  destLat: number;
  destLng: number;
  destName?: string;
  routeCoordinates?: { lat: number; lng: number }[];
  stops?: RideStop[];
  riders: DisplayRider[];
  iframeRef?: React.MutableRefObject<any>; // optional external ref to the iframe
}

export const RideMap = forwardRef<any, RideMapProps>(({
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
  iframeRef: externalIframeRef,
}, _ref) => {
  const internalRef = useRef<any>(null);

  // Callback ref that assigns to both internal and external ref
  const setIframeRef = (el: any) => {
    internalRef.current = el;
    if (externalIframeRef) externalIframeRef.current = el;
  };

  const initialRouteJson = JSON.stringify(
    routeCoordinates.map((c) => [c.lat, c.lng])
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

  const ridersJson = JSON.stringify(
    riders.map((r) => ({
      userId: r.userId,
      name: r.name,
      role: r.role,
      status: r.status,
      lat: r.lat,
      lng: r.lng,
      speed: Math.round(r.speed || 0),
      heading: r.heading || 0,
      isSelf: r.isSelf,
      distanceFromMe: r.distanceFromMe,
      distanceFromLeader: r.distanceFromLeader,
      relativeToLeader: r.relativeToLeader,
    }))
  );

  // Send real-time coordinate updates to the Leaflet iframe via postMessage
  useEffect(() => {
    if (internalRef.current && internalRef.current.contentWindow) {
      try {
        internalRef.current.contentWindow.postMessage(
          {
            type: 'UPDATE_LOCATIONS',
            myLat,
            myLng,
            riders: riders.map((r) => ({
              userId: r.userId,
              name: r.name,
              role: r.role,
              status: r.status,
              lat: r.lat,
              lng: r.lng,
              speed: Math.round(r.speed || 0),
              heading: r.heading || 0,
              isSelf: r.isSelf,
              distanceFromMe: r.distanceFromMe,
              distanceFromLeader: r.distanceFromLeader,
              relativeToLeader: r.relativeToLeader,
            })),
          },
          '*'
        );
      } catch (_) {}
    }
  }, [myLat, myLng, riders]);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .custom-div-icon { background: transparent; border: none; }
        
        /* Pulsing Radar Ring for Self */
        .self-marker {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .pulse-ring {
          position: absolute;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(37, 99, 235, 0.35);
          animation: pulse 1.8s infinite ease-out;
        }
        @keyframes pulse {
          0% { transform: scale(0.6); opacity: 1; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .self-pin {
          width: 32px;
          height: 32px;
          border-radius: 16px;
          background: #2563eb;
          color: white;
          border: 3px solid white;
          box-shadow: 0 3px 8px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          font-weight: 800;
          z-index: 2;
        }

        /* Leader Pin */
        .leader-pin {
          width: 34px;
          height: 34px;
          border-radius: 17px;
          background: #ea580c;
          color: white;
          border: 3px solid #fef08a;
          box-shadow: 0 3px 8px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        }

        /* Member Pin */
        .member-pin {
          width: 30px;
          height: 30px;
          border-radius: 15px;
          background: #4f46e5;
          color: white;
          border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
        }

        /* Dark Popup Styling */
        .leaflet-popup-content-wrapper {
          background: #12172B !important;
          color: #F9FAFB !important;
          border: 1px solid rgba(255, 255, 255, 0.12) !important;
          border-radius: 14px !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.6) !important;
        }
        .leaflet-popup-tip {
          background: #12172B !important;
        }

        /* Map Controls Overlay */
        .map-controls {
          position: absolute;
          bottom: 24px;
          right: 16px;
          z-index: 1000;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .control-btn {
          background: #12172B;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 13px;
          font-weight: 700;
          color: #F9FAFB;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .control-btn:hover { background: #1A2035; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      
      <div class="map-controls">
        <button class="control-btn" id="theme-btn" onclick="toggleMapTheme()">🗺 Voyager / Dark</button>
        <button class="control-btn" onclick="centerOnMe()">📍 My Location</button>
        <button class="control-btn" onclick="fitFullRoute()">🛣 Whole Route</button>
      </div>

      <script>
        var map = L.map('map', { zoomControl: false });

        var cartoKey = 'cb1_4uw2_1_70414a8f502607f82f75477d';
        var darkTileUrl = 'https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=' + cartoKey;
        var voyagerTileUrl = 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=' + cartoKey;

        var isDarkTheme = false; // default to Carto Voyager
        var currentTileLayer = L.tileLayer(voyagerTileUrl, {
          maxZoom: 19,
          attribution: '© OpenStreetMap, © CARTO'
        }).addTo(map);

        window.toggleMapTheme = function() {
          isDarkTheme = !isDarkTheme;
          map.removeLayer(currentTileLayer);
          currentTileLayer = L.tileLayer(isDarkTheme ? darkTileUrl : voyagerTileUrl, {
            maxZoom: 19,
            attribution: '© OpenStreetMap, © CARTO'
          }).addTo(map);
          currentTileLayer.bringToBack();
          var btn = document.getElementById('theme-btn');
          if (btn) btn.innerText = isDarkTheme ? '☀️ Switch to Voyager' : '🌙 Switch to Dark';
        };

        var bounds = L.latLngBounds([[${startLat}, ${startLng}], [${destLat}, ${destLng}]]);

        // 1. START / MEETING POINT
        var startIcon = L.divIcon({
          className: 'custom-div-icon',
          html: '<div style="background-color:#16a34a;color:white;width:34px;height:34px;border-radius:17px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 3px 8px rgba(0,0,0,0.3);font-size:18px;">📍</div>',
          iconSize: [34, 34],
          iconAnchor: [17, 34]
        });
        L.marker([${startLat}, ${startLng}], { icon: startIcon })
          .addTo(map)
          .bindPopup('<b>📍 Start: ${startName.replace(/'/g, "\\'")}</b><br>Meeting Point');

        // 2. DESTINATION POINT
        var destIcon = L.divIcon({
          className: 'custom-div-icon',
          html: '<div style="background-color:#dc2626;color:white;width:34px;height:34px;border-radius:17px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 3px 8px rgba(0,0,0,0.3);font-size:18px;">🏁</div>',
          iconSize: [34, 34],
          iconAnchor: [17, 34]
        });
        L.marker([${destLat}, ${destLng}], { icon: destIcon })
          .addTo(map)
          .bindPopup('<b>🏁 Finish: ${destName.replace(/'/g, "\\'")}</b><br>Ride Destination');

        // 3. STOPS (Fuel, Cafe, Rest)
        var stopsData = ${stopsJson};
        stopsData.forEach(function(s) {
          var stopIcon = L.divIcon({
            className: 'custom-div-icon',
            html: '<div style="background-color:' + s.color + ';color:white;width:30px;height:30px;border-radius:15px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);font-size:15px;">' + s.emoji + '</div>',
            iconSize: [30, 30],
            iconAnchor: [15, 30]
          });
          L.marker([s.lat, s.lng], { icon: stopIcon })
            .addTo(map)
            .bindPopup('<b>' + s.emoji + ' ' + s.name + '</b><br><small>' + s.type.toUpperCase() + ' STOP</small>');
          bounds.extend([s.lat, s.lng]);
        });

        // 4. ROUTE POLYLINE
        var routeCoords = ${initialRouteJson};
        var routePolyline = null;
        if (routeCoords && routeCoords.length > 0) {
          routePolyline = L.polyline(routeCoords, {
            color: '#FF6B35',
            weight: 6,
            opacity: 0.95,
            lineJoin: 'round'
          }).addTo(map);
          bounds.extend(routePolyline.getBounds());
        }

        // 5. RIDERS MARKERS
        var riderMarkersMap = {};

        function formatDist(m) {
          if (!m && m !== 0) return '0m';
          if (m < 1000) return Math.round(m) + 'm';
          return (m / 1000).toFixed(1) + 'km';
        }

        function createRiderMarker(r) {
          var iconHtml = '';
          if (r.isSelf) {
            iconHtml = '<div class="self-marker"><div class="pulse-ring"></div><div class="self-pin">📍</div></div>';
          } else if (r.role === 'leader') {
            iconHtml = '<div class="leader-pin">👑</div>';
          } else {
            iconHtml = '<div class="member-pin">🏍</div>';
          }

          var icon = L.divIcon({
            className: 'custom-div-icon',
            html: iconHtml,
            iconSize: [36, 36],
            iconAnchor: [18, 18]
          });

          var marker = L.marker([r.lat, r.lng], { icon: icon }).addTo(map);
          marker.bindPopup(getRiderPopupContent(r));
          return marker;
        }

        function getRiderPopupContent(r) {
          var title = r.isSelf ? '📍 You (' + r.name + ')' : (r.role === 'leader' ? '👑 Leader: ' + r.name : '🏍 Rider: ' + r.name);
          var statusText = r.status.replace(/_/g, ' ').toUpperCase();
          var distMe = r.isSelf ? 'Here' : formatDist(r.distanceFromMe) + ' from you';
          var relLeader = (!r.isSelf && r.role !== 'leader')
            ? ('<br><b>Position:</b> ' + (r.relativeToLeader === 'ahead' ? '▲ ' : '▼ ') + formatDist(r.distanceFromLeader) + ' ' + r.relativeToLeader)
            : '';

          return '<div style="font-size:13px;line-height:1.4;">' +
            '<b style="font-size:14px;color:#111;">' + title + '</b><br>' +
            '<b>Status:</b> ' + statusText + '<br>' +
            '<b>Speed:</b> ' + r.speed + ' km/h<br>' +
            '<b>Distance:</b> ' + distMe +
            relLeader +
            '</div>';
        }

        // Initialize riders
        var initialRiders = ${ridersJson};
        initialRiders.forEach(function(r) {
          riderMarkersMap[r.userId] = createRiderMarker(r);
          bounds.extend([r.lat, r.lng]);
        });

        // Fit map initially
        map.fitBounds(bounds, { padding: [45, 45] });

        // Handler for real-time postMessage updates
        var navStepMarker = null;

        window.addEventListener('message', function(event) {
          if (!event.data) return;

          // --- Location updates ---
          if (event.data.type === 'UPDATE_LOCATIONS') {
            var updateList = event.data.riders || [];
            updateList.forEach(function(r) {
              if (riderMarkersMap[r.userId]) {
                riderMarkersMap[r.userId].setLatLng([r.lat, r.lng]);
                riderMarkersMap[r.userId].setPopupContent(getRiderPopupContent(r));
              } else {
                riderMarkersMap[r.userId] = createRiderMarker(r);
              }
            });
          }

          // --- Recenter on user ---
          if (event.data.type === 'RECENTER') {
            var z = event.data.zoom || 16;
            map.flyTo([event.data.lat, event.data.lng], z, { animate: true, duration: 0.8 });
          }

          // --- Nav step: show next turn arrow marker on map ---
          if (event.data.type === 'NAV_STEP') {
            var step = event.data.step;
            if (!step || !step.lat || !step.lng) return;

            var arrowHtml = '<div style="' +
              'background:#1a1f36;color:white;width:36px;height:36px;border-radius:10px;' +
              'display:flex;align-items:center;justify-content:center;font-size:18px;' +
              'border:2px solid #2563eb;box-shadow:0 3px 10px rgba(0,0,0,0.5);">' +
              getArrowEmoji(step.maneuverType, step.maneuverModifier) +
              '</div>';

            var arrowIcon = L.divIcon({
              className: 'custom-div-icon',
              html: arrowHtml,
              iconSize: [36, 36],
              iconAnchor: [18, 18]
            });

            if (navStepMarker) {
              navStepMarker.setLatLng([step.lat, step.lng]);
              navStepMarker.setIcon(arrowIcon);
              navStepMarker.setPopupContent('<b>' + step.instruction + '</b>');
            } else {
              navStepMarker = L.marker([step.lat, step.lng], { icon: arrowIcon })
                .addTo(map)
                .bindPopup('<b>' + step.instruction + '</b>');
            }
          }
        });

        function getArrowEmoji(type, modifier) {
          if (type === 'arrive') return '🏁';
          if (type === 'depart') return '🚀';
          if (type === 'roundabout' || type === 'rotary') return '🔄';
          if (modifier === 'left') return '⬅';
          if (modifier === 'right') return '➡';
          if (modifier === 'slight left') return '↖';
          if (modifier === 'slight right') return '↗';
          if (modifier === 'sharp left') return '↩';
          if (modifier === 'sharp right') return '↪';
          if (modifier === 'uturn') return '🔁';
          return '⬆';
        }

        window.centerOnMe = function() {
          map.flyTo([${myLat}, ${myLng}], 16, { animate: true, duration: 0.8 });
        };

        window.fitFullRoute = function() {
          map.fitBounds(bounds, { padding: [45, 45] });
        };
      </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <iframe
        ref={setIframeRef}
        srcDoc={html}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="RideBy Live Route Map"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
});
