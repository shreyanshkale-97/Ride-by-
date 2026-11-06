import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../src/services/supabase';
import { useAuthStore } from '../src/store/authStore';

export default function RootLayout() {
  const { setSession, fetchProfile } = useAuthStore();

  useEffect(() => {
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        // CRITICAL FIX: Only navigate on SIGNED_IN — NOT on TOKEN_REFRESHED or USER_UPDATED
        // TOKEN_REFRESHED fires every hour during active rides and would kick riders back to home!
        if (event === 'SIGNED_IN' && session?.user) {
          try {
            await fetchProfile(session.user.id);
          } catch (e) {
            console.warn('[Auth] fetchProfile failed:', e);
          }
          router.replace('/(tabs)/home');
        } else if (event === 'SIGNED_OUT') {
          router.replace('/(auth)/login');
        }
        // TOKEN_REFRESHED, USER_UPDATED, INITIAL_SESSION — handled silently
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="ride" />
      </Stack>
    </>
  );
}
