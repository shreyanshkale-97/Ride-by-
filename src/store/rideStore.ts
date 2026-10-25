import { create } from 'zustand';
import { supabase } from '../services/supabase';
import {
  Ride, RideMember, ChatMessage, LocationPayload,
  PresencePayload, RiderMarker, RideStatus, SosPayload,
} from '../types';
import { AppConstants } from '../constants';
import { RealtimeChannel } from '@supabase/supabase-js';

interface RideState {
  // Current ride
  activeRide: Ride | null;
  members: RideMember[];
  messages: ChatMessage[];

  // Live map data (in-memory, from Broadcast — never from DB)
  riderMarkers: Record<string, RiderMarker>;
  presence: Record<string, PresencePayload>;

  // SOS
  activeSos: SosPayload | null;

  // Channel
  channel: RealtimeChannel | null;

  // Actions
  setActiveRide: (ride: Ride | null) => void;
  setMembers: (members: RideMember[]) => void;
  updateRiderLocation: (payload: LocationPayload, name: string, avatar?: string) => void;
  updatePresence: (presence: Record<string, PresencePayload>) => void;
  setActiveSos: (sos: SosPayload | null) => void;
  setChannel: (channel: RealtimeChannel | null) => void;
  addMessage: (msg: ChatMessage) => void;
  setMessages: (msgs: ChatMessage[]) => void;
  clearRide: () => void;

  // DB actions
  createRide: (data: CreateRideInput) => Promise<{ rideId: string; code: string } | null>;
  joinRide: (userId: string, rideId: string, code: string) => Promise<string | null>;
  endRide: (rideId: string) => Promise<string | null>;
  sendMessage: (rideId: string, userId: string, message: string) => Promise<void>;
  triggerSOS: (rideId: string, userId: string, lat: number, lng: number) => Promise<void>;
}

export interface CreateRideInput {
  creatorId: string;
  name: string;
  meetingName: string;
  meetingLat: number;
  meetingLng: number;
  destinationName: string;
  destinationLat: number;
  destinationLng: number;
  meetingTime?: string;
  description?: string;
  maxMembers?: number;
  startTime?: string;
  endTime?: string;
  joinDeadline?: string;
  estimatedCost?: string;
  stops?: any[];
  totalDistance?: number;
  totalDuration?: string;
  customCode?: string;
}

import { generateRideCode } from '../utils/location';

export const useRideStore = create<RideState>((set, get) => ({
  activeRide: null,
  members: [],
  messages: [],
  riderMarkers: {},
  presence: {},
  activeSos: null,
  channel: null,

  setActiveRide: (ride) => set({ activeRide: ride }),
  setMembers: (members) => set({ members }),
  setChannel: (channel) => set({ channel }),
  setActiveSos: (sos) => set({ activeSos: sos }),
  setMessages: (msgs) => set({ messages: msgs }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

  updateRiderLocation: (payload, name, avatar) => {
    set((state) => ({
      riderMarkers: {
        ...state.riderMarkers,
        [payload.user_id]: {
          user_id: payload.user_id,
          name,
          avatar,
          lat: payload.lat,
          lng: payload.lng,
          speed: payload.speed,
          heading: payload.heading,
          lastUpdated: payload.timestamp,
          memberStatus: payload.speed < AppConstants.STOPPED_SPEED_KMH ? 'stopped' : 'riding',
          isOnline: true,
        },
      },
    }));
  },

  updatePresence: (presence) => set({ presence }),

  clearRide: () => set({
    activeRide: null,
    members: [],
    messages: [],
    riderMarkers: {},
    presence: {},
    activeSos: null,
    channel: null,
  }),

  createRide: async (data) => {
    let code = data.customCode || generateRideCode();
    let attempts = 0;

    while (attempts < 5) {
      const { data: ride, error } = await supabase
        .from('rides')
        .insert({
          creator_id: data.creatorId,
          name: data.name,
          meeting_name: data.meetingName,
          meeting_lat: data.meetingLat,
          meeting_lng: data.meetingLng,
          destination_name: data.destinationName,
          destination_lat: data.destinationLat,
          destination_lng: data.destinationLng,
          meeting_time: data.startTime || data.meetingTime,
          start_time: data.startTime,
          end_time: data.endTime,
          join_deadline: data.joinDeadline,
          description: data.description,
          max_members: data.maxMembers || 20,
          estimated_cost: data.estimatedCost,
          stops: data.stops || [],
          total_distance: data.totalDistance,
          total_duration: data.totalDuration,
          join_code: code,
          status: 'planned',
        })
        .select()
        .single();

      if (error?.code === '23505') {
        // Unique constraint violation — regenerate code
        code = generateRideCode();
        attempts++;
        continue;
      }

      if (error || !ride) {
        console.error('Failed to insert ride in Supabase:', error);
        return null;
      }

      // Insert leader as member
      const { error: memberError } = await supabase.from('ride_members').insert({
        ride_id: ride.id,
        user_id: data.creatorId,
        role: 'leader',
      });

      if (memberError) {
        console.warn('Warning inserting leader as member:', memberError);
      }

      set({ activeRide: ride });
      return { rideId: ride.id, code: ride.join_code };
    }
    return null;
  },

  joinRide: async (userId, rideId, _code) => {
    const { error } = await supabase.from('ride_members').insert({
      ride_id: rideId,
      user_id: userId,
      role: 'member',
    });
    if (error) return error.message;
    return null;
  },

  endRide: async (rideId) => {
    const { error } = await supabase.functions.invoke('ride-transition', {
      body: { ride_id: rideId, target_status: 'completed' },
    });
    if (error) return error.message;
    return null;
  },

  sendMessage: async (rideId, userId, message) => {
    await supabase.from('ride_messages').insert({ ride_id: rideId, user_id: userId, message });
  },

  triggerSOS: async (rideId, userId, lat, lng) => {
    await supabase.from('emergency_events').insert({
      ride_id: rideId, user_id: userId, latitude: lat, longitude: lng,
    });
  },
}));
