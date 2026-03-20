import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { webhookUrl, message } = await req.json();

        if (!webhookUrl || !message) {
            return NextResponse.json({ error: 'webhookUrl과 message가 필요합니다.' }, { status: 400 });
        }

        const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(message),
        });

        if (!res.ok) {
            const text = await res.text();
            return NextResponse.json({ error: `Slack 전송 실패: ${text}` }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Slack notify error:', error);
        return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
    }
}
