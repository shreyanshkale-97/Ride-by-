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
let forceRebroadcastTimer: ReturnType<typeof setInterval> | null = null;

// The ACTIVE subscribed channel — must be set by realtimeService after subscription
// so locationService can broadcast on the same channel object (not create new ones)
let activeChannelRef: import('@supabase/supabase-js').RealtimeChannel | null = null;

// Last known good position for forced re-broadcast
let lastKnownLocation: {
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  accuracy: number;
} | null = null;

/** Called by realtimeService after channel.subscribe() succeeds */
export function setActiveChannel(channel: import('@supabase/supabase-js').RealtimeChannel | null) {
  activeChannelRef = channel;
}

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

  // Clear any existing watch + timer
  if (watchSubscription) {
    watchSubscription.remove();
    watchSubscription = null;
  }
  if (forceRebroadcastTimer) {
    clearInterval(forceRebroadcastTimer);
    forceRebroadcastTimer = null;
  }

  try {
    // HIGH ACCURACY: BestForNavigation for most accurate GPS
    watchSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 5000,       // poll every 5s
        distanceInterval: 0,      // trigger on any movement (don't miss small moves)
      },
      (location) => handleLocationUpdate(location)
    );
  } catch (e) {
    console.warn('Watch position async error:', e);
  }

  // FORCE RE-BROADCAST every 15s regardless of GPS movement
  // This ensures all riders stay visible on the map even when stopped
  forceRebroadcastTimer = setInterval(() => {
    if (lastKnownLocation && currentRideId && currentUserId) {
      sendLocationBroadcast(
        lastKnownLocation.lat,
        lastKnownLocation.lng,
        lastKnownLocation.speed,
        lastKnownLocation.heading,
        lastKnownLocation.accuracy
      );
    }
  }, 15000);
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
      timeInterval: 5000,
      distanceInterval: 0,
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
  if (forceRebroadcastTimer) {
    clearInterval(forceRebroadcastTimer);
    forceRebroadcastTimer = null;
  }
  if (Platform.OS !== 'web') {
    try {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    } catch (_) {}
  }
  currentRideId = null;
  currentUserId = null;
  lastKnownLocation = null;
  activeChannelRef = null;
}

// ============================================================
// Core location handler — filter + rate limit + broadcast
// ============================================================
async function handleLocationUpdate(location: Location.LocationObject) {
  if (!currentRideId || !currentUserId) return;

  const { latitude, longitude, accuracy, speed, heading } = location.coords;
  const speedKmh = (speed ?? 0) * 3.6;

  // Filter bad readings — use relaxed threshold (80m)
  if (!isValidLocation(accuracy ?? 999, speedKmh, lastSpeed)) {
    console.log(`[Location] Skipping inaccurate GPS reading: accuracy=${accuracy}m`);
    return;
  }

  // Always store the latest valid position for forced re-broadcasts
  lastKnownLocation = {
    lat: latitude,
    lng: longitude,
    speed: speedKmh,
    heading: heading ?? 0,
    accuracy: accuracy ?? 0,
  };

  const isStopped = speedKmh < AppConstants.STOPPED_SPEED_KMH;
  const interval = getBroadcastInterval(riderCount, isStopped);
  const now = Date.now();

  // Rate-limit event-driven updates (15s minimum gap)
  if (now - lastBroadcastTime < interval) return;
  lastBroadcastTime = now;
  lastSpeed = speedKmh;

  await sendLocationBroadcast(latitude, longitude, speedKmh, heading ?? 0, accuracy ?? 0);
}

// ============================================================
// Send broadcast on the ACTIVE subscribed channel
// ============================================================
async function sendLocationBroadcast(
  lat: number,
  lng: number,
  speed: number,
  heading: number,
  accuracy: number
) {
  if (!currentRideId || !currentUserId) return;

  const payload = {
    user_id: currentUserId,
    lat,
    lng,
    speed,
    heading,
    accuracy,
    timestamp: Date.now(),
  };

  try {
    if (activeChannelRef) {
      // Use the already-subscribed channel (correct approach)
      await activeChannelRef.send({
        type: 'broadcast',
        event: AppConstants.EVENT_LOCATION_UPDATE,
        payload,
      });
    } else {
      // Fallback: create a temporary channel (may not work without subscription)
      // This is kept as a last resort only
      const channel = supabase.channel(`ride:${currentRideId}`);
      await channel.send({
        type: 'broadcast',
        event: AppConstants.EVENT_LOCATION_UPDATE,
        payload,
      });
      console.warn('[Location] Broadcasting on unsubscribed channel — set activeChannel for reliability');
    }
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
      accuracy: Location.Accuracy.BestForNavigation,
    });
  } catch {
    // Fallback to lower accuracy if BestForNavigation fails
    try {
      return await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
    } catch {
      return null;
    }
  }
}
