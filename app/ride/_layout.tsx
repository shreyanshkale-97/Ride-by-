import { Stack } from 'expo-router';

export default function RideLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="plan" />
      <Stack.Screen name="route-preview" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="join" />
      <Stack.Screen name="lobby" />
      <Stack.Screen name="active" />
      <Stack.Screen name="summary" />
    </Stack>
  );
}
