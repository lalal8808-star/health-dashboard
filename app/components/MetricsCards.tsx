'use client';

import { AnalysisRecord } from '@/app/lib/types';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface MetricsCardsProps {
    records: AnalysisRecord[];
}

export default function MetricsCards({ records }: MetricsCardsProps) {
    if (!records || records.length === 0) {
        return (
            <div className="no-data-message" style={{ gridColumn: '1 / -1' }}>
                <div className="no-data-icon">📊</div>
                <p>분석 기록이 없습니다. 결과지를 업로드해 주세요.</p>
            </div>
        );
    }

    // Sort records chronologically just in case
    const sorted = [...records].sort((a, b) => new Date(a.metrics.date).getTime() - new Date(b.metrics.date).getTime());
    const latest = sorted[sorted.length - 1].metrics;

    // Calculate total delta from the first to latest record
    const first = sorted[0].metrics;
    // Or maybe just from max/min? The HTML says "최고 76.8 -> 현재 74.9"
    // Let's find max and min

    const getStats = (key: 'weight' | 'skeletalMuscle' | 'bodyFatMass' | 'inbodyScore') => {
        const values = sorted.map(r => r.metrics[key]).filter(v => v !== null && v !== undefined) as number[];
        if (values.length === 0) return { current: null, first: null, max: null, min: null, delta: null, numDays: 0 };

        const current = values[values.length - 1];
        const firstVal = values[0];
        const max = Math.max(...values);
        const min = Math.min(...values);

        const firstDate = new Date(sorted[0].metrics.date);
        const lastDate = new Date(sorted[sorted.length - 1].metrics.date);
        const diffTime = Math.abs(lastDate.getTime() - firstDate.getTime());
        const numDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return {
            current,
            first: firstVal,
            max,
            min,
            delta: parseFloat((current - firstVal).toFixed(1)),
            numDays,
        };
    };

    const w = getStats('weight');
    const m = getStats('skeletalMuscle');
    const f = getStats('bodyFatMass');
    const s = getStats('inbodyScore'); // note: higher is better here usually

    const renderCard = (
        title: string, value: number | null, unit: string,
        stats: ReturnType<typeof getStats>,
        colorHex: string, invertDelta: boolean,
        isScore: boolean = false
    ) => {
        if (value === null) return null;

        const isUp = stats.delta! > 0;
        const isDown = stats.delta! < 0;
        const isNeutral = stats.delta === 0;

        // Custom logic: Weight/Fat down is good (green), Score/Muscle up is good (green)
        let deltaClass = 'neutral';
        if (invertDelta) {
            if (isDown) deltaClass = 'up'; // good
            if (isUp) deltaClass = 'down'; // bad
        } else {
            if (isUp) deltaClass = 'up'; // good
            if (isDown) deltaClass = 'down'; // bad
        }

        return (
            <div className="kpi-card animate-slideUp" style={{ '--accent-light': colorHex } as React.CSSProperties}>
                <div className="kpi-label">{title}</div>
                <div className="kpi-value">{value}<span className="kpi-unit">{unit}</span></div>

                {stats.numDays > 0 && (
                    <>
                        <div className={`kpi-delta ${deltaClass}`}>
                            {isUp && '▲'}
                            {isDown && '▼'}
                            {isNeutral && '-'}
                            {' '}
                            {Math.abs(stats.delta!)}{unit} <span style={{ color: 'var(--text-dim)', marginLeft: '4px' }}>{stats.numDays}일간</span>
                        </div>
                        <div className="kpi-period">
                            {isScore ? `최저 ${stats.min} → 현재 ${value}` : `최고 ${stats.max} → 현재 ${value}`}
                        </div>
                    </>
                )}
            </div>
        );
    };

    return (
        <div className="kpi-row-scroll-wrapper">
            <div className="kpi-row">
                {renderCard('체중', latest.weight, 'kg', w, '#3b82f6', true)}
                {renderCard('골격근량', latest.skeletalMuscle, 'kg', m, '#10b981', false)}
                {renderCard('체지방량', latest.bodyFatMass, 'kg', f, '#ef4444', true)}
                {renderCard('인바디 점수', latest.inbodyScore, '점', s, '#f59e0b', false, true)}
            </div>
        </div>
    );
}
