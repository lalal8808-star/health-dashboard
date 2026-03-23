/**
 * Slack 설정을 Redis에 저장/조회하는 API
 * 서버 사이드 cron job이 webhook URL에 접근할 수 있도록 Redis에 보관합니다.
 */
import { NextRequest, NextResponse } from 'next/server';

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const WEBHOOK_KEY = 'health-dashboard-slack-webhook';
const SETTINGS_KEY = 'health-dashboard-slack-settings';

async function redisGet(key: string): Promise<string | null> {
    if (!REDIS_URL || !REDIS_TOKEN) return null;
    const res = await fetch(`${REDIS_URL}/get/${key}`, {
        headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
        cache: 'no-store',
    });
    const data = await res.json();
    return data.result ?? null;
}

async function redisSet(key: string, value: string): Promise<void> {
    if (!REDIS_URL || !REDIS_TOKEN) return;
    await fetch(`${REDIS_URL}/set/${key}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
    });
}

export async function GET() {
    try {
        const [webhookUrl, settingsStr] = await Promise.all([
            redisGet(WEBHOOK_KEY),
            redisGet(SETTINGS_KEY),
        ]);
        const settings = settingsStr ? JSON.parse(settingsStr) : {
            weeklyReport: true,
            dailyReport: false,
            mealReminder: false,
            goalAlert: true,
            inbodyAlert: true,
            chatShare: true,
        };
        return NextResponse.json({ webhookUrl: webhookUrl || '', settings });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { webhookUrl, settings } = body;

        if (webhookUrl !== undefined) {
            await redisSet(WEBHOOK_KEY, webhookUrl);
        }
        if (settings !== undefined) {
            await redisSet(SETTINGS_KEY, JSON.stringify(settings));
        }
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
