'use client';

import { useEffect, useRef } from 'react';
import { syncFromServer } from '@/app/lib/storage-sync';

interface StorageSyncProps {
    /** 동기화 완료 후 콜백 (선택) */
    onSynced?: () => void;
}

const POLL_INTERVAL_MS = 900_000; // 15분마다 재동기화 (기존 5분 → 요청 66% 절감)
const TAB_FOCUS_COOLDOWN_MS = 60_000; // 탭 전환 시 1분 이내 재동기화 방지

/**
 * 페이지 마운트 시 + 탭 활성화 시(1분 쿨다운) + 15분마다 서버 데이터를 동기화.
 * onSynced를 useRef로 관리해 무한 루프 방지.
 */
export default function StorageSync({ onSynced }: StorageSyncProps) {
    const isSyncing = useRef(false);
    const lastSyncedAt = useRef(0);
    const onSyncedRef = useRef(onSynced);
    onSyncedRef.current = onSynced; // 렌더 중 직접 갱신 (useEffect 불필요)

    useEffect(() => {
        const sync = async (force = false) => {
            if (isSyncing.current) return;
            // 쿨다운: 마지막 동기화로부터 1분 미만이면 스킵 (탭 전환 반복 방지)
            if (!force && Date.now() - lastSyncedAt.current < TAB_FOCUS_COOLDOWN_MS) return;
            isSyncing.current = true;
            try {
                await syncFromServer();
                lastSyncedAt.current = Date.now();
            } catch {
                // 서버 없이도 localStorage로 동작
            } finally {
                isSyncing.current = false;
                onSyncedRef.current?.();
            }
        };

        // 1) 최초 로드 시 동기화 (강제)
        sync(true);

        // 2) 탭 활성화 시 동기화 (쿨다운 적용)
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') sync();
        };
        document.addEventListener('visibilitychange', handleVisibility);

        // 3) 15분마다 주기적 재동기화
        const timer = setInterval(() => sync(true), POLL_INTERVAL_MS);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            clearInterval(timer);
        };
    }, []);

    return null;
}
