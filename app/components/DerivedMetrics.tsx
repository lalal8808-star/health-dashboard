'use client';

import { useState } from 'react';
import { AnalysisRecord } from '@/app/lib/types';
import {
    getAllDerivedMetrics,
    calcProteinRecommendation,
    calcRateOfChange,
    MetricRef,
} from '@/app/lib/derived-metrics';

interface DerivedMetricsProps {
    records: AnalysisRecord[];
}

function GaugeBar({ metric }: { metric: MetricRef }) {
    const [showTooltip, setShowTooltip] = useState(false);

    if (metric.value == null) return null;

    const range = metric.max - metric.min;
    const pos = Math.max(0, Math.min(100, ((metric.value - metric.min) / range) * 100));
    const optStart = ((metric.optimal[0] - metric.min) / range) * 100;
    const optWidth = ((metric.optimal[1] - metric.optimal[0]) / range) * 100;

    const inOptimal = metric.value >= metric.optimal[0] && metric.value <= metric.optimal[1];
    const statusColor = inOptimal ? '#10b981' : metric.value < metric.optimal[0] ? '#f59e0b' : '#ef4444';

    return (
        <div
            className="derived-metric-item"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={() => setShowTooltip((v: boolean) => !v)}
            style={{ position: 'relative', cursor: 'help' }}
        >
            {showTooltip && (
                <div className="derived-tooltip">
                    {metric.tooltip.split('\n').map((line: string, i: number) => (
                        <div key={i} style={line === '' ? { height: '6px' } : undefined}>
                            {line.startsWith('•') ? (
                                <span style={{ paddingLeft: '8px' }}>{line}</span>
                            ) : line.startsWith('공식:') || line.startsWith('판정') || line.startsWith('정상') || line.startsWith('남성') ? (
                                <strong>{line}</strong>
                            ) : line}
                        </div>
                    ))}
                </div>
            )}
            <div className="derived-metric-header">
                <div className="derived-metric-label">
                    <span className="derived-metric-dot" style={{ background: metric.color }} />
                    {metric.label}
                </div>
                <div className="derived-metric-value" style={{ color: statusColor }}>
                    {metric.value}
                    {metric.unit && <span className="derived-metric-unit">{metric.unit}</span>}
                </div>
            </div>
            <div className="derived-metric-bar-track">
                <div
                    className="derived-metric-bar-optimal"
                    style={{ left: `${optStart}%`, width: `${optWidth}%` }}
                />
                <div
                    className="derived-metric-bar-marker"
                    style={{ left: `${pos}%`, background: statusColor }}
                />
            </div>
            <div className="derived-metric-desc">
                {metric.description}
                <span className="derived-metric-range">
                    적정 {metric.optimal[0]}~{metric.optimal[1]}
                </span>
            </div>
        </div>
    );
}

function RateItem({ label, value, unit, invert }: {
    label: string; value: number; unit: string; invert?: boolean;
}) {
    const isGood = invert ? value <= 0 : value >= 0;
    const color = value === 0 ? 'var(--text-tertiary)' : isGood ? '#10b981' : '#ef4444';
    const arrow = value > 0 ? '▲' : value < 0 ? '▼' : '-';

    return (
        <div className="derived-rate-item">
            <span className="derived-rate-label">{label}</span>
            <span style={{ color, fontFamily: 'monospace', fontWeight: 600, fontSize: '14px' }}>
                {arrow} {Math.abs(value)}{unit}
            </span>
        </div>
    );
}

export default function DerivedMetrics({ records }: DerivedMetricsProps) {
    if (!records || records.length === 0) return null;

    const sorted = [...records].sort((a, b) =>
        new Date(a.metrics.date).getTime() - new Date(b.metrics.date).getTime()
    );
    const latest = sorted[sorted.length - 1].metrics;
    const metrics = getAllDerivedMetrics(latest);
    const proteinRec = calcProteinRecommendation(latest);
    const rateOfChange = calcRateOfChange(records);

    const hasAny = metrics.some(m => m.value != null);
    if (!hasAny) return null;

    return (
        <div className="chart-card animate-slideUp" style={{ marginBottom: '24px' }}>
            <div className="chart-title" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>🧬</span>
                파생 체성분 지표
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginLeft: '8px' }}>
                    기존 데이터에서 자동 계산
                </span>
            </div>

            <div className="derived-metrics-grid">
                {metrics.map(m => <GaugeBar key={m.label} metric={m} />)}
            </div>

            <div className="derived-bottom-row">
                {proteinRec && (
                    <div className="derived-info-card">
                        <div className="derived-info-title">🥩 일일 권장 단백질</div>
                        <div className="derived-info-value">
                            {proteinRec.min}~{proteinRec.max}g
                        </div>
                        <div className="derived-info-desc">
                            체중 {latest.weight}kg × 1.6~2.2g 기준 (운동 강도에 따라 조정)
                        </div>
                    </div>
                )}

                {rateOfChange.weightPerWeek != null && (
                    <div className="derived-info-card">
                        <div className="derived-info-title">📈 주간 변화 속도</div>
                        <div className="derived-rate-grid">
                            <RateItem label="체중" value={rateOfChange.weightPerWeek} unit="kg/주" invert />
                            {rateOfChange.musclePerWeek != null && (
                                <RateItem label="골격근" value={rateOfChange.musclePerWeek} unit="kg/주" />
                            )}
                            {rateOfChange.fatPerWeek != null && (
                                <RateItem label="체지방" value={rateOfChange.fatPerWeek} unit="kg/주" invert />
                            )}
                        </div>
                        {rateOfChange.weightWarning && (
                            <div className="derived-warning">
                                ⚠️ {rateOfChange.weightWarning}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
