'use client';

/**
 * 서버(Redis) <-> localStorage 양방향 동기화
 *
 * 전략:
 * - 쓰기: localStorage 즉시 저장 + 백그라운드 서버 저장 (fire-and-forget)
 * - 읽기(초기화): 서버 데이터와 로컬 데이터를 스마트 병합 (더 많은 쪽 보존)
 *   → 병합 결과가 서버보다 크면 서버에도 역업로드 (다른 기기에 전파)
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
    localStorage.setItem(key, JSON.stringify(data));
    fetch(`/api/storage?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    }).catch(() => {});
}

/**
 * 두 배열을 ID 기준으로 병합 (양쪽의 유니크 항목을 모두 보존)
 * - 같은 ID가 있으면 로컬 우선 (더 최신 수정 가능)
 * - 정렬이 필요하면 sortFn 사용
 */
function mergeById<T extends { id: string }>(
    server: T[],
    local: T[],
    sortFn?: (a: T, b: T) => number
): T[] {
    const map = new Map<string, T>();
    // 서버 먼저, 로컬이 덮어씀 (로컬 = 더 최신)
    server.forEach(r => { if (r?.id) map.set(r.id, r); });
    local.forEach(r => { if (r?.id) map.set(r.id, r); });
    const merged = Array.from(map.values());
    return sortFn ? merged.sort(sortFn) : merged;
}

/**
 * 두 배열을 날짜(date) 기준으로 병합
 * - 같은 날짜면 로컬 우선
 */
function mergeByDate<T extends { date: string }>(server: T[], local: T[]): T[] {
    const map = new Map<string, T>();
    server.forEach(r => { if (r?.date) map.set(r.date, r); });
    local.forEach(r => { if (r?.date) map.set(r.date, r); });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 키에 따라 적절한 병합 전략 선택
 */
function smartMerge(key: SyncKey, serverData: unknown, localData: unknown): unknown {
    // 둘 다 배열이어야 merge 가능
    if (!Array.isArray(serverData) || !Array.isArray(localData)) {
        // 배열이 아니면 null이 아닌 쪽 사용, 둘 다 있으면 로컬 우선
        if (serverData !== null && serverData !== undefined && localData === null) return serverData;
        return localData ?? serverData;
    }

    if (key === 'health-dashboard-records') {
        // InBody 기록: ID 기반 merge + 날짜순 정렬
        return mergeById(
            serverData as { id: string }[],
            localData as { id: string }[],
            (a: any, b: any) =>
                new Date(a.metrics?.date || 0).getTime() - new Date(b.metrics?.date || 0).getTime()
        );
    }

    if (key === 'health-dashboard-food-logs' || key === 'health-dashboard-workout-logs') {
        // 일지: 날짜 기반 merge
        return mergeByDate(
            serverData as { date: string }[],
            localData as { date: string }[]
        );
    }

    if (
        key === 'health-dashboard-meal-presets' ||
        key === 'health-dashboard-food-items'
    ) {
        // ID 기반 merge
        return mergeById(serverData as { id: string }[], localData as { id: string }[]);
    }

    if (key === 'health-dashboard-chat-messages') {
        // 채팅: ID 기반 merge + 시간순 정렬
        return mergeById(
            serverData as { id: string }[],
            localData as { id: string }[],
            (a: any, b: any) =>
                new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
        );
    }

    // 기본: 더 많은 배열 우선
    return serverData.length >= localData.length ? serverData : localData;
}

/**
 * 페이지 로드 시 호출: 서버 ↔ 로컬 양방향 스마트 병합
 */
export async function syncFromServer(): Promise<void> {
    await Promise.allSettled(
        SYNC_KEYS.map(async (key) => {
            try {
                const res = await fetch(`/api/storage?key=${key}`, { cache: 'no-store' });
                if (!res.ok) return;
                const serverData = await res.json();

                // 로컬 데이터 읽기
                const localRaw = localStorage.getItem(key);
                const localData = localRaw ? JSON.parse(localRaw) : null;

                if (serverData === null) {
                    // 서버에 데이터 없음 → 로컬 데이터 서버에 업로드
                    if (localData !== null) {
                        fetch(`/api/storage?key=${key}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(localData),
                        }).catch(() => {});
                    }
                    return;
                }

                if (localData === null) {
                    // 로컬에 데이터 없음 → 서버 데이터로 로컬 채우기
                    localStorage.setItem(key, JSON.stringify(serverData));
                    return;
                }

                // 양쪽에 데이터 있음 → 스마트 병합
                const merged = smartMerge(key, serverData, localData);
                localStorage.setItem(key, JSON.stringify(merged));

                // 병합 결과가 서버보다 크면 역업로드 (다른 기기에 전파)
                const serverLen = Array.isArray(serverData) ? serverData.length : 0;
                const mergedLen = Array.isArray(merged) ? merged.length : 0;
                if (mergedLen > serverLen) {
                    fetch(`/api/storage?key=${key}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(merged),
                    }).catch(() => {});
                }
            } catch {
                // 네트워크 오류 → localStorage로 그대로 동작
            }
        })
    );
}
