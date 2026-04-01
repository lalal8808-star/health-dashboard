'use client';

/**
 * 서버(Redis) <-> localStorage 양방향 동기화
 *
 * 최적화 v2:
 * - 읽기: /api/storage?key=all 배치 API (6개 키를 1 요청으로)
 * - 쓰기: 2초 디바운스 + 배치 POST (연속 저장을 모아 1 요청으로)
 * - 병합: 스마트 양방향 merge (서버+로컬 유니온)
 */

const SYNC_KEYS = [
    'health-dashboard-records',
    'health-dashboard-workout-logs',
    'health-dashboard-food-logs',
    'health-dashboard-meal-presets',
    'health-dashboard-date-modes',
    // 'health-dashboard-food-items' — 기본 DB는 코드에 내장, 동기화 불필요
    // 'health-dashboard-chat-messages' — 디바이스 고유 대화, 동기화하면 대역폭 폭증
] as const;

export type SyncKey = typeof SYNC_KEYS[number];

// ── 쓰기 디바운싱 ──────────────────────────────────────
// 2초 안에 여러 키가 저장되면 한 번의 batch POST로 전송
const pendingWrites = new Map<SyncKey, unknown>();
let writeTimer: ReturnType<typeof setTimeout> | null = null;
let flushPromise: Promise<void> | null = null; // in-flight 추적
const WRITE_DEBOUNCE_MS = 2_000;

function flushWrites(): Promise<void> {
    if (pendingWrites.size === 0) return Promise.resolve();
    const entries: Record<string, unknown> = {};
    pendingWrites.forEach((data, key) => { entries[key] = data; });
    pendingWrites.clear();
    writeTimer = null;

    flushPromise = fetch('/api/storage?key=batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entries),
    }).then(() => { flushPromise = null; }).catch(() => { flushPromise = null; });

    return flushPromise;
}

/** localStorage 저장 + 2초 디바운스 후 서버 배치 동기화 */
export function syncedSetItem(key: SyncKey, data: unknown): void {
    localStorage.setItem(key, JSON.stringify(data));
    pendingWrites.set(key, data);
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = setTimeout(flushWrites, WRITE_DEBOUNCE_MS);
}

/** localStorage 저장 + 즉시 서버 업로드 (삭제 등 즉시 반영이 필요한 경우) */
export async function syncedSetItemNow(key: SyncKey, data: unknown): Promise<void> {
    localStorage.setItem(key, JSON.stringify(data));
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = null;
    pendingWrites.set(key, data);
    await flushWrites(); // await로 완료 보장
}

// ── 스마트 병합 ──────────────────────────────────────
function mergeById<T extends { id: string }>(
    server: T[],
    local: T[],
    sortFn?: (a: T, b: T) => number
): T[] {
    const map = new Map<string, T>();
    server.forEach(r => { if (r?.id) map.set(r.id, r); });
    local.forEach(r => { if (r?.id) map.set(r.id, r); });
    const merged = Array.from(map.values());
    return sortFn ? merged.sort(sortFn) : merged;
}

function mergeByDate<T extends { date: string }>(server: T[], local: T[]): T[] {
    const map = new Map<string, T>();
    server.forEach(r => { if (r?.date) map.set(r.date, r); });
    local.forEach(r => {
        if (!r?.date) return;
        const existing = map.get(r.date);
        if (!existing) {
            map.set(r.date, r);
            return;
        }
        // updatedAt이 있으면: 더 최근에 수정된 쪽 우선 (삭제 후 복원 문제 해결)
        const existingUpdatedAt = (existing as any).updatedAt;
        const localUpdatedAt = (r as any).updatedAt;
        if (localUpdatedAt || existingUpdatedAt) {
            const localTime = localUpdatedAt ? new Date(localUpdatedAt).getTime() : 0;
            const existingTime = existingUpdatedAt ? new Date(existingUpdatedAt).getTime() : 0;
            if (localTime >= existingTime) {
                map.set(r.date, r);
            }
            // 서버가 더 최신이면 서버 유지
        } else {
            // updatedAt 없는 구 데이터: entries가 더 많은 쪽 유지 (기존 동작)
            const existingEntries = (existing as any).entries;
            const localEntries = (r as any).entries;
            const existingLen = Array.isArray(existingEntries) ? existingEntries.length : 0;
            const localLen = Array.isArray(localEntries) ? localEntries.length : 0;
            if (localLen >= existingLen) {
                map.set(r.date, r);
            }
        }
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function smartMerge(key: SyncKey, serverData: unknown, localData: unknown): unknown {
    if (!Array.isArray(serverData) || !Array.isArray(localData)) {
        if (serverData !== null && serverData !== undefined && localData === null) return serverData;
        return localData ?? serverData;
    }

    if (key === 'health-dashboard-records') {
        return mergeById(
            serverData as { id: string }[],
            localData as { id: string }[],
            (a: any, b: any) =>
                new Date(a.metrics?.date || 0).getTime() - new Date(b.metrics?.date || 0).getTime()
        );
    }

    if (key === 'health-dashboard-food-logs' || key === 'health-dashboard-workout-logs') {
        return mergeByDate(
            serverData as { date: string }[],
            localData as { date: string }[]
        );
    }

    if (key === 'health-dashboard-meal-presets') {
        return mergeById(serverData as { id: string }[], localData as { id: string }[]);
    }

    return serverData.length >= localData.length ? serverData : localData;
}

// ── 서버 동기화 (배치 API 사용) ──────────────────────────────
/**
 * 페이지 로드 / 탭 전환 시 호출: 서버 ↔ 로컬 양방향 스마트 병합
 * 1 GET 요청으로 모든 키를 읽음 (기존 6 GET → 1 GET)
 */
export async function syncFromServer(): Promise<void> {
    // 대기 중인 쓰기 + in-flight 요청이 완료될 때까지 기다린 후 읽기
    // (삭제 직후 syncFromServer가 실행되면 구버전 서버 데이터를 읽는 경쟁 방지)
    if (pendingWrites.size > 0) {
        await flushWrites();
    } else if (flushPromise) {
        await flushPromise;
    }

    try {
        const res = await fetch('/api/storage?key=all', { cache: 'no-store' });
        if (!res.ok) return;
        const serverAll = await res.json() as Record<string, unknown>;

        const toUpload: Record<string, unknown> = {};

        for (const key of SYNC_KEYS) {
            const serverData = serverAll[key] ?? null;
            const localRaw = localStorage.getItem(key);
            const localData = localRaw ? JSON.parse(localRaw) : null;

            if (serverData === null) {
                if (localData !== null) toUpload[key] = localData;
                continue;
            }

            if (localData === null) {
                localStorage.setItem(key, JSON.stringify(serverData));
                continue;
            }

            const merged = smartMerge(key as SyncKey, serverData, localData);
            localStorage.setItem(key, JSON.stringify(merged));

            // 서버보다 항목이 많거나, food/workout 로그에 로컬 변경(updatedAt)이 있으면 역업로드
            const serverLen = Array.isArray(serverData) ? serverData.length : 0;
            const mergedLen = Array.isArray(merged) ? merged.length : 0;
            const isFoodOrWorkout = key === 'health-dashboard-food-logs' || key === 'health-dashboard-workout-logs';
            const hasLocalUpdates = isFoodOrWorkout && Array.isArray(localData) &&
                localData.some((item: any) => item?.updatedAt);

            if (mergedLen > serverLen || hasLocalUpdates) {
                toUpload[key] = merged;
            }
        }

        // 역업로드가 필요한 키들 배치 전송 (1 POST)
        if (Object.keys(toUpload).length > 0) {
            fetch('/api/storage?key=batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(toUpload),
            }).catch(() => {});
        }
    } catch {
        // 네트워크 오류 → localStorage로 그대로 동작
    }
}
