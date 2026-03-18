import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

/**
 * Notion 연결 진단 API
 * GET /api/notion-test → Notion DB 접근 가능 여부 및 속성 목록 반환
 */
export async function GET() {
    const apiKey = process.env.NOTION_API_KEY?.trim();
    const dbId = process.env.NOTION_CHAT_DB_ID?.trim(); // \n 제거
    const dsId = process.env.NOTION_CHAT_DS_ID?.trim();

    if (!apiKey) return NextResponse.json({ error: 'NOTION_API_KEY 없음' }, { status: 500 });
    if (!dbId)   return NextResponse.json({ error: 'NOTION_CHAT_DB_ID 없음' }, { status: 500 });

    const notion = new Client({ auth: apiKey });

    // 1) DB 스키마 조회
    let dbSchema: any = null;
    let dbError: string | null = null;
    try {
        dbSchema = await (notion.databases as any).retrieve({ database_id: dbId });
    } catch (e: any) {
        dbError = e?.message || String(e);
    }

    // 2) 테스트 페이지 생성 시도
    let writeResult: string = '미시도';
    let writeError: string | null = null;
    if (dbSchema) {
        const props = dbSchema.properties || {};
        let titlePropName = '제목';
        for (const [name, prop] of Object.entries(props)) {
            if ((prop as any).type === 'title') { titlePropName = name; break; }
        }
        try {
            await notion.pages.create({
                parent: { database_id: dbId! },
                properties: {
                    [titlePropName]: { title: [{ type: 'text', text: { content: '[테스트] Notion 연결 확인' } }] },
                    '질문내용': { rich_text: [{ type: 'text', text: { content: 'Notion 연결 테스트' } }] },
                    '답변내용': { rich_text: [{ type: 'text', text: { content: '이 항목은 연결 테스트용입니다.' } }] },
                },
            } as any);
            writeResult = '✅ 저장 성공';
        } catch (e: any) {
            writeError = e?.message || String(e);
            writeResult = '❌ 저장 실패';
        }
    }

    return NextResponse.json({
        env: { apiKey: '✅ 설정됨', dbId, dsId },
        dbAccess: dbError ? `❌ ${dbError}` : '✅ DB 접근 가능',
        dbProperties: dbSchema
            ? Object.entries(dbSchema.properties || {}).map(([name, p]: [string, any]) => ({
                name, type: p.type,
            }))
            : null,
        titlePropName: dbSchema
            ? (() => {
                for (const [n, p] of Object.entries(dbSchema.properties || {})) {
                    if ((p as any).type === 'title') return n;
                }
                return '(없음)';
            })()
            : null,
        writeResult,
        writeError,
    });
}
