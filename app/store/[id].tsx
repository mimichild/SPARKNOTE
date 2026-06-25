import React, { useCallback, useState } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity,
  Linking, StyleSheet, Dimensions, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import type { Store, Category } from '@/types';
import { getStoreById, deleteStore } from '@/db/storeRepository';
import { getAllCategories } from '@/db/categoryRepository';
import HeartRating from '@/components/HeartRating';
import { useSettingsStore } from '@/store/settingsStore';

const { width } = Dimensions.get('window');

export default function StoreDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const themeColor = useSettingsStore((s) => s.themeColor);
  const [store, setStore] = useState<Store | null>(null);
  const [category, setCategory] = useState<Category | undefined>();

  useFocusEffect(useCallback(() => {
    Promise.all([getStoreById(id), getAllCategories()]).then(([s, cats]) => {
      setStore(s);
      setCategory(cats.find((c) => c.id === s?.categoryId));
    });
  }, [id]));

  const handleDelete = () => {
    if (!store) return;
    Alert.alert('刪除店家', `確定要刪除「${store.name}」？`, [
      { text: '取消', style: 'cancel' },
      { text: '刪除', style: 'destructive', onPress: async () => { await deleteStore(store.id); router.back(); } },
    ]);
  };

  if (!store) return null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← 返回</Text>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => router.push({ pathname: '/store/add', params: { storeId: store.id } })}>
            <Text style={[styles.edit, { color: themeColor }]}>編輯</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete}>
            <Text style={styles.delete}>刪除</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {store.photos.length > 0 && (
          <ScrollView horizontal pagingEnabled style={{ height: width * (4 / 3) }}>
            {store.photos.map((uri, i) => (
              <Image
                key={i}
                source={{ uri }}
                style={{ width, height: width * (4 / 3), backgroundColor: '#ffffff' }}
                resizeMode="contain"
              />
            ))}
          </ScrollView>
        )}

        <View style={styles.body}>
          <Text style={styles.name}>{store.name}</Text>
          <HeartRating value={store.rating} themeColor={themeColor} readOnly size={20} />

          {category && <Text style={styles.meta}>{category.emoji} {category.name}</Text>}

          {store.address ? (
            <TouchableOpacity onPress={() => Linking.openURL(`https://maps.google.com/?q=${store.latitude},${store.longitude}`)}>
              <Text style={[styles.address, { color: themeColor }]}>📍 {store.address}</Text>
            </TouchableOpacity>
          ) : null}

          {store.event ? (
            <>
              <Text style={styles.sectionTitle}>事件</Text>
              <Text style={styles.notes}>{store.event}</Text>
            </>
          ) : null}

          {store.notes ? (
            <>
              <Text style={styles.sectionTitle}>備註</Text>
              <Text style={styles.notes}>{store.notes}</Text>
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 16,
  },
  headerActions: { flexDirection: 'row', gap: 16 },
  back: { color: '#475569', fontSize: 16 },
  edit: { fontSize: 16, fontWeight: '600' },
  delete: { fontSize: 16, fontWeight: '600', color: '#ef4444' },
  body: { padding: 20 },
  name: { color: '#0f172a', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  meta: { color: '#64748b', fontSize: 14, marginTop: 8 },
  address: { fontSize: 14, marginTop: 12, fontWeight: '500' },
  sectionTitle: { color: '#94a3b8', fontSize: 12, fontWeight: '600', marginTop: 20, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  notes: { color: '#334155', fontSize: 15, lineHeight: 22 },
});
