'use client';

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from 'recharts';
import { ChartDataPoint } from '@/app/lib/types';

interface PredictionChartProps {
    chartData: ChartDataPoint[];
}

function linearRegression(data: { x: number; y: number }[]): { slope: number; intercept: number } {
    const n = data.length;
    if (n < 2) return { slope: 0, intercept: data[0]?.y || 0 };
    const sumX = data.reduce((s, d) => s + d.x, 0);
    const sumY = data.reduce((s, d) => s + d.y, 0);
    const sumXY = data.reduce((s, d) => s + d.x * d.y, 0);
    const sumX2 = data.reduce((s, d) => s + d.x * d.x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    return { slope, intercept };
}

export default function PredictionChart({ chartData }: PredictionChartProps) {
    if (chartData.length < 3) {
        return (
            <div className="chart-card" style={{ marginBottom: '24px', padding: '40px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-tertiary)' }}>예측을 위해 최소 3개 이상의 데이터가 필요합니다.</p>
            </div>
        );
    }

    const metrics: { key: keyof ChartDataPoint; label: string; color: string; unit: string }[] = [
        { key: 'weight', label: '체중', color: '#3b82f6', unit: 'kg' },
        { key: 'skeletalMuscle', label: '골격근량', color: '#10b981', unit: 'kg' },
        { key: 'bodyFatPercent', label: '체지방률', color: '#ef4444', unit: '%' },
    ];

    // Generate prediction data
    const predictions = metrics.map(m => {
        const valid = chartData
            .map((d, i) => ({ x: i, y: d[m.key] as number }))
            .filter(d => d.y !== undefined && d.y !== null && !isNaN(d.y));

        if (valid.length < 2) return null;

        const { slope, intercept } = linearRegression(valid);
        const lastIdx = valid.length - 1;
        const currentVal = valid[lastIdx].y;

        const predict14 = +(intercept + slope * (lastIdx + 14)).toFixed(1);
        const predict30 = +(intercept + slope * (lastIdx + 30)).toFixed(1);

        return {
            ...m,
            current: currentVal,
            predict14,
            predict30,
            delta14: +(predict14 - currentVal).toFixed(1),
            delta30: +(predict30 - currentVal).toFixed(1),
        };
    }).filter(Boolean);

    // Extended chart data with predictions
    const extendedData = [...chartData.map(d => ({ ...d, isPrediction: false }))];
    const lastDate = new Date(chartData[chartData.length - 1].date.replace(/(\d+)\/(\d+)/, '2026-$1-$2'));

    for (let i = 1; i <= 14; i++) {
        const futureDate = new Date(lastDate);
        futureDate.setDate(futureDate.getDate() + i);
        const dateLabel = `${futureDate.getMonth() + 1}/${futureDate.getDate()}`;

        const point: Record<string, unknown> = { date: dateLabel, isPrediction: true };
        metrics.forEach((m) => {
            const valid = chartData
                .map((d, idx) => ({ x: idx, y: d[m.key] as number }))
                .filter(d => d.y !== undefined && !isNaN(d.y));
            if (valid.length >= 2) {
                const { slope, intercept } = linearRegression(valid);
                point[`${String(m.key)}Pred`] = +(intercept + slope * (valid.length - 1 + i)).toFixed(1);
            }
        });
        extendedData.push(point as unknown as ChartDataPoint & { isPrediction: boolean });
    }

    const gridColor = 'rgba(255,255,255,0.05)';
    const tickFont = { fontSize: 10, fill: '#475569', fontFamily: 'monospace' };
    const todayIdx = chartData.length - 1;
    const todayLabel = extendedData[todayIdx]?.date;

    return (
        <div style={{ marginBottom: '32px' }}>
            <div className="chart-card">
                <div className="chart-title" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>🔮</span>
                    AI 체성분 예측 (14일)
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginLeft: '8px' }}>선형 회귀 기반</span>
                </div>

                <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={extendedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis dataKey="date" tickLine={false} axisLine={false} tick={tickFont} />
                        <YAxis tickLine={false} axisLine={false} tick={tickFont} domain={['auto', 'auto']} />
                        <Tooltip
                            contentStyle={{
                                background: 'rgba(17,24,39,0.95)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '12px',
                                fontSize: '12px',
                            }}
                        />
                        {todayLabel && <ReferenceLine x={todayLabel} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" label={{ value: '오늘', fill: '#94a3b8', fontSize: 10 }} />}

                        {/* Actual lines */}
                        <Line type="monotone" dataKey="weight" name="체중" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                        <Line type="monotone" dataKey="skeletalMuscle" name="골격근량" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                        <Line type="monotone" dataKey="bodyFatPercent" name="체지방률" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} connectNulls />

                        {/* Prediction lines */}
                        <Line type="monotone" dataKey="weightPred" name="체중(예측)" stroke="#3b82f6" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 2, strokeDasharray: '' }} connectNulls />
                        <Line type="monotone" dataKey="skeletalMusclePred" name="골격근량(예측)" stroke="#10b981" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 2, strokeDasharray: '' }} connectNulls />
                        <Line type="monotone" dataKey="bodyFatPercentPred" name="체지방률(예측)" stroke="#ef4444" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 2, strokeDasharray: '' }} connectNulls />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Prediction Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '12px' }}>
                {predictions.map((p) => {
                    if (!p) return null;
                    return (
                        <div key={p.key as string} className="insight-card" style={{ borderLeft: `3px solid ${p.color}` }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>{p.label} 예측</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>2주 후</span>
                                    <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {p.predict14}{p.unit}
                                        <span style={{ fontSize: '11px', marginLeft: '4px', color: p.delta14 > 0 ? '#10b981' : '#ef4444' }}>
                                            {p.delta14 > 0 ? '▲' : '▼'}{Math.abs(p.delta14)}
                                        </span>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>1개월 후</span>
                                    <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {p.predict30}{p.unit}
                                        <span style={{ fontSize: '11px', marginLeft: '4px', color: p.delta30 > 0 ? '#10b981' : '#ef4444' }}>
                                            {p.delta30 > 0 ? '▲' : '▼'}{Math.abs(p.delta30)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
