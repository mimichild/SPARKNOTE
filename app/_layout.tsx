import 'react-native-get-random-values';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { seedCategoriesIfEmpty } from '@/db/categoryRepository';
import { registerBackgroundTask } from '@/tasks/locationTask';

export default function RootLayout() {
  useEffect(() => {
    seedCategoriesIfEmpty();
    registerBackgroundTask();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="store/add" options={{ presentation: 'modal' }} />
          <Stack.Screen name="store/[id]" />
          <Stack.Screen name="category/[id]" />
          <Stack.Screen name="main" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
