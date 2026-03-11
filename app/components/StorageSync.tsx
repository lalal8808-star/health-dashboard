'use client';

import { useEffect, useCallback } from 'react';
import { syncFromServer } from '@/app/lib/storage-sync';

interface StorageSyncProps {
    /** 동기화 완료 후 콜백 (선택) */
    onSynced?: () => void;
}

/**
 * 페이지 마운트 시 서버 데이터를 localStorage에 동기화.
 * 렌더링 없이 사이드이펙트만 처리하는 invisible 컴포넌트.
 */
export default function StorageSync({ onSynced }: StorageSyncProps) {
    const sync = useCallback(async () => {
        try {
            await syncFromServer();
        } catch {
            // 서버 없이도 localStorage로 동작
        } finally {
            onSynced?.();
        }
    }, [onSynced]);

    useEffect(() => {
        sync();
    }, [sync]);

    return null;
}
