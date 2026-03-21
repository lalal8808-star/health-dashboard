'use client';

import { useEffect, useRef } from 'react';
import { syncFromServer } from '@/app/lib/storage-sync';

interface StorageSyncProps {
    /** 동기화 완료 후 콜백 (선택) */
    onSynced?: () => void;
}

const POLL_INTERVAL_MS = 300_000; // 5분마다 재동기화

/**
 * 페이지 마운트 시 + 탭 활성화 시 + 5분마다 서버 데이터를 동기화.
 * onSynced를 useRef로 관리해 무한 루프 방지.
 */
export default function StorageSync({ onSynced }: StorageSyncProps) {
    const isSyncing = useRef(false);
    // onSynced를 ref로 저장 → 콜백이 바뀌어도 sync 함수 재생성 없음
    const onSyncedRef = useRef(onSynced);
    useEffect(() => { onSyncedRef.current = onSynced; }, [onSynced]);

    useEffect(() => {
        const sync = async () => {
            if (isSyncing.current) return;
            isSyncing.current = true;
            try {
                await syncFromServer();
            } catch {
                // 서버 없이도 localStorage로 동작
            } finally {
                isSyncing.current = false;
                onSyncedRef.current?.();
            }
        };

        // 1) 최초 로드 시 동기화
        sync();

        // 2) 탭 활성화 시 즉시 동기화
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') sync();
        };
        document.addEventListener('visibilitychange', handleVisibility);

        // 3) 5분마다 주기적 재동기화
        const timer = setInterval(sync, POLL_INTERVAL_MS);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            clearInterval(timer);
        };
    }, []); // 빈 배열 → 마운트 시 1회만 설정, 무한 루프 없음

    return null;
}
