/**
 * 주간 건강 리포트 Cron Job
 * 매주 일요일 21:00 KST (12:00 UTC)에 자동 실행
 */
import { NextResponse } from 'next/server';
import { sendSlackMessage, buildWeeklyReport } from '@/app/lib/slack';

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

function getLastWeekDates(): string[] {
    const dates: string[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
}

export async function GET() {
    try {
        const [webhookUrl, settingsStr] = await Promise.all([
            redisGet('health-dashboard-slack-webhook'),
            redisGet('health-dashboard-slack-settings'),
        ]);

        if (!webhookUrl) return NextResponse.json({ skipped: 'no webhook' });

        const settings = settingsStr ? JSON.parse(settingsStr) : {};
        if (!settings.weeklyReport) return NextResponse.json({ skipped: 'disabled' });

        const [foodLogsStr, workoutLogsStr, recordsStr] = await Promise.all([
            redisGet('health-dashboard-food-logs'),
            redisGet('health-dashboard-workout-logs'),
            redisGet('health-dashboard-records'),
        ]);

        const foodLogs: { date: string; entries: { calories: number; protein: number }[] }[] = foodLogsStr ? JSON.parse(foodLogsStr) : [];
        const workoutLogs: { date: string; entries: unknown[] }[] = workoutLogsStr ? JSON.parse(workoutLogsStr) : [];
        const records: { date: string; metrics: { weight?: number } }[] = recordsStr ? JSON.parse(recordsStr) : [];

        const weekDates = getLastWeekDates();
        const weekStart = weekDates[0];
        const weekEnd = weekDates[6];

        const weekFoodLogs = foodLogs.filter(l => weekDates.includes(l.date));
        const weekWorkoutLogs = workoutLogs.filter(l => weekDates.includes(l.date));

        // 평균 칼로리
        const totalCals = weekFoodLogs.reduce((s, l) =>
            s + l.entries.reduce((ss, e) => ss + (e.calories || 0), 0), 0);
        const avgCalories = weekFoodLogs.length > 0 ? Math.round(totalCals / weekFoodLogs.length) : 0;

        // 평균 단백질
        const totalProt = weekFoodLogs.reduce((s, l) =>
            s + l.entries.reduce((ss, e) => ss + (e.protein || 0), 0), 0);
        const avgProtein = weekFoodLogs.length > 0 ? Math.round(totalProt / weekFoodLogs.length) : 0;

        // 총 운동 횟수
        const totalWorkouts = weekWorkoutLogs.filter(l => l.entries.length > 0).length;

        // 총 식단 기록 끼니 수
        const totalMealsLogged = weekFoodLogs.reduce((s, l) => s + new Set(l.entries.map((e: any) => e.meal)).size, 0);

        // 체중 변화 (이번 주 첫날 vs 마지막날)
        const weekRecords = records.filter(r => weekDates.includes(r.date)).sort((a, b) => a.date.localeCompare(b.date));
        let weightChange: number | undefined;
        if (weekRecords.length >= 2) {
            const first = weekRecords[0].metrics?.weight;
            const last = weekRecords[weekRecords.length - 1].metrics?.weight;
            if (first && last) weightChange = last - first;
        }

        const weekLabel = `${weekStart} ~ ${weekEnd}`;
        const message = buildWeeklyReport(weekLabel, {
            avgCalories,
            targetCalories: settings.targetCalories || 2200,
            totalWorkouts,
            totalMealsLogged,
            avgProtein,
            weightChange,
        });

        await sendSlackMessage(webhookUrl, message);
        return NextResponse.json({ success: true, week: weekLabel });
    } catch (e) {
        console.error('Weekly report cron error:', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
