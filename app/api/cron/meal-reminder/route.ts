/**
 * 식단 미기록 리마인더 Cron Job
 * 매일 20:00 KST (11:00 UTC)에 저녁 미기록 시 Slack 알림
 */
import { NextResponse } from 'next/server';
import { sendSlackMessage, buildMealReminder } from '@/app/lib/slack';

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
        const [webhookUrl, settingsStr] = await Promise.all([
            redisGet('health-dashboard-slack-webhook'),
            redisGet('health-dashboard-slack-settings'),
        ]);

        if (!webhookUrl) return NextResponse.json({ skipped: 'no webhook' });

        const settings = settingsStr ? JSON.parse(settingsStr) : {};
        if (!settings.mealReminder) return NextResponse.json({ skipped: 'disabled' });

        // 오늘 날짜 (KST)
        const now = new Date();
        const today = now.toLocaleDateString('ko-KR', {
            timeZone: 'Asia/Seoul',
            year: 'numeric', month: '2-digit', day: '2-digit',
        }).replace(/\. /g, '-').replace('.', '');

        // 오늘 저녁 식단 기록 여부 확인
        const foodLogsStr = await redisGet('health-dashboard-food-logs');
        const foodLogs: { date: string; entries: { meal: string }[] }[] = foodLogsStr ? JSON.parse(foodLogsStr) : [];
        const todayLog = foodLogs.find(l => l.date === today);
        const hasDinner = todayLog?.entries?.some(e =>
            e.meal === '저녁' || e.meal === 'dinner'
        );

        if (hasDinner) return NextResponse.json({ skipped: 'dinner already logged' });

        await sendSlackMessage(webhookUrl, buildMealReminder('저녁', today));
        return NextResponse.json({ success: true, date: today });
    } catch (e) {
        console.error('Meal reminder cron error:', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
