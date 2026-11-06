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
  lastUpdated?: number;
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

const STALE_MS = 60_000;

export const RideMap = forwardRef<any, RideMapProps>(({
  myLat, myLng,
  startLat, startLng, startName = 'Meeting Point',
  destLat, destLng, destName = 'Destination',
  routeCoordinates = [], stops = [], riders = [],
  iframeRef: externalIframeRef,
}, _ref) => {
  const internalRef = useRef<any>(null);
  const iframeReadyRef = useRef(false);
  const pendingMessages = useRef<any[]>([]);

  const setIframeRef = useCallback((el: any) => {
    internalRef.current = el;
    if (externalIframeRef) externalIframeRef.current = el;
  }, [externalIframeRef]);

  const postMsg = useCallback((msg: object) => {
    if (!internalRef.current?.contentWindow) return;
    if (!iframeReadyRef.current) {
      pendingMessages.current.push(msg);
      return;
    }
    try { internalRef.current.contentWindow.postMessage(msg, '*'); } catch (_) {}
  }, []);

  // Listen for INIT_DONE from iframe → flush queued messages
  useEffect(() => {
    const handle = (e: MessageEvent) => {
      if (e.data?.type === 'INIT_DONE') {
        iframeReadyRef.current = true;
        const q = pendingMessages.current.splice(0);
        q.forEach((m) => {
          try { internalRef.current?.contentWindow?.postMessage(m, '*'); } catch (_) {}
        });
      }
    };
    window.addEventListener('message', handle);
    return () => window.removeEventListener('message', handle);
  }, []);

  // Reset ready flag when static props change (new ride)
  useEffect(() => {
    iframeReadyRef.current = false;
    pendingMessages.current = [];
  }, [startLat, startLng, destLat, destLng]);

  // Send live location updates (with stale flag) every time riders/position changes
  useEffect(() => {
    const now = Date.now();
    postMsg({
      type: 'UPDATE_LOCATIONS',
      myLat, myLng,
      riders: riders.map((r) => ({
        userId: r.userId, name: r.name, role: r.role, status: r.status,
        lat: r.lat, lng: r.lng,
        speed: Math.round(r.speed || 0),
        heading: r.heading || 0,
        isSelf: r.isSelf,
        distanceFromMe: r.distanceFromMe,
        distanceFromLeader: r.distanceFromLeader,
        relativeToLeader: r.relativeToLeader,
        isStale: !r.isSelf && r.lastUpdated ? (now - r.lastUpdated > STALE_MS) : false,
        lastUpdated: r.lastUpdated ?? now,
      })),
    });
  }, [myLat, myLng, riders, postMsg]);

  // Send route update when polyline changes mid-ride
  useEffect(() => {
    if (routeCoordinates.length > 0) {
      postMsg({ type: 'UPDATE_ROUTE', coords: routeCoordinates.map((c) => [c.lat, c.lng]) });
    }
  }, [routeCoordinates, postMsg]);

  // Handle REQUEST_CENTER_ON_ME from iframe — reply with live coords
  useEffect(() => {
    const handle = (e: MessageEvent) => {
      if (e.data?.type === 'REQUEST_CENTER_ON_ME') {
        try {
          internalRef.current?.contentWindow?.postMessage(
            { type: 'CENTER_ON_ME', lat: myLat, lng: myLng, zoom: 16 }, '*'
          );
        } catch (_) {}
      }
    };
    window.addEventListener('message', handle);
    return () => window.removeEventListener('message', handle);
  }, [myLat, myLng]);

  // ── Static HTML (created once — NEVER includes myLat/myLng/riders) ──
  const html = useMemo(() => {
    const routeJson = JSON.stringify(routeCoordinates.map((c) => [c.lat, c.lng]));
    const stopsJson = JSON.stringify(stops.map((s) => ({
      id: s.id, name: s.name, type: s.type, lat: s.lat, lng: s.lng,
      emoji: s.type === 'fuel' ? '⛽' : s.type === 'cafe' ? '☕' : '🛑',
      color: s.type === 'fuel' ? '#f59e0b' : s.type === 'cafe' ? '#b45309' : '#3b82f6',
    })));
    const safeStart = startName.replace(/'/g, "\\'");
    const safeDest  = destName.replace(/'/g, "\\'");

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/leaflet-rotate@0.2.8/dist/leaflet-rotate-src.js"></script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body,html,#map{width:100%;height:100%;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
    .custom-div-icon{background:transparent;border:none}

    /* ── Self: pulsing ring ── */
    .self-marker{position:relative;display:flex;align-items:center;justify-content:center}
    .pulse-ring{position:absolute;width:52px;height:52px;border-radius:50%;background:rgba(37,99,235,0.28);animation:pulse 2s infinite ease-out}
    @keyframes pulse{0%{transform:scale(0.5);opacity:1}100%{transform:scale(1.9);opacity:0}}
    .self-pin{width:34px;height:34px;border-radius:17px;background:#2563eb;color:white;border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;z-index:2}

    /* ── Self: directional chevron for Rider View ── */
    .self-arrow{width:44px;height:44px;border-radius:22px;background:white;border:3px solid #e5e7eb;box-shadow:0 2px 12px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center}
    .self-arrow svg{display:block}

    /* ── Leader ── */
    .leader-pin{width:36px;height:36px;border-radius:18px;background:#ea580c;color:white;border:3px solid #fef08a;box-shadow:0 3px 10px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;font-size:17px}

    /* ── Member ── */
    .member-pin{width:32px;height:32px;border-radius:16px;background:#4f46e5;color:white;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:15px}

    /* ── Stale ── */
    .stale-wrap{position:relative}
    .stale-pin{width:30px;height:30px;border-radius:15px;background:#374151;color:#9ca3af;border:2px solid #6b7280;display:flex;align-items:center;justify-content:center;font-size:14px;opacity:0.55}
    .stale-label{position:absolute;top:-16px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.75);color:#fca5a5;font-size:9px;padding:1px 5px;border-radius:4px;white-space:nowrap}

    /* ── Dark popups ── */
    .leaflet-popup-content-wrapper{background:#12172B!important;color:#F9FAFB!important;border:1px solid rgba(255,255,255,0.12)!important;border-radius:14px!important;box-shadow:0 8px 24px rgba(0,0,0,0.6)!important}
    .leaflet-popup-tip{background:#12172B!important}

    /* ── Map controls overlay ── */
    .map-controls{position:absolute;bottom:24px;right:14px;z-index:1000;display:flex;flex-direction:column;gap:8px}
    .ctrl-btn{background:#12172B;border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:9px 13px;font-size:12px;font-weight:700;color:#F9FAFB;box-shadow:0 4px 12px rgba(0,0,0,0.4);cursor:pointer;display:flex;align-items:center;gap:6px;white-space:nowrap;transition:all 0.15s}
    .ctrl-btn:hover{background:#1A2035}
    .ctrl-btn:active{transform:scale(0.96)}
    .ctrl-btn.active{background:#FF6B35;border-color:#FF6B35;color:white}

    /* ── Rider View: TOP instruction banner ── */
    #rv-banner{
      display:none;position:absolute;top:0;left:0;right:0;z-index:1100;
      background:#1B5E20;color:white;
      padding:14px 16px 12px;
      border-bottom-left-radius:12px;border-bottom-right-radius:12px;
      box-shadow:0 4px 20px rgba(0,0,0,0.5);
    }
    #rv-banner.show{display:block}
    .rv-banner-top{display:flex;align-items:center;gap:12px}
    .rv-arrow-box{width:44px;height:44px;background:rgba(255,255,255,0.15);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0}
    .rv-instruction{flex:1}
    .rv-dist{font-size:22px;font-weight:800;line-height:1.1}
    .rv-dist span{font-size:14px;font-weight:600;opacity:0.85}
    .rv-street{font-size:16px;font-weight:600;margin-top:2px;opacity:0.9}

    /* ── Rider View: BOTTOM info bar ── */
    #rv-bottom{
      display:none;position:absolute;bottom:0;left:0;right:0;z-index:1100;
      background:white;border-top-left-radius:14px;border-top-right-radius:14px;
      box-shadow:0 -4px 20px rgba(0,0,0,0.25);padding:14px 16px 20px;
    }
    #rv-bottom.show{display:block}
    .rv-eta-row{display:flex;align-items:center;gap:10px;margin-bottom:6px}
    .rv-eta-time{font-size:28px;font-weight:900;color:#1a7f37;line-height:1}
    .rv-eta-meta{font-size:13px;color:#6b7280;line-height:1.5}
    .rv-dest{font-size:15px;font-weight:700;color:#1f2937;text-align:center}
    .rv-close{width:34px;height:34px;border-radius:17px;background:#f3f4f6;border:none;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;margin-left:auto}

    /* ── Rider View: Street label pill on map ── */
    .street-label{background:#2563eb;color:white;padding:5px 12px;border-radius:20px;font-size:13px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.35)}
  </style>
</head>
<body>
  <div id="map"></div>

  <!-- Map control buttons -->
  <div class="map-controls">
    <button class="ctrl-btn" id="rider-view-btn" onclick="toggleRiderView()">🏍 Rider View</button>
    <button class="ctrl-btn" id="theme-btn" onclick="toggleTheme()">🌙 Dark Map</button>
    <button class="ctrl-btn" onclick="requestCenterOnMe()">📍 My Location</button>
    <button class="ctrl-btn" onclick="fitRoute()">🛣 Whole Route</button>
  </div>

  <!-- Rider View: top instruction banner -->
  <div id="rv-banner">
    <div class="rv-banner-top">
      <div class="rv-arrow-box" id="rv-arrow">⬆</div>
      <div class="rv-instruction">
        <div class="rv-dist" id="rv-dist">—</div>
        <div class="rv-street" id="rv-street">Follow the route</div>
      </div>
    </div>
  </div>

  <!-- Rider View: bottom ETA bar -->
  <div id="rv-bottom">
    <div class="rv-eta-row">
      <div>
        <div class="rv-eta-time" id="rv-eta-time">—</div>
        <div class="rv-eta-meta" id="rv-eta-meta">— km • —</div>
      </div>
      <button class="rv-close" onclick="exitRiderView()" title="Exit Rider View">✕</button>
    </div>
    <div class="rv-dest" id="rv-dest">Destination</div>
  </div>

  <script>
    // ── Map init with rotate plugin ───────────────────────────────
    var rotateSupported = typeof L.Map.mergeOptions === 'function'; // plugin loaded?
    var mapOptions = { zoomControl: false };
    if (rotateSupported) {
      mapOptions.rotate = true;
      mapOptions.bearing = 0;
    }
    var map = L.map('map', mapOptions);

    // ── Tiles: Carto Voyager (default) + Dark Matter ──────────────
    var cartoKey = 'cb1_4uw2_1_70414a8f502607f82f75477d';
    var voyagerUrl = 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key='+cartoKey;
    var darkUrl    = 'https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key='+cartoKey;
    var isDark = false;
    var currentTile = L.tileLayer(voyagerUrl, { maxZoom:19, attribution:'© OSM © CARTO' }).addTo(map);

    window.toggleTheme = function() {
      isDark = !isDark;
      map.removeLayer(currentTile);
      currentTile = L.tileLayer(isDark ? darkUrl : voyagerUrl, { maxZoom:19, attribution:'© OSM © CARTO' }).addTo(map);
      currentTile.bringToBack();
      document.getElementById('theme-btn').innerText = isDark ? '☀️ Voyager Map' : '🌙 Dark Map';
    };

    // ── Static route geometry ────────────────────────────────────
    var bounds = L.latLngBounds([[${startLat},${startLng}],[${destLat},${destLng}]]);

    // Start marker
    L.marker([${startLat},${startLng}], { icon: L.divIcon({
      className:'custom-div-icon',
      html:'<div style="background:#16a34a;color:white;width:34px;height:34px;border-radius:17px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 3px 8px rgba(0,0,0,0.3);font-size:18px;">📍</div>',
      iconSize:[34,34],iconAnchor:[17,34]
    }) }).addTo(map).bindPopup('<b>📍 Start: ${safeStart}</b><br>Meeting Point');

    // Dest marker
    L.marker([${destLat},${destLng}], { icon: L.divIcon({
      className:'custom-div-icon',
      html:'<div style="background:#dc2626;color:white;width:34px;height:34px;border-radius:17px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 3px 8px rgba(0,0,0,0.3);font-size:18px;">🏁</div>',
      iconSize:[34,34],iconAnchor:[17,34]
    }) }).addTo(map).bindPopup('<b>🏁 Finish: ${safeDest}</b><br>Ride Destination');

    // Route
    var routeCoords = ${routeJson};
    var routePolyline = null;
    if (routeCoords && routeCoords.length > 0) {
      routePolyline = L.polyline(routeCoords, { color:'#FF6B35', weight:6, opacity:0.95, lineJoin:'round' }).addTo(map);
      bounds.extend(routePolyline.getBounds());
    }

    // Stops
    var stopsData = ${stopsJson};
    stopsData.forEach(function(s) {
      L.marker([s.lat,s.lng], { icon: L.divIcon({
        className:'custom-div-icon',
        html:'<div style="background:'+s.color+';color:white;width:30px;height:30px;border-radius:15px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);font-size:15px;">'+s.emoji+'</div>',
        iconSize:[30,30],iconAnchor:[15,30]
      }) }).addTo(map).bindPopup('<b>'+s.emoji+' '+s.name+'</b><br><small>'+s.type.toUpperCase()+' STOP</small>');
      bounds.extend([s.lat,s.lng]);
    });

    // ── Rider state ───────────────────────────────────────────────
    var riderMarkersMap = {};
    var selfLat = null, selfLng = null, selfHeading = 0;
    var riderViewActive = false;
    var currentNavInfo = null;
    var streetLabelMarker = null;

    function formatDist(m) {
      if (!m && m !== 0) return '—';
      if (m < 1000) return Math.round(m / 10) * 10 + ' m';
      return (m / 1000).toFixed(1) + ' km';
    }

    // ── Marker helpers ────────────────────────────────────────────
    function getSelfIconHtml(inRiderView) {
      if (inRiderView) {
        // Blue directional chevron like Google Maps
        return '<div class="self-arrow">' +
          '<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">' +
          '<circle cx="14" cy="14" r="13" fill="white" stroke="#e5e7eb" stroke-width="1.5"/>' +
          '<polygon points="14,5 21,22 14,18 7,22" fill="#2563eb"/>' +
          '</svg></div>';
      }
      return '<div class="self-marker"><div class="pulse-ring"></div><div class="self-pin">📍</div></div>';
    }

    function getMarkerHtml(r, inRiderView) {
      if (r.isStale) {
        return '<div class="stale-wrap"><div class="stale-pin">🏍</div><div class="stale-label">offline</div></div>';
      }
      if (r.isSelf)         return getSelfIconHtml(inRiderView);
      if (r.role==='leader') return '<div class="leader-pin">👑</div>';
      return '<div class="member-pin">🏍</div>';
    }

    function getPopupHtml(r) {
      var title = r.isSelf ? '📍 You ('+r.name+')' : r.role==='leader' ? '👑 Leader: '+r.name : '🏍 '+r.name;
      var staleNote = r.isStale ? '<br><span style="color:#ef4444;font-size:11px;">⚠ GPS offline</span>' : '';
      var dist = r.isSelf ? 'Here' : formatDist(r.distanceFromMe)+' from you';
      var rel = (!r.isSelf && r.role!=='leader')
        ? '<br><b>vs Leader:</b> '+(r.relativeToLeader==='ahead'?'▲ ahead ':'▼ behind ')+formatDist(r.distanceFromLeader)
        : '';
      return '<div style="font-size:13px;line-height:1.6;min-width:160px;">'+
             '<b style="font-size:14px;">'+title+'</b>'+staleNote+'<br>'+
             '<b>Speed:</b> '+r.speed+' km/h<br>'+
             '<b>Distance:</b> '+dist+rel+'</div>';
    }

    // ── Smooth marker animation (ease-out cubic) ──────────────────
    function animateMarker(marker, toLat, toLng, ms) {
      var from = marker.getLatLng();
      var t0 = null;
      if (marker._animKey) cancelAnimationFrame(marker._animKey);
      function step(ts) {
        if (!t0) t0 = ts;
        var p = Math.min((ts-t0)/ms, 1);
        var ease = 1 - Math.pow(1-p, 3);
        marker.setLatLng([from.lat+(toLat-from.lat)*ease, from.lng+(toLng-from.lng)*ease]);
        if (p < 1) marker._animKey = requestAnimationFrame(step);
      }
      marker._animKey = requestAnimationFrame(step);
    }

    // ── Create or update rider marker ─────────────────────────────
    function upsertMarker(r) {
      var existing = riderMarkersMap[r.userId];
      var iconHtml = getMarkerHtml(r, riderViewActive && r.isSelf);
      var icon = L.divIcon({ className:'custom-div-icon', html:iconHtml, iconSize:[40,40], iconAnchor:[20,20] });

      if (existing) {
        existing.marker.setIcon(icon);
        animateMarker(existing.marker, r.lat, r.lng, 2500);
        existing.marker.setPopupContent(getPopupHtml(r));
      } else {
        var m = L.marker([r.lat,r.lng],{icon:icon}).addTo(map).bindPopup(getPopupHtml(r));
        riderMarkersMap[r.userId] = { marker:m };
        bounds.extend([r.lat,r.lng]);
      }
    }

    // ── Rider View: map rotation (requires leaflet-rotate plugin) ─
    function applyBearing(bearing) {
      if (map.setBearing) {
        map.setBearing(bearing);
      }
      // Fallback: no rotation if plugin didn't load
    }

    // ── Rider View toggle ─────────────────────────────────────────
    window.toggleRiderView = function() {
      riderViewActive ? exitRiderView() : enterRiderView();
    };

    function enterRiderView() {
      riderViewActive = true;
      var btn = document.getElementById('rider-view-btn');
      btn.classList.add('active');
      btn.innerText = '🗺 Overview';

      document.getElementById('rv-banner').classList.add('show');
      document.getElementById('rv-bottom').classList.add('show');

      // Adjust map padding so banners don't cover the route
      // Top banner ~90px, Bottom bar ~100px
      map.invalidateSize();

      if (selfLat !== null) {
        applyBearing(selfHeading);
        map.flyTo([selfLat, selfLng], 17, { animate:true, duration:1.0 });
      }

      // Update nav info panel
      if (currentNavInfo) updateNavBanner(currentNavInfo);

      // Switch self marker to arrow icon
      var selfEntry = Object.values(riderMarkersMap).find(function(e) {
        return e && e.marker && e.isself;
      });
      // Refresh all markers to pick up rider-view icons
      refreshAllMarkerIcons();
    }

    window.exitRiderView = function() {
      riderViewActive = false;
      var btn = document.getElementById('rider-view-btn');
      btn.classList.remove('active');
      btn.innerText = '🏍 Rider View';

      document.getElementById('rv-banner').classList.remove('show');
      document.getElementById('rv-bottom').classList.remove('show');

      applyBearing(0); // reset to north-up
      if (routePolyline) {
        map.fitBounds(routePolyline.getBounds(), { padding:[45,45] });
      } else {
        map.fitBounds(bounds, { padding:[45,45] });
      }

      // Refresh markers back to normal icons
      refreshAllMarkerIcons();
    };

    function refreshAllMarkerIcons() {
      // Re-draw all cached markers with correct icon for current view mode
      // We don't store the full rider data here, so we do a lightweight icon refresh
      // based on the isSelf flag stored on each entry
      Object.keys(riderMarkersMap).forEach(function(uid) {
        var entry = riderMarkersMap[uid];
        if (!entry) return;
        if (entry.isSelf) {
          var html = getSelfIconHtml(riderViewActive);
          entry.marker.setIcon(L.divIcon({ className:'custom-div-icon', html:html, iconSize:[40,40], iconAnchor:[20,20] }));
        }
      });
    }

    // ── Map drag → disable bearing follow ────────────────────────
    var followMode = true;
    map.on('dragstart', function() { followMode = false; });

    // ── Controls ──────────────────────────────────────────────────
    window.requestCenterOnMe = function() {
      window.parent.postMessage({ type:'REQUEST_CENTER_ON_ME' }, '*');
      followMode = true;
    };

    window.fitRoute = function() {
      applyBearing(0);
      if (routePolyline) {
        map.fitBounds(routePolyline.getBounds(), { padding:[45,45] });
      } else {
        map.fitBounds(bounds, { padding:[45,45] });
      }
      followMode = false;
      if (riderViewActive) exitRiderView();
    };

    // ── Nav banner update ─────────────────────────────────────────
    function getArrow(type, mod) {
      if (type==='arrive')   return '🏁';
      if (type==='depart')   return '⬆';
      if (type==='roundabout'||type==='rotary') return '🔄';
      if (mod==='left')        return '⬅';
      if (mod==='right')       return '➡';
      if (mod==='slight left') return '↖';
      if (mod==='slight right')return '↗';
      if (mod==='sharp left')  return '↩';
      if (mod==='sharp right') return '↪';
      if (mod==='uturn')       return '🔁';
      return '⬆';
    }

    function updateNavBanner(info) {
      // Top banner
      var distText = info.distToNextM < 1000
        ? (Math.round(info.distToNextM/10)*10)+' <span>m</span>'
        : (info.distToNextM/1000).toFixed(1)+' <span>km</span>';
      document.getElementById('rv-dist').innerHTML = distText;
      document.getElementById('rv-street').innerText = info.instruction || 'Follow the route';
      document.getElementById('rv-arrow').innerText = getArrow(info.maneuverType, info.maneuverModifier);

      // Bottom bar
      document.getElementById('rv-eta-time').innerText = info.etaMinutes > 0 ? info.etaMinutes+' min' : '—';
      document.getElementById('rv-eta-meta').innerText = (info.remainingKm||'—')+' km • '+info.etaTime;
      document.getElementById('rv-dest').innerText = info.destName || 'Destination';
    }

    // ── Street label pill (shown on map in rider view) ────────────
    function updateStreetLabel(info, lat, lng) {
      if (!info || !info.instruction) return;
      var labelHtml = '<div class="street-label">'+
        getArrow(info.maneuverType, info.maneuverModifier)+' '+info.instruction+'</div>';
      var icon = L.divIcon({ className:'custom-div-icon', html:labelHtml, iconAnchor:[0,0] });
      if (streetLabelMarker && lat && lng) {
        streetLabelMarker.setLatLng([lat,lng]).setIcon(icon);
      } else if (lat && lng) {
        streetLabelMarker = L.marker([lat,lng],{icon:icon, zIndexOffset:900}).addTo(map);
      }
    }

    // ── NAV step arrow on map ─────────────────────────────────────
    var navStepMarker = null;

    // ── postMessage handler ───────────────────────────────────────
    window.addEventListener('message', function(e) {
      if (!e.data) return;
      var d = e.data;

      // — Live location update —
      if (d.type === 'UPDATE_LOCATIONS') {
        var riders = d.riders || [];

        // Find self
        var self = riders.find(function(r){return r.isSelf;});
        if (self) {
          selfLat = self.lat; selfLng = self.lng; selfHeading = self.heading||0;
        }

        // Update markers
        riders.forEach(function(r) {
          upsertMarker(r);
          // Tag the entry as self for icon refresh
          if (r.isSelf && riderMarkersMap[r.userId]) {
            riderMarkersMap[r.userId].isSelf = true;
          }
        });

        // Rider view: rotate + follow
        if (riderViewActive && selfLat !== null && followMode) {
          applyBearing(selfHeading);
          map.panTo([selfLat, selfLng], { animate:true, duration:0.6 });
        }
      }

      // — Nav info (from React active.tsx) —
      if (d.type === 'NAV_INFO') {
        currentNavInfo = d;
        if (riderViewActive) {
          updateNavBanner(d);
        }
      }

      // — Nav step arrow on map —
      if (d.type === 'NAV_STEP') {
        var step = d.step;
        if (!step||!step.lat||!step.lng) return;
        var arrowHtml = '<div style="background:#1a1f36;color:white;width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;border:2px solid #2563eb;box-shadow:0 3px 10px rgba(0,0,0,0.5);">'+getArrow(step.maneuverType,step.maneuverModifier)+'</div>';
        var arrowIcon = L.divIcon({className:'custom-div-icon',html:arrowHtml,iconSize:[36,36],iconAnchor:[18,18]});
        if (navStepMarker) {
          navStepMarker.setLatLng([step.lat,step.lng]).setIcon(arrowIcon).setPopupContent('<b>'+step.instruction+'</b>');
        } else {
          navStepMarker = L.marker([step.lat,step.lng],{icon:arrowIcon}).addTo(map).bindPopup('<b>'+step.instruction+'</b>');
        }
        // Show street label in rider view
        if (riderViewActive) updateStreetLabel(currentNavInfo, step.lat, step.lng);
      }

      // — Centre on me (reply from React) —
      if (d.type === 'CENTER_ON_ME') {
        followMode = true;
        map.flyTo([d.lat,d.lng], d.zoom||16, {animate:true,duration:0.9});
      }

      // — Manual recenter (turn-by-turn) —
      if (d.type === 'RECENTER') {
        map.flyTo([d.lat,d.lng], d.zoom||16, {animate:true,duration:0.8});
      }

      // — Route update mid-ride —
      if (d.type === 'UPDATE_ROUTE') {
        if (routePolyline) map.removeLayer(routePolyline);
        if (d.coords && d.coords.length > 0) {
          routePolyline = L.polyline(d.coords,{color:'#FF6B35',weight:6,opacity:0.95,lineJoin:'round'}).addTo(map);
        }
      }
    });

    // ── Fit initial bounds, then signal React ─────────────────────
    map.fitBounds(bounds, { padding:[45,45] });
    window.parent.postMessage({ type:'INIT_DONE' }, '*');
  </script>
</body>
</html>`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startLat, startLng, destLat, destLng, startName, destName]);

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
