import { Client } from '@notionhq/client';

function getNotion() {
    const auth = process.env.NOTION_API_KEY;
    if (!auth) throw new Error('NOTION_API_KEY가 설정되지 않았습니다.');
    return new Client({ auth });
}

function getDsId() {
    const id = process.env.NOTION_CHAT_DS_ID?.trim(); // \n 등 공백 제거
    if (!id) throw new Error('NOTION_CHAT_DS_ID가 설정되지 않았습니다.');
    return id;
}

function getDbId() {
    // 쓰기(pages.create)는 database_id 필요 — DataSource ID와 별개
    // .trim() 필수: .env에서 줄바꿈(\n)이 붙으면 UUID 유효성 검사 실패
    const id = process.env.NOTION_CHAT_DB_ID?.trim();
    if (!id) throw new Error('NOTION_CHAT_DB_ID가 설정되지 않았습니다.');
    return id;
}

// Notion rich_text 1900자 청크 (2000자 제한보다 안전 마진 확보)
function splitText(text: string, maxLen = 1900): { type: 'text'; text: { content: string } }[] {
    const safe = text.slice(0, maxLen * 5); // 최대 5청크로 제한
    const chunks: { type: 'text'; text: { content: string } }[] = [];
    for (let i = 0; i < safe.length; i += maxLen) {
        chunks.push({ type: 'text', text: { content: safe.slice(i, i + maxLen) } });
    }
    return chunks.length > 0 ? chunks : [{ type: 'text', text: { content: '' } }];
}

function categorize(question: string): string {
    const q = question.toLowerCase();
    if (/식단|음식|먹|칼로리|단백질|탄수화물|지방|아침|점심|저녁|간식|식사/.test(q)) return '식단';
    if (/운동|웨이트|달리기|러닝|헬스|스쿼트|벤치|데드|유산소|근력/.test(q)) return '운동';
    if (/체중|체지방|골격근|인바디|BMI|기초대사|내장지방|체성분/.test(q)) return '체성분';
    return '일반';
}

export async function readRecentChats(limit = 20): Promise<{ question: string; answer: string; date: string }[]> {
    try {
        const notion = getNotion();
        const dsId = getDsId();
        const response = await notion.dataSources.query({
            data_source_id: dsId,
            sorts: [{ timestamp: 'created_time', direction: 'descending' }],
            page_size: limit,
        });

        const results = (response as any).results || [];
        return results.map((page: any) => {
            const props = page.properties;
            const question = (props['질문내용']?.rich_text || [])
                .map((t: any) => t.plain_text).join('');
            const answer = (props['답변내용']?.rich_text || [])
                .map((t: any) => t.plain_text).join('');
            const date = props['질문일시']?.created_time || page.created_time || '';
            return { question, answer, date };
        }).reverse();
    } catch (err) {
        console.error('Notion read error:', err);
        return [];
    }
}

export async function saveChatEntry(question: string, answer: string): Promise<void> {
    try {
        const notion = getNotion();
        const dbId = getDbId();

        // 1) DB 스키마 조회 → 실제 title 속성명 자동 감지
        let titlePropName = '제목';
        try {
            const db = await (notion.databases as any).retrieve({ database_id: dbId });
            const props: Record<string, any> = db?.properties || {};
            for (const [name, prop] of Object.entries(props)) {
                if ((prop as any).type === 'title') {
                    titlePropName = name;
                    break;
                }
            }
        } catch (schemaErr: any) {
            console.error('[Notion] schema 조회 실패 (기본값 사용):', schemaErr?.message);
        }

        const title = question.slice(0, 80).replace(/\n/g, ' ');
        const category = categorize(question);

        // 2) 제목(질문) + 답변내용 + 카테고리 저장
        try {
            await notion.pages.create({
                parent: { database_id: dbId },
                properties: {
                    [titlePropName]: { title: [{ type: 'text', text: { content: title } }] },
                    '답변내용': { rich_text: splitText(answer) },
                    '카테고리': { select: { name: category } },
                },
            } as any);
            return;
        } catch (e1: any) {
            console.error('[Notion] 1차 저장 실패:', e1?.message);
        }

        // 3) 카테고리 제외 재시도
        try {
            await notion.pages.create({
                parent: { database_id: dbId },
                properties: {
                    [titlePropName]: { title: [{ type: 'text', text: { content: title } }] },
                    '답변내용': { rich_text: splitText(answer) },
                },
            } as any);
            return;
        } catch (e2: any) {
            console.error('[Notion] 2차 저장 실패:', e2?.message);
        }

        // 4) 타이틀만 최소 저장
        await notion.pages.create({
            parent: { database_id: dbId },
            properties: {
                [titlePropName]: { title: [{ type: 'text', text: { content: title } }] },
            },
        } as any);

    } catch (err: any) {
        console.error('[Notion] saveChatEntry 최종 실패:', err?.message || err);
    }
}
