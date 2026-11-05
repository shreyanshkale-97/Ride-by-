import React, { forwardRef, useEffect, useRef, useMemo, useCallback } from 'react';
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
  lastUpdated?: number;         // timestamp of last GPS update
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
  iframeRef?: React.MutableRefObject<any>;
}

// ─────────────────────────────────────────────────────────────────
// Stale threshold: if no update in 60s, rider is considered offline
// ─────────────────────────────────────────────────────────────────
const STALE_MS = 60_000;

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
  const iframeReadyRef = useRef(false);
  // Queue to hold messages that arrive before iframe is ready
  const pendingMessages = useRef<any[]>([]);

  // ─── Callback ref: assign to both internal and external ref ───
  const setIframeRef = useCallback((el: any) => {
    internalRef.current = el;
    if (externalIframeRef) externalIframeRef.current = el;
  }, [externalIframeRef]);

  // ─── Helper: post a message, queuing if iframe not ready yet ──
  const postMsg = useCallback((msg: object) => {
    if (!internalRef.current?.contentWindow) return;
    if (!iframeReadyRef.current) {
      // Queue until INIT_DONE received
      pendingMessages.current.push(msg);
      return;
    }
    try {
      internalRef.current.contentWindow.postMessage(msg, '*');
    } catch (_) {}
  }, []);

  // ─── Listen for INIT_DONE from the iframe ─────────────────────
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'INIT_DONE') {
        iframeReadyRef.current = true;
        // Flush all queued messages
        const queue = pendingMessages.current.splice(0);
        queue.forEach((msg) => {
          try {
            internalRef.current?.contentWindow?.postMessage(msg, '*');
          } catch (_) {}
        });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // ─── Reset ready flag when iframe src changes (new ride) ──────
  useEffect(() => {
    iframeReadyRef.current = false;
    pendingMessages.current = [];
  }, [startLat, startLng, destLat, destLng]);

  // ─── Send live location updates via postMessage ───────────────
  // Riders get a `isStale` flag if their last update is > 60s ago
  useEffect(() => {
    const now = Date.now();
    const enrichedRiders = riders.map((r) => ({
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
      // Stale = no update for 60s AND not self
      isStale: !r.isSelf && r.lastUpdated ? (now - r.lastUpdated > STALE_MS) : false,
      lastUpdated: r.lastUpdated ?? now,
    }));

    postMsg({
      type: 'UPDATE_LOCATIONS',
      myLat,
      myLng,
      riders: enrichedRiders,
    });
  }, [myLat, myLng, riders, postMsg]);

  // ─── Static HTML — only baked-in once at mount ───────────────
  // NOTHING live (myLat/myLng/riders) is in this string.
  // All updates go via postMessage so the iframe never reloads.
  const html = useMemo(() => {
    const routeJson = JSON.stringify(routeCoordinates.map((c) => [c.lat, c.lng]));
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
    const safeStart = startName.replace(/'/g, "\\'");
    const safeDest  = destName.replace(/'/g, "\\'");

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body, html, #map { margin:0; padding:0; width:100%; height:100%; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
    .custom-div-icon { background:transparent; border:none; }

    /* — Self marker: pulsing radar ring — */
    .self-marker { position:relative; display:flex; align-items:center; justify-content:center; }
    .pulse-ring {
      position:absolute; width:48px; height:48px; border-radius:50%;
      background:rgba(37,99,235,0.3);
      animation:pulse 2s infinite ease-out;
    }
    @keyframes pulse {
      0%  { transform:scale(0.5); opacity:1; }
      100%{ transform:scale(1.8); opacity:0; }
    }
    .self-pin {
      width:34px; height:34px; border-radius:17px;
      background:#2563eb; color:white;
      border:3px solid white; box-shadow:0 3px 10px rgba(0,0,0,0.4);
      display:flex; align-items:center; justify-content:center;
      font-size:16px; font-weight:900; z-index:2;
    }

    /* — Leader: orange crown — */
    .leader-pin {
      width:36px; height:36px; border-radius:18px;
      background:#ea580c; color:white;
      border:3px solid #fef08a; box-shadow:0 3px 10px rgba(0,0,0,0.45);
      display:flex; align-items:center; justify-content:center; font-size:17px;
    }

    /* — Member: indigo bike — */
    .member-pin {
      width:32px; height:32px; border-radius:16px;
      background:#4f46e5; color:white;
      border:2px solid white; box-shadow:0 2px 8px rgba(0,0,0,0.4);
      display:flex; align-items:center; justify-content:center; font-size:15px;
    }

    /* — Stale / offline rider: greyed out — */
    .stale-pin {
      width:30px; height:30px; border-radius:15px;
      background:#374151; color:#9ca3af;
      border:2px solid #6b7280; box-shadow:0 2px 6px rgba(0,0,0,0.3);
      display:flex; align-items:center; justify-content:center; font-size:14px;
      opacity:0.6;
    }

    /* — Stale label — */
    .stale-label {
      position:absolute; top:-18px; left:50%; transform:translateX(-50%);
      background:rgba(0,0,0,0.7); color:#9ca3af;
      font-size:9px; padding:1px 5px; border-radius:4px; white-space:nowrap;
    }

    /* — Dark popup — */
    .leaflet-popup-content-wrapper {
      background:#12172B !important; color:#F9FAFB !important;
      border:1px solid rgba(255,255,255,0.12) !important;
      border-radius:14px !important; box-shadow:0 8px 24px rgba(0,0,0,0.6) !important;
    }
    .leaflet-popup-tip { background:#12172B !important; }

    /* — Map controls — */
    .map-controls {
      position:absolute; bottom:24px; right:16px; z-index:1000;
      display:flex; flex-direction:column; gap:8px;
    }
    .control-btn {
      background:#12172B; border:1px solid rgba(255,255,255,0.15);
      border-radius:10px; padding:8px 12px;
      font-size:13px; font-weight:700; color:#F9FAFB;
      box-shadow:0 4px 12px rgba(0,0,0,0.4);
      cursor:pointer; display:flex; align-items:center; gap:6px;
    }
    .control-btn:hover { background:#1A2035; }
    .control-btn:active { transform:scale(0.97); }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="map-controls">
    <button class="control-btn" id="theme-btn" onclick="toggleMapTheme()">🌙 Dark Map</button>
    <button class="control-btn" id="center-btn" onclick="requestCenterOnMe()">📍 My Location</button>
    <button class="control-btn" onclick="fitFullRoute()">🛣 Whole Route</button>
  </div>

  <script>
    // ── Map init ─────────────────────────────────────────────────
    var map = L.map('map', { zoomControl: false });
    var cartoKey = 'cb1_4uw2_1_70414a8f502607f82f75477d';
    var voyagerUrl = 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=' + cartoKey;
    var darkUrl    = 'https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key='   + cartoKey;
    var isDark = false;
    var currentTile = L.tileLayer(voyagerUrl, { maxZoom:19, attribution:'© OpenStreetMap © CARTO' }).addTo(map);

    window.toggleMapTheme = function() {
      isDark = !isDark;
      map.removeLayer(currentTile);
      currentTile = L.tileLayer(isDark ? darkUrl : voyagerUrl, { maxZoom:19, attribution:'© OpenStreetMap © CARTO' }).addTo(map);
      currentTile.bringToBack();
      var btn = document.getElementById('theme-btn');
      if (btn) btn.innerText = isDark ? '☀️ Voyager Map' : '🌙 Dark Map';
    };

    // ── Static: start, destination, route, stops ─────────────────
    var bounds = L.latLngBounds([[${startLat},${startLng}],[${destLat},${destLng}]]);

    // Start marker
    L.marker([${startLat},${startLng}], {
      icon: L.divIcon({
        className:'custom-div-icon',
        html:'<div style="background:#16a34a;color:white;width:34px;height:34px;border-radius:17px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 3px 8px rgba(0,0,0,0.3);font-size:18px;">📍</div>',
        iconSize:[34,34], iconAnchor:[17,34]
      })
    }).addTo(map).bindPopup('<b>📍 Start: ${safeStart}</b><br>Meeting Point');

    // Destination marker
    L.marker([${destLat},${destLng}], {
      icon: L.divIcon({
        className:'custom-div-icon',
        html:'<div style="background:#dc2626;color:white;width:34px;height:34px;border-radius:17px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 3px 8px rgba(0,0,0,0.3);font-size:18px;">🏁</div>',
        iconSize:[34,34], iconAnchor:[17,34]
      })
    }).addTo(map).bindPopup('<b>🏁 Finish: ${safeDest}</b><br>Ride Destination');

    // Route polyline
    var routeCoords = ${routeJson};
    var routePolyline = null;
    if (routeCoords && routeCoords.length > 0) {
      routePolyline = L.polyline(routeCoords, {
        color:'#FF6B35', weight:6, opacity:0.95, lineJoin:'round'
      }).addTo(map);
      bounds.extend(routePolyline.getBounds());
    }

    // Stops
    var stopsData = ${stopsJson};
    stopsData.forEach(function(s) {
      var stopMarker = L.marker([s.lat,s.lng], {
        icon: L.divIcon({
          className:'custom-div-icon',
          html:'<div style="background:'+s.color+';color:white;width:30px;height:30px;border-radius:15px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);font-size:15px;">'+s.emoji+'</div>',
          iconSize:[30,30], iconAnchor:[15,30]
        })
      }).addTo(map).bindPopup('<b>'+s.emoji+' '+s.name+'</b><br><small>'+s.type.toUpperCase()+' STOP</small>');
      bounds.extend([s.lat,s.lng]);
    });

    // ── Rider markers (created/updated via postMessage) ───────────
    var riderMarkersMap = {};   // userId → { marker, latLng, animReq }
    var latestMyLat = ${startLat};
    var latestMyLng = ${startLng};

    function formatDist(m) {
      if (!m && m !== 0) return '—';
      if (m < 1000) return Math.round(m) + 'm';
      return (m / 1000).toFixed(1) + 'km';
    }

    function getMarkerHtml(r) {
      if (r.isStale) {
        return '<div style="position:relative;">' +
               '<div class="stale-pin">🏍</div>' +
               '<div class="stale-label">offline</div></div>';
      }
      if (r.isSelf) return '<div class="self-marker"><div class="pulse-ring"></div><div class="self-pin">📍</div></div>';
      if (r.role === 'leader') return '<div class="leader-pin">👑</div>';
      return '<div class="member-pin">🏍</div>';
    }

    function getPopupHtml(r) {
      var title = r.isSelf ? '📍 You (' + r.name + ')' :
                  r.role === 'leader' ? '👑 Leader: ' + r.name : '🏍 ' + r.name;
      var staleNote = r.isStale ? '<br><span style="color:#ef4444;font-size:11px;">⚠ GPS offline</span>' : '';
      var dist = r.isSelf ? 'Here' : formatDist(r.distanceFromMe) + ' from you';
      var rel = (!r.isSelf && r.role !== 'leader')
        ? '<br><b>vs Leader:</b> ' + (r.relativeToLeader === 'ahead' ? '▲ ahead ' : '▼ behind ') + formatDist(r.distanceFromLeader)
        : '';
      return '<div style="font-size:13px;line-height:1.6;">' +
             '<b style="font-size:14px;">' + title + '</b>' + staleNote + '<br>' +
             '<b>Speed:</b> ' + r.speed + ' km/h<br>' +
             '<b>Distance:</b> ' + dist + rel +
             '</div>';
    }

    function createOrUpdateMarker(r) {
      var existing = riderMarkersMap[r.userId];
      if (existing) {
        // Update icon if stale state changed
        existing.marker.setIcon(L.divIcon({
          className:'custom-div-icon',
          html: getMarkerHtml(r),
          iconSize:[36,36], iconAnchor:[18,18]
        }));
        // Smooth animation to new position
        animateMarker(existing.marker, r.lat, r.lng, 2500);
        existing.marker.setPopupContent(getPopupHtml(r));
      } else {
        var marker = L.marker([r.lat, r.lng], {
          icon: L.divIcon({
            className:'custom-div-icon',
            html: getMarkerHtml(r),
            iconSize:[36,36], iconAnchor:[18,18]
          })
        }).addTo(map).bindPopup(getPopupHtml(r));
        riderMarkersMap[r.userId] = { marker: marker };
        bounds.extend([r.lat, r.lng]);
      }
    }

    // ── Smooth marker lerp animation ──────────────────────────────
    // Moves the marker gradually from current → target over durationMs
    function animateMarker(marker, toLat, toLng, durationMs) {
      var from = marker.getLatLng();
      var startTime = null;
      // Cancel any in-flight animation for this marker
      var animKey = marker._animKey;
      if (animKey) cancelAnimationFrame(animKey);

      function step(timestamp) {
        if (!startTime) startTime = timestamp;
        var t = Math.min((timestamp - startTime) / durationMs, 1);
        // Ease-out cubic for natural deceleration
        var ease = 1 - Math.pow(1 - t, 3);
        var lat = from.lat + (toLat - from.lat) * ease;
        var lng = from.lng + (toLng - from.lng) * ease;
        marker.setLatLng([lat, lng]);
        if (t < 1) {
          marker._animKey = requestAnimationFrame(step);
        }
      }
      marker._animKey = requestAnimationFrame(step);
    }

    // ── Map view controls ─────────────────────────────────────────
    var navCentered = false;  // set by RECENTER / CENTER_ON_ME messages

    window.requestCenterOnMe = function() {
      // Ask React for current coords via postMessage reply
      window.parent.postMessage({ type: 'REQUEST_CENTER_ON_ME' }, '*');
    };

    window.fitFullRoute = function() {
      map.fitBounds(bounds, { padding:[45,45] });
      navCentered = false;
    };

    // ── postMessage handler ───────────────────────────────────────
    var navStepMarker = null;

    window.addEventListener('message', function(event) {
      if (!event.data) return;
      var d = event.data;

      // — Live location update —
      if (d.type === 'UPDATE_LOCATIONS') {
        latestMyLat = d.myLat;
        latestMyLng = d.myLng;
        (d.riders || []).forEach(function(r) { createOrUpdateMarker(r); });
        // Auto-follow self if navCentered
        if (navCentered) {
          map.panTo([d.myLat, d.myLng], { animate:true, duration:0.6 });
        }
      }

      // — Center on my current coords (sent by React) —
      if (d.type === 'CENTER_ON_ME') {
        navCentered = true;
        map.flyTo([d.lat, d.lng], d.zoom || 16, { animate:true, duration:0.9 });
      }

      // — Recenter (turn-by-turn navigation) —
      if (d.type === 'RECENTER') {
        map.flyTo([d.lat, d.lng], d.zoom || 16, { animate:true, duration:0.8 });
      }

      // — Manual pan disables auto-follow —
      if (d.type === 'DISABLE_FOLLOW') {
        navCentered = false;
      }

      // — Nav step arrow —
      if (d.type === 'NAV_STEP') {
        var step = d.step;
        if (!step || !step.lat || !step.lng) return;
        var arrowHtml = '<div style="background:#1a1f36;color:white;width:36px;height:36px;border-radius:10px;' +
          'display:flex;align-items:center;justify-content:center;font-size:18px;' +
          'border:2px solid #2563eb;box-shadow:0 3px 10px rgba(0,0,0,0.5);">' +
          getArrowEmoji(step.maneuverType, step.maneuverModifier) + '</div>';
        var arrowIcon = L.divIcon({ className:'custom-div-icon', html:arrowHtml, iconSize:[36,36], iconAnchor:[18,18] });
        if (navStepMarker) {
          navStepMarker.setLatLng([step.lat, step.lng]);
          navStepMarker.setIcon(arrowIcon);
          navStepMarker.setPopupContent('<b>' + step.instruction + '</b>');
        } else {
          navStepMarker = L.marker([step.lat, step.lng], { icon:arrowIcon })
            .addTo(map).bindPopup('<b>' + step.instruction + '</b>');
        }
      }

      // — Route update (if route recalculated mid-ride) —
      if (d.type === 'UPDATE_ROUTE') {
        if (routePolyline) map.removeLayer(routePolyline);
        if (d.coords && d.coords.length > 0) {
          routePolyline = L.polyline(d.coords, { color:'#FF6B35', weight:6, opacity:0.95, lineJoin:'round' }).addTo(map);
        }
      }
    });

    function getArrowEmoji(type, modifier) {
      if (type === 'arrive') return '🏁';
      if (type === 'depart') return '🚀';
      if (type === 'roundabout' || type === 'rotary') return '🔄';
      if (modifier === 'left')        return '⬅';
      if (modifier === 'right')       return '➡';
      if (modifier === 'slight left') return '↖';
      if (modifier === 'slight right')return '↗';
      if (modifier === 'sharp left')  return '↩';
      if (modifier === 'sharp right') return '↪';
      if (modifier === 'uturn')       return '🔁';
      return '⬆';
    }

    // Disable auto-follow when user manually drags the map
    map.on('dragstart', function() {
      navCentered = false;
    });

    // ── Signal React that iframe is fully ready ───────────────────
    // Fit initial bounds, then tell parent to flush queued messages
    map.fitBounds(bounds, { padding:[45,45] });
    window.parent.postMessage({ type: 'INIT_DONE' }, '*');
  </script>
</body>
</html>`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startLat, startLng, destLat, destLng, startName, destName]);
  // ↑ routeCoordinates and stops are intentionally excluded:
  //   they are baked in once at mount. Live route updates go via UPDATE_ROUTE postMessage.

  // ─── Send route update when route coords change mid-ride ──────
  useEffect(() => {
    if (routeCoordinates.length > 0) {
      postMsg({
        type: 'UPDATE_ROUTE',
        coords: routeCoordinates.map((c) => [c.lat, c.lng]),
      });
    }
  }, [routeCoordinates, postMsg]);

  // ─── Handle REQUEST_CENTER_ON_ME from iframe ──────────────────
  // Iframe asks for live coords → React sends them back
  useEffect(() => {
    const handleFromIframe = (event: MessageEvent) => {
      if (event.data?.type === 'REQUEST_CENTER_ON_ME') {
        try {
          internalRef.current?.contentWindow?.postMessage(
            { type: 'CENTER_ON_ME', lat: myLat, lng: myLng, zoom: 16 },
            '*'
          );
        } catch (_) {}
      }
    };
    window.addEventListener('message', handleFromIframe);
    return () => window.removeEventListener('message', handleFromIframe);
  }, [myLat, myLng]);

  return (
    <View style={styles.container}>
      <iframe
        ref={setIframeRef}
        srcDoc={html}
        style={{ width: '100%', height: '100%', border: 'none' } as any}
        title="RideBy Live Route Map"
        sandbox="allow-scripts allow-same-origin"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
});
