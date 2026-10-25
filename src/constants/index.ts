// ============================================================
// RideBy — App Constants
// ============================================================

export const AppConstants = {
  // Location
  MEETING_POINT_RADIUS_M: 100,       // within 100m = "at meeting point"
  STOPPED_SPEED_KMH: 5,              // below this = stopped
  STOPPED_THRESHOLD_SEC: 30,         // seconds before "stopped" label
  MAX_GPS_ACCURACY_M: 20,            // reject GPS readings worse than this
  MAX_SPEED_JUMP_KMH: 200,           // reject GPS spikes
  AHEAD_BEHIND_MIN_DIST_M: 50,       // no label if < 50m from leader
  WARNING_DISTANCE_BEHIND_M: 500,    // show warning if > 500m behind

  // Broadcast intervals (adaptive by rider count)
  BROADCAST_INTERVAL_SMALL_MS: 3000,   // ≤10 riders, moving
  BROADCAST_INTERVAL_LARGE_MS: 5000,   // >10 riders, moving
  BROADCAST_INTERVAL_STOPPED_MS: 20000,// stopped
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

