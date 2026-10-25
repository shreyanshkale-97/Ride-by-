import { AppConstants } from '../constants';

// ============================================================
// Haversine distance (meters) between two lat/lng points
// ============================================================
export function calcDistanceM(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================================================
// Bearing (degrees 0-360) from point A to point B
// ============================================================
export function calcBearing(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// ============================================================
// Ahead / Behind relative to the ride leader
// ============================================================
export type RelativePosition = 'ahead' | 'behind' | 'together';

export function getRelativePosition(
  leaderLat: number, leaderLng: number,
  leaderHeading: number,
  riderLat: number, riderLng: number
): RelativePosition {
  const dist = calcDistanceM(leaderLat, leaderLng, riderLat, riderLng);

  if (dist < AppConstants.AHEAD_BEHIND_MIN_DIST_M) return 'together';

  const bearing = calcBearing(leaderLat, leaderLng, riderLat, riderLng);
  const angleDiff = (bearing - leaderHeading + 360) % 360;

  // Within ±90° of leader heading = ahead
  return angleDiff < 90 || angleDiff > 270 ? 'ahead' : 'behind';
}

// ============================================================
// Check if rider is at meeting point
// ============================================================
export function isAtMeetingPoint(
  riderLat: number, riderLng: number,
  meetingLat: number, meetingLng: number
): boolean {
  return calcDistanceM(riderLat, riderLng, meetingLat, meetingLng) <=
    AppConstants.MEETING_POINT_RADIUS_M;
}

// ============================================================
// Linear interpolation for smooth marker animation
// ============================================================
export function lerpLatLng(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
  t: number
): { lat: number; lng: number } {
  const clamped = Math.max(0, Math.min(1, t));
  return {
    lat: fromLat + (toLat - fromLat) * clamped,
    lng: fromLng + (toLng - fromLng) * clamped,
  };
}

// ============================================================
// Format distance for display
// ============================================================
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

// ============================================================
// GPS accuracy / speed spike filter
// ============================================================
export function isValidLocation(
  accuracy: number,
  speedKmh: number,
  prevSpeedKmh?: number
): boolean {
  if (accuracy > AppConstants.MAX_GPS_ACCURACY_M) return false;
  if (prevSpeedKmh !== undefined &&
    Math.abs(speedKmh - prevSpeedKmh) > AppConstants.MAX_SPEED_JUMP_KMH) return false;
  return true;
}

// ============================================================
// Generate unique ride code
// ============================================================
export function generateRideCode(): string {
  const chars = AppConstants.RIDE_CODE_CHARS;
  return Array.from({ length: AppConstants.RIDE_CODE_LENGTH }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

// ============================================================
// Get adaptive broadcast interval based on rider count
// ============================================================
export function getBroadcastInterval(riderCount: number, isStopped: boolean): number {
  if (isStopped) return AppConstants.BROADCAST_INTERVAL_STOPPED_MS;
  return riderCount <= AppConstants.SMALL_GROUP_THRESHOLD
    ? AppConstants.BROADCAST_INTERVAL_SMALL_MS
    : AppConstants.BROADCAST_INTERVAL_LARGE_MS;
}
