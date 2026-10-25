// ============================================================
// RideBy — TypeScript types
// ============================================================

export type RideStatus = 'planned' | 'meeting' | 'active' | 'completed' | 'cancelled';
export type MemberRole = 'leader' | 'member';
export type MemberStatus = 'pending' | 'at_meeting_point' | 'riding' | 'stopped' | 'offline';

export interface Profile {
  id: string;
  name: string;
  phone?: string;
  avatar_url?: string;
  fcm_token?: string;
  created_at: string;
}

export interface Ride {
  id: string;
  creator_id: string;
  name: string;
  meeting_name: string;
  meeting_lat: number;
  meeting_lng: number;
  destination_name: string;
  destination_lat: number;
  destination_lng: number;
  meeting_time?: string;
  status: RideStatus;
  join_code: string;
  created_at: string;
  started_at?: string;
  ended_at?: string;
  description?: string;
  max_members?: number;
  start_time?: string;
  end_time?: string;
  join_deadline?: string;
  estimated_cost?: string;
  stops?: any[];
  total_distance?: number;
  total_duration?: string;
}

export interface RideMember {
  id: string;
  ride_id: string;
  user_id: string;
  role: MemberRole;
  status: MemberStatus;
  joined_at: string;
  profile?: Profile;
}

export interface ChatMessage {
  id: string;
  ride_id: string;
  user_id: string;
  message: string;
  created_at: string;
  profile?: Profile;
}

export interface EmergencyEvent {
  id: string;
  ride_id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  created_at: string;
  resolved_at?: string;
  profile?: Profile;
}

export interface RideHistory {
  id: string;
  ride_id: string;
  user_id: string;
  total_distance?: number;
  duration_min?: number;
  member_count?: number;
  created_at: string;
  ride?: Ride;
}

// Realtime broadcast payloads
export interface LocationPayload {
  user_id: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  accuracy: number;
  timestamp: number;
}

export interface PresencePayload {
  user_id: string;
  name: string;
  avatar?: string;
  status: MemberStatus;
}

export interface SosPayload {
  user_id: string;
  name: string;
  lat: number;
  lng: number;
  timestamp: number;
}

export interface RideStatusPayload {
  status: RideStatus;
  ride_id: string;
}

// Derived UI type for map markers
export interface RiderMarker {
  user_id: string;
  name: string;
  avatar?: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  lastUpdated: number;
  memberStatus: MemberStatus;
  isOnline: boolean;
}

// Ride preview from get_ride_by_code RPC
export interface RidePreview {
  ride_id: string;
  ride_name: string;
  meeting_name: string;
  destination_name: string;
  meeting_time?: string;
  status: RideStatus;
  member_count: number;
}
