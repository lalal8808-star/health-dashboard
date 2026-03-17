'use client';

/**
 * 서버 파일 <-> localStorage 동기화 유틸리티
 *
 * 전략:
 * - 쓰기: localStorage에 즉시 저장 + 백그라운드로 서버에도 저장 (fire-and-forget)
 * - 읽기(초기화): 서버에서 불러와 localStorage 갱신 (서버 데이터 우선)
 */

const SYNC_KEYS = [
    'health-dashboard-records',
    'health-dashboard-workout-logs',
    'health-dashboard-food-logs',
    'health-dashboard-meal-presets',
    'health-dashboard-food-items',
    'health-dashboard-chat-messages',
] as const;

export type SyncKey = typeof SYNC_KEYS[number];

/** localStorage 저장 + 백그라운드 서버 동기화 */
export function syncedSetItem(key: SyncKey, data: unknown): void {
    // 1) localStorage 즉시 저장
    localStorage.setItem(key, JSON.stringify(data));

    // 2) 서버에 백그라운드 저장 (에러 무시)
    fetch(`/api/storage?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    }).catch(() => { /* 오프라인 or 서버 오류 → localStorage로 동작 */ });
}

/** 서버에서 모든 데이터를 가져와 localStorage에 반영 (페이지 로드 시 호출) */
export async function syncFromServer(): Promise<void> {
    await Promise.allSettled(
        SYNC_KEYS.map(async (key) => {
            try {
                const res = await fetch(`/api/storage?key=${key}`);
                if (!res.ok) return;
                const serverData = await res.json();
                if (serverData === null) return; // 서버에 데이터 없으면 로컬 유지

                // 서버 데이터가 있으면 localStorage 갱신 (서버 우선)
                localStorage.setItem(key, JSON.stringify(serverData));
            } catch {
                // 네트워크 오류 → localStorage로 그대로 동작
            }
        })
    );
}
