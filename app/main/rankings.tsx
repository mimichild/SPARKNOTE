import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import type { Store, Category } from '@/types';
import { getStoresFiltered } from '@/db/storeRepository';
import { getAllCategories } from '@/db/categoryRepository';
import StoreCard from '@/components/StoreCard';
import { useSettingsStore } from '@/store/settingsStore';

const ALL_RATINGS = [5, 4, 3, 2, 1];

export default function RankingsScreen() {
  const router = useRouter();
  const themeColor = useSettingsStore((s) => s.themeColor);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedRatings, setSelectedRatings] = useState<number[]>(ALL_RATINGS);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    const cats = await getAllCategories();
    setCategories(cats);
    const result = await getStoresFiltered(selectedRatings, selectedCategoryIds);
    setStores(result);
  }, [selectedRatings, selectedCategoryIds]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleRating = (n: number) => {
    setSelectedRatings((prev) => (prev.includes(n) ? prev.filter((r) => r !== n) : [...prev, n]));
  };

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c]));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/')}>
          <Text style={styles.back}>← 返回首頁</Text>
        </TouchableOpacity>
        <Text style={styles.title}>排行</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.filterRow}>
        {ALL_RATINGS.map((n) => (
          <TouchableOpacity
            key={n}
            style={[styles.chip, selectedRatings.includes(n) && { backgroundColor: themeColor }]}
            onPress={() => toggleRating(n)}
          >
            <Text style={[styles.chipText, selectedRatings.includes(n) && styles.chipTextActive]}>{'♥'.repeat(n)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={categories}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.catFilterRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.chip, selectedCategoryIds.includes(item.id) && { backgroundColor: themeColor }]}
            onPress={() => toggleCategory(item.id)}
          >
            <Text style={[styles.chipText, selectedCategoryIds.includes(item.id) && styles.chipTextActive]}>
              {item.emoji} {item.name}
            </Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={stores}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <StoreCard store={item} category={categoryMap[item.categoryId]} onPress={() => router.push(`/store/${item.id}`)} />
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>沒有符合篩選條件的店家</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  back: { color: '#475569', fontSize: 14 },
  title: { color: '#0f172a', fontSize: 18, fontWeight: '700' },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  catFilterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: {
    backgroundColor: '#f1f5f9', borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 12, marginRight: 8,
  },
  chipText: { color: '#0f172a', fontSize: 13 },
  chipTextActive: { color: '#ffffff' },
  list: { padding: 16, paddingBottom: 40 },
  empty: { color: '#94a3b8', textAlign: 'center', marginTop: 60, fontSize: 15 },
});
