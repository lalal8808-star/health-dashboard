'use client';

import { useState, useEffect } from 'react';
import { Bell, Send, Check, AlertCircle, Loader2, Link2 } from 'lucide-react';

const SLACK_WEBHOOK_KEY = 'health-dashboard-slack-webhook' as const;
const SLACK_SETTINGS_KEY = 'health-dashboard-slack-settings' as const;

interface SlackSettingsData {
    weeklyReport: boolean;
    mealReminder: boolean;
}

function getWebhookUrl(): string {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(SLACK_WEBHOOK_KEY) || '';
}

function getSlackSettings(): SlackSettingsData {
    if (typeof window === 'undefined') return { weeklyReport: true, mealReminder: false };
    try {
        const data = localStorage.getItem(SLACK_SETTINGS_KEY);
        return data ? JSON.parse(data) : { weeklyReport: true, mealReminder: false };
    } catch {
        return { weeklyReport: true, mealReminder: false };
    }
}

export default function SlackSettings() {
    const [webhookUrl, setWebhookUrl] = useState('');
    const [settings, setSettings] = useState<SlackSettingsData>({ weeklyReport: true, mealReminder: false });
    const [isSaved, setIsSaved] = useState(false);
    const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
    const [testMessage, setTestMessage] = useState('');

    useEffect(() => {
        setWebhookUrl(getWebhookUrl());
        setSettings(getSlackSettings());
    }, []);

    const handleSave = () => {
        localStorage.setItem(SLACK_WEBHOOK_KEY, webhookUrl);
        localStorage.setItem(SLACK_SETTINGS_KEY, JSON.stringify(settings));
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
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
                                type: 'section',
                                text: { type: 'mrkdwn', text: '✅ *HealthLens AI 알림이 성공적으로 연결되었습니다!*\n\n앞으로 주간 리포트와 식사 리마인더가 이 채널로 전송됩니다.' },
                            },
                        ],
                    },
                }),
            });
            if (res.ok) {
                setTestStatus('success');
                setTestMessage('테스트 메시지가 전송되었습니다!');
            } else {
                const data = await res.json();
                setTestStatus('error');
                setTestMessage(data.error || 'Webhook 전송에 실패했습니다.');
            }
        } catch {
            setTestStatus('error');
            setTestMessage('네트워크 오류가 발생했습니다.');
        }
    };

    const toggleStyle = (enabled: boolean): React.CSSProperties => ({
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: enabled ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
        position: 'relative', transition: 'background 0.2s',
    });

    const toggleDotStyle = (enabled: boolean): React.CSSProperties => ({
        position: 'absolute', top: 2, left: enabled ? 22 : 2,
        width: 20, height: 20, borderRadius: '50%', background: 'white',
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
    });

    return (
        <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px' }}>
            {/* Slack Webhook URL */}
            <div className="chart-card">
                <div className="chart-title" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Link2 size={18} color="var(--accent-blue)" /> Slack Webhook URL
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '12px' }}>
                    Slack App의 Incoming Webhook URL을 입력하세요. <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-blue)' }}>설정 방법 →</a>
                </p>
                <input
                    type="url"
                    value={webhookUrl}
                    onChange={e => setWebhookUrl(e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                    style={{
                        width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-glass)',
                        background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
                        boxSizing: 'border-box',
                    }}
                />
                <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                    <button onClick={handleSave}
                        style={{
                            padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                            background: isSaved ? 'var(--accent-green-dim)' : 'var(--gradient-blue)',
                            color: isSaved ? 'var(--accent-green)' : 'white', fontWeight: 600, fontSize: '13px',
                            display: 'flex', alignItems: 'center', gap: '6px',
                        }}>
                        {isSaved ? <><Check size={14} /> 저장됨</> : '저장'}
                    </button>
                    <button onClick={handleTest} disabled={testStatus === 'sending'}
                        style={{
                            padding: '10px 20px', borderRadius: '10px', border: '1px solid var(--border-glass)',
                            background: 'var(--bg-glass)', cursor: 'pointer',
                            color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px',
                            display: 'flex', alignItems: 'center', gap: '6px', opacity: testStatus === 'sending' ? 0.6 : 1,
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

            {/* Notification Toggles */}
            <div className="chart-card">
                <div className="chart-title" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Bell size={18} color="#f59e0b" /> 알림 설정
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Weekly Report Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>📊 주간 리포트 발송</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>매주 일요일 저녁에 주간 요약 리포트를 전송합니다</div>
                        </div>
                        <button style={toggleStyle(settings.weeklyReport)} onClick={() => {
                            const next = { ...settings, weeklyReport: !settings.weeklyReport };
                            setSettings(next);
                            localStorage.setItem(SLACK_SETTINGS_KEY, JSON.stringify(next));
                        }}>
                            <div style={toggleDotStyle(settings.weeklyReport)} />
                        </button>
                    </div>

                    <div style={{ height: 1, background: 'var(--border-glass)' }} />

                    {/* Meal Reminder Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>🍽️ 식사 리마인더</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>식사 시간에 식단 기록 알림을 전송합니다</div>
                        </div>
                        <button style={toggleStyle(settings.mealReminder)} onClick={() => {
                            const next = { ...settings, mealReminder: !settings.mealReminder };
                            setSettings(next);
                            localStorage.setItem(SLACK_SETTINGS_KEY, JSON.stringify(next));
                        }}>
                            <div style={toggleDotStyle(settings.mealReminder)} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Info */}
            <div style={{
                padding: '16px', borderRadius: '12px', border: '1px solid var(--border-glass)',
                background: 'var(--accent-blue-dim)', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6,
            }}>
                💡 <strong>Tip:</strong> Slack 앱에서 Incoming Webhook을 활성화한 후 생성된 URL을 위에 붙여넣으세요.
                주간 리포트는 서버 사이드 cron job으로 자동 전송되며, 식사 리마인더는 브라우저 알림과 함께 동작합니다.
            </div>
        </div>
    );
}
