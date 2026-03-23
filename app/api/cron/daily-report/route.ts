/**
 * 일일 건강 리포트 Cron Job
 * 매일 21:00 KST (12:00 UTC)에 자동 실행
 */
import { NextResponse } from 'next/server';
import { sendSlackMessage, buildDailyReport } from '@/app/lib/slack';

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

export async function GET() {
    try {
        // webhook URL 및 설정 조회
        const [webhookUrl, settingsStr] = await Promise.all([
            redisGet('health-dashboard-slack-webhook'),
            redisGet('health-dashboard-slack-settings'),
        ]);

        if (!webhookUrl) return NextResponse.json({ skipped: 'no webhook' });

        const settings = settingsStr ? JSON.parse(settingsStr) : {};
        if (!settings.dailyReport) return NextResponse.json({ skipped: 'disabled' });

        // 오늘 날짜 (KST)
        const today = new Date().toLocaleDateString('ko-KR', {
            timeZone: 'Asia/Seoul',
            year: 'numeric', month: '2-digit', day: '2-digit',
        }).replace(/\. /g, '-').replace('.', '');

        // 식단 및 운동 데이터 조회
        const [foodLogsStr, workoutLogsStr] = await Promise.all([
            redisGet('health-dashboard-food-logs'),
            redisGet('health-dashboard-workout-logs'),
        ]);

        const foodLogs: { date: string; entries: { calories: number; protein: number; carbs: number; fat: number; meal: string }[] }[] = foodLogsStr ? JSON.parse(foodLogsStr) : [];
        const workoutLogs: { date: string; entries: { name: string; duration?: number }[] }[] = workoutLogsStr ? JSON.parse(workoutLogsStr) : [];

        const todayFood = foodLogs.find(l => l.date === today);
        const todayWorkout = workoutLogs.find(l => l.date === today);

        const entries = todayFood?.entries ?? [];
        const totalCalories = entries.reduce((s, e) => s + (e.calories || 0), 0);
        const protein = entries.reduce((s, e) => s + (e.protein || 0), 0);
        const carbs = entries.reduce((s, e) => s + (e.carbs || 0), 0);
        const fat = entries.reduce((s, e) => s + (e.fat || 0), 0);
        const mealTypes = new Set(entries.map(e => e.meal));

        const workoutEntry = todayWorkout?.entries?.[0];

        const message = buildDailyReport(today, {
            totalCalories: Math.round(totalCalories),
            targetCalories: settings.targetCalories || 2200,
            protein: Math.round(protein),
            carbs: Math.round(carbs),
            fat: Math.round(fat),
            mealCount: mealTypes.size,
            workoutName: workoutEntry?.name,
            workoutDuration: workoutEntry?.duration,
        });

        await sendSlackMessage(webhookUrl, message);
        return NextResponse.json({ success: true, date: today });
    } catch (e) {
        console.error('Daily report cron error:', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
