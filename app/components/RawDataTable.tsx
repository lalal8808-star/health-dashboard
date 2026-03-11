'use client';

import { AnalysisRecord } from '@/app/lib/types';

interface RawDataTableProps {
    records: AnalysisRecord[];
}

export default function RawDataTable({ records }: RawDataTableProps) {
    if (!records || records.length === 0) return null;

    // Use reverse chronological order
    const sorted = [...records].sort((a, b) => new Date(b.metrics.date).getTime() - new Date(a.metrics.date).getTime());

    const renderDelta = (current: number | null | undefined, previous: number | null | undefined) => {
        if (current == null || previous == null) return null;
        const delta = parseFloat((current - previous).toFixed(1));
        if (delta === 0) return null;
        if (delta > 0) return <span className="tag-up" style={{ marginLeft: 4 }}>▲{delta}</span>;
        return <span className="tag-down" style={{ marginLeft: 4 }}>▼{Math.abs(delta)}</span>;
    };

    return (
        <div className="table-card animate-slideUp" style={{ animationDelay: '0.3s' }}>
            <div className="chart-title" style={{ marginBottom: '14px' }}>
                <span className="dot" />
                전체 측정 기록
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>날짜</th>
                            <th>체중(kg)</th>
                            <th>골격근량(kg)</th>
                            <th>체지방량(kg)</th>
                            <th>체지방률(%)</th>
                            <th>BMI</th>
                            <th>기초대사량</th>
                            <th>인바디점수</th>
                            <th>복부지방률</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((record, i) => {
                            const prev = sorted[i + 1]?.metrics;
                            const m = record.metrics;
                            const isLatest = i === 0;

                            return (
                                <tr key={record.id} className={isLatest ? 'latest' : ''}>
                                    <td>{m.date}</td>
                                    <td>
                                        {m.weight ?? '-'}
                                        {renderDelta(m.weight, prev?.weight)}
                                    </td>
                                    <td>
                                        {m.skeletalMuscle ?? '-'}
                                        {renderDelta(m.skeletalMuscle, prev?.skeletalMuscle)}
                                    </td>
                                    <td>
                                        {m.bodyFatMass ?? '-'}
                                        {renderDelta(m.bodyFatMass, prev?.bodyFatMass)}
                                    </td>
                                    <td>{m.bodyFatPercent ?? '-'}%</td>
                                    <td>{m.bmi ?? '-'}</td>
                                    <td>{m.basalMetabolicRate ?? '-'}</td>
                                    <td>{m.inbodyScore ?? '-'}</td>
                                    <td>{m.waistHipRatio ?? '-'}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
