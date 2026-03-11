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
        // 유효하지 않은 항목이 있었으면 정리
        if (valid.length !== parsed.length) {
            localStorage.removeItem(STORAGE_KEY);
            return [];
        }
        return valid;
    } catch {
        localStorage.removeItem(STORAGE_KEY);
        return [];
    }
}

export function saveRecord(record: AnalysisRecord): void {
    const records = getRecords();
    const existingIndex = records.findIndex(r => r.id === record.id);
    if (existingIndex >= 0) {
        records[existingIndex] = record;
    } else {
        records.push(record);
    }
    records.sort((a, b) => new Date(a.metrics.date).getTime() - new Date(b.metrics.date).getTime());
    syncedSetItem(STORAGE_KEY, records);
}

export function deleteRecord(id: string): void {
    const records = getRecords().filter(r => r.id !== id);
    syncedSetItem(STORAGE_KEY, records);
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
