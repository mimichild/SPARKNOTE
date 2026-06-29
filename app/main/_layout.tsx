import { Tabs } from 'expo-router';
import { useSettingsStore } from '@/store/settingsStore';

export default function MainTabsLayout() {
  const themeColor = useSettingsStore((s) => s.themeColor);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#ffffff', borderTopColor: '#e5e7eb' },
        tabBarActiveTintColor: themeColor,
        tabBarInactiveTintColor: '#94a3b8',
        tabBarItemStyle: { justifyContent: 'center' },
        tabBarLabelStyle: { fontSize: 17, fontWeight: '700' },
        tabBarIcon: () => null,
      }}
    >
      <Tabs.Screen name="records" options={{ tabBarLabel: '紀錄' }} />
      <Tabs.Screen name="categories" options={{ tabBarLabel: '分類' }} />
      <Tabs.Screen name="rankings" options={{ tabBarLabel: '排行' }} />
    </Tabs>
  );
}
