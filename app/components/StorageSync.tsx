'use client';

import { useEffect, useCallback, useRef } from 'react';
import { syncFromServer } from '@/app/lib/storage-sync';

interface StorageSyncProps {
    /** 동기화 완료 후 콜백 (선택) */
    onSynced?: () => void;
}

const POLL_INTERVAL_MS = 300_000; // 5분마다 재동기화 (Vercel 무료 한도 절약)

/**
 * 페이지 마운트 시 + 탭 활성화 시 + 30초마다 서버 데이터를 동기화.
 * 다른 기기(핸드폰 등)에서 입력한 데이터가 바로 반영됩니다.
 */
export default function StorageSync({ onSynced }: StorageSyncProps) {
    const isSyncing = useRef(false);

    const sync = useCallback(async () => {
        if (isSyncing.current) return; // 중복 실행 방지
        isSyncing.current = true;
        try {
            await syncFromServer();
        } catch {
            // 서버 없이도 localStorage로 동작
        } finally {
            isSyncing.current = false;
            onSynced?.();
        }
    }, [onSynced]);

    useEffect(() => {
        // 1) 최초 로드 시 동기화
        sync();

        // 2) 탭이 다시 포커스/활성화될 때 동기화 (다른 기기에서 입력 후 전환 시)
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') sync();
        };
        document.addEventListener('visibilitychange', handleVisibility);

        // 3) 30초마다 주기적 재동기화
        const timer = setInterval(sync, POLL_INTERVAL_MS);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            clearInterval(timer);
        };
    }, [sync]);

    return null;
}
