/**
 * Slack 설정을 Redis에 저장/조회하는 API
 * 서버 사이드 cron job이 webhook URL에 접근할 수 있도록 Redis에 보관합니다.
 */
import { NextRequest, NextResponse } from 'next/server';

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const WEBHOOK_KEY = 'health-dashboard-slack-webhook';
const SETTINGS_KEY = 'health-dashboard-slack-settings';

const headers = () => ({
    Authorization: `Bearer ${REDIS_TOKEN}`,
    'Content-Type': 'application/json',
});

async function redisGet(key: string): Promise<string | null> {
    if (!REDIS_URL || !REDIS_TOKEN) return null;
    const res = await fetch(`${REDIS_URL}/pipeline`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify([['GET', key]]),
        cache: 'no-store',
    });
    const data = await res.json() as Array<{ result?: string | null }>;
    return data[0]?.result ?? null;
}

async function redisSet(key: string, value: string): Promise<void> {
    if (!REDIS_URL || !REDIS_TOKEN) return;
    await fetch(`${REDIS_URL}/pipeline`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify([['SET', key, value]]),
    });
}

export async function GET() {
    try {
        const [webhookUrl, settingsStr] = await Promise.all([
            redisGet(WEBHOOK_KEY),
            redisGet(SETTINGS_KEY),
        ]);
        const DEFAULT_SETTINGS = {
            weeklyReport: true,
            dailyReport: false,
            mealReminder: false,
            goalAlert: true,
            inbodyAlert: true,
            chatShare: true,
        };
        // 저장된 설정이 구버전이더라도 누락된 키는 기본값으로 채움
        const saved = settingsStr ? JSON.parse(settingsStr) : {};
        const settings = { ...DEFAULT_SETTINGS, ...saved };
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
