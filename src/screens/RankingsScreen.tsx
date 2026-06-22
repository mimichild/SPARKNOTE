// src/screens/RankingsScreen.tsx
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList, Store, Category } from '@/types';
import { getStoresFiltered } from '@/db/storeRepository';
import { getAllCategories } from '@/db/categoryRepository';
import StoreCard from '@/components/StoreCard';
import { useTheme } from '@/context/ThemeContext';

type Nav = StackNavigationProp<RootStackParamList>;

export default function RankingsScreen() {
  const navigation = useNavigation<Nav>();
  const { themeColor } = useTheme();
  const [stores, setStores] = useState<Store[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedRatings, setSelectedRatings] = useState<number[]>([5]);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);

  const load = useCallback(async () => {
    const cats = await getAllCategories();
    setCategories(cats);
    const catIds = selectedCats.length ? selectedCats : cats.map((c) => c.id);
    const s = await getStoresFiltered(selectedRatings, catIds);
    setStores(s);
  }, [selectedRatings, selectedCats]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleRating = (r: number) =>
    setSelectedRatings((prev) =>
      prev.includes(r) ? (prev.length > 1 ? prev.filter((x) => x !== r) : prev) : [...prev, r],
    );

  const toggleCat = (id: string) =>
    setSelectedCats((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c]));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>排行</Text>
      </View>

      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {[5, 4, 3, 2, 1].map((r) => (
            <TouchableOpacity key={r}
              style={[styles.chip, selectedRatings.includes(r) && { backgroundColor: themeColor }]}
              onPress={() => toggleRating(r)}>
              <Text style={styles.chipText}>{'♥'.repeat(r)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {categories.map((cat) => (
            <TouchableOpacity key={cat.id}
              style={[styles.chip, selectedCats.includes(cat.id) && { backgroundColor: themeColor }]}
              onPress={() => toggleCat(cat.id)}>
              <Text style={styles.chipText}>{cat.emoji} {cat.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={stores}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <StoreCard
            store={item}
            category={categoryMap[item.categoryId]}
            onPress={() => navigation.navigate('StoreDetail', { storeId: item.id })}
          />
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>沒有符合條件的店家</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  title: { color: '#f1f5f9', fontSize: 18, fontWeight: '700' },
  filterSection: { paddingTop: 8 },
  filterRow: { paddingHorizontal: 12, marginBottom: 6 },
  chip: {
    backgroundColor: '#1e293b', borderRadius: 8,
    paddingVertical: 5, paddingHorizontal: 12, marginRight: 8,
  },
  chipText: { color: '#f1f5f9', fontSize: 13 },
  list: { padding: 16 },
  empty: { color: '#475569', textAlign: 'center', marginTop: 60, fontSize: 15 },
});
