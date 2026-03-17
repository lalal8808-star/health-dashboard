'use client';

import { FoodEntry, DailyFoodLog, MealPreset, MealPresetEntry, FoodItem } from './types';
import { syncedSetItem } from './storage-sync';

const FOOD_STORAGE_KEY = 'health-dashboard-food-logs' as const;

export function getFoodLogs(): DailyFoodLog[] {
    if (typeof window === 'undefined') return [];
    try {
        const data = localStorage.getItem(FOOD_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

export function getFoodLogByDate(date: string): DailyFoodLog | null {
    const logs = getFoodLogs();
    return logs.find(l => l.date === date) || null;
}

export function saveFoodEntry(date: string, entry: FoodEntry, targetCalories: number = 2200): void {
    const logs = getFoodLogs();
    const idx = logs.findIndex(l => l.date === date);
    if (idx >= 0) {
        logs[idx].entries.push(entry);
    } else {
        logs.push({ date, entries: [entry], targetCalories });
    }
    syncedSetItem(FOOD_STORAGE_KEY, logs);
}

export function deleteFoodEntry(date: string, entryId: string): void {
    const logs = getFoodLogs();
    const idx = logs.findIndex(l => l.date === date);
    if (idx >= 0) {
        logs[idx].entries = logs[idx].entries.filter(e => e.id !== entryId);
        if (logs[idx].entries.length === 0) {
            logs.splice(idx, 1);
        }
        syncedSetItem(FOOD_STORAGE_KEY, logs);
    }
}

export function getTotalCalories(log: DailyFoodLog): { calories: number; protein: number; carbs: number; fat: number } {
    return log.entries.reduce((acc, e) => ({
        calories: acc.calories + e.calories,
        protein: acc.protein + e.protein,
        carbs: acc.carbs + e.carbs,
        fat: acc.fat + e.fat,
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

// ── 식단 프리셋 (저장된 식단 템플릿) ──────────────────────────
const PRESET_STORAGE_KEY = 'health-dashboard-meal-presets' as const;

export function getMealPresets(): MealPreset[] {
    if (typeof window === 'undefined') return [];
    try {
        const data = localStorage.getItem(PRESET_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

export function saveMealPreset(preset: MealPreset): void {
    const presets = getMealPresets();
    const idx = presets.findIndex(p => p.id === preset.id);
    if (idx >= 0) {
        presets[idx] = preset;
    } else {
        presets.unshift(preset); // 최신 순 정렬
    }
    syncedSetItem(PRESET_STORAGE_KEY, presets);
}

export function deleteMealPreset(id: string): void {
    const presets = getMealPresets().filter(p => p.id !== id);
    syncedSetItem(PRESET_STORAGE_KEY, presets);
}

/** 프리셋의 음식들을 특정 날짜/식사에 일괄 추가 */
export function loadPresetToDate(
    date: string,
    preset: MealPreset,
    meal: FoodEntry['meal'],
    targetCalories: number = 2200
): void {
    const now = new Date().toTimeString().slice(0, 5);
    preset.entries.forEach((pe: MealPresetEntry, i: number) => {
        const entry: FoodEntry = {
            id: `food-preset-${Date.now()}-${i}`,
            time: now,
            meal,
            name: pe.name,
            description: pe.description,
            calories: pe.calories,
            protein: pe.protein,
            carbs: pe.carbs,
            fat: pe.fat,
        };
        saveFoodEntry(date, entry, targetCalories);
    });
}

// ── 음식 데이터베이스 (미리 저장된 음식 아이템) ──────────────────────────
const FOOD_ITEMS_STORAGE_KEY = 'health-dashboard-food-items' as const;

// 기본 음식 목록 (50개)
const DEFAULT_FOOD_ITEMS: FoodItem[] = [
    // ── 주식 (밥/면) ──
    { id: 'food-rice-bowl',        name: '흰쌀밥 1공기',      description: '일반 흰쌀밥 (210g)',               calories: 310, protein: 5,    carbs: 68,   fat: 0.5, createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-brown-rice',       name: '현미밥 1공기',      description: '현미밥 (210g)',                    calories: 295, protein: 6,    carbs: 63,   fat: 1.5, createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-ramen',            name: '라면 1봉',          description: '인스턴트 라면 1인분',              calories: 470, protein: 11,   carbs: 71,   fat: 17,  createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-gimbap',           name: '김밥 1줄',          description: '참치·야채 김밥 1줄',              calories: 340, protein: 12,   carbs: 52,   fat: 8,   createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-bibimbap',         name: '비빔밥 1인분',      description: '야채 비빔밥 + 고추장',             calories: 540, protein: 18,   carbs: 80,   fat: 16,  createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-tteokbokki',       name: '떡볶이 1인분',      description: '떡볶이 (350g)',                    calories: 420, protein: 9,    carbs: 85,   fat: 5,   createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-triangle-gimbap',  name: '삼각김밥',          description: '편의점 삼각김밥 1개',              calories: 175, protein: 4,    carbs: 32,   fat: 3,   createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-udon',             name: '우동 1인분',        description: '일본식 우동 (면+국물)',             calories: 350, protein: 14,   carbs: 62,   fat: 5,   createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-jjajang',          name: '짜장면 1인분',      description: '중화식 짜장면 (550g)',              calories: 620, protein: 18,   carbs: 100,  fat: 18,  createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-naengmyeon',       name: '냉면 1인분',        description: '물냉면 또는 비빔냉면',              calories: 350, protein: 14,   carbs: 68,   fat: 3,   createdAt: '2024-01-01T00:00:00.000Z' },

    // ── 육류 ──
    { id: 'food-pork-belly',       name: '삼겹살 200g',       description: '구운 삼겹살 (200g)',               calories: 730, protein: 38,   carbs: 0,    fat: 64,  createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-bulgogi',          name: '불고기 1인분',      description: '소불고기 (200g)',                  calories: 300, protein: 28,   carbs: 15,   fat: 12,  createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-jeyuk',            name: '제육볶음 1인분',    description: '돼지고기 제육볶음 (200g)',           calories: 390, protein: 30,   carbs: 15,   fat: 24,  createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-chicken-breast',   name: '닭가슴살 100g',     description: '구운 닭가슴살 (100g)',              calories: 165, protein: 31,   carbs: 0,    fat: 3.6, createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-beef-100',         name: '소고기 100g',       description: '한우 등심 구이 (100g)',             calories: 250, protein: 26,   carbs: 0,    fat: 16,  createdAt: '2024-01-01T00:00:00.000Z' },

    // ── 생선·해산물 ──
    { id: 'food-salmon',           name: '연어 100g',         description: '구운 연어 (100g)',                 calories: 206, protein: 22,   carbs: 0,    fat: 13,  createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-mackerel',         name: '고등어 1토막',      description: '구운 고등어 (100g)',               calories: 190, protein: 22,   carbs: 0,    fat: 11,  createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-tuna-can',         name: '참치캔 100g',       description: '물참치 (100g)',                    calories: 150, protein: 23,   carbs: 0,    fat: 6,   createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-shrimp',           name: '새우 100g',         description: '삶은 새우 (100g)',                 calories: 99,  protein: 24,   carbs: 0,    fat: 1,   createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-squid',            name: '오징어 100g',       description: '데친 오징어 (100g)',               calories: 92,  protein: 18,   carbs: 0,    fat: 1.2, createdAt: '2024-01-01T00:00:00.000Z' },

    // ── 한식 찌개·반찬 ──
    { id: 'food-doenjang-jjigae',  name: '된장찌개 1그릇',   description: '두부·야채 된장찌개',                calories: 95,  protein: 8,    carbs: 8,    fat: 3,   createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-kimchi-jjigae',    name: '김치찌개 1그릇',   description: '돼지고기 김치찌개',                 calories: 200, protein: 14,   carbs: 12,   fat: 10,  createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-sundubu',          name: '순두부찌개 1그릇', description: '해물 순두부찌개',                   calories: 190, protein: 13,   carbs: 12,   fat: 9,   createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-kimchi',           name: '김치 100g',        description: '배추김치 (100g)',                   calories: 30,  protein: 2,    carbs: 5,    fat: 0.5, createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-tofu',             name: '두부 100g',        description: '찌개용 두부 (100g)',                calories: 84,  protein: 9,    carbs: 2,    fat: 5,   createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-egg',              name: '계란 1개',         description: '계란 (구운 또는 삶은)',              calories: 78,  protein: 6.3,  carbs: 0.6,  fat: 5,   createdAt: '2024-01-01T00:00:00.000Z' },

    // ── 패스트푸드 ──
    { id: 'food-burger',           name: '햄버거 1개',       description: '일반 햄버거 (패스트푸드)',           calories: 500, protein: 24,   carbs: 43,   fat: 26,  createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-fries',            name: '프렌치프라이 중',  description: '패스트푸드 감자튀김 (중)',           calories: 340, protein: 4,    carbs: 44,   fat: 16,  createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-pizza',            name: '피자 1조각',       description: '일반 피자 1조각 (1/8)',             calories: 285, protein: 12,   carbs: 36,   fat: 10,  createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-fried-chicken',    name: '후라이드치킨 1조각', description: '후라이드치킨 다리 또는 날개',    calories: 320, protein: 30,   carbs: 11,   fat: 17,  createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-hotdog',           name: '핫도그 1개',       description: '소시지 핫도그',                     calories: 300, protein: 10,   carbs: 26,   fat: 17,  createdAt: '2024-01-01T00:00:00.000Z' },

    // ── 빵·과자·디저트 ──
    { id: 'food-bread',            name: '식빵 1장',         description: '슬라이스 식빵 (30g)',               calories: 80,  protein: 2.5,  carbs: 14,   fat: 1,   createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-croissant',        name: '크로와상 1개',     description: '크로와상 (50g)',                    calories: 240, protein: 5,    carbs: 28,   fat: 12,  createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-donut',            name: '도넛 1개',         description: '글레이즈드 도넛 (60g)',              calories: 253, protein: 4,    carbs: 32,   fat: 12,  createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-chocolate',        name: '초콜릿 바 1개',    description: '밀크초콜릿 바 (40g)',               calories: 210, protein: 3,    carbs: 24,   fat: 12,  createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-icecream',         name: '아이스크림 1스쿱', description: '아이스크림 바닐라 1스쿱 (100g)',    calories: 200, protein: 3.5,  carbs: 24,   fat: 10,  createdAt: '2024-01-01T00:00:00.000Z' },

    // ── 과일 ──
    { id: 'food-apple',            name: '사과 1개',         description: '사과 중간 크기 (182g)',             calories: 95,  protein: 0.5,  carbs: 25,   fat: 0.3, createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-banana',           name: '바나나 1개',       description: '바나나 중간 크기 (118g)',           calories: 105, protein: 1.3,  carbs: 27,   fat: 0.3, createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-strawberry',       name: '딸기 100g',        description: '딸기 (100g)',                       calories: 32,  protein: 0.7,  carbs: 7.7,  fat: 0.3, createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-orange',           name: '오렌지 1개',       description: '오렌지 중간 크기 (130g)',           calories: 62,  protein: 1.2,  carbs: 15,   fat: 0.2, createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-watermelon',       name: '수박 200g',        description: '수박 (200g)',                       calories: 60,  protein: 1.2,  carbs: 15,   fat: 0.2, createdAt: '2024-01-01T00:00:00.000Z' },

    // ── 음료 ──
    { id: 'food-cola',             name: '콜라 500ml',       description: '탄산음료 콜라 500ml',               calories: 210, protein: 0,    carbs: 56,   fat: 0,   createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-oj',               name: '오렌지주스 250ml', description: '100% 오렌지주스 (250ml)',           calories: 110, protein: 1.7,  carbs: 26,   fat: 0.5, createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-americano',        name: '아메리카노',       description: '아메리카노 (Shot 2잔 기준)',         calories: 15,  protein: 0,    carbs: 3,    fat: 0,   createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-latte',            name: '카페라떼',         description: '우유 카페라떼 (355ml)',              calories: 190, protein: 7,    carbs: 19,   fat: 8,   createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-sports-drink',     name: '이온음료 500ml',   description: '스포츠 이온음료 (500ml)',            calories: 90,  protein: 0,    carbs: 22,   fat: 0,   createdAt: '2024-01-01T00:00:00.000Z' },

    // ── 유제품 ──
    { id: 'food-milk',             name: '우유 200ml',       description: '일반 우유 (200ml)',                 calories: 134, protein: 6.6,  carbs: 9.7,  fat: 7.4, createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-yogurt',           name: '요구르트 100g',    description: '플레인 요구르트 (100g)',            calories: 100, protein: 3.5,  carbs: 17,   fat: 2,   createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-cheese',           name: '치즈 1장',         description: '슬라이스 치즈 (20g)',               calories: 70,  protein: 4.5,  carbs: 0.5,  fat: 5.5, createdAt: '2024-01-01T00:00:00.000Z' },

    // ── 채소·견과류 ──
    { id: 'food-broccoli',         name: '브로콜리 100g',    description: '삶은 브로콜리 (100g)',              calories: 34,  protein: 2.8,  carbs: 6.6,  fat: 0.4, createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-sweet-potato',     name: '고구마 100g',      description: '찐 고구마 (100g)',                  calories: 90,  protein: 1.6,  carbs: 21,   fat: 0.1, createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-almond',           name: '아몬드 30g',       description: '아몬드 한 줌 (약 23개)',            calories: 176, protein: 6,    carbs: 6,    fat: 15,  createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'food-soymilk',          name: '두유 200ml',       description: '무가당 두유 (200ml)',               calories: 90,  protein: 6,    carbs: 6,    fat: 4,   createdAt: '2024-01-01T00:00:00.000Z' },
];

export function getFoodItems(): FoodItem[] {
    if (typeof window === 'undefined') return DEFAULT_FOOD_ITEMS;
    try {
        const data = localStorage.getItem(FOOD_ITEMS_STORAGE_KEY);
        if (!data) {
            syncedSetItem(FOOD_ITEMS_STORAGE_KEY, DEFAULT_FOOD_ITEMS);
            return DEFAULT_FOOD_ITEMS;
        }
        const saved: FoodItem[] = JSON.parse(data);
        // 기본 목록 중 사용자 DB에 없는 항목을 끝에 추가 (업그레이드 지원)
        const savedIds = new Set(saved.map(i => i.id));
        const missing = DEFAULT_FOOD_ITEMS.filter(i => !savedIds.has(i.id));
        if (missing.length > 0) {
            const merged = [...saved, ...missing];
            syncedSetItem(FOOD_ITEMS_STORAGE_KEY, merged);
            return merged;
        }
        return saved;
    } catch {
        return DEFAULT_FOOD_ITEMS;
    }
}

export function saveFoodItem(item: FoodItem): void {
    const items = getFoodItems();
    const idx = items.findIndex(i => i.id === item.id);
    if (idx >= 0) {
        items[idx] = item;
    } else {
        items.unshift(item);
    }
    syncedSetItem(FOOD_ITEMS_STORAGE_KEY, items);
}

export function deleteFoodItem(id: string): void {
    const items = getFoodItems().filter(i => i.id !== id);
    syncedSetItem(FOOD_ITEMS_STORAGE_KEY, items);
}

export function searchFoodItems(query: string): FoodItem[] {
    const items = getFoodItems();
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(item =>
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
}
