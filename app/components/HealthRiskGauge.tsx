'use client';

import { AnalysisRecord } from '@/app/lib/types';

interface HealthRiskGaugeProps {
    records: AnalysisRecord[];
}

function getRiskLevel(score: number): { label: string; color: string; emoji: string } {
    if (score >= 80) return { label: '안전', color: '#10b981', emoji: '🟢' };
    if (score >= 60) return { label: '양호', color: '#3b82f6', emoji: '🔵' };
    if (score >= 40) return { label: '주의', color: '#f59e0b', emoji: '🟡' };
    if (score >= 20) return { label: '경고', color: '#f97316', emoji: '🟠' };
    return { label: '위험', color: '#ef4444', emoji: '🔴' };
}

function calculateHealthScore(bmi: number | null, bodyFatPercent: number | null, waistHipRatio: number | null): {
    total: number;
    bmiScore: number;
    fatScore: number;
    whrScore: number;
    details: { label: string; value: number | null; score: number; status: string; color: string }[];
} {
    // BMI score (0-100): optimal 18.5-24.9
    let bmiScore = 0;
    if (bmi !== null) {
        if (bmi >= 18.5 && bmi <= 24.9) bmiScore = 100;
        else if (bmi < 18.5) bmiScore = Math.max(0, 100 - (18.5 - bmi) * 15);
        else bmiScore = Math.max(0, 100 - (bmi - 24.9) * 12);
    }

    // Body fat % score: male optimal 10-20%
    let fatScore = 0;
    if (bodyFatPercent !== null) {
        if (bodyFatPercent >= 10 && bodyFatPercent <= 20) fatScore = 100;
        else if (bodyFatPercent < 10) fatScore = Math.max(0, 100 - (10 - bodyFatPercent) * 10);
        else fatScore = Math.max(0, 100 - (bodyFatPercent - 20) * 8);
    }

    // WHR score: male optimal < 0.9
    let whrScore = 0;
    if (waistHipRatio !== null) {
        if (waistHipRatio <= 0.85) whrScore = 100;
        else if (waistHipRatio <= 0.90) whrScore = 80;
        else if (waistHipRatio <= 0.95) whrScore = 50;
        else whrScore = Math.max(0, 100 - (waistHipRatio - 0.95) * 200);
    }

    const validScores = [
        bmi !== null ? bmiScore : null,
        bodyFatPercent !== null ? fatScore : null,
        waistHipRatio !== null ? whrScore : null,
    ].filter(s => s !== null) as number[];

    const total = validScores.length > 0 ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length) : 0;

    const bmiStatus = bmi === null ? '-' : bmi < 18.5 ? '저체중' : bmi <= 24.9 ? '정상' : bmi <= 29.9 ? '과체중' : '비만';
    const fatStatus = bodyFatPercent === null ? '-' : bodyFatPercent <= 20 ? '정상' : bodyFatPercent <= 25 ? '경계' : '과다';
    const whrStatus = waistHipRatio === null ? '-' : waistHipRatio <= 0.85 ? '정상' : waistHipRatio <= 0.90 ? '경계' : '위험';

    return {
        total,
        bmiScore,
        fatScore,
        whrScore,
        details: [
            { label: 'BMI', value: bmi, score: bmiScore, status: bmiStatus, color: getRiskLevel(bmiScore).color },
            { label: '체지방률', value: bodyFatPercent, score: fatScore, status: fatStatus, color: getRiskLevel(fatScore).color },
            { label: '복부지방률(WHR)', value: waistHipRatio, score: whrScore, status: whrStatus, color: getRiskLevel(whrScore).color },
        ],
    };
}

export default function HealthRiskGauge({ records }: HealthRiskGaugeProps) {
    if (!records || records.length === 0) return null;

    const sorted = [...records].sort((a, b) => new Date(a.metrics.date).getTime() - new Date(b.metrics.date).getTime());
    const latest = sorted[sorted.length - 1].metrics;

    const result = calculateHealthScore(latest.bmi, latest.bodyFatPercent, latest.waistHipRatio);
    const risk = getRiskLevel(result.total);

    // Gauge angle: 0-180 degrees for 0-100 score
    const gaugeAngle = (result.total / 100) * 180;

    return (
        <div className="chart-card animate-slideUp" style={{ marginBottom: '24px' }}>
            <div className="chart-title" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>🛡️</span>
                건강 위험도 분석
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginLeft: '8px' }}>대사증후군 위험 평가</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'center' }}>
                {/* Gauge */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ position: 'relative', width: '200px', height: '110px', overflow: 'hidden' }}>
                        {/* Background arc */}
                        <div style={{
                            position: 'absolute',
                            width: '200px',
                            height: '200px',
                            borderRadius: '50%',
                            background: `conic-gradient(
                                #ef4444 0deg 36deg,
                                #f97316 36deg 72deg,
                                #f59e0b 72deg 108deg,
                                #3b82f6 108deg 144deg,
                                #10b981 144deg 180deg,
                                transparent 180deg 360deg
                            )`,
                            transform: 'rotate(180deg)',
                        }} />
                        {/* Inner circle */}
                        <div style={{
                            position: 'absolute',
                            top: '15px',
                            left: '15px',
                            width: '170px',
                            height: '170px',
                            borderRadius: '50%',
                            background: 'var(--bg-secondary)',
                        }} />
                        {/* Needle */}
                        <div style={{
                            position: 'absolute',
                            bottom: '0',
                            left: '50%',
                            width: '3px',
                            height: '80px',
                            background: risk.color,
                            transformOrigin: 'bottom center',
                            transform: `translateX(-50%) rotate(${gaugeAngle - 90}deg)`,
                            transition: 'transform 1s ease',
                            borderRadius: '2px',
                            boxShadow: `0 0 10px ${risk.color}`,
                        }} />
                        {/* Center dot */}
                        <div style={{
                            position: 'absolute',
                            bottom: '-5px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            background: risk.color,
                            boxShadow: `0 0 10px ${risk.color}`,
                        }} />
                    </div>
                    <div style={{ textAlign: 'center', marginTop: '8px' }}>
                        <div style={{ fontSize: '36px', fontWeight: 700, color: risk.color, fontFamily: 'monospace' }}>
                            {result.total}
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: risk.color }}>
                            {risk.emoji} {risk.label}
                        </div>
                    </div>
                </div>

                {/* Detail bars */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {result.details.map(d => (
                        <div key={d.label}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{d.label}</span>
                                <span style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                                        {d.value !== null ? d.value : '-'}
                                    </span>
                                    <span style={{
                                        marginLeft: '8px',
                                        padding: '2px 8px',
                                        borderRadius: '10px',
                                        fontSize: '10px',
                                        fontWeight: 600,
                                        background: `${d.color}22`,
                                        color: d.color,
                                    }}>
                                        {d.status}
                                    </span>
                                </span>
                            </div>
                            <div style={{
                                height: '6px',
                                background: 'var(--bg-tertiary)',
                                borderRadius: '3px',
                                overflow: 'hidden',
                            }}>
                                <div style={{
                                    height: '100%',
                                    width: `${d.score}%`,
                                    background: d.color,
                                    borderRadius: '3px',
                                    transition: 'width 1s ease',
                                }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
