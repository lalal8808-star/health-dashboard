'use client';

import { useRef, useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import { AnalysisRecord } from '@/app/lib/types';

interface ShareCardProps {
    records: AnalysisRecord[];
}

export default function ShareCard({ records }: ShareCardProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    if (!records || records.length < 2) return null;

    const sorted = [...records].sort((a, b) => a.metrics.date.localeCompare(b.metrics.date));
    const first = sorted[0].metrics;
    const latest = sorted[sorted.length - 1].metrics;

    const firstDate = new Date(first.date);
    const lastDate = new Date(latest.date);
    const diffDays = Math.ceil(Math.abs(lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));

    const changes = [
        { label: '체중', start: first.weight, end: latest.weight, unit: 'kg', invert: true },
        { label: '골격근량', start: first.skeletalMuscle, end: latest.skeletalMuscle, unit: 'kg', invert: false },
        { label: '체지방량', start: first.bodyFatMass, end: latest.bodyFatMass, unit: 'kg', invert: true },
        { label: '인바디 점수', start: first.inbodyScore, end: latest.inbodyScore, unit: '점', invert: false },
    ];

    const handleDownload = async () => {
        if (!cardRef.current) return;
        setIsGenerating(true);
        try {
            const html2canvas = (await import('html2canvas')).default;
            const canvas = await html2canvas(cardRef.current, {
                backgroundColor: null, scale: 2, useCORS: true,
            });
            const link = document.createElement('a');
            link.download = `healthlens-card-${latest.date}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (e) {
            console.error('Card generation failed:', e);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    <Share2 size={18} /> SNS 공유 카드
                </div>
                <button onClick={handleDownload} disabled={isGenerating}
                    style={{
                        padding: '8px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                        background: 'var(--gradient-blue)', color: 'white', fontWeight: 600, fontSize: '13px',
                        display: 'flex', alignItems: 'center', gap: '6px', opacity: isGenerating ? 0.6 : 1,
                    }}>
                    <Download size={14} /> {isGenerating ? '생성 중...' : 'PNG 다운로드'}
                </button>
            </div>

            {/* Shareable Card */}
            <div ref={cardRef} style={{
                width: '100%', maxWidth: '540px',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
                borderRadius: '20px', padding: '32px', position: 'relative', overflow: 'hidden',
            }}>
                {/* Decorative elements */}
                <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: '50%', background: 'rgba(56,189,248,0.1)' }} />
                <div style={{ position: 'absolute', bottom: -30, left: -30, width: 90, height: 90, borderRadius: '50%', background: 'rgba(167,139,250,0.1)' }} />

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', position: 'relative' }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: '10px',
                        background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: 'white',
                    }}>💪</div>
                    <div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9' }}>HealthLens AI</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{diffDays}일간의 변화 기록</div>
                    </div>
                </div>

                {/* Period */}
                <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px', position: 'relative' }}>
                    📅 {first.date} → {latest.date}
                </div>

                {/* Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', position: 'relative' }}>
                    {changes.map(c => {
                        const delta = ((c.end || 0) - (c.start || 0));
                        const good = c.invert ? delta < 0 : delta > 0;
                        const color = delta === 0 ? '#64748b' : good ? '#10b981' : '#ef4444';
                        return (
                            <div key={c.label} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '14px' }}>
                                <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{c.label}</div>
                                <div style={{ fontSize: '22px', fontWeight: 700, color: '#f1f5f9' }}>
                                    {c.end ?? '-'}<span style={{ fontSize: '11px', color: '#64748b' }}> {c.unit}</span>
                                </div>
                                <div style={{ fontSize: '12px', color, fontWeight: 600, marginTop: '4px' }}>
                                    {delta > 0 ? '▲' : delta < 0 ? '▼' : '-'} {Math.abs(delta).toFixed(1)}{c.unit}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '10px', color: '#475569', position: 'relative' }}>
                    Powered by HealthLens AI · 체성분 변화 리포트
                </div>
            </div>
        </div>
    );
}
