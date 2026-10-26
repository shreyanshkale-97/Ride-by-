// ============================================================
// RideBy — App Constants
// ============================================================

export const AppConstants = {
  // Location
  MEETING_POINT_RADIUS_M: 100,       // within 100m = "at meeting point"
  STOPPED_SPEED_KMH: 5,              // below this = stopped
  STOPPED_THRESHOLD_SEC: 30,         // seconds before "stopped" label
  MAX_GPS_ACCURACY_M: 80,            // reject GPS readings worse than 80m (phones typically 20-50m)
  MAX_SPEED_JUMP_KMH: 200,           // reject GPS spikes
  AHEAD_BEHIND_MIN_DIST_M: 50,       // no label if < 50m from leader
  WARNING_DISTANCE_BEHIND_M: 500,    // show warning if > 500m behind

  // Broadcast intervals — update every 15s for all riders (moving or stopped)
  BROADCAST_INTERVAL_SMALL_MS: 15000,  // ≤10 riders, moving — every 15s
  BROADCAST_INTERVAL_LARGE_MS: 15000,  // >10 riders, moving — every 15s
  BROADCAST_INTERVAL_STOPPED_MS: 15000,// stopped — every 15s (keep map fresh)
  SMALL_GROUP_THRESHOLD: 10,           // rider count threshold

  // Realtime event names
  EVENT_LOCATION_UPDATE: 'location_update',
  EVENT_RIDE_STATUS_CHANGED: 'RIDE_STATUS_CHANGED',
  EVENT_SOS: 'SOS',

  // Map
  DEFAULT_ZOOM: 15,
  MAP_ZOOM_ACTIVE: 14,

  // Ride code
  RIDE_CODE_LENGTH: 6,
  RIDE_CODE_CHARS: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', // no 0/O/1/I/L ambiguity
} as const;

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://sxycrtkgawrxyxzttftb.supabase.co';
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4eWNydGtnYXdyeHl4enR0ZnRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5NDc0MzksImV4cCI6MjEwODUyMzQzOX0.xHcg0hulzD98ZgoeQpRAQhqnIg1yhMma_-XUATEe49s';

// Carto Basemap Tiles & API Key
export const CARTO_API_KEY = 'cb1_4uw2_1_70414a8f502607f82f75477d';
export const CARTO_TILES = {
  VOYAGER: `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CARTO_API_KEY}`,
  DARK_MATTER: `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=${CARTO_API_KEY}`,
  VOYAGER_RETINA: `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png?key=${CARTO_API_KEY}`,
  DARK_RETINA: `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png?key=${CARTO_API_KEY}`,
} as const;

