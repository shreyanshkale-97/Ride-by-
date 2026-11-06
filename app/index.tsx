import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../src/services/supabase';
import { useAuthStore } from '../src/store/authStore';

export default function Index() {
  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error || !data?.session?.user) {
          router.replace('/(auth)/login');
        } else {
          // Ensure profile is populated before navigating to home
          useAuthStore.getState().fetchProfile(data.session.user.id).finally(() => {
            router.replace('/(tabs)/home');
          });
        }
      })
      .catch(() => router.replace('/(auth)/login'));
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FF6B35" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0E1A',
  },
});
