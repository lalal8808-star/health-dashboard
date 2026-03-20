'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, Cell, ResponsiveContainer, PieChart, Pie } from 'recharts';
import { FoodEntry, DailyFoodLog, MealPreset, FoodItem } from '@/app/lib/types';
import {
    getFoodLogs, getFoodLogByDate, saveFoodEntry, deleteFoodEntry, getTotalCalories,
    getMealPresets, saveMealPreset, deleteMealPreset, loadPresetToDate,
    getFoodItems, saveFoodItem, searchFoodItems,
} from '@/app/lib/food-storage';
import { getLatestRecord } from '@/app/lib/storage';
import {
    Plus, Trash2, ChevronLeft, ChevronRight,
    Loader2, CheckCircle2, XCircle, ImagePlus,
    BookmarkPlus, BookOpen, ChevronDown, ChevronUp,
} from 'lucide-react';

interface FoodDiaryProps {
    onGoToUpload: () => void;
}

type MealKey = 'breakfast' | 'lunch' | 'dinner' | 'snack';

const MEAL_CONFIG: Record<MealKey, { emoji: string; label: string; color: string }> = {
    breakfast: { emoji: '🌅', label: '아침', color: '#f59e0b' },
    lunch:     { emoji: '☀️', label: '점심', color: '#10b981' },
    dinner:    { emoji: '🌙', label: '저녁', color: '#3b82f6' },
    snack:     { emoji: '🍎', label: '간식', color: '#8b5cf6' },
};

const MEAL_ORDER: MealKey[] = ['breakfast', 'lunch', 'dinner', 'snack'];

type UploadStatus = 'pending' | 'analyzing' | 'done' | 'error';
interface PendingFile {
    id: string; file: File; preview: string;
    status: UploadStatus; errorMsg?: string;
}

/** 로컬 날짜를 YYYY-MM-DD 형식으로 반환 (toISOString은 UTC 기준이라 한국에서 날짜 밀림) */
const toLocalDateStr = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

export default function FoodDiary({ onGoToUpload: _onGoToUpload }: FoodDiaryProps) {
    // SSR 서버(UTC)와 클라이언트(KST) 날짜 불일치 방지:
    // useState 초기값은 SSR 빌드 시점에 고정될 수 있으므로, useEffect에서 클라이언트 날짜로 덮어씀
    const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
    const [foodLog, setFoodLog] = useState<DailyFoodLog | null>(null);
    const [showManualForm, setShowManualForm] = useState(false);
    const [selectedMeal, setSelectedMeal] = useState<MealKey>('lunch');
    const [isDragOver, setIsDragOver] = useState(false);
    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
    const [presets, setPresets] = useState<MealPreset[]>(() => getMealPresets());
    const [showPresetPanel, setShowPresetPanel] = useState(false);
    // savingPreset: which meal is being saved → shows inline name input
    const [savingMeal, setSavingMeal] = useState<MealKey | null>(null);
    const [presetName, setPresetName] = useState('');
    // 음식 검색
    const [foodSearch, setFoodSearch] = useState('');
    const [showFoodSearch, setShowFoodSearch] = useState(false);
    const [foodItems, setFoodItems] = useState<FoodItem[]>(() => getFoodItems());
    const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
    const [isAISearching, setIsAISearching] = useState(false);
    const [aiSearchError, setAISearchError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isProcessingRef = useRef(false);

    const bmrInfo = useMemo(() => {
        const latest = getLatestRecord();
        if (latest?.metrics.basalMetabolicRate) {
            const bmr = latest.metrics.basalMetabolicRate;
            return { bmr, targetCalories: Math.round(bmr * 1.55), date: latest.metrics.date };
        }
        return { bmr: null, targetCalories: 2200, date: null };
    }, []);

    const refreshLog = useCallback((date: string) => {
        setFoodLog(getFoodLogByDate(date));
    }, []);

    // 클라이언트에서만 실행: 정확한 로컬 날짜로 초기화 (SSR 날짜 오염 방지)
    useEffect(() => {
        const today = toLocalDateStr(new Date());
        setSelectedDate(today);
        setFoodLog(getFoodLogByDate(today));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps



    const refreshPresets = () => setPresets(getMealPresets());

    const changeDate = (delta: number) => {
        const d = new Date(selectedDate + 'T00:00:00');
        d.setDate(d.getDate() + delta);
        const nd = toLocalDateStr(d);
        setSelectedDate(nd);
        refreshLog(nd);
    };

    // ── 순차 AI 분석 ─────────────────────────────────────────
    const analyzeOne = useCallback(async (pf: PendingFile, date: string, meal: MealKey) => {
        setPendingFiles(prev => prev.map(f => f.id === pf.id ? { ...f, status: 'analyzing' } : f));
        try {
            const formData = new FormData();
            formData.append('image', pf.file);
            const res = await fetch('/api/food-analyze', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success) {
                const entry: FoodEntry = {
                    id: `food-${Date.now()}-${pf.id}`,
                    time: new Date().toTimeString().slice(0, 5),
                    meal,
                    name: data.name || '분석된 음식',
                    description: data.description || '',
                    calories: data.calories || 0,
                    protein: data.protein || 0,
                    carbs: data.carbs || 0,
                    fat: data.fat || 0,
                };
                saveFoodEntry(date, entry, bmrInfo.targetCalories);
                refreshLog(date);
                setPendingFiles(prev => prev.map(f => f.id === pf.id ? { ...f, status: 'done' } : f));
            } else {
                setPendingFiles(prev => prev.map(f => f.id === pf.id ? { ...f, status: 'error', errorMsg: data.error } : f));
            }
        } catch {
            setPendingFiles(prev => prev.map(f => f.id === pf.id ? { ...f, status: 'error', errorMsg: '서버 오류' } : f));
        }
    }, [refreshLog, bmrInfo.targetCalories]);

    useEffect(() => {
        const pending = pendingFiles.filter(f => f.status === 'pending');
        const analyzing = pendingFiles.filter(f => f.status === 'analyzing');
        if (pending.length === 0 || analyzing.length > 0 || isProcessingRef.current) return;
        const next = pending[0];
        isProcessingRef.current = true;
        analyzeOne(next, selectedDate, selectedMeal).finally(() => { isProcessingRef.current = false; });
    }, [pendingFiles, selectedDate, selectedMeal, analyzeOne]);

    // ── 파일 추가 / 드래그 ────────────────────────────────────
    const addFiles = useCallback((files: FileList | File[]) => {
        const imgs = Array.from(files).filter(f => f.type.startsWith('image/'));
        if (!imgs.length) return;
        setPendingFiles(prev => [
            ...prev,
            ...imgs.map(file => ({
                id: `up-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                file, preview: URL.createObjectURL(file), status: 'pending' as UploadStatus,
            })),
        ]);
    }, []);

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; };
    const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false); };
    const handleDragOver = (e: React.DragEvent) => e.preventDefault();
    const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); addFiles(e.dataTransfer.files); };

    const removePending = (id: string) => setPendingFiles(prev => { const t = prev.find(f => f.id === id); if (t) URL.revokeObjectURL(t.preview); return prev.filter(f => f.id !== id); });
    const clearDone = () => setPendingFiles(prev => { prev.filter(f => f.status === 'done' || f.status === 'error').forEach(f => URL.revokeObjectURL(f.preview)); return prev.filter(f => f.status === 'pending' || f.status === 'analyzing'); });

    // ── 직접 입력 ────────────────────────────────────────────
    const handleManualAdd = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const name = (fd.get('name') as string).trim();
        const description = (fd.get('description') as string).trim();
        const calories = Number(fd.get('calories')) || 0;
        const protein = Number(fd.get('protein')) || 0;
        const carbs = Number(fd.get('carbs')) || 0;
        const fat = Number(fd.get('fat')) || 0;

        if (!name) return;

        const entry: FoodEntry = {
            id: `food-${Date.now()}`,
            time: (fd.get('time') as string) || new Date().toTimeString().slice(0, 5),
            meal: selectedMeal,
            name,
            description,
            calories,
            protein,
            carbs,
            fat,
        };
        saveFoodEntry(selectedDate, entry, bmrInfo.targetCalories);

        // 새로운 음식을 데이터베이스에 저장할지 물어보지 않고, 선택한 음식이 있으면 업데이트
        if (!selectedFood && name && (calories > 0 || protein > 0 || carbs > 0 || fat > 0)) {
            const newFood: FoodItem = {
                id: `food-${Date.now()}`,
                name,
                description,
                calories,
                protein,
                carbs,
                fat,
                createdAt: new Date().toISOString(),
            };
            saveFoodItem(newFood);
            setFoodItems(getFoodItems());
        }

        refreshLog(selectedDate);
        setShowManualForm(false);
        setSelectedFood(null);
        setFoodSearch('');
        e.currentTarget.reset();
    };

    const handleSelectFood = (food: FoodItem) => {
        setSelectedFood(food);
        setFoodSearch('');
        setShowFoodSearch(false);
        setAISearchError(null);
    };

    const handleAISearch = async () => {
        const query = foodSearch.trim();
        if (!query || isAISearching) return;
        setIsAISearching(true);
        setAISearchError(null);
        try {
            const res = await fetch('/api/food-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query }),
            });
            const data = await res.json();
            if (data.success) {
                const newFood: FoodItem = {
                    id: `food-${Date.now()}`,
                    name: data.name,
                    description: data.description || '',
                    calories: data.calories,
                    protein: data.protein,
                    carbs: data.carbs,
                    fat: data.fat,
                    createdAt: new Date().toISOString(),
                };
                // 데이터베이스에 저장 (다음 검색 시 로컬에서 바로 찾을 수 있도록)
                saveFoodItem(newFood);
                setFoodItems(getFoodItems());
                handleSelectFood(newFood);
            } else {
                setAISearchError(data.error || '영양 정보를 찾을 수 없습니다.');
            }
        } catch {
            setAISearchError('네트워크 오류가 발생했습니다.');
        } finally {
            setIsAISearching(false);
        }
    };

    const handleDelete = (entryId: string) => { deleteFoodEntry(selectedDate, entryId); refreshLog(selectedDate); };

    // ── 식단 저장 ─────────────────────────────────────────────
    const handleSavePreset = (meal: MealKey) => {
        const entries = mealGroups[meal];
        if (!entries.length || !presetName.trim()) return;
        const preset: MealPreset = {
            id: `preset-${Date.now()}`,
            name: presetName.trim(),
            meal,
            entries: entries.map(e => ({
                name: e.name, description: e.description,
                calories: e.calories, protein: e.protein, carbs: e.carbs, fat: e.fat,
            })),
            totalCalories: entries.reduce((s, e) => s + e.calories, 0),
            createdAt: new Date().toISOString(),
        };
        saveMealPreset(preset);
        refreshPresets();
        setSavingMeal(null);
        setPresetName('');
    };

    // ── 식단 불러오기 ──────────────────────────────────────────
    const handleLoadPreset = (preset: MealPreset) => {
        loadPresetToDate(selectedDate, preset, selectedMeal, bmrInfo.targetCalories);
        refreshLog(selectedDate);
        setShowPresetPanel(false);
    };

    const handleDeletePreset = (id: string) => { deleteMealPreset(id); refreshPresets(); };

    // ── 파생 데이터 ───────────────────────────────────────────
    const entries = foodLog?.entries ?? [];
    const mealGroups = useMemo(() => {
        const g: Record<MealKey, FoodEntry[]> = { breakfast: [], lunch: [], dinner: [], snack: [] };
        entries.forEach(e => { if (g[e.meal]) g[e.meal].push(e); });
        return g;
    }, [entries]);

    const mealTotals = useMemo(() =>
        Object.fromEntries(
            MEAL_ORDER.map(m => [m, mealGroups[m].reduce((a, e) => ({
                calories: a.calories + e.calories,
                protein: a.protein + e.protein,
                carbs: a.carbs + e.carbs,
                fat: a.fat + e.fat,
            }), { calories: 0, protein: 0, carbs: 0, fat: 0 })])
        ) as Record<MealKey, { calories: number; protein: number; carbs: number; fat: number }>,
    [mealGroups]);

    const totals = foodLog ? getTotalCalories(foodLog) : { calories: 0, protein: 0, carbs: 0, fat: 0 };
    const targetCal = bmrInfo.targetCalories;
    const calPercent = Math.min(100, Math.round((totals.calories / targetCal) * 100));

    // 주간 칼로리 데이터 (선택 날짜 기준 최근 7일)
    const weekCalorieData = useMemo(() => {
        const allLogs = getFoodLogs();
        const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(selectedDate + 'T00:00:00');
            d.setDate(d.getDate() - (6 - i));
            const date = toLocalDateStr(d);
            const log = allLogs.find(l => l.date === date);
            const calories = log ? getTotalCalories(log).calories : 0;
            return {
                date,
                calories,
                label: `${d.getMonth() + 1}/${d.getDate()}\n${weekdays[d.getDay()]}`,
                isSelected: date === selectedDate,
            };
        });
    }, [selectedDate]);

    const isToday = selectedDate === toLocalDateStr(new Date());
    const dateLabel = isToday
        ? '오늘'
        : new Date(selectedDate + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });

    const isAnalyzing = pendingFiles.some(f => f.status === 'pending' || f.status === 'analyzing');
    const hasDoneOrError = pendingFiles.some(f => f.status === 'done' || f.status === 'error');

    const statusIcon = (status: UploadStatus) => {
        if (status === 'analyzing') return <Loader2 size={16} style={{ color: '#fff', animation: 'spin 1s linear infinite' }} />;
        if (status === 'done') return <CheckCircle2 size={16} style={{ color: '#10b981' }} />;
        if (status === 'error') return <XCircle size={16} style={{ color: '#ef4444' }} />;
        return null;
    };

    return (
        <div className="guide-section animate-fadeIn">

            {/* 날짜 네비게이터 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '24px' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => changeDate(-1)}><ChevronLeft size={16} /></button>
                <div style={{ textAlign: 'center', minWidth: '140px' }}>
                    <div style={{ fontSize: '18px', fontWeight: 700 }}>{dateLabel}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{selectedDate}</div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => changeDate(1)}><ChevronRight size={16} /></button>
            </div>

            {/* 주간 섭취 칼로리 그래프 */}
            <div className="chart-card" style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>주간 섭취 칼로리</div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '12px' }}>최근 7일 · 파란 막대가 선택된 날짜</div>
                <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={weekCalorieData} margin={{ top: 8, right: 12, left: -28, bottom: 0 }}>
                        <XAxis
                            dataKey="label"
                            tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                            axisLine={false}
                            tickLine={false}
                            interval={0}
                        />
                        <YAxis
                            tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
                        />
                        <Tooltip
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            formatter={(value: any) => [`${value ?? 0} kcal`, '섭취']}
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            labelFormatter={(label: any) => String(label ?? '').replace('\n', ' ')}
                            contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: '8px', fontSize: '12px' }}
                            itemStyle={{ color: 'var(--text-primary)' }}
                            labelStyle={{ color: 'var(--text-tertiary)', fontSize: '11px' }}
                        />
                        {targetCal > 0 && (
                            <ReferenceLine
                                y={targetCal}
                                stroke="#ef4444"
                                strokeDasharray="4 3"
                                strokeWidth={1.5}
                                label={{ value: `목표 ${targetCal}`, position: 'insideTopRight', fontSize: 10, fill: '#ef4444', dy: -4 }}
                            />
                        )}
                        <Bar dataKey="calories" radius={[4, 4, 0, 0]} maxBarSize={36}>
                            {weekCalorieData.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.isSelected ? '#3b82f6' : entry.calories > 0 ? '#475569' : '#1e293b'}
                                    opacity={entry.isSelected ? 1 : 0.75}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* 칼로리 진행 */}
            <div className="chart-card" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>일일 섭취 칼로리</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '20px', fontWeight: 700 }}>
                        <span style={{ color: calPercent > 100 ? 'var(--accent-red)' : 'var(--accent-blue)' }}>{totals.calories}</span>
                        <span style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}> / {targetCal} kcal</span>
                    </span>
                </div>
                <div style={{ height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${calPercent}%`, background: calPercent > 100 ? 'var(--accent-red)' : 'var(--gradient-blue)', borderRadius: '4px', transition: 'width 0.5s ease' }} />
                </div>
                <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-tertiary)', textAlign: 'right' }}>
                    {bmrInfo.bmr ? `BMR ${bmrInfo.bmr}kcal × 1.55 = ${targetCal}kcal (${bmrInfo.date} 기준)` : '기본 권장 칼로리 (BMR 데이터 없음)'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '16px' }}>
                    {[{ label: '단백질', value: totals.protein, color: '#10b981' }, { label: '탄수화물', value: totals.carbs, color: '#3b82f6' }, { label: '지방', value: totals.fat, color: '#f59e0b' }].map(n => (
                        <div key={n.label} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>{n.label}</div>
                            <div style={{ fontSize: '18px', fontWeight: 700, color: n.color, fontFamily: 'monospace' }}>{n.value}g</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── 영양소 밸런스 분석 ── */}
            {totals.calories > 0 && (() => {
                const pCal = totals.protein * 4;
                const cCal = totals.carbs * 4;
                const fCal = totals.fat * 9;
                const totalMacroCal = pCal + cCal + fCal || 1;
                const pPct = Math.round(pCal / totalMacroCal * 100);
                const cPct = Math.round(cCal / totalMacroCal * 100);
                const fPct = Math.round(fCal / totalMacroCal * 100);
                // 💪 하체 엔진(러킹/HIIT) 최적 비율: 단백질 40%, 탄수화물 30%, 지방 30%
                // 기준점: 사용자의 최신 기초대사량 (BMR) 직접 사용 (활동 대사량 제외)
                const dietTargetCal = bmrInfo.bmr || 1500;
                const targetProtein = Math.round(dietTargetCal * 0.40 / 4);
                const targetCarbs = Math.round(dietTargetCal * 0.30 / 4);
                const targetFat = Math.round(dietTargetCal * 0.30 / 9);
                const deficits = [
                    totals.protein < targetProtein * 0.8 ? `🥩 단백질이 ${targetProtein - totals.protein}g 부족합니다 (목표: ${targetProtein}g)` : null,
                    totals.carbs < targetCarbs * 0.7 ? `🍎 탄수화물이 ${targetCarbs - totals.carbs}g 부족합니다 (목표: ${targetCarbs}g)` : null,
                    totals.fat > targetFat * 1.3 ? `🥑 지방 섭취가 ${totals.fat - targetFat}g 초과되었습니다 (목표: ${targetFat}g 이하)` : null,
                ].filter(Boolean) as string[];
                const pieData = [
                    { name: '단백질', value: pPct, target: 40, color: '#10b981', gram: totals.protein, targetGram: targetProtein },
                    { name: '탄수화물', value: cPct, target: 30, color: '#3b82f6', gram: totals.carbs, targetGram: targetCarbs },
                    { name: '지방', value: fPct, target: 30, color: '#f59e0b', gram: totals.fat, targetGram: targetFat },
                ];
                return (
                    <div className="chart-card" style={{ marginBottom: '24px' }}>
                        <div style={{ marginBottom: '12px' }}>
                            <div style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                🥗 영양소 밸런스
                                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 400 }}>💪 하체 엔진 맞춤형: 단40:탄30:지30</span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                                🥩 단백질 120~140g · 🍎 탄수화물 100~130g · 🥑 지방 40~60g
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                            <div style={{ width: 110, height: 110, flexShrink: 0, position: 'relative' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={48} paddingAngle={3}>
                                            {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>비율</div>
                                </div>
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {pieData.map((d) => {
                                    const diff = d.value - d.target;
                                    return (
                                        <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', minWidth: '52px' }}>{d.name}</span>
                                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: '44px' }}>
                                                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{d.value}%</span>
                                                <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', lineHeight: 1.2 }}>{d.gram}g 섭취</span>
                                            </div>
                                            <span style={{
                                                fontSize: '11px', fontWeight: 600,
                                                color: Math.abs(diff) <= 5 ? 'var(--accent-green)' : diff > 0 ? 'var(--accent-red)' : 'var(--accent-blue)',
                                            }}>{diff > 0 ? `+${diff}` : diff}{diff !== 0 ? '%p' : ' ✓'}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        {deficits.length > 0 && (
                            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {deficits.map((d, i) => (
                                    <div key={i} style={{
                                        padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 500,
                                        background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                    }}>⚠️ {d}</div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* 식사 선택 + 저장된 식단 불러오기 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {MEAL_ORDER.map(meal => {
                        const cfg = MEAL_CONFIG[meal];
                        const cnt = mealGroups[meal].length;
                        return (
                            <button
                                key={meal}
                                className={`btn btn-sm ${selectedMeal === meal ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setSelectedMeal(meal)}
                                style={{ gap: '4px', position: 'relative' }}
                            >
                                {cfg.emoji} {cfg.label}
                                {cnt > 0 && (
                                    <span style={{
                                        marginLeft: '4px',
                                        background: selectedMeal === meal ? 'rgba(255,255,255,0.3)' : cfg.color,
                                        color: '#fff',
                                        borderRadius: '10px',
                                        fontSize: '10px',
                                        padding: '0 5px',
                                        fontWeight: 700,
                                    }}>{cnt}</span>
                                )}
                            </button>
                        );
                    })}
                </div>
                <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowPresetPanel(v => !v)}
                    style={{ gap: '6px' }}
                >
                    <BookOpen size={14} />
                    저장된 식단
                    {showPresetPanel ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
            </div>

            {/* 저장된 식단 패널 */}
            {showPresetPanel && (
                <div className="chart-card" style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>
                        📁 저장된 식단 — <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>클릭하면 [{MEAL_CONFIG[selectedMeal].label}]에 추가됩니다</span>
                    </div>
                    {presets.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                            아직 저장된 식단이 없습니다.<br />
                            <span style={{ fontSize: '11px' }}>아래 식사 섹션에서 💾 버튼으로 저장하세요.</span>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {presets.map(preset => (
                                <div key={preset.id} style={{
                                    display: 'flex', alignItems: 'center', gap: '12px',
                                    padding: '10px 12px', borderRadius: '8px',
                                    background: 'var(--bg-tertiary)',
                                    border: '1px solid var(--border-glass)',
                                    cursor: 'pointer', transition: 'all 0.15s',
                                }}
                                    onClick={() => handleLoadPreset(preset)}
                                >
                                    <div style={{ fontSize: '20px' }}>{MEAL_CONFIG[preset.meal]?.emoji || '🍽️'}</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: '13px' }}>{preset.name}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                            {MEAL_CONFIG[preset.meal]?.label} · {preset.entries.length}가지 · {preset.totalCalories}kcal
                                        </div>
                                    </div>
                                    <button
                                        onClick={e => { e.stopPropagation(); handleDeletePreset(preset.id); }}
                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 드래그앤드랍 업로드 */}
            <div
                onDragEnter={handleDragEnter} onDragLeave={handleDragLeave}
                onDragOver={handleDragOver} onDrop={handleDrop}
                onClick={() => !isAnalyzing && fileInputRef.current?.click()}
                style={{
                    marginBottom: '12px',
                    border: `2px dashed ${isDragOver ? 'var(--accent-blue)' : 'var(--border-glass)'}`,
                    borderRadius: '12px', padding: '20px 16px', textAlign: 'center',
                    cursor: isAnalyzing ? 'default' : 'pointer',
                    background: isDragOver ? 'rgba(59,130,246,0.08)' : 'var(--bg-tertiary)',
                    transition: 'all 0.2s ease',
                }}
            >
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileInput} style={{ display: 'none' }} />
                <ImagePlus size={26} style={{ color: isDragOver ? 'var(--accent-blue)' : 'var(--text-tertiary)', marginBottom: '6px' }} />
                <div style={{ fontSize: '13px', fontWeight: 600, color: isDragOver ? 'var(--accent-blue)' : 'var(--text-secondary)', marginBottom: '2px' }}>
                    {isDragOver ? '여기에 놓으세요!' : '음식 사진 드래그 또는 클릭 업로드'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                    여러 장 동시 업로드 · AI 자동 칼로리 분석
                </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={isAnalyzing}>
                    사진 선택
                </button>
                <button className="btn btn-secondary" onClick={() => setShowManualForm(v => !v)}>
                    <Plus size={16} /> 직접 입력
                </button>
            </div>

            {/* 업로드 썸네일 그리드 */}
            {pendingFiles.length > 0 && (
                <div className="chart-card" style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>
                            사진 분석 {pendingFiles.filter(f => f.status === 'done').length} / {pendingFiles.length}
                            {isAnalyzing && <Loader2 size={13} style={{ marginLeft: '6px', display: 'inline', animation: 'spin 1s linear infinite' }} />}
                        </span>
                        {hasDoneOrError && <button className="btn btn-secondary btn-sm" onClick={clearDone} style={{ fontSize: '11px' }}>완료 지우기</button>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: '10px' }}>
                        {pendingFiles.map(pf => (
                            <div key={pf.id} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden' }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={pf.preview} alt={pf.file.name} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block', opacity: pf.status === 'done' ? 0.6 : 1 }} />
                                <div style={{
                                    position: 'absolute', inset: 0,
                                    background: pf.status === 'analyzing' ? 'rgba(59,130,246,0.4)' : pf.status === 'done' ? 'rgba(16,185,129,0.3)' : pf.status === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(0,0,0,0.15)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    {statusIcon(pf.status)}
                                </div>
                                {pf.status !== 'analyzing' && (
                                    <button onClick={e => { e.stopPropagation(); removePending(pf.id); }} style={{ position: 'absolute', top: '4px', right: '4px', width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                                )}
                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.55)', padding: '3px 4px', textAlign: 'center' }}>
                                    <span style={{ fontSize: '10px', color: pf.status === 'done' ? '#10b981' : pf.status === 'error' ? '#ef4444' : pf.status === 'analyzing' ? '#3b82f6' : 'var(--text-tertiary)', fontWeight: 600 }}>
                                        {pf.status === 'pending' ? '대기' : pf.status === 'analyzing' ? '분석 중…' : pf.status === 'done' ? '완료' : '오류'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 직접 입력 폼 */}
            {showManualForm && (
                <form key={selectedFood?.id ?? 'none'} onSubmit={handleManualAdd} className="chart-card" style={{ marginBottom: '24px' }}>
                    {/* 음식 검색/선택 */}
                    <div style={{ marginBottom: '16px' }}>
                        <label style={labelStyle}>🔍 음식 검색 (선택 사항)</label>
                        <div style={{ position: 'relative' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="text"
                                    value={foodSearch}
                                    onChange={e => { setFoodSearch(e.target.value); setShowFoodSearch(true); setAISearchError(null); }}
                                    onFocus={() => setShowFoodSearch(true)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const results = searchFoodItems(foodSearch);
                                            if (results.length === 0 && foodSearch.trim()) handleAISearch();
                                            else if (results.length > 0) handleSelectFood(results[0]);
                                        }
                                    }}
                                    style={{ ...inputStyle, flex: 1 }}
                                    placeholder="연어 400g, 바나나 1개, 아메리카노 등 입력 후 자동 검색..."
                                    disabled={isAISearching}
                                />
                                {foodSearch.trim() && searchFoodItems(foodSearch).length === 0 && (
                                    <button
                                        type="button"
                                        onClick={handleAISearch}
                                        disabled={isAISearching}
                                        style={{
                                            padding: '0 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            color: '#fff', fontSize: '12px', fontWeight: 600,
                                            whiteSpace: 'nowrap', flexShrink: 0,
                                            opacity: isAISearching ? 0.7 : 1,
                                            display: 'flex', alignItems: 'center', gap: '4px',
                                        }}
                                    >
                                        {isAISearching ? (
                                            <>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                                                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                                </svg>
                                                검색 중...
                                            </>
                                        ) : '🤖 AI 검색'}
                                    </button>
                                )}
                            </div>
                            {showFoodSearch && foodSearch && (
                                <div style={{
                                    position: 'absolute', top: '100%', left: 0, right: 0,
                                    background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)',
                                    borderRadius: '8px', marginTop: '4px', maxHeight: '200px', overflow: 'auto',
                                    zIndex: 10,
                                }}>
                                    {searchFoodItems(foodSearch).slice(0, 8).map(item => (
                                        <div
                                            key={item.id}
                                            onClick={() => handleSelectFood(item)}
                                            style={{
                                                padding: '10px 12px', borderBottom: '1px solid var(--border-glass)',
                                                cursor: 'pointer', transition: 'background 0.15s',
                                            }}
                                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)'; }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                        >
                                            <div style={{ fontWeight: 600, fontSize: '13px' }}>{item.name}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                                {item.calories}kcal · 단{item.protein}g 탄{item.carbs}g 지{item.fat}g
                                            </div>
                                        </div>
                                    ))}
                                    {searchFoodItems(foodSearch).length === 0 && !isAISearching && (
                                        <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                                            잠시 후 🤖 Gemini가 자동으로 영양 정보를 검색합니다...
                                        </div>
                                    )}
                                    {isAISearching && (
                                        <div style={{ padding: '14px', textAlign: 'center', fontSize: '12px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}>
                                                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                            </svg>
                                            Gemini가 &ldquo;{foodSearch}&rdquo; 영양 정보 분석 중...
                                        </div>
                                    )}
                                    {aiSearchError && (
                                        <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#ef4444' }}>
                                            ⚠️ {aiSearchError}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        {selectedFood && (
                            <div style={{
                                marginTop: '8px', padding: '10px 12px', borderRadius: '8px',
                                background: 'rgba(16,185,129,0.15)', border: '1px solid var(--border-glass)',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '13px' }}>✓ {selectedFood.name}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                            {selectedFood.calories}kcal · 단{selectedFood.protein}g 탄{selectedFood.carbs}g 지{selectedFood.fat}g
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedFood(null)}
                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px' }}
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 기본 정보 입력 */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <label style={labelStyle}>음식 이름 *</label>
                            <input
                                name="name"
                                required
                                style={inputStyle}
                                placeholder="예: 닭가슴살 샐러드"
                                defaultValue={selectedFood?.name || ''}
                                autoFocus
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>시간</label>
                            <input name="time" type="time" defaultValue={new Date().toTimeString().slice(0, 5)} style={inputStyle} />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label style={labelStyle}>설명</label>
                            <input
                                name="description"
                                style={inputStyle}
                                placeholder="예: 닭가슴살 200g + 야채 + 드레싱"
                                defaultValue={selectedFood?.description || ''}
                            />
                        </div>
                        <div><label style={labelStyle}>칼로리 (kcal)</label><input name="calories" type="number" style={inputStyle} placeholder="450" defaultValue={selectedFood?.calories || ''} /></div>
                        <div><label style={labelStyle}>단백질 (g)</label><input name="protein" type="number" style={inputStyle} placeholder="35" defaultValue={selectedFood?.protein || ''} /></div>
                        <div><label style={labelStyle}>탄수화물 (g)</label><input name="carbs" type="number" style={inputStyle} placeholder="40" defaultValue={selectedFood?.carbs || ''} /></div>
                        <div><label style={labelStyle}>지방 (g)</label><input name="fat" type="number" style={inputStyle} placeholder="15" defaultValue={selectedFood?.fat || ''} /></div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                        <button type="submit" className="btn btn-primary btn-sm">저장</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setShowManualForm(false); setSelectedFood(null); }}>취소</button>
                    </div>
                </form>
            )}

            {/* ── 식사별 그룹 섹션 ──────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {MEAL_ORDER.map(meal => {
                    const cfg = MEAL_CONFIG[meal];
                    const mealEntries = mealGroups[meal];
                    const sub = mealTotals[meal];
                    const isSaving = savingMeal === meal;
                    const isActive = selectedMeal === meal;

                    return (
                        <div key={meal} className="chart-card" style={{
                            borderLeft: `3px solid ${isActive ? cfg.color : 'transparent'}`,
                            transition: 'border-color 0.2s',
                        }}>
                            {/* 섹션 헤더 */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: mealEntries.length > 0 ? '12px' : '0', cursor: 'pointer' }}
                                onClick={() => setSelectedMeal(meal)}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '18px' }}>{cfg.emoji}</span>
                                    <span style={{ fontWeight: 700, fontSize: '15px', color: cfg.color }}>{cfg.label}</span>
                                    {mealEntries.length > 0 && (
                                        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                                            {mealEntries.length}가지
                                        </span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {mealEntries.length > 0 && (
                                        <>
                                            <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 700, color: cfg.color }}>
                                                {sub.calories} kcal
                                            </span>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                                단{sub.protein}g 탄{sub.carbs}g 지{sub.fat}g
                                            </span>
                                        </>
                                    )}
                                    {mealEntries.length === 0 && (
                                        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>없음</span>
                                    )}
                                </div>
                            </div>

                            {/* 항목 리스트 */}
                            {mealEntries.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {mealEntries.map(entry => (
                                        <div key={entry.id} style={{
                                            display: 'flex', alignItems: 'center', gap: '12px',
                                            padding: '8px 10px', borderRadius: '8px',
                                            background: 'var(--bg-tertiary)',
                                        }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                                    <span style={{ fontWeight: 600, fontSize: '13px' }}>{entry.name}</span>
                                                    <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-tertiary)' }}>{entry.time}</span>
                                                </div>
                                                {entry.description && <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '1px' }}>{entry.description}</div>}
                                                <div style={{ display: 'flex', gap: '10px', marginTop: '4px', fontSize: '11px' }}>
                                                    <span style={{ color: cfg.color, fontWeight: 600 }}>{entry.calories}kcal</span>
                                                    <span style={{ color: '#10b981' }}>단 {entry.protein}g</span>
                                                    <span style={{ color: '#3b82f6' }}>탄 {entry.carbs}g</span>
                                                    <span style={{ color: '#f59e0b' }}>지 {entry.fat}g</span>
                                                </div>
                                            </div>
                                            <button onClick={() => handleDelete(entry.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}>
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    ))}

                                    {/* 식단 저장 버튼 */}
                                    <div style={{ marginTop: '8px' }}>
                                        {!isSaving ? (
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => { setSavingMeal(meal); setPresetName(`${cfg.label} 식단 ${new Date().toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}`); }}
                                                style={{ fontSize: '11px', gap: '4px' }}
                                            >
                                                <BookmarkPlus size={13} /> 이 {cfg.label} 식단 저장
                                            </button>
                                        ) : (
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <input
                                                    autoFocus
                                                    value={presetName}
                                                    onChange={e => setPresetName(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') handleSavePreset(meal); if (e.key === 'Escape') setSavingMeal(null); }}
                                                    style={{ ...inputStyle, flex: 1, padding: '6px 10px', fontSize: '12px' }}
                                                    placeholder="식단 이름 입력"
                                                />
                                                <button className="btn btn-primary btn-sm" onClick={() => handleSavePreset(meal)} style={{ fontSize: '11px' }}>저장</button>
                                                <button className="btn btn-secondary btn-sm" onClick={() => setSavingMeal(null)} style={{ fontSize: '11px' }}>취소</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {entries.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
                    <p style={{ fontSize: '36px', marginBottom: '8px' }}>🍽️</p>
                    <p>오늘 기록된 식단이 없습니다.</p>
                    <p style={{ fontSize: '12px', marginTop: '4px' }}>사진을 드래그하거나 직접 입력하세요.</p>
                </div>
            )}
        </div>
    );
}

const labelStyle: React.CSSProperties = {
    fontSize: '11px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px',
};
const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px',
    background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
    border: '1px solid var(--border-glass)', borderRadius: '8px',
    fontSize: '13px', fontFamily: 'inherit',
};
