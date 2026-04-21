'use client';

import { useState } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell,
} from 'recharts';
import { ChartDataPoint } from '@/app/lib/types';

interface HealthChartsProps {
    chartData: ChartDataPoint[];
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; name: string; value: number }>; label?: string }) => {
    if (!active || !payload) return null;
    return (
        <div style={{
            background: 'rgba(17, 24, 39, 0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '12px 16px',
            backdropFilter: 'blur(20px)',
        }}>
            <p style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px' }}>{label}</p>
            {payload.map((item, i) => (
                <p key={i} style={{ color: item.color, fontSize: '13px', fontWeight: 600, marginBottom: '2px' }}>
                    {item.name}: {item.value}
                </p>
            ))}
        </div>
    );
};

export default function HealthCharts({ chartData }: HealthChartsProps) {
    const [viewMode, setViewMode] = useState<'scroll' | 'fit'>('scroll');

    if (chartData.length < 2) {
        return (
            <div className="no-data-message" style={{ gridColumn: '1 / -1' }}>
                <div className="no-data-icon">📈</div>
                <p>차트를 표시하려면 2회 이상의 분석 기록이 필요합니다.</p>
            </div>
        );
    }

    const gridColor = 'rgba(255,255,255,0.05)';
    const tickColor = '#475569';
    const tickFont = { fontSize: 10, fill: tickColor, fontFamily: 'monospace' };

    const getChartMinWidth = () => {
        return viewMode === 'scroll' && chartData.length > 6 ? `${chartData.length * 45}px` : '100%';
    };

    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                <div style={{ background: 'var(--bg-tertiary)', padding: '2px', borderRadius: '8px', display: 'inline-flex' }}>
                    <button
                        onClick={() => setViewMode('scroll')}
                        style={{
                            padding: '4px 12px',
                            fontSize: '12px',
                            borderRadius: '6px',
                            background: viewMode === 'scroll' ? 'var(--bg-primary)' : 'transparent',
                            color: viewMode === 'scroll' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                            border: viewMode === 'scroll' ? '1px solid var(--border-glass)' : 'transparent',
                            transition: 'all 0.2s',
                            fontWeight: viewMode === 'scroll' ? 600 : 400,
                        }}
                    >
                        최근(스크롤)
                    </button>
                    <button
                        onClick={() => setViewMode('fit')}
                        style={{
                            padding: '4px 12px',
                            fontSize: '12px',
                            borderRadius: '6px',
                            background: viewMode === 'fit' ? 'var(--bg-primary)' : 'transparent',
                            color: viewMode === 'fit' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                            border: viewMode === 'fit' ? '1px solid var(--border-glass)' : 'transparent',
                            transition: 'all 0.2s',
                            fontWeight: viewMode === 'fit' ? 600 : 400,
                        }}
                    >
                        전체(한눈에)
                    </button>
                </div>
            </div>

            {/* 메인 차트: 체중·골격근량·체지방량 + 인바디 점수 */}
            <div className="charts-grid">
                <div className="chart-card">
                    <div className="chart-title" style={{ marginBottom: '16px' }}>
                        <span className="dot" style={{ background: '#3b82f6' }} />
                        체중 · 골격근량 · 체지방량 변화
                    </div>
                    <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '8px' }}>
                        <div style={{ minWidth: getChartMinWidth(), height: 170 }}>
                            <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                            <XAxis dataKey="date" tickLine={false} axisLine={false} tick={tickFont} interval={viewMode === 'fit' ? 'preserveStartEnd' : 'preserveEnd'} minTickGap={20} />
                            <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={tickFont} domain={['auto', 'auto']} />
                            <Tooltip content={<CustomTooltip />} />
                            <Line yAxisId="left" type="monotone" dataKey="weight" name="체중(kg)" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: '#3b82f6' }} activeDot={{ r: 6 }} />
                            <Line yAxisId="left" type="monotone" dataKey="skeletalMuscle" name="골격근량(kg)" stroke="#10b981" strokeWidth={2} dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} />
                            <Line yAxisId="left" type="monotone" dataKey="bodyFatMass" name="체지방량(kg)" stroke="#ef4444" strokeWidth={2} dot={{ r: 4, fill: '#ef4444' }} activeDot={{ r: 6 }} />
                        </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="chart-card">
                    <div className="chart-title" style={{ marginBottom: '16px' }}>
                        <span className="dot" style={{ background: '#f59e0b' }} />
                        인바디 점수 변화
                    </div>
                    <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '8px' }}>
                        <div style={{ minWidth: getChartMinWidth(), height: 170 }}>
                            <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                            <XAxis dataKey="date" tickLine={false} axisLine={false} tick={tickFont} interval={viewMode === 'fit' ? 'preserveStartEnd' : 'preserveEnd'} minTickGap={20} />
                            <YAxis tickLine={false} axisLine={false} tick={tickFont} domain={[70, 85]} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="inbodyScore" name="점수" radius={[4, 4, 4, 4]}>
                                {chartData.map((entry, index) => {
                                    const score = entry.inbodyScore || 0;
                                    let fill = 'rgba(71,85,105,0.5)';
                                    if (score >= 79) fill = 'rgba(16,185,129,0.7)';
                                    else if (score >= 77) fill = 'rgba(59,130,246,0.5)';
                                    return <Cell key={`cell-${index}`} fill={fill} />;
                                })}
                            </Bar>
                        </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2행 차트: 체지방률, 기초대사량, BMI+복부지방률 */}
            {/* inline style로 flex 강제: CSS 클래스가 Recharts ResizeObserver에 의해 grid로 부풀려지는 현상 방지 */}
            <div className="charts-grid-3" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: 0, width: '100%', overflow: 'hidden' }}>
                <div className="chart-card" style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                    <div className="chart-title" style={{ marginBottom: '16px' }}>
                        <span className="dot" style={{ background: '#ef4444' }} />
                        체지방률 (%)
                    </div>
                    <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '8px' }}>
                        <div style={{ minWidth: getChartMinWidth(), height: 130 }}>
                            <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                            <XAxis dataKey="date" tickLine={false} axisLine={false} tick={tickFont} interval={viewMode === 'fit' ? 'preserveStartEnd' : 'preserveEnd'} minTickGap={20} />
                            <YAxis tickLine={false} axisLine={false} tick={tickFont} domain={['auto', 'auto']} />
                            <Tooltip content={<CustomTooltip />} />
                            <Line type="monotone" dataKey="bodyFatPercent" name="체지방률(%)" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#ef4444' }} />
                        </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="chart-card" style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                    <div className="chart-title" style={{ marginBottom: '16px' }}>
                        <span className="dot" style={{ background: '#8b5cf6' }} />
                        기초대사량 (kcal)
                    </div>
                    <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '8px' }}>
                        <div style={{ minWidth: getChartMinWidth(), height: 160 }}>
                            <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                            <XAxis dataKey="date" tickLine={false} axisLine={false} tick={tickFont} interval={viewMode === 'fit' ? 'preserveStartEnd' : 'preserveEnd'} minTickGap={20} />
                            <YAxis tickLine={false} axisLine={false} tick={tickFont} domain={['auto', 'auto']} />
                            <Tooltip content={<CustomTooltip />} />
                            <Line type="monotone" dataKey="basalMetabolicRate" name="기초대사량" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3, fill: '#8b5cf6' }} />
                        </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="chart-card" style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                    <div className="chart-title" style={{ marginBottom: '16px' }}>
                        <span className="dot" style={{ background: '#06b6d4' }} />
                        BMI · 복부지방률
                    </div>
                    <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '8px' }}>
                        <div style={{ minWidth: getChartMinWidth(), height: 160 }}>
                            <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                            <XAxis dataKey="date" tickLine={false} axisLine={false} tick={tickFont} interval={viewMode === 'fit' ? 'preserveStartEnd' : 'preserveEnd'} minTickGap={20} />
                            <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={tickFont} domain={['auto', 'auto']} />
                            <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ ...tickFont, fill: '#f59e0b' }} domain={[0.8, 1.0]} />
                            <Tooltip content={<CustomTooltip />} />
                            <Line yAxisId="left" type="monotone" dataKey="bmi" name="BMI" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3, fill: '#06b6d4' }} />
                            <Line yAxisId="right" type="monotone" dataKey="waistHipRatio" name="복부지방률" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3, fill: '#f59e0b' }} />
                        </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
