import { AnalysisRecord, ChartDataPoint } from './types';
import { syncedSetItem } from './storage-sync';

const STORAGE_KEY = 'health-dashboard-records' as const;

export function getRecords(): AnalysisRecord[] {
    if (typeof window === 'undefined') return [];
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return [];
        const parsed = JSON.parse(data);
        // 배열이 아니거나 각 요소가 유효한 레코드가 아닌 경우 초기화
        if (!Array.isArray(parsed)) {
            localStorage.removeItem(STORAGE_KEY);
            return [];
        }
        const valid = parsed.filter(
            (r): r is AnalysisRecord =>
                r !== null &&
                typeof r === 'object' &&
                typeof r.id === 'string' &&
                r.metrics != null &&
                typeof r.metrics.date === 'string'
        );

        // 날짜가 겹치는 기록 자동 정리 (가장 최근에 저장된 것만 유지)
        const byDate = new Map<string, AnalysisRecord>();
        valid.forEach(r => {
            const existing = byDate.get(r.metrics.date);
            // createdAt이 없을 수 있으므로 대비
            const rTime = r.createdAt ? new Date(r.createdAt).getTime() : 0;
            const existingTime = existing?.createdAt ? new Date(existing.createdAt).getTime() : 0;
            if (!existing || rTime > existingTime) {
                byDate.set(r.metrics.date, r);
            }
        });
        const deduped = Array.from(byDate.values()).sort(
            (a, b) => new Date(a.metrics.date).getTime() - new Date(b.metrics.date).getTime()
        );

        // 유효하지 않은 항목이 있거나 중복이 제거된 경우 스토리지 업데이트
        if (valid.length !== parsed.length || deduped.length !== valid.length) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped));
        }
        return deduped;
    } catch {
        localStorage.removeItem(STORAGE_KEY);
        return [];
    }
}

export function saveRecord(record: AnalysisRecord): void {
    const records = getRecords();
    // ID 또는 날짜가 같은 기존 레코드를 모두 제거하고 새 레코드로 교체
    const filtered = records.filter(
        r => r.id !== record.id && r.metrics.date !== record.metrics.date
    );
    filtered.push(record);
    filtered.sort((a, b) => new Date(a.metrics.date).getTime() - new Date(b.metrics.date).getTime());
    syncedSetItem(STORAGE_KEY, filtered);
}

export function deleteRecord(id: string): void {
    const records = getRecords().filter(r => r.id !== id);
    syncedSetItem(STORAGE_KEY, records);
}

/**
 * 여러 레코드를 한 번에 저장 (CSV 가져오기 등 대량 저장 시 사용)
 * - 날짜 기준 dedup: 같은 날짜면 newRecords 우선
 * - localStorage + Redis 단 1번 저장
 */
export function bulkSaveRecords(newRecords: AnalysisRecord[]): void {
    const existing = getRecords();
    const incomingDates = new Set(newRecords.map(r => r.metrics.date));
    const incomingIds   = new Set(newRecords.map(r => r.id));
    // 기존 중 날짜/ID가 겹치지 않는 것만 보존
    const base = existing.filter(
        r => !incomingDates.has(r.metrics.date) && !incomingIds.has(r.id)
    );
    const merged = [...base, ...newRecords].sort(
        (a, b) => new Date(a.metrics.date).getTime() - new Date(b.metrics.date).getTime()
    );
    syncedSetItem(STORAGE_KEY, merged);
}

/**
 * 현재 저장된 레코드에서 날짜 중복 제거 (앱 최초 로드 시 1회 실행)
 * 같은 날짜가 여러 개면 createdAt이 가장 최신인 것 1개만 유지
 */
export function deduplicateRecordsByDate(): number {
    const records = getRecords();
    const byDate = new Map<string, AnalysisRecord>();
    records.forEach(r => {
        const existing = byDate.get(r.metrics.date);
        if (!existing || new Date(r.createdAt) > new Date(existing.createdAt)) {
            byDate.set(r.metrics.date, r);
        }
    });
    const deduped = Array.from(byDate.values()).sort(
        (a, b) => new Date(a.metrics.date).getTime() - new Date(b.metrics.date).getTime()
    );
    const removed = records.length - deduped.length;
    if (removed > 0) {
        syncedSetItem(STORAGE_KEY, deduped);
    }
    return removed; // 제거된 개수 반환
}

export function getLatestRecord(): AnalysisRecord | null {
    const records = getRecords();
    return records.length > 0 ? records[records.length - 1] : null;
}

export function getChartData(): ChartDataPoint[] {
    return getRecords().map(r => ({
        date: formatDate(r.metrics.date),
        weight: r.metrics.weight ?? undefined,
        skeletalMuscle: r.metrics.skeletalMuscle ?? undefined,
        bodyFatPercent: r.metrics.bodyFatPercent ?? undefined,
        bmi: r.metrics.bmi ?? undefined,
        basalMetabolicRate: r.metrics.basalMetabolicRate ?? undefined,
        inbodyScore: r.metrics.inbodyScore ?? undefined,
        bodyFatMass: r.metrics.bodyFatMass ?? undefined,
        waistHipRatio: r.metrics.waistHipRatio ?? undefined,
    }));
}

export function getMetricsDelta(current: AnalysisRecord): Record<string, number | null> {
    const records = getRecords();
    const currentIndex = records.findIndex(r => r.id === current.id);
    if (currentIndex <= 0) return {};

    const prev = records[currentIndex - 1].metrics;
    const curr = current.metrics;

    return {
        weight: curr.weight && prev.weight ? +(curr.weight - prev.weight).toFixed(1) : null,
        skeletalMuscle: curr.skeletalMuscle && prev.skeletalMuscle ? +(curr.skeletalMuscle - prev.skeletalMuscle).toFixed(1) : null,
        bodyFatPercent: curr.bodyFatPercent && prev.bodyFatPercent ? +(curr.bodyFatPercent - prev.bodyFatPercent).toFixed(1) : null,
        bodyFatMass: curr.bodyFatMass && prev.bodyFatMass ? +(curr.bodyFatMass - prev.bodyFatMass).toFixed(1) : null,
        inbodyScore: curr.inbodyScore && prev.inbodyScore ? +(curr.inbodyScore - prev.inbodyScore).toFixed(0) : null,
        bmi: curr.bmi && prev.bmi ? +(curr.bmi - prev.bmi).toFixed(1) : null,
        basalMetabolicRate: curr.basalMetabolicRate && prev.basalMetabolicRate ? +(curr.basalMetabolicRate - prev.basalMetabolicRate).toFixed(0) : null,
    };
}

function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
