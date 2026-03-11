'use client';

import { WorkoutLog, WorkoutEntry } from './types';
import { syncedSetItem } from './storage-sync';

const WORKOUT_STORAGE_KEY = 'health-dashboard-workout-logs' as const;

export function getWorkoutLogs(): WorkoutLog[] {
    if (typeof window === 'undefined') return [];
    try {
        const data = localStorage.getItem(WORKOUT_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

export function getWorkoutLogByDate(date: string): WorkoutLog | null {
    const logs = getWorkoutLogs();
    return logs.find(l => l.date === date) || null;
}

export function saveWorkoutEntry(date: string, entry: WorkoutEntry): void {
    const logs = getWorkoutLogs();
    const idx = logs.findIndex(l => l.date === date);
    if (idx >= 0) {
        logs[idx].entries.push(entry);
    } else {
        logs.push({ date, entries: [entry] });
    }
    syncedSetItem(WORKOUT_STORAGE_KEY, logs);
}

export function deleteWorkoutEntry(date: string, entryId: string): void {
    const logs = getWorkoutLogs();
    const idx = logs.findIndex(l => l.date === date);
    if (idx >= 0) {
        logs[idx].entries = logs[idx].entries.filter(e => e.id !== entryId);
        if (logs[idx].entries.length === 0) {
            logs.splice(idx, 1);
        }
        syncedSetItem(WORKOUT_STORAGE_KEY, logs);
    }
}

export function getMonthlyWorkoutLogs(year: number, month: number): WorkoutLog[] {
    const logs = getWorkoutLogs();
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    return logs.filter(l => l.date.startsWith(prefix));
}

// TODO: Slack 연동 준비
// Slack에서 운동 기록을 전송하면 자동으로 추가하는 기능
// Endpoint: /api/slack/workout (webhook receiver)
// Flow: Slack 메시지 -> webhook -> saveWorkoutEntry
