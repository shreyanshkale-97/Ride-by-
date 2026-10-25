import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { AppConstants } from '../constants';
import { isValidLocation, getBroadcastInterval } from '../utils/location';

export const LOCATION_TASK_NAME = 'rideby-background-location';

let lastBroadcastTime = 0;
let lastSpeed = 0;
let currentRideId: string | null = null;
let currentUserId: string | null = null;
let riderCount = 1;
let watchSubscription: Location.LocationSubscription | null = null;

// ============================================================
// Request location permissions (2-step: while-using → always)
// ============================================================
export async function requestForegroundPermission(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    console.warn('Foreground location permission error:', e);
    return true; // Allow graceful fallback
  }
}

export async function requestBackgroundPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  try {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    console.warn('Background location permission not supported:', e);
    return false;
  }
}

// ============================================================
// Start live location broadcasting
// ============================================================
export async function startLocationBroadcast(
  rideId: string,
  userId: string,
  memberCount: number
) {
  currentRideId = rideId;
  currentUserId = userId;
  riderCount = memberCount;
  lastBroadcastTime = 0;

  try {
    if (watchSubscription) {
      watchSubscription.remove();
    }
    // Start foreground location updates
    watchSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 2000,
        distanceInterval: 2,
      },
      (location) => handleLocationUpdate(location)
    );
  } catch (e) {
    console.warn('Watch position async error:', e);
  }
}

// ============================================================
// Define background task (runs when app is backgrounded on mobile)
// ============================================================
if (Platform.OS !== 'web') {
  try {
    TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
      if (error || !data) return;
      const { locations } = data;
      if (locations?.length > 0) {
        await handleLocationUpdate(locations[0]);
      }
    });
  } catch (e) {
    console.warn('TaskManager definition error:', e);
  }
}

export async function startBackgroundLocation(rideId: string, userId: string, memberCount: number) {
  if (Platform.OS === 'web') return;
  currentRideId = rideId;
  currentUserId = userId;
  riderCount = memberCount;

  try {
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 3000,
      distanceInterval: 5,
      foregroundService: {
        notificationTitle: 'RideBy — Ride Active',
        notificationBody: 'Sharing your location with the group',
        notificationColor: '#FF6B35',
      },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });
  } catch (e) {
    console.warn('Start background location error:', e);
  }
}

export async function stopLocationBroadcast() {
  if (watchSubscription) {
    watchSubscription.remove();
    watchSubscription = null;
  }
  if (Platform.OS !== 'web') {
    try {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    } catch (_) {}
  }
  currentRideId = null;
  currentUserId = null;
}

// ============================================================
// Core location handler — filter + rate limit + broadcast
// ============================================================
async function handleLocationUpdate(location: Location.LocationObject) {
  if (!currentRideId || !currentUserId) return;

  const { latitude, longitude, accuracy, speed, heading } = location.coords;
  const speedKmh = (speed ?? 0) * 3.6;

  // Filter bad readings
  if (!isValidLocation(accuracy ?? 999, speedKmh, lastSpeed)) return;

  const isStopped = speedKmh < AppConstants.STOPPED_SPEED_KMH;
  const interval = getBroadcastInterval(riderCount, isStopped);
  const now = Date.now();

  if (now - lastBroadcastTime < interval) return;
  lastBroadcastTime = now;
  lastSpeed = speedKmh;

  // Broadcast (NOT written to DB)
  try {
    const channel = supabase.channel(`ride:${currentRideId}`);
    await channel.send({
      type: 'broadcast',
      event: AppConstants.EVENT_LOCATION_UPDATE,
      payload: {
        user_id: currentUserId,
        lat: latitude,
        lng: longitude,
        speed: speedKmh,
        heading: heading ?? 0,
        accuracy: accuracy ?? 0,
        timestamp: now,
      },
    });
  } catch (e) {
    console.warn('Realtime broadcast location error:', e);
  }
}

// ============================================================
// Get current position once (for lobby / meeting point check)
// ============================================================
export async function getCurrentLocation(): Promise<Location.LocationObject | null> {
  try {
    return await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
  } catch {
    return null;
  }
}
