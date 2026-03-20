'use client';

import { useState, useMemo } from 'react';
import { Calendar, TrendingUp, TrendingDown, Minus, Loader2, Dumbbell, Utensils, Activity } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { AnalysisRecord } from '@/app/lib/types';
import { getRecords } from '@/app/lib/storage';
import { getFoodLogs, getTotalCalories } from '@/app/lib/food-storage';
import { getWorkoutLogs } from '@/app/lib/workout-storage';

type Period = 'week' | 'month';

function toLocalDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function WeeklyReport() {
    const [period, setPeriod] = useState<Period>('week');
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [aiFeedback, setAiFeedback] = useState<string | null>(null);

    const today = useMemo(() => new Date(), []);

    const dateRange = useMemo(() => {
        const end = new Date(today);
        const start = new Date(today);
        if (period === 'week') {
            start.setDate(start.getDate() - 6);
        } else {
            start.setDate(start.getDate() - 29);
        }
        return { start, end, startStr: toLocalDateStr(start), endStr: toLocalDateStr(end) };
    }, [period, today]);

    // Body composition data
    const bodyData = useMemo(() => {
        const records = getRecords();
        const inRange = records.filter(r => {
            const d = r.metrics.date;
            return d >= dateRange.startStr && d <= dateRange.endStr;
        }).sort((a, b) => a.metrics.date.localeCompare(b.metrics.date));

        if (inRange.length < 1) return null;

        const first = inRange[0].metrics;
        const last = inRange[inRange.length - 1].metrics;

        return {
            count: inRange.length,
            weight: { start: first.weight, end: last.weight, delta: (last.weight || 0) - (first.weight || 0) },
            muscle: { start: first.skeletalMuscle, end: last.skeletalMuscle, delta: (last.skeletalMuscle || 0) - (first.skeletalMuscle || 0) },
            fat: { start: first.bodyFatMass, end: last.bodyFatMass, delta: (last.bodyFatMass || 0) - (first.bodyFatMass || 0) },
            fatPct: { start: first.bodyFatPercent, end: last.bodyFatPercent, delta: (last.bodyFatPercent || 0) - (first.bodyFatPercent || 0) },
            score: { start: first.inbodyScore, end: last.inbodyScore, delta: (last.inbodyScore || 0) - (first.inbodyScore || 0) },
        };
    }, [dateRange]);

    // Food data
    const foodData = useMemo(() => {
        const logs = getFoodLogs();
        const inRange = logs.filter(l => l.date >= dateRange.startStr && l.date <= dateRange.endStr);
        if (inRange.length === 0) return null;

        let totalCal = 0, totalP = 0, totalC = 0, totalF = 0;
        inRange.forEach(log => {
            const t = getTotalCalories(log);
            totalCal += t.calories;
            totalP += t.protein;
            totalC += t.carbs;
            totalF += t.fat;
        });

        const days = inRange.length;
        return {
            days,
            avgCalories: Math.round(totalCal / days),
            avgProtein: Math.round(totalP / days),
            avgCarbs: Math.round(totalC / days),
            avgFat: Math.round(totalF / days),
            totalCalories: totalCal,
        };
    }, [dateRange]);

    // Workout data
    const workoutData = useMemo(() => {
        const logs = getWorkoutLogs();
        const inRange = logs.filter(l => l.date >= dateRange.startStr && l.date <= dateRange.endStr);
        if (inRange.length === 0) return null;

        const typeCounts: Record<string, number> = {};
        let totalEntries = 0;
        inRange.forEach(log => {
            log.entries.forEach(e => {
                typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
                totalEntries++;
            });
        });

        const typeLabels: Record<string, string> = {
            strength: '근력', cardio: '유산소', flexibility: '유연성',
            HIIT: 'HIIT', recovery: '회복', other: '기타',
        };

        return {
            workoutDays: inRange.length,
            totalExercises: totalEntries,
            types: Object.entries(typeCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => ({ type, label: typeLabels[type] || type, count })),
        };
    }, [dateRange]);

    // Macro pie chart data
    const macroPieData = useMemo(() => {
        if (!foodData) return [];
        const pCal = foodData.avgProtein * 4;
        const cCal = foodData.avgCarbs * 4;
        const fCal = foodData.avgFat * 9;
        const total = pCal + cCal + fCal || 1;
        return [
            { name: '단백질', value: Math.round(pCal / total * 100), cal: pCal, color: '#10b981' },
            { name: '탄수화물', value: Math.round(cCal / total * 100), cal: cCal, color: '#3b82f6' },
            { name: '지방', value: Math.round(fCal / total * 100), cal: fCal, color: '#f59e0b' },
        ];
    }, [foodData]);

    const handleGenerateAI = async () => {
        setIsGeneratingAI(true);
        setAiFeedback(null);
        try {
            const summary = {
                period: period === 'week' ? '7일' : '30일',
                body: bodyData ? {
                    weightDelta: bodyData.weight.delta.toFixed(1),
                    muscleDelta: bodyData.muscle.delta.toFixed(1),
                    fatDelta: bodyData.fat.delta.toFixed(1),
                    scoreDelta: bodyData.score.delta,
                } : null,
                food: foodData ? {
                    avgCalories: foodData.avgCalories,
                    avgProtein: foodData.avgProtein,
                    avgCarbs: foodData.avgCarbs,
                    avgFat: foodData.avgFat,
                } : null,
                workout: workoutData ? {
                    workoutDays: workoutData.workoutDays,
                    totalExercises: workoutData.totalExercises,
                } : null,
            };

            const res = await fetch('/api/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ summary }),
            });
            const data = await res.json();
            setAiFeedback(data.feedback || data.error || 'AI 피드백을 생성하지 못했습니다.');
        } catch {
            setAiFeedback('AI 피드백 생성에 실패했습니다. 나중에 다시 시도해주세요.');
        } finally {
            setIsGeneratingAI(false);
        }
    };

    const DeltaTag = ({ value, unit, invert = false }: { value: number; unit: string; invert?: boolean }) => {
        const isPos = value > 0;
        const isNeg = value < 0;
        const good = invert ? isNeg : isPos;
        const color = value === 0 ? 'var(--text-tertiary)' : good ? '#10b981' : '#ef4444';
        return (
            <span style={{ color, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                {isPos && <TrendingUp size={13} />}{isNeg && <TrendingDown size={13} />}{!isPos && !isNeg && <Minus size={13} />}
                {' '}{value > 0 ? '+' : ''}{value.toFixed(1)}{unit}
            </span>
        );
    };

    const periodLabel = period === 'week' ? '주간' : '월간';
    const dateRangeLabel = `${dateRange.start.getMonth() + 1}/${dateRange.start.getDate()} — ${dateRange.end.getMonth() + 1}/${dateRange.end.getDate()}`;

    return (
        <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Period Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '10px', padding: '3px', border: '1px solid var(--border-glass)' }}>
                    {(['week', 'month'] as Period[]).map(p => (
                        <button key={p} onClick={() => { setPeriod(p); setAiFeedback(null); }}
                            style={{
                                padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                fontSize: '13px', fontWeight: 600, transition: 'all 0.2s',
                                background: period === p ? 'var(--accent-blue)' : 'transparent',
                                color: period === p ? 'white' : 'var(--text-secondary)',
                            }}>{p === 'week' ? '주간' : '월간'}</button>
                    ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                    <Calendar size={14} /> {dateRangeLabel}
                </div>
            </div>

            {/* Body Composition Summary */}
            <div className="chart-card">
                <div className="chart-title" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Activity size={18} color="var(--accent-blue)" /> {periodLabel} 체성분 변화
                </div>
                {bodyData ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                        {[
                            { label: '체중', start: bodyData.weight.start, end: bodyData.weight.end, delta: bodyData.weight.delta, unit: 'kg', invert: true },
                            { label: '골격근량', start: bodyData.muscle.start, end: bodyData.muscle.end, delta: bodyData.muscle.delta, unit: 'kg', invert: false },
                            { label: '체지방량', start: bodyData.fat.start, end: bodyData.fat.end, delta: bodyData.fat.delta, unit: 'kg', invert: true },
                            { label: '체지방률', start: bodyData.fatPct.start, end: bodyData.fatPct.end, delta: bodyData.fatPct.delta, unit: '%', invert: true },
                            { label: '인바디 점수', start: bodyData.score.start, end: bodyData.score.end, delta: bodyData.score.delta, unit: '점', invert: false },
                        ].map(m => (
                            <div key={m.label} style={{ background: 'var(--bg-tertiary)', borderRadius: '10px', padding: '14px' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>{m.label}</div>
                                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>{m.end ?? '-'}<span style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginLeft: '2px' }}>{m.unit}</span></div>
                                <div style={{ fontSize: '12px', marginTop: '4px' }}>
                                    <DeltaTag value={m.delta} unit={m.unit} invert={m.invert} />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px' }}>해당 기간에 체성분 기록이 없습니다.</div>
                )}
            </div>

            {/* Food & Workout Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Nutrition */}
                <div className="chart-card">
                    <div className="chart-title" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Utensils size={18} color="#10b981" /> {periodLabel} 식단 요약
                    </div>
                    {foodData ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                            <div style={{ width: 130, height: 130, flexShrink: 0 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={macroPieData} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3}>
                                            {macroPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                                        </Pie>
                                        <Tooltip formatter={(v) => `${v ?? 0}%`} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>일평균 ({foodData.days}일 기록)</div>
                                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>{foodData.avgCalories}<span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}> kcal</span></div>
                                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {macroPieData.map(d => (
                                        <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                                            <span style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                                            <span style={{ marginLeft: 'auto', fontWeight: 600, color: 'var(--text-primary)' }}>{d.value}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px' }}>해당 기간에 식단 기록이 없습니다.</div>
                    )}
                </div>

                {/* Workout */}
                <div className="chart-card">
                    <div className="chart-title" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Dumbbell size={18} color="#a78bfa" /> {periodLabel} 운동 요약
                    </div>
                    {workoutData ? (
                        <div>
                            <div style={{ display: 'flex', gap: '24px', marginBottom: '16px' }}>
                                <div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>운동 일수</div>
                                    <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>{workoutData.workoutDays}<span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>일</span></div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>총 운동 수</div>
                                    <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>{workoutData.totalExercises}<span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>개</span></div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {workoutData.types.map(t => (
                                    <span key={t.type} style={{
                                        padding: '4px 10px', borderRadius: '14px', fontSize: '11px', fontWeight: 600,
                                        background: 'var(--accent-purple-dim)', color: 'var(--accent-purple)',
                                    }}>{t.label} × {t.count}</span>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px' }}>해당 기간에 운동 기록이 없습니다.</div>
                    )}
                </div>
            </div>

            {/* AI Feedback */}
            <div className="chart-card">
                <div className="chart-title" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>🤖</span> AI {periodLabel} 피드백
                </div>
                {aiFeedback ? (
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{aiFeedback}</div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                        <button onClick={handleGenerateAI} disabled={isGeneratingAI}
                            style={{
                                padding: '12px 28px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                                background: 'var(--gradient-blue)', color: 'white', fontWeight: 600, fontSize: '14px',
                                display: 'inline-flex', alignItems: 'center', gap: '8px', opacity: isGeneratingAI ? 0.6 : 1,
                            }}>
                            {isGeneratingAI ? <><Loader2 size={16} className="animate-spin" /> 분석 중...</> : <>AI 피드백 생성</>}
                        </button>
                        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '10px' }}>
                            AI가 {periodLabel} 데이터를 분석하여 맞춤형 피드백을 제공합니다.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
