'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { WorkoutEntry } from '@/app/lib/types';
import {
    getWorkoutLogByDate,
    saveWorkoutEntry,
    deleteWorkoutEntry,
    getMonthlyWorkoutLogs,
} from '@/app/lib/workout-storage';
import { Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

interface WorkoutDiaryProps {
    onGoToUpload: () => void;
    syncVersion?: number;
}

/** 로컬 날짜를 YYYY-MM-DD 형식으로 반환 (toISOString은 UTC 기준이라 한국에서 날짜 밀림) */
const toLocalDateStr = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

export default function WorkoutDiary({ onGoToUpload: _onGoToUpload, syncVersion }: WorkoutDiaryProps) {
    const ssrToday = new Date();
    // SSR 빌드 시점 날짜 오염 방지: useEffect에서 클라이언트 로컬 날짜로 덮어씀
    const [currentMonth, setCurrentMonth] = useState({ year: ssrToday.getFullYear(), month: ssrToday.getMonth() });
    const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
    const [showForm, setShowForm] = useState(false);
    const [workoutLog, setWorkoutLog] = useState(() => getWorkoutLogByDate(new Date().toISOString().split('T')[0]));
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 640);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    const monthlyLogs = getMonthlyWorkoutLogs(currentMonth.year, currentMonth.month);

    // Build a date → entries map for calendar display
    const dailyMap = useMemo(() => {
        const map: Record<string, WorkoutEntry[]> = {};
        for (const log of monthlyLogs) {
            map[log.date] = log.entries;
        }
        return map;
    }, [monthlyLogs]);

    const refreshLog = useCallback((date: string) => {
        setWorkoutLog(getWorkoutLogByDate(date));
    }, []);

    // 클라이언트에서만 실행: 정확한 로컬 날짜로 초기화 (SSR 날짜 오염 방지)
    useEffect(() => {
        const today = toLocalDateStr(new Date());
        setSelectedDate(today);
        setWorkoutLog(getWorkoutLogByDate(today));
        const d = new Date();
        setCurrentMonth({ year: d.getFullYear(), month: d.getMonth() });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // 외부 동기화(다른 기기 입력) 감지 시 데이터 재로드
    useEffect(() => {
        if (syncVersion === undefined || syncVersion === 0) return;
        setWorkoutLog(getWorkoutLogByDate(selectedDate));
    }, [syncVersion, selectedDate]);

    const handleDateSelect = (date: string) => {
        setSelectedDate(date);
        refreshLog(date);
    };

    const changeMonth = (delta: number) => {
        setCurrentMonth(prev => {
            let m = prev.month + delta;
            let y = prev.year;
            if (m < 0) { m = 11; y--; }
            if (m > 11) { m = 0; y++; }
            return { year: y, month: m };
        });
    };

    const handleAddEntry = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        const entry: WorkoutEntry = {
            id: `workout-${Date.now()}`,
            name: fd.get('name') as string,
            type: 'other',
            duration: (fd.get('duration') as string) || '',
            description: '',
        };
        saveWorkoutEntry(selectedDate, entry);
        refreshLog(selectedDate);
        setShowForm(false);
        form.reset();
    };

    const handleDeleteEntry = (entryId: string) => {
        deleteWorkoutEntry(selectedDate, entryId);
        refreshLog(selectedDate);
    };

    // 렌더 시마다 클라이언트 로컬 날짜로 계산 (SSR 시점 고정 방지)
    const todayStr = toLocalDateStr(new Date());
    const isSelectedToday = selectedDate === todayStr;
    const dateLabel = isSelectedToday
        ? '오늘'
        : new Date(selectedDate + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });

    // Calendar rendering
    const renderCalendar = () => {
        const firstDay = new Date(currentMonth.year, currentMonth.month, 1);
        const lastDay = new Date(currentMonth.year, currentMonth.month + 1, 0);
        const startDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday=0
        const daysInMonth = lastDay.getDate();

        const weeks: (number | null)[][] = [];
        let currentWeek: (number | null)[] = [];
        for (let i = 0; i < startDayOfWeek; i++) currentWeek.push(null);
        for (let day = 1; day <= daysInMonth; day++) {
            currentWeek.push(day);
            if (currentWeek.length === 7) {
                weeks.push(currentWeek);
                currentWeek = [];
            }
        }
        if (currentWeek.length > 0) {
            while (currentWeek.length < 7) currentWeek.push(null);
            weeks.push(currentWeek);
        }

        const dayLabels = ['월', '화', '수', '목', '금', '토', '일'];
        const monthLabel = `${currentMonth.year}년 ${currentMonth.month + 1}월`;

        return (
            <div className="chart-card" style={{ marginBottom: '24px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => changeMonth(-1)}>
                        <ChevronLeft size={16} />
                    </button>
                    <div style={{ fontSize: '16px', fontWeight: 700 }}>{monthLabel}</div>
                    <button className="btn btn-secondary btn-sm" onClick={() => changeMonth(1)}>
                        <ChevronRight size={16} />
                    </button>
                </div>

                {/* Day headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '2px' }}>
                    {dayLabels.map(d => (
                        <div key={d} style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-tertiary)', padding: isMobile ? '2px 0' : '4px' }}>
                            {d}
                        </div>
                    ))}
                </div>

                {/* Weeks */}
                {weeks.map((week, wi) => (
                    <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '2px' }}>
                        {week.map((day, di) => {
                            if (day === null) return <div key={di} style={{ minHeight: isMobile ? '44px' : '72px' }} />;

                            const dateStr = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            const isSelected = dateStr === selectedDate;
                            const isTodayCell = dateStr === todayStr;
                            const entries = dailyMap[dateStr] || [];
                            const MAX_SHOW = 2;

                            return (
                                <div
                                    key={di}
                                    onClick={() => handleDateSelect(dateStr)}
                                    style={{
                                        minHeight: isMobile ? '44px' : '72px',
                                        padding: isMobile ? '4px 2px' : '6px 4px',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        background: isSelected ? 'rgba(59,130,246,0.15)' : 'transparent',
                                        border: isTodayCell ? '1px solid var(--accent-blue)' : '1px solid transparent',
                                        transition: 'all 0.15s ease',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: isMobile ? '4px' : '3px',
                                        boxSizing: 'border-box',
                                    }}
                                >
                                    {/* Date number */}
                                    <span style={{
                                        fontSize: isMobile ? '12px' : '13px',
                                        fontWeight: isSelected ? 700 : 400,
                                        color: isSelected ? 'var(--accent-blue)' : 'var(--text-primary)',
                                        lineHeight: 1,
                                    }}>
                                        {day}
                                    </span>

                                    {/* 모바일: 점(dot)으로 표시 / 데스크탑: 텍스트 칩 */}
                                    {isMobile ? (
                                        entries.length > 0 && (
                                            <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                                {entries.slice(0, 3).map((entry) => (
                                                    <div key={entry.id} style={{
                                                        width: '6px',
                                                        height: '6px',
                                                        borderRadius: '50%',
                                                        background: '#10b981',
                                                        flexShrink: 0,
                                                    }} />
                                                ))}
                                            </div>
                                        )
                                    ) : (
                                        <>
                                            {entries.slice(0, MAX_SHOW).map((entry) => (
                                                <div key={entry.id} style={{
                                                    width: '100%',
                                                    fontSize: '11px',
                                                    lineHeight: '1.4',
                                                    color: '#10b981',
                                                    background: 'rgba(16,185,129,0.15)',
                                                    borderRadius: '3px',
                                                    padding: '2px 4px',
                                                    overflow: 'hidden',
                                                    whiteSpace: 'nowrap',
                                                    textOverflow: 'ellipsis',
                                                    textAlign: 'left',
                                                    fontWeight: 600,
                                                }}>
                                                    {entry.name}{entry.duration ? ` · ${entry.duration}` : ''}
                                                </div>
                                            ))}
                                            {entries.length > MAX_SHOW && (
                                                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                                                    +{entries.length - MAX_SHOW}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="guide-section animate-fadeIn">
            {/* Calendar */}
            {renderCalendar()}

            {/* Selected date header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                    <div style={{ fontSize: '18px', fontWeight: 700 }}>{dateLabel}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{selectedDate}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {workoutLog && workoutLog.entries.length > 0 && (
                        <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 600 }}>
                            {workoutLog.entries.length}개 운동
                        </span>
                    )}
                    <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
                        <Plus size={16} /> 운동 추가
                    </button>
                </div>
            </div>

            {/* Add workout form - simplified to name + duration only */}
            {showForm && (
                <form onSubmit={handleAddEntry} className="chart-card" style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label style={labelStyle}>운동내용 *</label>
                            <input
                                name="name"
                                required
                                style={inputStyle}
                                placeholder="예: 벤치프레스, 러닝, 스쿼트"
                                autoFocus
                            />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label style={labelStyle}>운동시간</label>
                            <input
                                name="duration"
                                style={inputStyle}
                                placeholder="예: 30분, 1시간"
                            />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                        <button type="submit" className="btn btn-primary btn-sm">저장</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>취소</button>
                    </div>
                </form>
            )}

            {/* Workout entries list */}
            {workoutLog && workoutLog.entries.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {workoutLog.entries.map(entry => (
                        <div key={entry.id} className="chart-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ fontSize: '22px' }}>🏋️</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: '14px' }}>{entry.name}</div>
                                {entry.duration && (
                                    <div style={{ fontSize: '12px', color: 'var(--accent-blue)', marginTop: '2px', fontWeight: 600 }}>
                                        ⏱ {entry.duration}
                                    </div>
                                )}
                            </div>
                            <button onClick={() => handleDeleteEntry(entry.id)} className="btn btn-danger btn-sm" style={{ padding: '6px' }}>
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>
                    <p style={{ fontSize: '40px', marginBottom: '8px' }}>🏋️</p>
                    <p>이 날짜에 기록된 운동이 없습니다.</p>
                    <p style={{ fontSize: '12px', marginTop: '4px' }}>위의 &quot;운동 추가&quot; 버튼을 눌러 운동을 기록하세요.</p>
                </div>
            )}
        </div>
    );
}

const labelStyle: React.CSSProperties = {
    fontSize: '11px',
    color: 'var(--text-tertiary)',
    display: 'block',
    marginBottom: '4px',
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-glass)',
    borderRadius: '8px',
    fontSize: '13px',
    fontFamily: 'inherit',
};
