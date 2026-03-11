'use client';

import { FoodEntry, DailyFoodLog, MealPreset, MealPresetEntry } from './types';
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
