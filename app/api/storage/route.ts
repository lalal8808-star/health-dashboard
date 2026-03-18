import { NextRequest, NextResponse } from 'next/server';

// 허용된 키 목록 (보안: 임의 키 방지)
const ALLOWED_KEYS = new Set([
    'health-dashboard-records',
    'health-dashboard-workout-logs',
    'health-dashboard-food-logs',
    'health-dashboard-meal-presets',
    'health-dashboard-chat-messages',   // 챗봇 크로스기기 동기화
    'health-dashboard-food-items',      // 음식 DB 크로스기기 동기화
]);

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const headers = () => ({
    Authorization: `Bearer ${REDIS_TOKEN ?? ''}`,
    'Content-Type': 'application/json',
});

// Upstash pipeline API: POST /pipeline  body: [["CMD", arg1, arg2, ...], ...]
// GET key → pipeline [["GET", key]]  → [{result: "stored_string"}]
async function kvGet(key: string): Promise<unknown> {
    if (!REDIS_URL || !REDIS_TOKEN) return null;
    try {
        const res = await fetch(`${REDIS_URL}/pipeline`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify([['GET', key]]),
            cache: 'no-store',
        });
        const json = await res.json() as Array<{ result?: string | null }>;
        const raw = json[0]?.result;
        if (raw === null || raw === undefined) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

// SET key value → pipeline [["SET", key, json_string]]
async function kvSet(key: string, value: unknown): Promise<void> {
    if (!REDIS_URL || !REDIS_TOKEN) return;
    try {
        await fetch(`${REDIS_URL}/pipeline`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify([['SET', key, JSON.stringify(value)]]),
        });
    } catch (e) {
        console.error('[storage] kvSet error:', e);
    }
}

// GET /api/storage?key=...  → Redis에서 JSON 반환
export async function GET(req: NextRequest) {
    const key = req.nextUrl.searchParams.get('key');
    if (!key || !ALLOWED_KEYS.has(key)) {
        return NextResponse.json(null);
    }
    const data = await kvGet(key);
    return NextResponse.json(data);
}

// POST /api/storage?key=...  body: JSON → Redis에 저장
export async function POST(req: NextRequest) {
    const key = req.nextUrl.searchParams.get('key');
    if (!key || !ALLOWED_KEYS.has(key)) {
        return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
    }
    try {
        const data = await req.json();
        await kvSet(key, data);
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error('[storage] POST error:', e);
        return NextResponse.json({ error: 'Write failed' }, { status: 500 });
    }
}
