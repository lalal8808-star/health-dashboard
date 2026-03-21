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

// 모든 키를 한 번에 읽기 (Upstash pipeline 1회로 6개 키 전부)
async function kvGetAll(): Promise<Record<string, unknown>> {
    if (!REDIS_URL || !REDIS_TOKEN) return {};
    try {
        const keys = Array.from(ALLOWED_KEYS);
        const pipeline = keys.map(k => ['GET', k]);
        const res = await fetch(`${REDIS_URL}/pipeline`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify(pipeline),
            cache: 'no-store',
        });
        const json = await res.json() as Array<{ result?: string | null }>;
        const result: Record<string, unknown> = {};
        keys.forEach((key, i) => {
            const raw = json[i]?.result;
            result[key] = raw ? JSON.parse(raw) : null;
        });
        return result;
    } catch {
        return {};
    }
}

// 여러 키를 한 번에 저장 (Upstash pipeline 1회)
async function kvSetMulti(entries: Record<string, unknown>): Promise<void> {
    if (!REDIS_URL || !REDIS_TOKEN) return;
    try {
        const pipeline = Object.entries(entries).map(
            ([key, value]) => ['SET', key, JSON.stringify(value)]
        );
        await fetch(`${REDIS_URL}/pipeline`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify(pipeline),
        });
    } catch (e) {
        console.error('[storage] kvSetMulti error:', e);
    }
}

// GET /api/storage?key=...  → 단일 키 또는 key=all로 전체 배치
export async function GET(req: NextRequest) {
    const key = req.nextUrl.searchParams.get('key');

    // 배치 모드: /api/storage?key=all → 모든 키 한 번에 반환
    if (key === 'all') {
        const data = await kvGetAll();
        return NextResponse.json(data);
    }

    if (!key || !ALLOWED_KEYS.has(key)) {
        return NextResponse.json(null);
    }
    const data = await kvGet(key);
    return NextResponse.json(data);
}

// POST /api/storage?key=...  body: JSON → Redis에 저장
// POST /api/storage?key=batch  body: { "key1": data1, "key2": data2, ... } → 배치 저장
export async function POST(req: NextRequest) {
    const key = req.nextUrl.searchParams.get('key');

    // 배치 모드: 여러 키를 한 번에 저장
    if (key === 'batch') {
        try {
            const entries = await req.json() as Record<string, unknown>;
            // 허용된 키만 필터
            const valid: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(entries)) {
                if (ALLOWED_KEYS.has(k)) valid[k] = v;
            }
            if (Object.keys(valid).length > 0) {
                await kvSetMulti(valid);
            }
            return NextResponse.json({ success: true });
        } catch (e) {
            console.error('[storage] batch POST error:', e);
            return NextResponse.json({ error: 'Batch write failed' }, { status: 500 });
        }
    }

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
