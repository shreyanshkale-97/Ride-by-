import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { Profile } from '../types';

interface AuthState {
  user: Profile | null;
  session: any | null;
  loading: boolean;

  // Actions
  setSession: (session: any) => void;
  setUser: (user: Profile | null) => void;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, name: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  fetchProfile: (userId: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,

  setSession: (session) => set({ session }),
  setUser: (user) => set({ user }),

  signIn: async (email, password) => {
    set({ loading: true });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { set({ loading: false }); return error.message; }
    if (data.user) await get().fetchProfile(data.user.id);
    set({ loading: false });
    return null;
  },

  signUp: async (email, password, name) => {
    set({ loading: true });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) { set({ loading: false }); return error.message; }
    if (data.user) await get().fetchProfile(data.user.id);
    set({ loading: false });
    return null;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    // Clear ride store state so stale data doesn't bleed to next user session
    const { useRideStore } = await import('./rideStore');
    useRideStore.getState().clearRide();
    set({ user: null, session: null, loading: false });
  },

  fetchProfile: async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) {
      set({ user: data, loading: false });
    } else {
      // Profile record missing — synthesize fallback so app doesn't hang
      set({
        user: { id: userId, name: 'Rider', created_at: new Date().toISOString() } as Profile,
        loading: false,
      });
    }
  },
}));
