import { supabase } from './supabase';
import { useRideStore } from '../store/rideStore';
import { AppConstants } from '../constants';
import { LocationPayload, SosPayload, RideStatusPayload, PresencePayload } from '../types';
import { RealtimeChannel } from '@supabase/supabase-js';

let activeChannel: RealtimeChannel | null = null;

// ============================================================
// Subscribe to ride realtime channel
// ============================================================
export function subscribeToRide(
  rideId: string,
  userId: string,
  userName: string,
  userAvatar?: string,
  onStatusChange?: (status: string) => void
): RealtimeChannel {
  // Unsubscribe from any existing channel
  const topic = `realtime:ride:${rideId}`;
  const existing = supabase.getChannels().find((c) => c.topic === topic);
  if (existing) {
    supabase.removeChannel(existing);
  }
  if (activeChannel) {
    supabase.removeChannel(activeChannel);
    activeChannel = null;
  }

  const store = useRideStore.getState();

  const channel = supabase.channel(`ride:${rideId}`, {
    config: { private: true },   // REQUIRED: enables RLS authorization
  });

  channel
    // 1. Receive GPS location updates from other riders
    .on('broadcast', { event: AppConstants.EVENT_LOCATION_UPDATE }, ({ payload }) => {
      const loc = payload as LocationPayload;
      if (loc.user_id === userId) return; // skip own broadcasts

      // Find member name from members list
      const members = useRideStore.getState().members;
      const member = members.find(m => m.user_id === loc.user_id);
      const name = member?.profile?.name ?? 'Rider';
      const avatar = member?.profile?.avatar_url;

      store.updateRiderLocation(loc, name, avatar);
    })

    // 2. Ride status changes (start, end, cancel)
    .on('broadcast', { event: AppConstants.EVENT_RIDE_STATUS_CHANGED }, ({ payload }) => {
      const { status } = payload as RideStatusPayload;
      onStatusChange?.(status);
    })

    // 3. SOS alerts
    .on('broadcast', { event: AppConstants.EVENT_SOS }, ({ payload }) => {
      store.setActiveSos(payload as SosPayload);
    })

    // 4. Presence — who is online
    .on('presence', { event: 'sync' }, () => {
      const presenceState = channel.presenceState<PresencePayload>();
      const flattened: Record<string, PresencePayload> = {};
      Object.values(presenceState).flat().forEach((p) => {
        flattened[p.user_id] = p;
      });
      store.updatePresence(flattened);
    });

  // Subscribe and track own presence
  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({
        user_id: userId,
        name: userName,
        avatar: userAvatar,
        status: 'riding',
      } as PresencePayload);
    }
  });

  activeChannel = channel;
  store.setChannel(channel);
  return channel;
}

// ============================================================
// Broadcast SOS via channel (in addition to DB insert)
// ============================================================
export async function broadcastSOS(
  rideId: string,
  userId: string,
  name: string,
  lat: number,
  lng: number
) {
  const channel = supabase.channel(`ride:${rideId}`);
  await channel.send({
    type: 'broadcast',
    event: AppConstants.EVENT_SOS,
    payload: {
      user_id: userId,
      name,
      lat,
      lng,
      timestamp: Date.now(),
    } as SosPayload,
  });
}

// ============================================================
// Unsubscribe and clean up
// ============================================================
export async function unsubscribeFromRide() {
  if (activeChannel) {
    await activeChannel.untrack();
    await supabase.removeChannel(activeChannel);
    activeChannel = null;
  }
}
