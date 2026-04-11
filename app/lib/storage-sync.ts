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
    // 서버 항목을 먼저 삽입
    server.forEach(r => { if (r?.id) map.set(r.id, r); });
    // 로컬 항목: updatedAt이 있으면 최신 버전을 우선 채택 (tombstone 포함)
    local.forEach(r => {
        if (!r?.id) return;
        const existing = map.get(r.id);
        if (!existing) {
            map.set(r.id, r);
            return;
        }
        const existingTime = (existing as any).updatedAt ? new Date((existing as any).updatedAt).getTime() : 0;
        const localTime = (r as any).updatedAt ? new Date((r as any).updatedAt).getTime() : 0;
        // 로컬이 더 최신이거나 동일하면 로컬 우선 (삭제 tombstone 보존)
        if (localTime >= existingTime) {
            map.set(r.id, r);
        }
    });
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
let isSyncInProgress = false; // 동시 실행 방지 락

/**
 * 페이지 로드 / 탭 전환 시 호출: 서버 ↔ 로컬 양방향 스마트 병합
 * 1 GET 요청으로 모든 키를 읽음
 */
export async function syncFromServer(): Promise<void> {
    // 이미 동기화 중이면 스킵 (동시 호출로 인한 중복 요청 방지)
    if (isSyncInProgress) return;
    isSyncInProgress = true;

    try {
        // 대기 중인 쓰기 완료 대기
        if (pendingWrites.size > 0) {
            await flushWrites();
        } else if (flushPromise) {
            await flushPromise;
        }

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

            // 로컬이 서버보다 최신인 경우만 역업로드 (무한루프 방지)
            const serverLen = Array.isArray(serverData) ? serverData.length : 0;
            const mergedLen = Array.isArray(merged) ? merged.length : 0;
            const isFoodOrWorkout = key === 'health-dashboard-food-logs' || key === 'health-dashboard-workout-logs';

            let shouldUpload = mergedLen > serverLen;
            if (!shouldUpload && isFoodOrWorkout && Array.isArray(localData) && Array.isArray(serverData)) {
                const serverByDate = new Map((serverData as any[]).map((r: any) => [r.date, r]));
                shouldUpload = (localData as any[]).some((localItem: any) => {
                    if (!localItem?.updatedAt) return false;
                    const serverItem = serverByDate.get(localItem.date);
                    if (!serverItem) return true;
                    const serverTime = serverItem.updatedAt ? new Date(serverItem.updatedAt).getTime() : 0;
                    const localTime = new Date(localItem.updatedAt).getTime();
                    return localTime > serverTime;
                });
            }
            // meal-presets: updatedAt(삭제 tombstone 포함) 기준으로 역업로드 판단
            if (!shouldUpload && key === 'health-dashboard-meal-presets' && Array.isArray(localData) && Array.isArray(serverData)) {
                const serverById = new Map((serverData as any[]).map((r: any) => [r.id, r]));
                shouldUpload = (localData as any[]).some((localItem: any) => {
                    if (!localItem?.updatedAt) return false;
                    const serverItem = serverById.get(localItem.id);
                    if (!serverItem) return true;
                    const serverTime = serverItem.updatedAt ? new Date(serverItem.updatedAt).getTime() : 0;
                    const localTime = new Date(localItem.updatedAt).getTime();
                    return localTime > serverTime;
                });
            }

            if (shouldUpload) {
                toUpload[key] = merged;
            }
        }

        // 역업로드 — await로 완료 보장 (fire-and-forget 제거)
        if (Object.keys(toUpload).length > 0) {
            try {
                await fetch('/api/storage?key=batch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(toUpload),
                });
            } catch {
                // 네트워크 오류는 무시 — 다음 sync에서 재시도
            }
        }
    } catch {
        // 네트워크 오류 → localStorage로 그대로 동작
    } finally {
        isSyncInProgress = false;
    }
}
