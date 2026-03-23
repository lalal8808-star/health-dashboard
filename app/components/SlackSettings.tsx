'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Bell, Send, Check, AlertCircle, Loader2, Link2, RefreshCw } from 'lucide-react';
import { getLatestRecord } from '@/app/lib/storage';

interface SlackSettingsData {
    weeklyReport: boolean;
    dailyReport: boolean;
    mealReminder: boolean;
    goalAlert: boolean;
    inbodyAlert: boolean;
    chatShare: boolean;
    targetCalories: number;
}

const DEFAULT_SETTINGS: SlackSettingsData = {
    weeklyReport: true,
    dailyReport: false,
    mealReminder: false,
    goalAlert: true,
    inbodyAlert: true,
    chatShare: true,
    targetCalories: 2200,
};

export default function SlackSettings() {
    const [webhookUrl, setWebhookUrl] = useState('');
    const [settings, setSettings] = useState<SlackSettingsData>(DEFAULT_SETTINGS);
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
    const [testMessage, setTestMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isFirstLoad = useRef(true);

    // 인바디 데이터로 BMR 자동 계산
    const bmrInfo = useMemo(() => {
        const latest = getLatestRecord();
        if (latest?.metrics.basalMetabolicRate) {
            const bmr = latest.metrics.basalMetabolicRate;
            return { bmr, targetCalories: Math.round(bmr * 1.55), date: latest.metrics.date };
        }
        return { bmr: null, targetCalories: 2200, date: null };
    }, []);

    useEffect(() => {
        // 서버(Redis)에서 설정 불러오기
        fetch('/api/slack-settings')
            .then(r => r.json())
            .then(data => {
                if (data.webhookUrl) setWebhookUrl(data.webhookUrl);
                const saved = data.settings || {};
                // targetCalories가 저장된 적 없으면 BMR 자동 계산값 사용
                const targetCalories = saved.targetCalories ?? bmrInfo.targetCalories;
                setSettings({ ...DEFAULT_SETTINGS, ...saved, targetCalories });
            })
            .catch(() => {})
            .finally(() => {
                setIsLoading(false);
                isFirstLoad.current = false;
            });
    }, []);

    // 토글 변경 시 1초 후 자동저장
    const autoSaveSettings = useCallback((newSettings: SlackSettingsData) => {
        if (isFirstLoad.current) return;
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = setTimeout(async () => {
            setIsSaving(true);
            try {
                await fetch('/api/slack-settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ settings: newSettings }),
                });
                setIsSaved(true);
                setTimeout(() => setIsSaved(false), 2000);
            } catch { /* ignore */ } finally {
                setIsSaving(false);
            }
        }, 800);
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await fetch('/api/slack-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ webhookUrl, settings }),
            });
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 2000);
        } catch {
            /* ignore */
        } finally {
            setIsSaving(false);
        }
    };

    const handleTest = async () => {
        if (!webhookUrl.trim()) {
            setTestStatus('error');
            setTestMessage('Webhook URL을 먼저 입력해주세요.');
            return;
        }
        setTestStatus('sending');
        try {
            const res = await fetch('/api/slack-notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    webhookUrl: webhookUrl.trim(),
                    message: {
                        text: '🏋️ HealthLens AI 연동 테스트',
                        blocks: [
                            {
                                type: 'header',
                                text: { type: 'plain_text', text: '✅ HealthLens AI 연동 성공!' },
                            },
                            {
                                type: 'section',
                                text: {
                                    type: 'mrkdwn',
                                    text: '🎉 Slack 알림이 정상적으로 연결됐습니다!\n\n활성화한 알림들이 이 채널로 자동 전송됩니다.',
                                },
                            },
                            {
                                type: 'context',
                                elements: [{ type: 'mrkdwn', text: '_HealthLens AI • 연동 테스트_' }],
                            },
                        ],
                    },
                }),
            });
            if (res.ok) {
                setTestStatus('success');
                setTestMessage('✅ 테스트 메시지가 전송됐습니다!');
            } else {
                const data = await res.json();
                setTestStatus('error');
                setTestMessage(data.error || '전송 실패');
            }
        } catch {
            setTestStatus('error');
            setTestMessage('네트워크 오류가 발생했습니다.');
        }
        setTimeout(() => { setTestStatus('idle'); setTestMessage(''); }, 4000);
    };

    const toggle = (key: keyof SlackSettingsData) => {
        setSettings(prev => {
            const next = { ...prev, [key]: !prev[key] };
            autoSaveSettings(next);
            return next;
        });
    };

    const Toggle = ({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) => (
        <button
            onClick={onToggle}
            style={{
                width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: enabled ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
            }}
        >
            <div style={{
                position: 'absolute', top: 2, left: enabled ? 22 : 2,
                width: 20, height: 20, borderRadius: '50%', background: 'white',
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }} />
        </button>
    );

    const NotifRow = ({ icon, title, desc, settingKey }: {
        icon: string; title: string; desc: string; settingKey: keyof SlackSettingsData;
    }) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{icon} {title}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{desc}</div>
            </div>
            <Toggle enabled={!!settings[settingKey]} onToggle={() => toggle(settingKey)} />
        </div>
    );

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                <Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-tertiary)' }} />
            </div>
        );
    }

    return (
        <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px' }}>

            {/* Webhook URL */}
            <div className="chart-card">
                <div className="chart-title" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Link2 size={18} color="var(--accent-blue)" /> Slack Webhook URL
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '12px' }}>
                    Slack App의 Incoming Webhook URL을 입력하세요.{' '}
                    <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-blue)' }}>
                        설정 방법 →
                    </a>
                </p>
                <input
                    type="url"
                    value={webhookUrl}
                    onChange={e => setWebhookUrl(e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                    style={{
                        width: '100%', padding: '12px 14px', borderRadius: '10px',
                        border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                    }}
                />
                <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
                    <button onClick={handleSave} disabled={isSaving}
                        style={{
                            padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                            background: isSaved ? 'var(--accent-green-dim)' : 'var(--gradient-blue)',
                            color: isSaved ? 'var(--accent-green)' : 'white', fontWeight: 600, fontSize: '13px',
                            display: 'flex', alignItems: 'center', gap: '6px', opacity: isSaving ? 0.6 : 1,
                        }}>
                        {isSaving ? <Loader2 size={14} className="animate-spin" /> : isSaved ? <Check size={14} /> : <RefreshCw size={14} />}
                        {isSaved ? '저장됨' : '저장'}
                    </button>
                    <button onClick={handleTest} disabled={testStatus === 'sending'}
                        style={{
                            padding: '10px 20px', borderRadius: '10px', border: '1px solid var(--border-glass)',
                            background: 'var(--bg-glass)', cursor: 'pointer', color: 'var(--text-secondary)',
                            fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px',
                            opacity: testStatus === 'sending' ? 0.6 : 1,
                        }}>
                        {testStatus === 'sending' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        테스트 전송
                    </button>
                </div>
                {testMessage && (
                    <div style={{
                        marginTop: '10px', padding: '10px 14px', borderRadius: '8px', fontSize: '13px',
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: testStatus === 'success' ? 'var(--accent-green-dim)' : 'var(--accent-red-dim)',
                        color: testStatus === 'success' ? 'var(--accent-green)' : 'var(--accent-red)',
                    }}>
                        {testStatus === 'success' ? <Check size={14} /> : <AlertCircle size={14} />} {testMessage}
                    </div>
                )}
            </div>

            {/* 자동 알림 설정 */}
            <div className="chart-card">
                <div className="chart-title" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Bell size={18} color="#f59e0b" /> 자동 알림 설정
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <NotifRow icon="📊" title="주간 리포트" settingKey="weeklyReport"
                        desc="매주 일요일 21:00 KST — 한 주 식단·운동 요약 전송" />
                    <div style={{ height: 1, background: 'var(--border-glass)' }} />
                    <NotifRow icon="📋" title="일일 리포트" settingKey="dailyReport"
                        desc="매일 21:00 KST — 당일 식단·운동 요약 전송" />
                    <div style={{ height: 1, background: 'var(--border-glass)' }} />
                    <NotifRow icon="🍽️" title="저녁 식단 리마인더" settingKey="mealReminder"
                        desc="매일 20:00 KST — 저녁 미기록 시 알림 전송" />
                    <div style={{ height: 1, background: 'var(--border-glass)' }} />
                    <NotifRow icon="🎯" title="칼로리 목표 달성 알림" settingKey="goalAlert"
                        desc="오늘 칼로리 목표를 달성했을 때 즉시 전송" />
                    <div style={{ height: 1, background: 'var(--border-glass)' }} />
                    <NotifRow icon="💪" title="인바디 결과 알림" settingKey="inbodyAlert"
                        desc="새 인바디 데이터 업로드 시 결과 즉시 전송" />
                    <div style={{ height: 1, background: 'var(--border-glass)' }} />
                    <NotifRow icon="🤖" title="코치 답변 공유 버튼" settingKey="chatShare"
                        desc="챗봇 AI 답변에 Slack 공유 버튼 표시" />
                </div>
            </div>

            {/* 칼로리 목표 */}
            <div className="chart-card">
                <div className="chart-title" style={{ marginBottom: '12px' }}>⚙️ 리포트 기준 설정</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <label style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>일일 칼로리 목표</label>
                    <input
                        type="number"
                        value={settings.targetCalories}
                        onChange={e => setSettings(prev => ({ ...prev, targetCalories: Number(e.target.value) }))}
                        style={{
                            width: '100px', padding: '8px 12px', borderRadius: '8px',
                            border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)',
                            color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
                        }}
                    />
                    <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>kcal</span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
                    {bmrInfo.bmr
                        ? `✅ BMR ${bmrInfo.bmr}kcal × 1.55 = ${bmrInfo.targetCalories}kcal 자동 계산됨 (${bmrInfo.date} 기준)`
                        : '인바디 데이터가 없어 기본값 2200kcal 사용 중'}
                </p>
            </div>

            {/* Tip */}
            <div style={{
                padding: '16px', borderRadius: '12px', border: '1px solid var(--border-glass)',
                background: 'var(--accent-blue-dim)', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6,
            }}>
                💡 <strong>설정 방법:</strong> Slack → 앱 관리 → Incoming Webhooks → 새 Webhook 생성 → URL 복사 → 위에 붙여넣기 후 저장
            </div>
        </div>
    );
}
