# SPARKNOTES v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild SPARKNOTES on Expo Router v6 + Zustand per `docs/superpowers/specs/2026-06-23-sparknotes-v2-design.md`, replacing the existing React Navigation + Context implementation in place.

**Architecture:** Expo Router file-based routing (`app/`) for navigation. Zustand (+ persist middleware over AsyncStorage) for theme/settings global state, replacing Context. SQLite via expo-sqlite for stores/categories. A background expo-task-manager task does Haversine distance checks against low-rated stores and fires local notifications. Store location is captured via an embedded `react-native-maps` picker with a draggable marker (no address typing, no Places API). Single light theme only — no dark mode.

**Tech Stack:** Expo SDK 54, Expo Router v6, React Native 0.81.x, TypeScript 5 (strict), Zustand v5, expo-sqlite, @react-native-async-storage/async-storage, expo-location, expo-task-manager, expo-notifications, expo-image-picker, expo-file-system, expo-sharing, expo-document-picker, react-native-maps, Jest + jest-expo + @testing-library/react-native.

## Global Constraints

- Single light theme only; `themeColor` setting controls only the accent color, never background/dark mode (spec §3).
- Store location is captured by draggable-marker map picker; never require manual address text entry; no Google Places API (spec §2, §9).
- Geofencing distance comparisons always use `latitude`/`longitude` (Haversine), never the `address` string (spec §2, §6).
- Required Store fields: `name`, `categoryId`, `rating`, `latitude`, `longitude`. Optional: `photos`, `event`, `notes`, `address` (auto-derived) (spec §2).
- No cloud sync, no user accounts, no social sharing (spec §9).
- Home screen is a standalone landing route, not a tab; the 3 tabs (records/categories/rankings) all show a "←返回首頁" control that exits the tab group back to `index` (spec §4).
- Path alias `@/*` → `./src/*`; tests live under `src/__tests__/**/*.test.(ts|tsx)` (REUSABLE_INFRA.md §2-3).

---

## File Structure

```
app/
├── _layout.tsx              — Root Stack: registers category seed + background task on mount, hosts Stack screens
├── index.tsx                 — HomeScreen
├── settings.tsx               — SettingsScreen
├── store/
│   ├── [id].tsx                — StoreDetailScreen
│   └── add.tsx                  — AddStoreScreen (modal, add+edit)
├── category/
│   └── [id].tsx                 — CategoryDetailScreen
└── main/
    ├── _layout.tsx              — Bottom Tab layout (records/categories/rankings)
    ├── records.tsx               — Tab 1
    ├── categories.tsx            — Tab 2
    └── rankings.tsx               — Tab 3
src/
├── types/index.ts             — Store, Category, AppSettings interfaces
├── utils/
│   ├── haversine.ts             — distance in metres between two coords
│   ├── relativeTime.ts          — ISO → "2天前" formatter
│   └── exportImport.ts          — serialize/parse backup JSON
├── db/
│   ├── database.ts              — SQLite open + schema migration
│   ├── categoryRepository.ts    — CRUD + seed defaults
│   └── storeRepository.ts       — CRUD + search + filter queries
├── store/
│   └── settingsStore.ts          — Zustand store, persisted to AsyncStorage
├── components/
│   ├── HeartRating.tsx           — 5-heart row, tappable or read-only
│   ├── PhotoThumbnail.tsx        — image or dashed placeholder
│   ├── StoreCard.tsx             — list row: thumbnail + name + hearts + time
│   ├── FAB.tsx                    — floating add button
│   └── LocationPickerModal.tsx    — embedded map + draggable marker picker
├── tasks/
│   └── locationTask.ts            — background geofence + notification logic
└── __mocks__/
    ├── async-storage.ts
    ├── expo-file-system.ts
    └── expo-sqlite.ts
src/__tests__/
├── utils/haversine.test.ts
├── utils/relativeTime.test.ts
├── utils/exportImport.test.ts
├── db/categoryRepository.test.ts
├── db/storeRepository.test.ts
├── store/settingsStore.test.ts
└── components/HeartRating.test.tsx
```

---

## Task 1: Project Scaffold (Expo Router + Reusable Infra)

**Files:**
- Remove: `App.tsx`, `babel.config.js`, `index.ts`, `app.json`, `package.json`, `package-lock.json`, `tsconfig.json`, `jest.config.js`, `src/` (all old contents), `__tests__/` (old root-level tests)
- Create: `package.json`, `app.json`, `babel.config.js`, `tsconfig.json`, `src/__mocks__/async-storage.ts`, `src/__mocks__/expo-file-system.ts`, `src/__mocks__/expo-sqlite.ts`, `app/_layout.tsx`, `app/index.tsx`

- [ ] **Step 1: Remove legacy React Navigation project files**

```bash
git rm -r App.tsx babel.config.js index.ts app.json package.json package-lock.json tsconfig.json jest.config.js src __tests__
```

Expected: files staged for deletion. (`docs/`, `assets/`, `.claude/`, `LICENSE`, `AGENTS.md`, `CLAUDE.md` are untouched.)

- [ ] **Step 2: Scaffold a blank TypeScript Expo project**

```bash
npx create-expo-app@latest . --template blank-typescript --yes
```

Expected: `App.tsx`, `package.json`, `tsconfig.json`, `app.json` regenerated.

- [ ] **Step 3: Install Expo Router and its peer dependencies**

```bash
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
```

- [ ] **Step 4: Install feature dependencies**

```bash
npx expo install expo-sqlite @react-native-async-storage/async-storage expo-location expo-task-manager expo-notifications expo-image-picker expo-file-system expo-sharing expo-document-picker react-native-maps react-native-gesture-handler react-native-reanimated
```

- [ ] **Step 5: Install state management and id generation**

```bash
npm install zustand uuid
```

- [ ] **Step 6: Install test tooling**

```bash
npm install --save-dev jest jest-expo @testing-library/react-native @testing-library/jest-native @types/jest @types/uuid
```

- [ ] **Step 7: Remove the blank-typescript entry files (Expo Router replaces them)**

```bash
git rm -f App.tsx index.ts 2>/dev/null || rm -f App.tsx index.ts
```

- [ ] **Step 8: Edit `package.json` — set router entry, add jest config**

Open `package.json`. Set `"main"` and add a top-level `"jest"` key (keep the `dependencies`/`devDependencies` that the install steps above already wrote):

```json
{
  "main": "expo-router/entry",
  "jest": {
    "preset": "jest-expo",
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|zustand)"
    ],
    "moduleNameMapper": {
      "^expo-sqlite$": "<rootDir>/src/__mocks__/expo-sqlite.ts",
      "^expo-file-system$": "<rootDir>/src/__mocks__/expo-file-system.ts",
      "^@react-native-async-storage/async-storage$": "<rootDir>/src/__mocks__/async-storage.ts"
    },
    "testMatch": [
      "<rootDir>/src/__tests__/**/*.test.(ts|tsx)"
    ],
    "collectCoverageFrom": [
      "src/**/*.{ts,tsx}",
      "!src/__mocks__/**",
      "!src/__tests__/**"
    ]
  }
}
```

- [ ] **Step 9: Write `tsconfig.json`**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.ts",
    "expo-env.d.ts"
  ],
  "exclude": [
    "node_modules",
    "src/__mocks__",
    "src/__tests__"
  ]
}
```

- [ ] **Step 10: Write `app.json`**

```json
{
  "expo": {
    "name": "SPARKNOTES",
    "slug": "sparknotes",
    "scheme": "sparknotes",
    "orientation": "portrait",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "android": {
      "package": "com.sparknotes.app",
      "edgeToEdgeEnabled": true,
      "predictiveBackGestureEnabled": false,
      "permissions": ["ACCESS_BACKGROUND_LOCATION", "ACCESS_FINE_LOCATION"]
    },
    "ios": {
      "bundleIdentifier": "com.sparknotes.app",
      "infoPlist": {
        "NSLocationAlwaysAndWhenInUseUsageDescription": "需要定位權限以提供雷店接近提醒",
        "NSLocationWhenInUseUsageDescription": "需要定位權限以記錄店家位置"
      }
    },
    "web": {
      "output": "static"
    },
    "plugins": [
      "expo-router",
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "需要定位權限以提供雷店接近提醒"
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

- [ ] **Step 11: Create folder structure**

```bash
mkdir -p src/{types,utils,db,store,components,tasks,__mocks__}
mkdir -p src/__tests__/{utils,db,store,components}
mkdir -p app/store app/category app/main
```

- [ ] **Step 12: Write native module mocks**

```typescript
// src/__mocks__/async-storage.ts
const store: Record<string, string> = {};

const AsyncStorage = {
  getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
  setItem: jest.fn((key: string, value: string) => { store[key] = value; return Promise.resolve(); }),
  removeItem: jest.fn((key: string) => { delete store[key]; return Promise.resolve(); }),
  clear: jest.fn(() => { Object.keys(store).forEach(k => delete store[k]); return Promise.resolve(); }),
  getAllKeys: jest.fn(() => Promise.resolve(Object.keys(store))),
  multiGet: jest.fn((keys: string[]) => Promise.resolve(keys.map(k => [k, store[k] ?? null]))),
  multiSet: jest.fn((pairs: [string, string][]) => { pairs.forEach(([k, v]) => { store[k] = v; }); return Promise.resolve(); }),
  __store: store,
};

export default AsyncStorage;
```

```typescript
// src/__mocks__/expo-file-system.ts
export const documentDirectory = '/mock/documents/';
export const cacheDirectory = '/mock/cache/';

export const getInfoAsync = jest.fn().mockResolvedValue({ exists: false, isDirectory: false });
export const makeDirectoryAsync = jest.fn().mockResolvedValue(undefined);
export const copyAsync = jest.fn().mockResolvedValue(undefined);
export const deleteAsync = jest.fn().mockResolvedValue(undefined);
export const readAsStringAsync = jest.fn().mockResolvedValue('');
export const writeAsStringAsync = jest.fn().mockResolvedValue(undefined);
export const readDirectoryAsync = jest.fn().mockResolvedValue([]);
export const moveAsync = jest.fn().mockResolvedValue(undefined);

export const EncodingType = { Base64: 'base64', UTF8: 'utf8' };
```

```typescript
// src/__mocks__/expo-sqlite.ts
const mockDb = {
  execAsync: jest.fn().mockResolvedValue(undefined),
  runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
  getFirstAsync: jest.fn().mockResolvedValue(null),
  getAllAsync: jest.fn().mockResolvedValue([]),
  closeAsync: jest.fn().mockResolvedValue(undefined),
};

export const openDatabaseAsync = jest.fn().mockResolvedValue(mockDb);

export { mockDb as __mockDb };
```

- [ ] **Step 13: Write minimal root layout and home placeholder so the router boots**

```typescript
// app/_layout.tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

```typescript
// app/index.tsx
import { View, Text } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' }}>
      <Text>SPARKNOTES</Text>
    </View>
  );
}
```

- [ ] **Step 14: Verify the project compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -m "chore: rebuild scaffold on Expo Router v6 + Zustand"
```

---

## Task 2: Types

**Files:**
- Create: `src/types/index.ts`

**Interfaces:**
- Produces: `Store`, `Category`, `AppSettings` interfaces consumed by every later task.

- [ ] **Step 1: Write types**

```typescript
// src/types/index.ts
export interface Store {
  id: string;
  name: string;
  categoryId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  latitude: number;
  longitude: number;
  address: string;        // auto-derived via reverse geocoding, never typed by the user
  photos: string[];       // local file URIs
  event: string;          // free text: what happened on this visit
  notes: string;
  createdAt: string;      // ISO 8601
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  order: number;
}

export interface AppSettings {
  themeColor: string;              // hex, accent color only — never background/dark mode
  radarEnabled: boolean;
  radarRatingThreshold: number;    // stores with rating <= this trigger the radar
  radarRadiusMeters: number;
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add Store, Category, AppSettings types"
```

---

## Task 3: Utility Functions — haversine & relativeTime (TDD)

**Files:**
- Create: `src/utils/haversine.ts`, `src/utils/relativeTime.ts`
- Test: `src/__tests__/utils/haversine.test.ts`, `src/__tests__/utils/relativeTime.test.ts`

**Interfaces:**
- Produces: `haversineMeters(lat1, lon1, lat2, lon2): number`, `relativeTime(iso: string): string`

- [ ] **Step 1: Write haversine test**

```typescript
// src/__tests__/utils/haversine.test.ts
import { haversineMeters } from '@/utils/haversine';

test('same point returns 0', () => {
  expect(haversineMeters(25.033, 121.564, 25.033, 121.564)).toBe(0);
});

test('Taipei to ~1km north is roughly 1000m', () => {
  const d = haversineMeters(25.033, 121.564, 25.042, 121.564);
  expect(d).toBeGreaterThan(900);
  expect(d).toBeLessThan(1100);
});

test('returns number type', () => {
  expect(typeof haversineMeters(0, 0, 0, 1)).toBe('number');
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx jest src/__tests__/utils/haversine.test.ts
```

Expected: `Cannot find module '@/utils/haversine'`

- [ ] **Step 3: Implement haversine**

```typescript
// src/utils/haversine.ts
export function haversineMeters(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx jest src/__tests__/utils/haversine.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Write relativeTime test**

```typescript
// src/__tests__/utils/relativeTime.test.ts
import { relativeTime } from '@/utils/relativeTime';

test('under 1 minute returns "剛剛"', () => {
  const now = new Date().toISOString();
  expect(relativeTime(now)).toBe('剛剛');
});

test('2 days ago returns "2天前"', () => {
  const d = new Date(Date.now() - 2 * 86_400_000).toISOString();
  expect(relativeTime(d)).toBe('2天前');
});

test('1 hour ago returns "1小時前"', () => {
  const d = new Date(Date.now() - 3_600_000).toISOString();
  expect(relativeTime(d)).toBe('1小時前');
});

test('30 days ago returns "1個月前"', () => {
  const d = new Date(Date.now() - 30 * 86_400_000).toISOString();
  expect(relativeTime(d)).toBe('1個月前');
});
```

- [ ] **Step 6: Run — expect FAIL**

```bash
npx jest src/__tests__/utils/relativeTime.test.ts
```

- [ ] **Step 7: Implement relativeTime**

```typescript
// src/utils/relativeTime.ts
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return '剛剛';
  if (mins < 60) return `${mins}分鐘前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小時前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}個月前`;
  return `${Math.floor(months / 12)}年前`;
}
```

- [ ] **Step 8: Run — expect PASS**

```bash
npx jest src/__tests__/utils/relativeTime.test.ts
```

- [ ] **Step 9: Commit**

```bash
git add src/utils/haversine.ts src/utils/relativeTime.ts src/__tests__/utils/haversine.test.ts src/__tests__/utils/relativeTime.test.ts
git commit -m "feat: add haversine distance and relativeTime utils with tests"
```

---

## Task 4: Settings Store — Zustand + persist (TDD)

**Files:**
- Create: `src/store/settingsStore.ts`
- Test: `src/__tests__/store/settingsStore.test.ts`

**Interfaces:**
- Consumes: `AppSettings` from `src/types/index.ts` (Task 2)
- Produces: `useSettingsStore` Zustand hook exposing `themeColor`, `radarEnabled`, `radarRatingThreshold`, `radarRadiusMeters`, `setThemeColor(color: string)`, `setRadarEnabled(v: boolean)`, `setRadarRatingThreshold(n: number)`, `setRadarRadiusMeters(n: number)`. Later tasks read settings via `useSettingsStore()` and the background task reads via `useSettingsStore.getState()`.

- [ ] **Step 1: Write test**

```typescript
// src/__tests__/store/settingsStore.test.ts
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@/__mocks__/async-storage'),
);

import { useSettingsStore } from '@/store/settingsStore';

test('has correct default values', () => {
  const state = useSettingsStore.getState();
  expect(state.themeColor).toBe('#6c63ff');
  expect(state.radarEnabled).toBe(true);
  expect(state.radarRatingThreshold).toBe(2);
  expect(state.radarRadiusMeters).toBe(500);
});

test('setThemeColor updates themeColor', () => {
  useSettingsStore.getState().setThemeColor('#ef4444');
  expect(useSettingsStore.getState().themeColor).toBe('#ef4444');
});

test('setRadarEnabled updates radarEnabled', () => {
  useSettingsStore.getState().setRadarEnabled(false);
  expect(useSettingsStore.getState().radarEnabled).toBe(false);
});

test('setRadarRatingThreshold updates radarRatingThreshold', () => {
  useSettingsStore.getState().setRadarRatingThreshold(1);
  expect(useSettingsStore.getState().radarRatingThreshold).toBe(1);
});

test('setRadarRadiusMeters updates radarRadiusMeters', () => {
  useSettingsStore.getState().setRadarRadiusMeters(300);
  expect(useSettingsStore.getState().radarRadiusMeters).toBe(300);
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx jest src/__tests__/store/settingsStore.test.ts
```

Expected: `Cannot find module '@/store/settingsStore'`

- [ ] **Step 3: Implement settingsStore**

```typescript
// src/store/settingsStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppSettings } from '@/types';

interface SettingsState extends AppSettings {
  setThemeColor: (color: string) => void;
  setRadarEnabled: (v: boolean) => void;
  setRadarRatingThreshold: (n: number) => void;
  setRadarRadiusMeters: (n: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      themeColor: '#6c63ff',
      radarEnabled: true,
      radarRatingThreshold: 2,
      radarRadiusMeters: 500,
      setThemeColor: (color) => set({ themeColor: color }),
      setRadarEnabled: (v) => set({ radarEnabled: v }),
      setRadarRatingThreshold: (n) => set({ radarRatingThreshold: n }),
      setRadarRadiusMeters: (n) => set({ radarRadiusMeters: n }),
    }),
    {
      name: 'app_settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx jest src/__tests__/store/settingsStore.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/store/settingsStore.ts src/__tests__/store/settingsStore.test.ts
git commit -m "feat: add Zustand settings store with AsyncStorage persistence"
```

---

## Task 5: Database Layer — categories + stores repositories (TDD)

**Files:**
- Create: `src/db/database.ts`, `src/db/categoryRepository.ts`, `src/db/storeRepository.ts`
- Test: `src/__tests__/db/categoryRepository.test.ts`, `src/__tests__/db/storeRepository.test.ts`

**Interfaces:**
- Consumes: `Store`, `Category` from `src/types/index.ts` (Task 2)
- Produces: `getDb(): Promise<SQLite.SQLiteDatabase>`; category repo: `seedCategoriesIfEmpty()`, `getAllCategories()`, `insertCategory(name, emoji)`, `updateCategory(id, name, emoji)`, `deleteCategory(id)`; store repo: `getAllStores()`, `getStoreById(id)`, `searchStores(query)`, `getStoresByCategory(categoryId, order)`, `getStoresFiltered(ratings, categoryIds)`, `getLowRatedStores(threshold)`, `insertStore(data)`, `updateStore(id, data)`, `deleteStore(id)`.

- [ ] **Step 1: Write database.ts**

```typescript
// src/db/database.ts
import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('sparknotes.db');
  await migrate(_db);
  return _db;
}

async function migrate(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL,
      "order" INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      categoryId TEXT NOT NULL,
      rating INTEGER NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      photos TEXT NOT NULL DEFAULT '[]',
      event TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL
    );
  `);
}
```

- [ ] **Step 2: Write categoryRepository.ts**

```typescript
// src/db/categoryRepository.ts
import { v4 as uuid } from 'uuid';
import { getDb } from './database';
import type { Category } from '@/types';

const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: '餐廳',   emoji: '🍽',  order: 0 },
  { name: '咖啡廳', emoji: '☕',  order: 1 },
  { name: '飲料店', emoji: '🧋',  order: 2 },
  { name: '服飾',   emoji: '👗',  order: 3 },
  { name: '甜點店', emoji: '🍰',  order: 4 },
];

export async function seedCategoriesIfEmpty(): Promise<void> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ count: number }>('SELECT COUNT(*) as count FROM categories');
  if (rows[0].count > 0) return;
  for (const cat of DEFAULT_CATEGORIES) {
    await db.runAsync(
      'INSERT INTO categories (id, name, emoji, "order") VALUES (?, ?, ?, ?)',
      [uuid(), cat.name, cat.emoji, cat.order],
    );
  }
}

export async function getAllCategories(): Promise<Category[]> {
  const db = await getDb();
  return db.getAllAsync<Category>('SELECT * FROM categories ORDER BY "order" ASC');
}

export async function insertCategory(name: string, emoji: string): Promise<Category> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ max: number | null }>('SELECT MAX("order") as max FROM categories');
  const order = (rows[0].max ?? -1) + 1;
  const id = uuid();
  await db.runAsync(
    'INSERT INTO categories (id, name, emoji, "order") VALUES (?, ?, ?, ?)',
    [id, name, emoji, order],
  );
  return { id, name, emoji, order };
}

export async function updateCategory(id: string, name: string, emoji: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE categories SET name = ?, emoji = ? WHERE id = ?', [name, emoji, id]);
}

export async function deleteCategory(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM categories WHERE id = ?', [id]);
}
```

- [ ] **Step 3: Write categoryRepository test**

```typescript
// src/__tests__/db/categoryRepository.test.ts
jest.mock('expo-sqlite');
jest.mock('@/db/database', () => ({ getDb: jest.fn() }));

import { getDb } from '@/db/database';
import {
  seedCategoriesIfEmpty, getAllCategories, insertCategory, updateCategory, deleteCategory,
} from '@/db/categoryRepository';

const mockDb = { getAllAsync: jest.fn(), runAsync: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  (getDb as jest.Mock).mockResolvedValue(mockDb);
});

test('seedCategoriesIfEmpty inserts 5 defaults when table is empty', async () => {
  mockDb.getAllAsync.mockResolvedValue([{ count: 0 }]);
  await seedCategoriesIfEmpty();
  expect(mockDb.runAsync).toHaveBeenCalledTimes(5);
});

test('seedCategoriesIfEmpty does nothing when categories already exist', async () => {
  mockDb.getAllAsync.mockResolvedValue([{ count: 3 }]);
  await seedCategoriesIfEmpty();
  expect(mockDb.runAsync).not.toHaveBeenCalled();
});

test('getAllCategories orders by "order" ascending', async () => {
  mockDb.getAllAsync.mockResolvedValue([]);
  await getAllCategories();
  expect(mockDb.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('ORDER BY "order" ASC'));
});

test('insertCategory returns category with generated id', async () => {
  mockDb.getAllAsync.mockResolvedValue([{ max: 4 }]);
  mockDb.runAsync.mockResolvedValue(undefined);
  const cat = await insertCategory('運動用品', '🏋️');
  expect(cat.id).toBeTruthy();
  expect(cat.order).toBe(5);
});

test('updateCategory calls UPDATE with correct params', async () => {
  mockDb.runAsync.mockResolvedValue(undefined);
  await updateCategory('c1', '新名稱', '🆕');
  expect(mockDb.runAsync).toHaveBeenCalledWith(
    'UPDATE categories SET name = ?, emoji = ? WHERE id = ?', ['新名稱', '🆕', 'c1'],
  );
});

test('deleteCategory calls DELETE with correct id', async () => {
  mockDb.runAsync.mockResolvedValue(undefined);
  await deleteCategory('c1');
  expect(mockDb.runAsync).toHaveBeenCalledWith('DELETE FROM categories WHERE id = ?', ['c1']);
});
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx jest src/__tests__/db/categoryRepository.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Write storeRepository.ts**

```typescript
// src/db/storeRepository.ts
import { v4 as uuid } from 'uuid';
import { getDb } from './database';
import type { Store } from '@/types';

function rowToStore(row: any): Store {
  return { ...row, photos: JSON.parse(row.photos) };
}

export async function getAllStores(): Promise<Store[]> {
  const db = await getDb();
  const rows = await db.getAllAsync('SELECT * FROM stores ORDER BY createdAt DESC');
  return rows.map(rowToStore);
}

export async function getStoreById(id: string): Promise<Store | null> {
  const db = await getDb();
  const rows = await db.getAllAsync('SELECT * FROM stores WHERE id = ?', [id]);
  return rows.length ? rowToStore(rows[0]) : null;
}

export async function searchStores(query: string): Promise<Store[]> {
  const db = await getDb();
  const rows = await db.getAllAsync(
    'SELECT * FROM stores WHERE name LIKE ? ORDER BY createdAt DESC',
    [`%${query}%`],
  );
  return rows.map(rowToStore);
}

export async function getStoresByCategory(categoryId: string, order: 'desc' | 'asc' = 'desc'): Promise<Store[]> {
  const db = await getDb();
  const dir = order === 'desc' ? 'DESC' : 'ASC';
  const rows = await db.getAllAsync(
    `SELECT * FROM stores WHERE categoryId = ? ORDER BY createdAt ${dir}`,
    [categoryId],
  );
  return rows.map(rowToStore);
}

export async function getStoresFiltered(ratings: number[], categoryIds: string[]): Promise<Store[]> {
  const db = await getDb();
  const rPlaceholders = ratings.map(() => '?').join(',');
  const params: any[] = [...ratings];
  let sql = `SELECT * FROM stores WHERE rating IN (${rPlaceholders})`;
  if (categoryIds.length > 0) {
    const cPlaceholders = categoryIds.map(() => '?').join(',');
    sql += ` AND categoryId IN (${cPlaceholders})`;
    params.push(...categoryIds);
  }
  sql += ' ORDER BY rating DESC, createdAt DESC';
  const rows = await db.getAllAsync(sql, params);
  return rows.map(rowToStore);
}

export async function getLowRatedStores(threshold: number): Promise<Store[]> {
  const db = await getDb();
  const rows = await db.getAllAsync('SELECT * FROM stores WHERE rating <= ?', [threshold]);
  return rows.map(rowToStore);
}

export async function insertStore(data: Omit<Store, 'id' | 'createdAt'>): Promise<Store> {
  const db = await getDb();
  const id = uuid();
  const createdAt = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO stores (id, name, categoryId, rating, latitude, longitude, address, photos, event, notes, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.name, data.categoryId, data.rating, data.latitude, data.longitude,
     data.address, JSON.stringify(data.photos), data.event, data.notes, createdAt],
  );
  return { ...data, id, createdAt };
}

export async function updateStore(id: string, data: Omit<Store, 'id' | 'createdAt'>): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE stores SET name=?, categoryId=?, rating=?, latitude=?, longitude=?,
     address=?, photos=?, event=?, notes=? WHERE id=?`,
    [data.name, data.categoryId, data.rating, data.latitude, data.longitude,
     data.address, JSON.stringify(data.photos), data.event, data.notes, id],
  );
}

export async function deleteStore(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM stores WHERE id = ?', [id]);
}
```

- [ ] **Step 6: Write storeRepository test**

```typescript
// src/__tests__/db/storeRepository.test.ts
jest.mock('expo-sqlite');
jest.mock('@/db/database', () => ({ getDb: jest.fn() }));

import { getDb } from '@/db/database';
import {
  getAllStores, insertStore, deleteStore, searchStores, getLowRatedStores, getStoresFiltered,
} from '@/db/storeRepository';

const mockDb = { getAllAsync: jest.fn(), runAsync: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  (getDb as jest.Mock).mockResolvedValue(mockDb);
});

const baseStore = {
  name: '路易莎', categoryId: 'cat-1', rating: 5 as const,
  latitude: 25.03, longitude: 121.5, address: '台北市',
  photos: [], event: '', notes: '',
};

test('getAllStores parses photos JSON', async () => {
  mockDb.getAllAsync.mockResolvedValue([
    { ...baseStore, id: '1', createdAt: '2026-01-01T00:00:00Z', photos: '[]' },
  ]);
  const stores = await getAllStores();
  expect(stores[0].photos).toEqual([]);
});

test('insertStore returns store with id and createdAt', async () => {
  mockDb.runAsync.mockResolvedValue(undefined);
  const store = await insertStore(baseStore);
  expect(store.id).toBeTruthy();
  expect(store.createdAt).toBeTruthy();
  expect(store.name).toBe('路易莎');
});

test('deleteStore calls DELETE with correct id', async () => {
  mockDb.runAsync.mockResolvedValue(undefined);
  await deleteStore('abc');
  expect(mockDb.runAsync).toHaveBeenCalledWith('DELETE FROM stores WHERE id = ?', ['abc']);
});

test('searchStores uses LIKE query', async () => {
  mockDb.getAllAsync.mockResolvedValue([]);
  await searchStores('路易莎');
  expect(mockDb.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('LIKE'), ['%路易莎%']);
});

test('getLowRatedStores queries rating <= threshold', async () => {
  mockDb.getAllAsync.mockResolvedValue([]);
  await getLowRatedStores(2);
  expect(mockDb.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('rating <= ?'), [2]);
});

test('getStoresFiltered combines rating and category filters', async () => {
  mockDb.getAllAsync.mockResolvedValue([]);
  await getStoresFiltered([4, 5], ['cat-1', 'cat-2']);
  expect(mockDb.getAllAsync).toHaveBeenCalledWith(
    expect.stringContaining('rating IN (?,?) AND categoryId IN (?,?)'),
    [4, 5, 'cat-1', 'cat-2'],
  );
});
```

- [ ] **Step 7: Run — expect PASS**

```bash
npx jest src/__tests__/db/storeRepository.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/db src/__tests__/db
git commit -m "feat: add SQLite database layer with store and category repositories"
```

---

## Task 6: Export/Import Utility (TDD)

**Files:**
- Create: `src/utils/exportImport.ts`
- Test: `src/__tests__/utils/exportImport.test.ts`

**Interfaces:**
- Consumes: `Store`, `Category` from `src/types/index.ts` (Task 2)
- Produces: `serializeBackup(stores: Store[], categories: Category[]): string`, `parseBackup(json: string): { stores: Store[]; categories: Category[] }`

- [ ] **Step 1: Write test**

```typescript
// src/__tests__/utils/exportImport.test.ts
import { serializeBackup, parseBackup } from '@/utils/exportImport';
import type { Store, Category } from '@/types';

const cat: Category = { id: 'c1', name: '咖啡廳', emoji: '☕', order: 0 };
const store: Store = {
  id: 's1', name: '路易莎', categoryId: 'c1', rating: 5,
  latitude: 25.03, longitude: 121.5, address: '台北',
  photos: [], event: '跟朋友一起喝咖啡', notes: '老闆很親切',
  createdAt: '2026-01-01T00:00:00Z',
};

test('serializeBackup produces valid JSON string', () => {
  const json = serializeBackup([store], [cat]);
  const parsed = JSON.parse(json);
  expect(parsed.version).toBe(1);
  expect(parsed.stores).toHaveLength(1);
  expect(parsed.categories).toHaveLength(1);
});

test('parseBackup round-trips correctly', () => {
  const json = serializeBackup([store], [cat]);
  const result = parseBackup(json);
  expect(result.stores[0].name).toBe('路易莎');
  expect(result.stores[0].event).toBe('跟朋友一起喝咖啡');
  expect(result.categories[0].emoji).toBe('☕');
});

test('parseBackup throws on invalid JSON', () => {
  expect(() => parseBackup('not json')).toThrow();
});

test('parseBackup throws on wrong version', () => {
  const bad = JSON.stringify({ version: 99, stores: [], categories: [] });
  expect(() => parseBackup(bad)).toThrow('Unsupported backup version');
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx jest src/__tests__/utils/exportImport.test.ts
```

- [ ] **Step 3: Implement**

```typescript
// src/utils/exportImport.ts
import type { Store, Category } from '@/types';

interface Backup {
  version: number;
  exportedAt: string;
  categories: Category[];
  stores: Store[];
}

export function serializeBackup(stores: Store[], categories: Category[]): string {
  const backup: Backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    categories,
    stores,
  };
  return JSON.stringify(backup, null, 2);
}

export function parseBackup(json: string): { stores: Store[]; categories: Category[] } {
  const data = JSON.parse(json) as Backup;
  if (data.version !== 1) throw new Error('Unsupported backup version');
  return { stores: data.stores, categories: data.categories };
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx jest src/__tests__/utils/exportImport.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/exportImport.ts src/__tests__/utils/exportImport.test.ts
git commit -m "feat: add export/import JSON serialization with tests"
```

---

## Task 7: Shared Components — HeartRating, PhotoThumbnail, StoreCard, FAB (TDD for HeartRating)

**Files:**
- Create: `src/components/HeartRating.tsx`, `src/components/PhotoThumbnail.tsx`, `src/components/StoreCard.tsx`, `src/components/FAB.tsx`
- Test: `src/__tests__/components/HeartRating.test.tsx`

**Interfaces:**
- Consumes: `Store`, `Category` types (Task 2); `relativeTime` (Task 3); `useSettingsStore` for `themeColor` (Task 4)
- Produces: `HeartRating({ value, themeColor, onPress?, readOnly?, size? })`; `PhotoThumbnail({ uri?, size? })`; `StoreCard({ store, category?, onPress, onLongPress? })`; `FAB({ onPress })`

- [ ] **Step 1: Write HeartRating test**

```typescript
// src/__tests__/components/HeartRating.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import HeartRating from '@/components/HeartRating';

test('renders 5 hearts', () => {
  const { getAllByText } = render(<HeartRating value={3} themeColor="#6c63ff" />);
  expect(getAllByText('♥')).toHaveLength(5);
});

test('calls onPress with correct value when tapped', () => {
  const onPress = jest.fn();
  const { getAllByText } = render(
    <HeartRating value={1} themeColor="#6c63ff" onPress={onPress} />,
  );
  fireEvent.press(getAllByText('♥')[2]); // tap 3rd heart
  expect(onPress).toHaveBeenCalledWith(3);
});

test('does not call onPress when readOnly', () => {
  const onPress = jest.fn();
  const { getAllByText } = render(
    <HeartRating value={5} themeColor="#6c63ff" onPress={onPress} readOnly />,
  );
  fireEvent.press(getAllByText('♥')[0]);
  expect(onPress).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx jest src/__tests__/components/HeartRating.test.tsx
```

- [ ] **Step 3: Implement HeartRating**

Note the spec's color rule (Out of Scope §3 / data model): 3–5 hearts fill with the theme accent color, 1–2 hearts fill with a fixed warning color (not theme-dependent), unfilled hearts are fixed light gray.

```typescript
// src/components/HeartRating.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  value: number;
  themeColor: string;
  onPress?: (rating: number) => void;
  readOnly?: boolean;
  size?: number;
}

const WARNING_COLOR = '#ef4444';
const EMPTY_COLOR = '#d1d5db';

export default function HeartRating({ value, themeColor, onPress, readOnly, size = 16 }: Props) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        const color = filled ? (value >= 3 ? themeColor : WARNING_COLOR) : EMPTY_COLOR;
        const heart = (
          <Text key={n} style={{ color, fontSize: size }}>♥</Text>
        );
        if (readOnly || !onPress) return heart;
        return (
          <TouchableOpacity key={n} onPress={() => onPress(n)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
            {heart}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 2 },
});
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx jest src/__tests__/components/HeartRating.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 5: Implement PhotoThumbnail (light theme placeholder)**

```typescript
// src/components/PhotoThumbnail.tsx
import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';

interface Props {
  uri?: string;
  size?: number;
}

export default function PhotoThumbnail({ uri, size = 52 }: Props) {
  const style = { width: size, height: size, borderRadius: 10 };
  if (uri) {
    return <Image source={{ uri }} style={style} resizeMode="cover" />;
  }
  return (
    <View style={[style, styles.placeholder]}>
      <Text style={styles.icon}>📷</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 18, color: '#94a3b8' },
});
```

- [ ] **Step 6: Implement StoreCard (light theme)**

```typescript
// src/components/StoreCard.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Store, Category } from '@/types';
import PhotoThumbnail from './PhotoThumbnail';
import HeartRating from './HeartRating';
import { relativeTime } from '@/utils/relativeTime';
import { useSettingsStore } from '@/store/settingsStore';

interface Props {
  store: Store;
  category?: Category;
  onPress: () => void;
  onLongPress?: () => void;
}

export default function StoreCard({ store, category, onPress, onLongPress }: Props) {
  const themeColor = useSettingsStore((s) => s.themeColor);
  const subtitle = [category?.name, store.address].filter(Boolean).join(' · ');

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.7}>
      <PhotoThumbnail uri={store.photos[0]} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{store.name}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        <HeartRating value={store.rating} themeColor={themeColor} readOnly size={14} />
      </View>
      <Text style={styles.time}>{relativeTime(store.createdAt)}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  info: { flex: 1, minWidth: 0 },
  name: { color: '#0f172a', fontWeight: '600', fontSize: 15 },
  subtitle: { color: '#64748b', fontSize: 12, marginTop: 2 },
  time: { color: '#94a3b8', fontSize: 11, flexShrink: 0 },
});
```

- [ ] **Step 7: Implement FAB (light theme)**

```typescript
// src/components/FAB.tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useSettingsStore } from '@/store/settingsStore';

interface Props {
  onPress: () => void;
}

export default function FAB({ onPress }: Props) {
  const themeColor = useSettingsStore((s) => s.themeColor);
  return (
    <TouchableOpacity
      style={[styles.fab, { backgroundColor: themeColor }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={styles.plus}>＋</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  plus: { color: '#fff', fontSize: 26, lineHeight: 30 },
});
```

- [ ] **Step 8: Commit**

```bash
git add src/components/HeartRating.tsx src/components/PhotoThumbnail.tsx src/components/StoreCard.tsx src/components/FAB.tsx src/__tests__/components/HeartRating.test.tsx
git commit -m "feat: add HeartRating, PhotoThumbnail, StoreCard, FAB components"
```

---

## Task 8: Root Layout & Tab Layout

**Files:**
- Modify: `app/_layout.tsx`
- Create: `app/main/_layout.tsx`

**Interfaces:**
- Consumes: `seedCategoriesIfEmpty` (Task 5), `registerBackgroundTask` (stubbed here, implemented in Task 17), `useSettingsStore` (Task 4)
- Produces: Stack routes `index`, `settings`, `store/add`, `store/[id]`, `category/[id]`, `main` (tab group); tab routes `main/records`, `main/categories`, `main/rankings`

- [ ] **Step 1: Write a stub locationTask module so the root layout compiles**

```typescript
// src/tasks/locationTask.ts
export async function registerBackgroundTask(): Promise<void> {
  // full implementation in Task 17
}
```

- [ ] **Step 2: Write the root layout**

```typescript
// app/_layout.tsx
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
```

- [ ] **Step 3: Write the tab layout**

Per spec §4, all 3 tabs show a consistent "←返回首頁" control; that control is rendered inside each tab screen's own header (Task 10, 14, 15), not in the tab bar itself, so the tab bar here stays header-less.

```typescript
// app/main/_layout.tsx
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
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
      }}
    >
      <Tabs.Screen name="records" options={{ tabBarLabel: '紀錄', tabBarIcon: ({ color }) => <Text style={{ color }}>📝</Text> }} />
      <Tabs.Screen name="categories" options={{ tabBarLabel: '分類', tabBarIcon: ({ color }) => <Text style={{ color }}>📂</Text> }} />
      <Tabs.Screen name="rankings" options={{ tabBarLabel: '排行', tabBarIcon: ({ color }) => <Text style={{ color }}>🏆</Text> }} />
    </Tabs>
  );
}
```

- [ ] **Step 4: Write minimal placeholder tab screens so the layout compiles**

```typescript
// app/main/records.tsx
import { View, Text } from 'react-native';
export default function RecordsScreen() {
  return <View style={{ flex: 1, backgroundColor: '#fff' }}><Text>紀錄</Text></View>;
}
```

```typescript
// app/main/categories.tsx
import { View, Text } from 'react-native';
export default function CategoriesScreen() {
  return <View style={{ flex: 1, backgroundColor: '#fff' }}><Text>分類</Text></View>;
}
```

```typescript
// app/main/rankings.tsx
import { View, Text } from 'react-native';
export default function RankingsScreen() {
  return <View style={{ flex: 1, backgroundColor: '#fff' }}><Text>排行</Text></View>;
}
```

- [ ] **Step 5: Write minimal placeholder screens for the remaining stack routes**

```typescript
// app/settings.tsx
import { View, Text } from 'react-native';
export default function SettingsScreen() {
  return <View style={{ flex: 1, backgroundColor: '#fff' }}><Text>設定</Text></View>;
}
```

```typescript
// app/store/add.tsx
import { View, Text } from 'react-native';
export default function AddStoreScreen() {
  return <View style={{ flex: 1, backgroundColor: '#fff' }}><Text>新增店家</Text></View>;
}
```

```typescript
// app/store/[id].tsx
import { View, Text } from 'react-native';
export default function StoreDetailScreen() {
  return <View style={{ flex: 1, backgroundColor: '#fff' }}><Text>店家詳情</Text></View>;
}
```

```typescript
// app/category/[id].tsx
import { View, Text } from 'react-native';
export default function CategoryDetailScreen() {
  return <View style={{ flex: 1, backgroundColor: '#fff' }}><Text>分類詳情</Text></View>;
}
```

- [ ] **Step 6: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add app src/tasks/locationTask.ts
git commit -m "feat: add root stack and tab layout with placeholder screens"
```

---

## Task 9: HomeScreen

**Files:**
- Modify: `app/index.tsx`

**Interfaces:**
- Consumes: `useSettingsStore` for `themeColor` (Task 4)

- [ ] **Step 1: Implement HomeScreen**

```typescript
// app/index.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSettingsStore } from '@/store/settingsStore';

export default function HomeScreen() {
  const router = useRouter();
  const themeColor = useSettingsStore((s) => s.themeColor);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <Text style={[styles.title, { color: themeColor }]}>SPARK{'\n'}NOTES</Text>

        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/main/records')}>
          <Text style={[styles.primaryBtnText, { backgroundColor: themeColor }]}> </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.enterBtn, { backgroundColor: themeColor }]}
          onPress={() => router.push('/main/records')}
        >
          <Text style={styles.enterBtnText}>進入主頁</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/settings')}>
          <Text style={styles.settingsText}>⚙️  設定</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontSize: 48,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -1,
    lineHeight: 56,
    marginBottom: 40,
  },
  primaryBtn: { display: 'none' },
  primaryBtnText: { display: 'none' },
  enterBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  enterBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  settingsBtn: {
    marginTop: 20,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  settingsText: { color: '#475569', fontSize: 15, fontWeight: '500' },
});
```

- [ ] **Step 2: Remove the unused dead `primaryBtn` placeholder**

The `primaryBtn`/`primaryBtnText` styles above are leftover scaffolding with no purpose — delete them and the `TouchableOpacity` that uses them so the screen only has the title, "進入主頁" button, and "設定" button:

```typescript
// app/index.tsx — replace the JSX body and trim the unused styles
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSettingsStore } from '@/store/settingsStore';

export default function HomeScreen() {
  const router = useRouter();
  const themeColor = useSettingsStore((s) => s.themeColor);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <Text style={[styles.title, { color: themeColor }]}>SPARK{'\n'}NOTES</Text>

        <TouchableOpacity
          style={[styles.enterBtn, { backgroundColor: themeColor }]}
          onPress={() => router.push('/main/records')}
        >
          <Text style={styles.enterBtnText}>進入主頁</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/settings')}>
          <Text style={styles.settingsText}>⚙️  設定</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontSize: 48,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -1,
    lineHeight: 56,
    marginBottom: 40,
  },
  enterBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  enterBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  settingsBtn: {
    marginTop: 20,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  settingsText: { color: '#475569', fontSize: 15, fontWeight: '500' },
});
```

- [ ] **Step 3: Verify in app**

```bash
npx expo start --web
```

Expected: HomeScreen shows title in theme color, "進入主頁" navigates to the records tab, "設定" navigates to settings.

- [ ] **Step 4: Commit**

```bash
git add app/index.tsx
git commit -m "feat: implement HomeScreen as standalone landing route"
```

---

## Task 10: Records Screen (main/records)

**Files:**
- Modify: `app/main/records.tsx`

**Interfaces:**
- Consumes: `getAllStores`, `searchStores`, `deleteStore` (Task 5), `getAllCategories` (Task 5), `StoreCard`, `FAB` (Task 7)

- [ ] **Step 1: Implement Records screen**

```typescript
// app/main/records.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  Alert, StyleSheet, LayoutAnimation,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import type { Store, Category } from '@/types';
import { getAllStores, searchStores, deleteStore } from '@/db/storeRepository';
import { getAllCategories } from '@/db/categoryRepository';
import StoreCard from '@/components/StoreCard';
import FAB from '@/components/FAB';

export default function RecordsScreen() {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchVisible, setSearchVisible] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    const [s, c] = await Promise.all([getAllStores(), getAllCategories()]);
    setStores(s);
    setCategories(c);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!query) { load(); return; }
    searchStores(query).then(setStores);
  }, [query]);

  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c]));

  const handleLongPress = (store: Store) => {
    Alert.alert('刪除店家', `確定要刪除「${store.name}」？`, [
      { text: '取消', style: 'cancel' },
      { text: '刪除', style: 'destructive', onPress: async () => { await deleteStore(store.id); load(); } },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/')}>
          <Text style={styles.back}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>紀錄</Text>
        <TouchableOpacity onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setSearchVisible((v) => !v);
          if (searchVisible) setQuery('');
        }}>
          <Text style={styles.searchIcon}>🔍</Text>
        </TouchableOpacity>
      </View>

      {searchVisible && (
        <TextInput
          style={styles.searchInput}
          placeholder="搜尋店家名稱..."
          placeholderTextColor="#94a3b8"
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
      )}

      <FlatList
        data={stores}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <StoreCard
            store={item}
            category={categoryMap[item.categoryId]}
            onPress={() => router.push(`/store/${item.id}`)}
            onLongPress={() => handleLongPress(item)}
          />
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>還沒有記錄，點 ＋ 新增第一家店！</Text>}
      />

      <FAB onPress={() => router.push('/store/add')} />
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
  back: { color: '#475569', fontSize: 15 },
  title: { color: '#0f172a', fontSize: 18, fontWeight: '700' },
  searchIcon: { fontSize: 20 },
  searchInput: {
    backgroundColor: '#f1f5f9', color: '#0f172a',
    marginHorizontal: 16, marginBottom: 8,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15,
  },
  list: { padding: 16, paddingBottom: 80 },
  empty: { color: '#94a3b8', textAlign: 'center', marginTop: 60, fontSize: 15 },
});
```

- [ ] **Step 2: Verify in app**

```bash
npx expo start --web
```

Expected: list renders (empty state visible with no data yet), search icon toggles input, "←返回" navigates to `/`, FAB navigates to `/store/add`.

- [ ] **Step 3: Commit**

```bash
git add app/main/records.tsx
git commit -m "feat: implement records screen with search and FAB"
```

---

## Task 11: Location Picker Modal Component

**Files:**
- Create: `src/components/LocationPickerModal.tsx`

**Interfaces:**
- Produces: `LocationPickerModal({ visible, initialLatitude?, initialLongitude?, onConfirm: (lat: number, lon: number, address: string) => void, onCancel: () => void })`. `onConfirm` always receives the reverse-geocoded `address` string already resolved — callers never type an address.

- [ ] **Step 1: Implement LocationPickerModal**

```typescript
// src/components/LocationPickerModal.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { useSettingsStore } from '@/store/settingsStore';

interface Props {
  visible: boolean;
  initialLatitude?: number;
  initialLongitude?: number;
  onConfirm: (lat: number, lon: number, address: string) => void;
  onCancel: () => void;
}

const FALLBACK_REGION: Region = {
  latitude: 25.0330, longitude: 121.5654,
  latitudeDelta: 0.01, longitudeDelta: 0.01,
};

export default function LocationPickerModal({ visible, initialLatitude, initialLongitude, onConfirm, onCancel }: Props) {
  const themeColor = useSettingsStore((s) => s.themeColor);
  const [region, setRegion] = useState<Region>(FALLBACK_REGION);
  const [marker, setMarker] = useState({ latitude: FALLBACK_REGION.latitude, longitude: FALLBACK_REGION.longitude });
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (initialLatitude && initialLongitude) {
      const r = { latitude: initialLatitude, longitude: initialLongitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
      setRegion(r);
      setMarker({ latitude: initialLatitude, longitude: initialLongitude });
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('需要定位權限才能定位目前位置，請手動拖曳大頭針');
        setLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const r = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
      setRegion(r);
      setMarker({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      setLoading(false);
    })();
  }, [visible, initialLatitude, initialLongitude]);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const [geo] = await Location.reverseGeocodeAsync(marker);
      const address = geo ? `${geo.city ?? ''}${geo.district ?? ''}${geo.street ?? ''}` : '';
      onConfirm(marker.latitude, marker.longitude, address);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel}>
            <Text style={styles.cancel}>取消</Text>
          </TouchableOpacity>
          <Text style={styles.title}>拖曳大頭針選擇位置</Text>
          <TouchableOpacity onPress={handleConfirm} disabled={confirming}>
            {confirming ? <ActivityIndicator color={themeColor} /> : <Text style={[styles.confirm, { color: themeColor }]}>確認</Text>}
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingBox}><ActivityIndicator color={themeColor} /></View>
        ) : (
          <MapView
            style={styles.map}
            initialRegion={region}
            onRegionChangeComplete={setRegion}
          >
            <Marker
              coordinate={marker}
              draggable
              onDragEnd={(e) => setMarker(e.nativeEvent.coordinate)}
            />
          </MapView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  title: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  cancel: { color: '#64748b', fontSize: 16 },
  confirm: { fontSize: 16, fontWeight: '600' },
  map: { flex: 1 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/LocationPickerModal.tsx
git commit -m "feat: add draggable-marker location picker modal"
```

---

## Task 12: AddStore Screen (store/add)

**Files:**
- Modify: `app/store/add.tsx`

**Interfaces:**
- Consumes: `getAllCategories` (Task 5), `insertStore`, `updateStore`, `getStoreById` (Task 5), `HeartRating` (Task 7), `LocationPickerModal` (Task 11), `useSettingsStore` (Task 4)

- [ ] **Step 1: Implement AddStoreScreen**

```typescript
// app/store/add.tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Alert, StyleSheet, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import type { Category } from '@/types';
import { getAllCategories } from '@/db/categoryRepository';
import { insertStore, updateStore, getStoreById } from '@/db/storeRepository';
import HeartRating from '@/components/HeartRating';
import LocationPickerModal from '@/components/LocationPickerModal';
import { useSettingsStore } from '@/store/settingsStore';

export default function AddStoreScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ storeId?: string }>();
  const themeColor = useSettingsStore((s) => s.themeColor);
  const isEdit = !!params.storeId;

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [address, setAddress] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [event, setEvent] = useState('');
  const [notes, setNotes] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);

  useEffect(() => {
    getAllCategories().then((cats) => {
      setCategories(cats);
      if (cats.length && !isEdit) setCategoryId(cats[0].id);
    });
    if (isEdit && params.storeId) {
      getStoreById(params.storeId).then((store) => {
        if (!store) return;
        setName(store.name);
        setCategoryId(store.categoryId);
        setRating(store.rating);
        setLatitude(store.latitude);
        setLongitude(store.longitude);
        setAddress(store.address);
        setPhotos(store.photos);
        setEvent(store.event);
        setNotes(store.notes);
      });
    }
  }, []);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setPhotos((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('請輸入店家名稱'); return; }
    if (!categoryId) { Alert.alert('請選擇分類'); return; }
    if (latitude === null || longitude === null) { Alert.alert('請選擇店家位置'); return; }

    const data = { name: name.trim(), categoryId, rating, latitude, longitude, address, photos, event, notes };
    if (isEdit && params.storeId) {
      await updateStore(params.storeId, data);
    } else {
      await insertStore(data);
    }
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancel}>取消</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{isEdit ? '編輯店家' : '新增店家'}</Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={[styles.save, { color: themeColor }]}>儲存</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.form} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.label}>店家名稱 *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName}
          placeholder="輸入店家名稱" placeholderTextColor="#94a3b8" />

        <Text style={styles.label}>分類 *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {categories.map((cat) => (
            <TouchableOpacity key={cat.id}
              style={[styles.catChip, categoryId === cat.id && { backgroundColor: themeColor }]}
              onPress={() => setCategoryId(cat.id)}>
              <Text style={[styles.catText, categoryId === cat.id && styles.catTextActive]}>{cat.emoji} {cat.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.label}>評分 *</Text>
        <View style={{ marginBottom: 16 }}>
          <HeartRating value={rating} themeColor={themeColor} onPress={(v) => setRating(v as 1 | 2 | 3 | 4 | 5)} size={28} />
        </View>

        <Text style={styles.label}>位置 *</Text>
        <TouchableOpacity style={styles.locBtn} onPress={() => setPickerVisible(true)}>
          <Text style={[styles.locBtnText, { color: themeColor }]}>
            📍 {address ? address : '選擇位置'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.label}>照片（選填）</Text>
        <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto}>
          <Text style={styles.photoBtnText}>＋ 從相簿選取</Text>
        </TouchableOpacity>
        <ScrollView horizontal style={{ marginBottom: 16 }}>
          {photos.map((uri, i) => (
            <Image key={i} source={{ uri }} style={styles.photoThumb} />
          ))}
        </ScrollView>

        <Text style={styles.label}>事件（選填）</Text>
        <TextInput style={[styles.input, { height: 60 }]} value={event} onChangeText={setEvent}
          placeholder="這次上門發生的事..." placeholderTextColor="#94a3b8" multiline />

        <Text style={styles.label}>備註（選填）</Text>
        <TextInput style={[styles.input, { height: 80 }]} value={notes} onChangeText={setNotes}
          placeholder="心得、注意事項..." placeholderTextColor="#94a3b8" multiline />
      </ScrollView>

      <LocationPickerModal
        visible={pickerVisible}
        initialLatitude={latitude ?? undefined}
        initialLongitude={longitude ?? undefined}
        onConfirm={(lat, lon, addr) => {
          setLatitude(lat);
          setLongitude(lon);
          setAddress(addr);
          setPickerVisible(false);
        }}
        onCancel={() => setPickerVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  title: { color: '#0f172a', fontSize: 17, fontWeight: '600' },
  cancel: { color: '#64748b', fontSize: 16 },
  save: { fontSize: 16, fontWeight: '600' },
  form: { padding: 16 },
  label: { color: '#64748b', fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' },
  input: {
    backgroundColor: '#f1f5f9', color: '#0f172a',
    borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 16,
  },
  catChip: {
    backgroundColor: '#f1f5f9', borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 12, marginRight: 8,
  },
  catText: { color: '#0f172a', fontSize: 13 },
  catTextActive: { color: '#ffffff' },
  locBtn: { backgroundColor: '#f1f5f9', borderRadius: 10, padding: 12, marginBottom: 16 },
  locBtnText: { fontSize: 14, fontWeight: '500' },
  photoBtn: {
    backgroundColor: '#f1f5f9', borderRadius: 10, padding: 12,
    alignItems: 'center', marginBottom: 10,
  },
  photoBtnText: { color: '#64748b', fontSize: 14 },
  photoThumb: { width: 72, height: 72, borderRadius: 8, marginRight: 8 },
});
```

- [ ] **Step 2: Verify in app**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/store/add.tsx
git commit -m "feat: implement AddStoreScreen with map location picker"
```

---

## Task 13: StoreDetail Screen

**Files:**
- Modify: `app/store/[id].tsx`

**Interfaces:**
- Consumes: `getStoreById` (Task 5), `getAllCategories` (Task 5), `deleteStore` (Task 5), `HeartRating`, `PhotoThumbnail` (Task 7), `useSettingsStore` (Task 4)

- [ ] **Step 1: Implement StoreDetailScreen**

```typescript
// app/store/[id].tsx
import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Linking, StyleSheet, Dimensions, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import type { Store, Category } from '@/types';
import { getStoreById, deleteStore } from '@/db/storeRepository';
import { getAllCategories } from '@/db/categoryRepository';
import HeartRating from '@/components/HeartRating';
import PhotoThumbnail from '@/components/PhotoThumbnail';
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
        {store.photos.length > 0 ? (
          <ScrollView horizontal pagingEnabled style={{ height: 220 }}>
            {store.photos.map((uri, i) => (
              <PhotoThumbnail key={i} uri={uri} size={width} />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.noPhoto}>
            <Text style={{ color: '#94a3b8', fontSize: 14 }}>沒有照片</Text>
          </View>
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
  noPhoto: { height: 160, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
  body: { padding: 20 },
  name: { color: '#0f172a', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  meta: { color: '#64748b', fontSize: 14, marginTop: 8 },
  address: { fontSize: 14, marginTop: 12, fontWeight: '500' },
  sectionTitle: { color: '#94a3b8', fontSize: 12, fontWeight: '600', marginTop: 20, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  notes: { color: '#334155', fontSize: 15, lineHeight: 22 },
});
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/store/[id].tsx
git commit -m "feat: implement StoreDetailScreen with photo carousel and map link"
```

---

## Task 14: Categories Screen + CategoryDetail Screen

**Files:**
- Modify: `app/main/categories.tsx`, `app/category/[id].tsx`

**Interfaces:**
- Consumes: `getAllCategories`, `insertCategory`, `updateCategory`, `deleteCategory` (Task 5), `getAllStores`, `getStoresByCategory` (Task 5), `StoreCard` (Task 7), `useSettingsStore` (Task 4)

- [ ] **Step 1: Implement Categories screen**

Per spec §5.3, the categories tab's top-left button returns to Home (not back to a "categories list" — this *is* the categories list), and top-right is the edit control.

```typescript
// app/main/categories.tsx
import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, Alert,
  Modal, TextInput, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import type { Category } from '@/types';
import {
  getAllCategories, insertCategory, deleteCategory, updateCategory,
} from '@/db/categoryRepository';
import { getAllStores } from '@/db/storeRepository';
import { useSettingsStore } from '@/store/settingsStore';

export default function CategoriesScreen() {
  const router = useRouter();
  const themeColor = useSettingsStore((s) => s.themeColor);
  const [categories, setCategories] = useState<Category[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [inputName, setInputName] = useState('');
  const [inputEmoji, setInputEmoji] = useState('');

  const load = useCallback(async () => {
    const [cats, stores] = await Promise.all([getAllCategories(), getAllStores()]);
    setCategories(cats);
    const c: Record<string, number> = {};
    stores.forEach((s) => { c[s.categoryId] = (c[s.categoryId] ?? 0) + 1; });
    setCounts(c);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openAdd = () => { setEditTarget(null); setInputName(''); setInputEmoji(''); setModalVisible(true); };
  const openEdit = (cat: Category) => { setEditTarget(cat); setInputName(cat.name); setInputEmoji(cat.emoji); setModalVisible(true); };

  const handleSave = async () => {
    if (!inputName.trim()) { Alert.alert('請輸入分類名稱'); return; }
    if (editTarget) {
      await updateCategory(editTarget.id, inputName.trim(), inputEmoji || '📌');
    } else {
      await insertCategory(inputName.trim(), inputEmoji || '📌');
    }
    setModalVisible(false);
    load();
  };

  const handleDelete = (cat: Category) => {
    Alert.alert('刪除分類', `確定要刪除「${cat.name}」？`, [
      { text: '取消', style: 'cancel' },
      { text: '刪除', style: 'destructive', onPress: async () => { await deleteCategory(cat.id); load(); } },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/')}>
          <Text style={styles.back}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>分類</Text>
        <TouchableOpacity onPress={openAdd}>
          <Text style={[styles.editBtn, { color: themeColor }]}>✏️ 編輯</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.chip}
            onPress={() => router.push(`/category/${item.id}`)}
            onLongPress={() => {
              Alert.alert(item.name, '', [
                { text: '編輯', onPress: () => openEdit(item) },
                { text: '刪除', style: 'destructive', onPress: () => handleDelete(item) },
                { text: '取消', style: 'cancel' },
              ]);
            }}
          >
            <Text style={styles.chipEmoji}>{item.emoji}</Text>
            <Text style={styles.chipName}>{item.name}</Text>
            <Text style={styles.chipCount}>{counts[item.id] ?? 0} 家</Text>
          </TouchableOpacity>
        )}
      />

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{editTarget ? '編輯分類' : '新增分類'}</Text>
            <TextInput style={styles.modalInput} value={inputEmoji}
              onChangeText={setInputEmoji} placeholder="Emoji 圖示" placeholderTextColor="#94a3b8" />
            <TextInput style={styles.modalInput} value={inputName}
              onChangeText={setInputName} placeholder="分類名稱" placeholderTextColor="#94a3b8" />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancel}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave}>
                <Text style={[styles.modalSave, { color: themeColor }]}>儲存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  back: { color: '#475569', fontSize: 15 },
  title: { color: '#0f172a', fontSize: 18, fontWeight: '700' },
  editBtn: { fontSize: 15, fontWeight: '600' },
  grid: { padding: 12 },
  chip: {
    flex: 1, margin: 6, backgroundColor: '#ffffff', borderRadius: 12,
    padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb',
  },
  chipEmoji: { fontSize: 28, marginBottom: 6 },
  chipName: { color: '#0f172a', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  chipCount: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#ffffff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { color: '#0f172a', fontSize: 17, fontWeight: '600', marginBottom: 16 },
  modalInput: {
    backgroundColor: '#f1f5f9', color: '#0f172a',
    borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 12,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20, marginTop: 8 },
  modalCancel: { color: '#64748b', fontSize: 16 },
  modalSave: { fontSize: 16, fontWeight: '600' },
});
```

- [ ] **Step 2: Implement CategoryDetail screen**

Per spec §5.4, this screen's top-left returns to the categories tab (not Home), and top-right is the search control for stores within this category.

```typescript
// app/category/[id].tsx
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import type { Store, Category } from '@/types';
import { getStoresByCategory } from '@/db/storeRepository';
import { getAllCategories } from '@/db/categoryRepository';
import StoreCard from '@/components/StoreCard';
import { useSettingsStore } from '@/store/settingsStore';

export default function CategoryDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const themeColor = useSettingsStore((s) => s.themeColor);
  const [allStores, setAllStores] = useState<Store[]>([]);
  const [category, setCategory] = useState<Category | undefined>();
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [searchVisible, setSearchVisible] = useState(false);
  const [query, setQuery] = useState('');

  useFocusEffect(useCallback(() => {
    Promise.all([getStoresByCategory(id, sortOrder), getAllCategories()]).then(([s, cats]) => {
      setAllStores(s);
      setCategory(cats.find((c) => c.id === id));
    });
  }, [id, sortOrder]));

  const stores = query
    ? allStores.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))
    : allStores;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← 返回分類頁</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{category ? `${category.emoji} ${category.name}` : ''}</Text>
        <TouchableOpacity onPress={() => setSearchVisible((v) => !v)}>
          <Text style={styles.searchIcon}>🔍</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sortRow}>
        <TouchableOpacity onPress={() => setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}>
          <Text style={[styles.sort, { color: themeColor }]}>{sortOrder === 'desc' ? '新→舊' : '舊→新'}</Text>
        </TouchableOpacity>
      </View>

      {searchVisible && (
        <TextInput
          style={styles.searchInput}
          placeholder="搜尋此分類的店家..."
          placeholderTextColor="#94a3b8"
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
      )}

      <FlatList
        data={stores}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <StoreCard store={item} category={category} onPress={() => router.push(`/store/${item.id}`)} />
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>這個分類還沒有店家</Text>}
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
  title: { color: '#0f172a', fontSize: 16, fontWeight: '700' },
  searchIcon: { fontSize: 20 },
  sortRow: { paddingHorizontal: 16, paddingTop: 8 },
  sort: { fontSize: 13, fontWeight: '600' },
  searchInput: {
    backgroundColor: '#f1f5f9', color: '#0f172a',
    marginHorizontal: 16, marginTop: 8, marginBottom: 4,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15,
  },
  list: { padding: 16, paddingBottom: 40 },
  empty: { color: '#94a3b8', textAlign: 'center', marginTop: 60, fontSize: 15 },
});
```

- [ ] **Step 3: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/main/categories.tsx app/category/[id].tsx
git commit -m "feat: implement Categories and CategoryDetail screens"
```

---

## Task 15: Rankings Screen (main/rankings)

**Files:**
- Modify: `app/main/rankings.tsx`

**Interfaces:**
- Consumes: `getStoresFiltered` (Task 5), `getAllCategories` (Task 5), `StoreCard` (Task 7), `HeartRating` (Task 7), `useSettingsStore` (Task 4)

- [ ] **Step 1: Implement Rankings screen**

Per spec §5.5: heart filter (1–5, multi-select) and category filter (multi-select), both as toggle chips; top-left "←返回首頁" consistent with the other two tabs.

```typescript
// app/main/rankings.tsx
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
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/main/rankings.tsx
git commit -m "feat: implement Rankings screen with heart x category filters"
```

---

## Task 16: Settings Screen

**Files:**
- Modify: `app/settings.tsx`

**Interfaces:**
- Consumes: `useSettingsStore` (Task 4), `getAllStores`, `getAllCategories` (Task 5), `serializeBackup`, `parseBackup` (Task 6), `insertStore`, `insertCategory` (Task 5)

- [ ] **Step 1: Implement SettingsScreen**

```typescript
// app/settings.tsx
import React from 'react';
import { View, Text, TouchableOpacity, Switch, ScrollView, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useSettingsStore } from '@/store/settingsStore';
import { getAllStores, insertStore } from '@/db/storeRepository';
import { getAllCategories, insertCategory } from '@/db/categoryRepository';
import { serializeBackup, parseBackup } from '@/utils/exportImport';

const PRESET_COLORS = ['#6c63ff', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#ec4899'];
const RATING_OPTIONS = [
  { label: '1星', value: 1 },
  { label: '2星以下', value: 2 },
  { label: '3星以下', value: 3 },
];
const RADIUS_OPTIONS = [
  { label: '100m', value: 100 },
  { label: '300m', value: 300 },
  { label: '500m', value: 500 },
  { label: '1km', value: 1000 },
];

export default function SettingsScreen() {
  const router = useRouter();
  const {
    themeColor, radarEnabled, radarRatingThreshold, radarRadiusMeters,
    setThemeColor, setRadarEnabled, setRadarRatingThreshold, setRadarRadiusMeters,
  } = useSettingsStore();

  const handleExport = async () => {
    const [stores, categories] = await Promise.all([getAllStores(), getAllCategories()]);
    const json = serializeBackup(stores, categories);
    const path = `${FileSystem.documentDirectory}sparknotes-backup.json`;
    await FileSystem.writeAsStringAsync(path, json);
    await Sharing.shareAsync(path);
  };

  const handleImport = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
    if (result.canceled) return;
    const json = await FileSystem.readAsStringAsync(result.assets[0].uri);
    const { stores, categories } = parseBackup(json);
    Alert.alert('匯入資料', '要合併還是覆蓋現有資料？', [
      { text: '取消', style: 'cancel' },
      {
        text: '合併', onPress: async () => {
          for (const c of categories) await insertCategory(c.name, c.emoji);
          for (const s of stores) await insertStore(s);
          Alert.alert('匯入完成');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>設定</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.section}>主題顏色</Text>
        <View style={styles.colorRow}>
          {PRESET_COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.colorDot, { backgroundColor: c }, themeColor === c && styles.colorDotActive]}
              onPress={() => setThemeColor(c)}
            />
          ))}
        </View>

        <Text style={styles.section}>心級雷達</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>開啟雷店預警通知</Text>
          <Switch value={radarEnabled} onValueChange={setRadarEnabled} trackColor={{ true: themeColor }} />
        </View>

        <Text style={styles.subLabel}>幾顆心以下開啟雷達</Text>
        <View style={styles.optionRow}>
          {RATING_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.optionChip, radarRatingThreshold === opt.value && { backgroundColor: themeColor }]}
              onPress={() => setRadarRatingThreshold(opt.value)}
            >
              <Text style={[styles.optionText, radarRatingThreshold === opt.value && styles.optionTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.subLabel}>幾公尺內提醒</Text>
        <View style={styles.optionRow}>
          {RADIUS_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.optionChip, radarRadiusMeters === opt.value && { backgroundColor: themeColor }]}
              onPress={() => setRadarRadiusMeters(opt.value)}
            >
              <Text style={[styles.optionText, radarRadiusMeters === opt.value && styles.optionTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.section}>資料管理</Text>
        <TouchableOpacity style={styles.actionBtn} onPress={handleExport}>
          <Text style={styles.actionText}>📤 匯出資料</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleImport}>
          <Text style={styles.actionText}>📥 匯入資料</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  back: { color: '#475569', fontSize: 15 },
  title: { color: '#0f172a', fontSize: 17, fontWeight: '700' },
  body: { padding: 20, paddingBottom: 60 },
  section: { color: '#0f172a', fontSize: 15, fontWeight: '700', marginTop: 24, marginBottom: 12 },
  subLabel: { color: '#64748b', fontSize: 12, marginTop: 12, marginBottom: 8 },
  colorRow: { flexDirection: 'row', gap: 12 },
  colorDot: { width: 36, height: 36, borderRadius: 18 },
  colorDotActive: { borderWidth: 3, borderColor: '#0f172a' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  rowLabel: { color: '#0f172a', fontSize: 15 },
  optionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  optionChip: { backgroundColor: '#f1f5f9', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  optionText: { color: '#0f172a', fontSize: 13 },
  optionTextActive: { color: '#ffffff' },
  actionBtn: { backgroundColor: '#f1f5f9', borderRadius: 10, padding: 14, marginBottom: 10 },
  actionText: { color: '#0f172a', fontSize: 15, fontWeight: '500' },
});
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/settings.tsx
git commit -m "feat: implement SettingsScreen with theme, radar, export/import"
```

---

## Task 17: Background Geofencing Task

**Files:**
- Modify: `src/tasks/locationTask.ts`

**Interfaces:**
- Consumes: `getLowRatedStores` (Task 5), `haversineMeters` (Task 3), `useSettingsStore.getState()` (Task 4)
- Produces: `registerBackgroundTask(): Promise<void>` (already referenced by `app/_layout.tsx` from Task 8)

- [ ] **Step 1: Implement the background task**

```typescript
// src/tasks/locationTask.ts
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { getLowRatedStores } from '@/db/storeRepository';
import { haversineMeters } from '@/utils/haversine';
import { useSettingsStore } from '@/store/settingsStore';

const LOCATION_TASK_NAME = 'sparknotes-radar-task';
const lastNotifiedAt: Record<string, number> = {};
const NOTIFY_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) return;
  const { radarEnabled, radarRatingThreshold, radarRadiusMeters } = useSettingsStore.getState();
  if (!radarEnabled) return;

  const locations = (data as { locations: Location.LocationObject[] } | undefined)?.locations;
  const current = locations?.[locations.length - 1];
  if (!current) return;

  const lowRatedStores = await getLowRatedStores(radarRatingThreshold);
  const now = Date.now();

  for (const store of lowRatedStores) {
    const distance = haversineMeters(
      current.coords.latitude, current.coords.longitude,
      store.latitude, store.longitude,
    );
    if (distance > radarRadiusMeters) continue;
    const lastNotified = lastNotifiedAt[store.id] ?? 0;
    if (now - lastNotified < NOTIFY_COOLDOWN_MS) continue;

    lastNotifiedAt[store.id] = now;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚠️ 雷店就在附近！',
        body: `${store.name}（${store.rating}心）距離你只有 ${Math.round(distance)}m，小心別踩雷`,
      },
      trigger: null,
    });
  }
});

export async function registerBackgroundTask(): Promise<void> {
  await Notifications.requestPermissionsAsync();

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return;
  const bgStatus = await Location.requestBackgroundPermissionsAsync();
  if (bgStatus.status !== 'granted') return;

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (alreadyStarted) return;

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 5 * 60 * 1000, // every 5 minutes
    distanceInterval: 100,
  });
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run the full test suite**

```bash
npx jest
```

Expected: all tests across `src/__tests__/**` pass (haversine, relativeTime, exportImport, categoryRepository, storeRepository, settingsStore, HeartRating).

- [ ] **Step 4: Commit**

```bash
git add src/tasks/locationTask.ts
git commit -m "feat: implement background geofencing with low-rated store notifications"
```

---

## Self-Review Notes

**Spec coverage:**
- §1 tech stack → Task 1 (scaffold), Task 4 (Zustand store)
- §2 data model & add-store flow → Task 2 (types), Task 5 (db), Task 11–12 (map picker + add form)
- §3 light-only theme → Task 7 (HeartRating fixed warning/empty colors), Task 9/10/12–16 (light backgrounds throughout, no dark variant anywhere)
- §4 navigation (standalone Home, 3-tab group, consistent return-to-home) → Task 8 (layouts), Task 9 (Home), Task 10/14/15 (back buttons)
- §5 all 8 screen specs → Task 9, 10, 12, 13, 14 (x2), 15, 16
- §6 geofencing → Task 17
- §7 export/import JSON format → Task 6 (serialize/parse), Task 16 (UI wiring)
- §8 default categories → Task 5 (`DEFAULT_CATEGORIES`)
- §9 out of scope → no tasks add cloud sync, accounts, social sharing, address text input, or dark mode; confirmed absent from every screen task above.

**Placeholder scan:** no TBD/TODO markers remain; the only "later task" reference is the Task 8 `locationTask.ts` stub explicitly fulfilled by Task 17, and Task 8's placeholder screens are explicitly fulfilled by Tasks 9, 10, 12–16 — both are real, compiling code, not unfilled blanks.

**Type consistency:** `Store`/`Category`/`AppSettings` (Task 2) match field-for-field across `database.ts`, `storeRepository.ts`, `categoryRepository.ts` (Task 5), `exportImport.ts` (Task 6), `LocationPickerModal`/`HeartRating`/`StoreCard`/`FAB` props (Task 7/11), and every screen (Task 9–16). `useSettingsStore` field names (`themeColor`, `radarEnabled`, `radarRatingThreshold`, `radarRadiusMeters`) are identical in Task 4's definition and every later consumer (Task 7, 9, 10, 11, 12, 13, 14, 15, 16, 17).
