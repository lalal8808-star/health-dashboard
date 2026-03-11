'use client';

import { AnalysisRecord } from '@/app/lib/types';
import { Eye, Trash2, Calendar } from 'lucide-react';

interface AnalysisHistoryProps {
    records: AnalysisRecord[];
    onSelectRecord: (record: AnalysisRecord) => void;
    onDeleteRecord: (id: string) => void;
    onGoToUpload: () => void;
}

export default function AnalysisHistory({ records, onSelectRecord, onDeleteRecord, onGoToUpload }: AnalysisHistoryProps) {
    if (records.length === 0) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <h3>분석 기록이 없습니다</h3>
                <p>건강 검진 결과지를 업로드하면 분석 기록이 여기에 저장됩니다.</p>
                <button className="btn btn-primary" style={{ marginTop: '20px' }} onClick={onGoToUpload}>
                    첫 결과지 업로드하기
                </button>
            </div>
        );
    }

    const sortedRecords = [...records].sort(
        (a, b) => new Date(b.metrics.date).getTime() - new Date(a.metrics.date).getTime()
    );

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return {
            day: d.getDate().toString(),
            month: d.toLocaleString('ko-KR', { month: 'short' }),
            year: d.getFullYear().toString(),
        };
    };

    return (
        <div>
            <h2 className="section-title">📋 분석 기록</h2>
            <p className="section-subtitle">총 {records.length}개의 분석 기록이 있습니다.</p>

            <div className="history-list">
                {sortedRecords.map((record, i) => {
                    const date = formatDate(record.metrics.date);
                    return (
                        <div
                            key={record.id}
                            className={`history-item animate-slideUp stagger-${Math.min(i + 1, 6)}`}
                        >
                            <div className="history-item-date">
                                <div className="history-item-date-day">{date.day}</div>
                                <div className="history-item-date-month">{date.month} {date.year}</div>
                            </div>

                            <div className="history-item-divider" />

                            <div className="history-item-metrics">
                                {record.metrics.weight && (
                                    <div className="history-metric">
                                        <span className="history-metric-label">체중</span>
                                        <span className="history-metric-value">{record.metrics.weight}kg</span>
                                    </div>
                                )}
                                {record.metrics.skeletalMuscle && (
                                    <div className="history-metric">
                                        <span className="history-metric-label">골격근</span>
                                        <span className="history-metric-value">{record.metrics.skeletalMuscle}kg</span>
                                    </div>
                                )}
                                {record.metrics.bodyFatPercent && (
                                    <div className="history-metric">
                                        <span className="history-metric-label">체지방률</span>
                                        <span className="history-metric-value">{record.metrics.bodyFatPercent}%</span>
                                    </div>
                                )}
                                {record.metrics.bmi && (
                                    <div className="history-metric">
                                        <span className="history-metric-label">BMI</span>
                                        <span className="history-metric-value">{record.metrics.bmi}</span>
                                    </div>
                                )}
                            </div>

                            <div className="history-item-actions">
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => onSelectRecord(record)}
                                    title="상세 보기"
                                >
                                    <Eye size={14} />
                                </button>
                                <button
                                    className="btn btn-danger btn-sm"
                                    onClick={(e) => { e.stopPropagation(); onDeleteRecord(record.id); }}
                                    title="삭제"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
