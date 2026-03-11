'use client';

import { useState } from 'react';
import { AnalysisRecord } from '@/app/lib/types';
import {
    RadarChart,
    Radar,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer,
    Tooltip,
    Legend,
} from 'recharts';
import { ArrowUp, ArrowDown, Minus, GitCompareArrows } from 'lucide-react';

interface CompareAnalysisProps {
    records: AnalysisRecord[];
}

// 정방향: 값이 클수록 점수 높음 (골격근량, 기초대사량, 인바디점수)
const toScore = (val: number | null, min: number, max: number): number => {
    if (val === null || val === undefined) return 0;
    return Math.round(Math.min(100, Math.max(0, ((val - min) / (max - min)) * 100)));
};

// 역방향: 값이 클수록 점수 낮음 (체중, 체지방량, BMI)
const toScoreInv = (val: number | null, min: number, max: number): number => {
    if (val === null || val === undefined) return 0;
    return 100 - toScore(val, min, max);
};

export default function CompareAnalysis({ records }: CompareAnalysisProps) {
    const sorted = [...records].sort((a, b) => new Date(a.metrics.date).getTime() - new Date(b.metrics.date).getTime());
    const [leftIdx, setLeftIdx] = useState(0);
    const [rightIdx, setRightIdx] = useState(sorted.length - 1);

    if (sorted.length < 2) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon">📊</div>
                <h3>비교 분석을 위해 2개 이상의 기록이 필요합니다</h3>
                <p>InBody 결과를 더 업로드해 주세요.</p>
            </div>
        );
    }

    const left = sorted[leftIdx]?.metrics;
    const right = sorted[rightIdx]?.metrics;

    if (!left || !right) return null;

    const metricsList = [
        { key: 'weight', label: '체중', unit: 'kg', invertDelta: true },
        { key: 'skeletalMuscle', label: '골격근량', unit: 'kg', invertDelta: false },
        { key: 'bodyFatMass', label: '체지방량', unit: 'kg', invertDelta: true },
        { key: 'bodyFatPercent', label: '체지방률', unit: '%', invertDelta: true },
        { key: 'bmi', label: 'BMI', unit: '', invertDelta: true },
        { key: 'basalMetabolicRate', label: '기초대사량', unit: 'kcal', invertDelta: false },
        { key: 'inbodyScore', label: '인바디 점수', unit: '점', invertDelta: false },
        { key: 'waistHipRatio', label: '복부지방률', unit: '', invertDelta: true },
    ];

    // 0-100 점수 정규화: 육각형에서 바깥쪽이 항상 "좋은 상태"를 의미
    // 역방향(▼낮을수록 좋음): 체중, 체지방량, BMI
    // 정방향(▲높을수록 좋음): 골격근량, 인바디점수, 기초대사량
    const radarData = [
        {
            subject: '체중',
            A: toScoreInv(left.weight, 50, 100),       // 낮을수록 점수 높음
            B: toScoreInv(right.weight, 50, 100),
        },
        {
            subject: '골격근량',
            A: toScore(left.skeletalMuscle, 15, 50),   // 높을수록 점수 높음
            B: toScore(right.skeletalMuscle, 15, 50),
        },
        {
            subject: '체지방량',
            A: toScoreInv(left.bodyFatMass, 5, 35),    // 낮을수록 점수 높음
            B: toScoreInv(right.bodyFatMass, 5, 35),
        },
        {
            subject: 'BMI',
            A: toScoreInv(left.bmi, 15, 35),           // 낮을수록 점수 높음
            B: toScoreInv(right.bmi, 15, 35),
        },
        {
            subject: '인바디 점수',
            A: left.inbodyScore != null && left.inbodyScore > 0 ? left.inbodyScore : 50,  // 높을수록 점수 높음
            B: right.inbodyScore != null && right.inbodyScore > 0 ? right.inbodyScore : 50,
        },
        {
            subject: '기초대사량',
            A: toScore(left.basalMetabolicRate, 1000, 2200),  // 높을수록 점수 높음
            B: toScore(right.basalMetabolicRate, 1000, 2200),
        },
    ];

    const renderDelta = (leftVal: number | null, rightVal: number | null, invertDelta: boolean) => {
        if (leftVal === null || rightVal === null) return <span style={{ color: 'var(--text-tertiary)' }}>-</span>;
        const delta = +(rightVal - leftVal).toFixed(1);
        if (delta === 0) return <Minus size={14} style={{ color: 'var(--text-tertiary)' }} />;

        const isGood = invertDelta ? delta < 0 : delta > 0;
        const color = isGood ? '#10b981' : '#ef4444';
        return (
            <span style={{ color, fontWeight: 700, fontFamily: 'monospace', fontSize: '14px' }}>
                {delta > 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                {Math.abs(delta)}
            </span>
        );
    };

    return (
        <div className="guide-section animate-fadeIn">
            {/* Date selectors */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '16px', marginBottom: '24px', alignItems: 'center' }}>
                <div className="chart-card" style={{ padding: '16px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '8px' }}>
                        비교 기준일 (Before)
                    </label>
                    <select
                        value={leftIdx}
                        onChange={(e) => setLeftIdx(Number(e.target.value))}
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            background: 'var(--bg-tertiary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-glass)',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontFamily: 'monospace',
                        }}
                    >
                        {sorted.map((r, i) => (
                            <option key={r.id} value={i}>{r.metrics.date}</option>
                        ))}
                    </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <GitCompareArrows size={28} style={{ color: 'var(--accent-blue)' }} />
                </div>

                <div className="chart-card" style={{ padding: '16px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '8px' }}>
                        비교 대상일 (After)
                    </label>
                    <select
                        value={rightIdx}
                        onChange={(e) => setRightIdx(Number(e.target.value))}
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            background: 'var(--bg-tertiary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-glass)',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontFamily: 'monospace',
                        }}
                    >
                        {sorted.map((r, i) => (
                            <option key={r.id} value={i}>{r.metrics.date}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Comparison table */}
            <div className="table-card" style={{ marginBottom: '24px' }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'left' }}>지표</th>
                            <th style={{ color: '#3b82f6' }}>{left.date}</th>
                            <th>변화</th>
                            <th style={{ color: '#10b981' }}>{right.date}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {metricsList.map(m => {
                            const lv = (left as unknown as Record<string, unknown>)[m.key] as number | null;
                            const rv = (right as unknown as Record<string, unknown>)[m.key] as number | null;
                            return (
                                <tr key={m.key}>
                                    <td style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>{m.label}</td>
                                    <td>{lv !== null && lv !== undefined ? `${lv}${m.unit}` : '-'}</td>
                                    <td style={{ textAlign: 'center' }}>{renderDelta(lv, rv, m.invertDelta)}</td>
                                    <td>{rv !== null && rv !== undefined ? `${rv}${m.unit}` : '-'}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Radar chart overlay */}
            <div className="chart-card">
                <div className="chart-title" style={{ marginBottom: '4px' }}>
                    <span className="dot" style={{ background: 'var(--accent-purple)' }} />
                    체성분 오버레이 비교
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '16px', lineHeight: '1.6' }}>
                    육각형 바깥쪽 = 좋은 상태 &nbsp;·&nbsp;
                    <span style={{ color: '#10b981' }}>▲ 높을수록 좋음</span>: 골격근량, 인바디점수, 기초대사량 &nbsp;·&nbsp;
                    <span style={{ color: '#f59e0b' }}>▼ 낮을수록 좋음</span>: 체중, 체지방량, BMI
                    {(!(left.inbodyScore && left.inbodyScore > 0) || !(right.inbodyScore && right.inbodyScore > 0)) && (
                        <span style={{ color: '#f59e0b', marginLeft: '8px' }}>
                            ⚠ 인바디 점수 미측정 항목은 50점으로 표시
                        </span>
                    )}
                </div>
                <ResponsiveContainer width="100%" height={320}>
                    <RadarChart data={radarData}>
                        <PolarGrid stroke="rgba(255,255,255,0.1)" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar name={left.date} dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} />
                        <Radar name={right.date} dataKey="B" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Tooltip formatter={(value, name, props) => {
                            const subject = (props?.payload as Record<string, unknown>)?.subject;
                            const v = value ?? 0;
                            if (subject === '인바디 점수') return [`${v}점`, name];
                            return [`${v}점 (정규화)`, name];
                        }} />
                    </RadarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
