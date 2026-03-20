'use client';

import { AnalysisRecord } from '@/app/lib/types';
import { calcRateOfChange } from '@/app/lib/derived-metrics';

interface DashboardInsightsProps {
    records: AnalysisRecord[];
}

export default function DashboardInsights({ records }: DashboardInsightsProps) {
    if (!records || records.length < 2) return null;

    // Sort chronologically
    const sorted = [...records].sort((a, b) => new Date(a.metrics.date).getTime() - new Date(b.metrics.date).getTime());
    const first = sorted[0].metrics;
    const latest = sorted[sorted.length - 1].metrics;

    const firstDate = new Date(first.date);
    const lastDate = new Date(latest.date);
    const diffTime = Math.abs(lastDate.getTime() - firstDate.getTime());
    const numDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const weightDelta = (latest.weight || 0) - (first.weight || 0);
    const fatDelta = (latest.bodyFatMass || 0) - (first.bodyFatMass || 0);
    const muscleDelta = (latest.skeletalMuscle || 0) - (first.skeletalMuscle || 0);
    const scoreDelta = (latest.inbodyScore || 0) - (first.inbodyScore || 0);
    const roc = calcRateOfChange(records);

    return (
        <div className="insight-row animate-slideUp" style={{ animationDelay: '0.2s' }}>
            <div className="insight-card">
                <div className="insight-icon">📉</div>
                <div className="insight-title">체중 변화 추세</div>
                <div className="insight-text">
                    {numDays}일간 체중이 <strong>{first.weight} → {latest.weight}kg</strong>으로 약 <strong>{Math.abs(weightDelta).toFixed(1)}kg</strong> {weightDelta > 0 ? '증가' : '감소'}했습니다.
                    {roc.weightPerWeek != null && (
                        <> (주당 <strong>{Math.abs(roc.weightPerWeek)}kg</strong> {roc.weightPerWeek > 0 ? '증가' : '감소'})</>
                    )}
                </div>
                {roc.weightWarning && (
                    <div style={{ marginTop: '6px', fontSize: '12px', color: '#f59e0b', fontWeight: 500 }}>
                        ⚠️ {roc.weightWarning}
                    </div>
                )}
            </div>

            <div className="insight-card">
                <div className="insight-icon">💪</div>
                <div className="insight-title">체성분 변화</div>
                <div className="insight-text">
                    {Math.abs(weightDelta).toFixed(1)}kg 변화 중 체지방이 <strong>{first.bodyFatMass} → {latest.bodyFatMass}kg ({fatDelta > 0 ? '▲' : '▼'}{Math.abs(fatDelta).toFixed(1)}kg)</strong> 변동했습니다.
                    골격근량은 <strong>{Math.abs(muscleDelta).toFixed(1)}kg {muscleDelta > 0 ? '증가' : '감소'}</strong>했습니다.
                    {roc.musclePerWeek != null && (
                        <> (주당 <strong>{Math.abs(roc.musclePerWeek)}kg</strong>)</>
                    )}
                </div>
            </div>

            <div className="insight-card">
                <div className="insight-icon">🎯</div>
                <div className="insight-title">인바디 점수 변화</div>
                <div className="insight-text">
                    인바디 점수가 <strong>{first.inbodyScore} → {latest.inbodyScore}점</strong>으로 {Math.abs(scoreDelta)}점 {scoreDelta > 0 ? '상승' : '하락'}했습니다.
                    복부지방률도 <strong>{first.waistHipRatio} → {latest.waistHipRatio}</strong>으로 변동되었습니다.
                </div>
            </div>
        </div>
    );
}
