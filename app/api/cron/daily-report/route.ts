/**
 * 일일 건강 리포트 Cron Job
 * 매일 21:00 KST (12:00 UTC)에 자동 실행
 */
import { NextResponse } from 'next/server';
import { sendSlackMessage } from '@/app/lib/slack';

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redisGet(key: string) {
    if (!REDIS_URL || !REDIS_TOKEN) return null;
    const res = await fetch(`${REDIS_URL}/get/${key}`, {
        headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
        cache: 'no-store',
    });
    const data = await res.json();
    return data.result ?? null;
}

const ACTIVITY_MODES = [
    { key: 'diet',    label: '🥗 다이어트', multiplier: 1.0,   macros: { p: 40, c: 30, f: 30 } },
    { key: 'office',  label: '💼 사무직',   multiplier: 1.2,   macros: { p: 30, c: 40, f: 30 } },
    { key: 'worker',  label: '🚶 직장인',   multiplier: 1.375, macros: { p: 30, c: 40, f: 30 } },
    { key: 'workout', label: '🏋️ 운동',     multiplier: 1.55,  macros: { p: 25, c: 50, f: 25 } },
];

function makeBar(pct: number, total = 10): string {
    const filled = Math.round((pct / 100) * total);
    return '█'.repeat(filled) + '░'.repeat(total - filled);
}

export async function GET() {
    try {
        const [webhookUrl, settingsStr] = await Promise.all([
            redisGet('health-dashboard-slack-webhook'),
            redisGet('health-dashboard-slack-settings'),
        ]);

        const cleanUrl = webhookUrl ? String(webhookUrl).replace(/^"|"$/g, '').trim() : '';
        if (!cleanUrl) return NextResponse.json({ skipped: 'no webhook' });

        const settings = settingsStr ? JSON.parse(settingsStr) : {};
        if (!settings.dailyReport) return NextResponse.json({ skipped: 'disabled' });

        // 오늘 날짜 (KST)
        const today = new Date().toLocaleDateString('ko-KR', {
            timeZone: 'Asia/Seoul',
            year: 'numeric', month: '2-digit', day: '2-digit',
        }).replace(/\. /g, '-').replace('.', '');

        // 데이터 조회
        const [foodLogsStr, workoutLogsStr, dateModesStr, recordsStr] = await Promise.all([
            redisGet('health-dashboard-food-logs'),
            redisGet('health-dashboard-workout-logs'),
            redisGet('health-dashboard-date-modes'),
            redisGet('health-dashboard-records'),
        ]);

        const foodLogs: { date: string; entries: { calories: number; protein: number; carbs: number; fat: number; meal: string }[] }[] = foodLogsStr ? JSON.parse(foodLogsStr) : [];
        const workoutLogs: { date: string; entries: { name: string; duration?: number }[] }[] = workoutLogsStr ? JSON.parse(workoutLogsStr) : [];
        const dateModes: Record<string, string> = dateModesStr ? JSON.parse(dateModesStr) : {};
        const records: { metrics: { basalMetabolicRate?: number } }[] = recordsStr ? JSON.parse(recordsStr) : [];

        // 오늘 모드 & 목표 칼로리
        const todayModeKey = dateModes[today] || 'diet';
        const mode = ACTIVITY_MODES.find(m => m.key === todayModeKey) || ACTIVITY_MODES[0];
        const latestBmr = records.length > 0 ? records[records.length - 1]?.metrics?.basalMetabolicRate : null;
        const targetCalories = latestBmr ? Math.round(latestBmr * mode.multiplier) : (settings.targetCalories || 2200);

        const todayFood = foodLogs.find(l => l.date === today);
        const todayWorkout = workoutLogs.find(l => l.date === today);

        const entries = todayFood?.entries ?? [];
        const totalCalories = Math.round(entries.reduce((s, e) => s + (e.calories || 0), 0));
        const protein = Math.round(entries.reduce((s, e) => s + (e.protein || 0), 0));
        const carbs = Math.round(entries.reduce((s, e) => s + (e.carbs || 0), 0));
        const fat = Math.round(entries.reduce((s, e) => s + (e.fat || 0), 0));
        const mealTypes = new Set(entries.map(e => e.meal));
        const workoutEntry = todayWorkout?.entries?.[0];

        // 실제 섭취 비율 계산
        const pCal = protein * 4;
        const cCal = carbs * 4;
        const fCal = fat * 9;
        const totalMacroCal = pCal + cCal + fCal || 1;
        const pPct = Math.round(pCal / totalMacroCal * 100);
        const cPct = Math.round(cCal / totalMacroCal * 100);
        const fPct = Math.round(fCal / totalMacroCal * 100);

        const calorieRate = targetCalories > 0 ? Math.round((totalCalories / targetCalories) * 100) : 0;
        const calorieStatus = calorieRate >= 90 && calorieRate <= 110 ? '✅' : calorieRate > 110 ? '⚠️' : '📉';

        const message = {
            text: `📊 ${today} 일일 건강 리포트`,
            blocks: [
                {
                    type: 'header',
                    text: { type: 'plain_text', text: `📊 ${today} 일일 건강 리포트` },
                },
                { type: 'divider' },
                {
                    type: 'section',
                    fields: [
                        { type: 'mrkdwn', text: `*🎯 오늘 모드*\n${mode.label}` },
                        { type: 'mrkdwn', text: `*🔥 칼로리*\n${calorieStatus} ${totalCalories} / ${targetCalories} kcal (${calorieRate}%)` },
                        { type: 'mrkdwn', text: `*🍽️ 식사 기록*\n${mealTypes.size}끼` },
                        { type: 'mrkdwn', text: `*💪 운동*\n${workoutEntry ? `${workoutEntry.name}${workoutEntry.duration ? ` (${workoutEntry.duration}분)` : ''}` : '미기록'}` },
                    ],
                },
                { type: 'divider' },
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: [
                            `*🥗 영양소 밸런스* (목표 탄${mode.macros.c}:단${mode.macros.p}:지${mode.macros.f})`,
                            ``,
                            `🍚 탄수화물  ${makeBar(cPct)} ${cPct}%  *${carbs}g*  (목표 ${Math.round(targetCalories * mode.macros.c / 100 / 4)}g)`,
                            `🥩 단백질     ${makeBar(pPct)} ${pPct}%  *${protein}g*  (목표 ${Math.round(targetCalories * mode.macros.p / 100 / 4)}g)`,
                            `🥑 지방        ${makeBar(fPct)} ${fPct}%  *${fat}g*  (목표 ${Math.round(targetCalories * mode.macros.f / 100 / 9)}g)`,
                        ].join('\n'),
                    },
                },
                {
                    type: 'context',
                    elements: [{ type: 'mrkdwn', text: `_HealthLens AI • ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}_` }],
                },
            ],
        };

        const sent = await sendSlackMessage(cleanUrl, message);
        if (!sent) return NextResponse.json({ error: 'Slack 전송 실패 (webhook 응답 오류)' }, { status: 500 });
        return NextResponse.json({ success: true, date: today });
    } catch (e) {
        console.error('Daily report cron error:', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
