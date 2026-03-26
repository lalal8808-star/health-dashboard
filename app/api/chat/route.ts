import { NextRequest } from 'next/server';
import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import { readRecentChats, saveChatEntry } from '@/app/lib/notion-chat';

export const maxDuration = 60;

const SYSTEM_PROMPT = `당신은 "코치"라는 이름의 전문 다이어트·건강 코칭 AI입니다.
회원님의 체성분, 식단, 운동 기록과 과거 대화를 참고하여 맞춤형 조언을 제공합니다.

## 답변 원칙
- 짧은 질문엔 간결하게, 분석 요청엔 상세하게 답변한다 (질문 복잡도에 맞춤).
- 이모지 활용, 구체적 수치 인용, 위트있는 표현 사용.
- 음식/운동 추천 시 1번/2번/3번 형식으로 + 생리학적 이유 제시. ("1순위", "2순위" 표현 금지)
- 마지막엔 🚨 "코치의 절대 수칙" 1~2개로 마무리.

## 식단 미기입 규칙
- 미기입 날이 있으면 반드시 언급하고 기록을 독려한다.

## 중요
- 근거 없는 의학 진단 금지. 전문의 상담 필요 시 안내.
- 한국 식문화에 맞는 추천.
- 과거 대화 기록이 있으면 맥락을 이어간다.`;

interface ChatRequestBody {
    message: string;
    history: { role: 'user' | 'assistant'; content: string }[];
    healthData: {
        records: any[];
        foodLogs: any[];
        workoutLogs: any[];
    };
    image?: {
        base64: string;
        mimeType: string;
    };
}

function getKSTNow(): { date: string; hour: number; timeStr: string } {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const date = kst.toISOString().split('T')[0];
    const hour = kst.getUTCHours();
    const min = String(kst.getUTCMinutes()).padStart(2, '0');
    return { date, hour, timeStr: `${hour}:${min}` };
}

function getKSTDateString(offsetDays = 0): string {
    const now = new Date();
    // KST = UTC+9
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    kst.setUTCDate(kst.getUTCDate() - offsetDays);
    return kst.toISOString().split('T')[0];
}

function findMissingFoodDays(foodLogs: any[], kstHour: number, days = 7): string[] {
    const loggedDates = new Set((foodLogs || []).map((l: any) => l.date));
    const missing: string[] = [];
    for (let i = 0; i < days; i++) {
        const dateStr = getKSTDateString(i);
        // 오늘(i=0)은 오전 10시 이후부터만 미기입으로 체크
        // (아침 일찍엔 아직 식사 전이므로 잔소리 방지)
        if (i === 0 && kstHour < 10) continue;
        if (!loggedDates.has(dateStr)) missing.push(dateStr);
    }
    return missing;
}

function buildContextMessage(healthData: ChatRequestBody['healthData']): string {
    const { date: todayDate, hour: kstHour, timeStr } = getKSTNow();
    const parts: string[] = [`[회원 건강 데이터] (현재 시각: ${timeStr} KST, 오늘: ${todayDate})`];

    if (healthData.records?.length > 0) {
        const sorted = [...healthData.records].sort(
            (a, b) => new Date(a.metrics.date).getTime() - new Date(b.metrics.date).getTime()
        );
        const latest = sorted[sorted.length - 1]?.metrics;
        const prev = sorted.length > 1 ? sorted[sorted.length - 2]?.metrics : null;

        parts.push('\n## 최신 체성분');
        if (latest) {
            parts.push(`측정일: ${latest.date}`);
            if (latest.weight != null) parts.push(`체중: ${latest.weight}kg${prev?.weight ? ` (변화: ${(latest.weight - prev.weight).toFixed(1)}kg)` : ''}`);
            if (latest.skeletalMuscle != null) parts.push(`골격근량: ${latest.skeletalMuscle}kg`);
            if (latest.bodyFatPercent != null) parts.push(`체지방률: ${latest.bodyFatPercent}%`);
            if (latest.bodyFatMass != null) parts.push(`체지방량: ${latest.bodyFatMass}kg`);
            if (latest.bmi != null) parts.push(`BMI: ${latest.bmi}`);
            if (latest.basalMetabolicRate != null) parts.push(`기초대사량: ${latest.basalMetabolicRate}kcal`);
            if (latest.visceralFatLevel != null) parts.push(`내장지방: ${latest.visceralFatLevel}`);
            if (latest.inbodyScore != null) parts.push(`인바디점수: ${latest.inbodyScore}`);
        }
    }

    // 오늘 식단 별도 표시 (가장 최신 데이터 기준)
    const todayLog = healthData.foodLogs?.find((l: any) => l.date === todayDate);
    if (todayLog?.entries?.length > 0) {
        const mealMap: Record<string, string> = { breakfast: '아침', lunch: '점심', dinner: '저녁', snack: '간식' };
        const todayCal = todayLog.entries.reduce((s: number, e: any) => s + (e.calories || 0), 0);
        const todayP = todayLog.entries.reduce((s: number, e: any) => s + (e.protein || 0), 0);
        const mealTypes = [...new Set(todayLog.entries.map((e: any) => mealMap[e.meal] || e.meal))];
        parts.push(`\n## 오늘 식단 (${todayDate}, 입력된 끼니: ${mealTypes.join('·')})`);
        parts.push(`총 ${todayCal}kcal / 단백질 ${todayP.toFixed(0)}g`);
        todayLog.entries.forEach((e: any) => {
            parts.push(`  [${mealMap[e.meal] || e.meal}] ${e.name} ${e.calories}kcal`);
        });
    } else {
        parts.push(`\n## 오늘 식단 (${todayDate}): 미입력`);
    }

    if (healthData.foodLogs?.length > 0) {
        const sorted = [...healthData.foodLogs]
            .filter((l: any) => l.date !== todayDate)
            .sort((a, b) => b.date.localeCompare(a.date));
        if (sorted.length > 0) {
            parts.push('\n## 최근 식단 (이전 3일)');
            sorted.slice(0, 3).forEach(log => {
                const cal = log.entries.reduce((s: number, e: any) => s + (e.calories || 0), 0);
                const p = log.entries.reduce((s: number, e: any) => s + (e.protein || 0), 0);
                parts.push(`${log.date}: ${cal}kcal / 단백질 ${p.toFixed(0)}g`);
                log.entries.forEach((e: any) => {
                    const m: Record<string, string> = { breakfast: '아침', lunch: '점심', dinner: '저녁', snack: '간식' };
                    parts.push(`  [${m[e.meal] || e.meal}] ${e.name} ${e.calories}kcal`);
                });
            });
        }
    }

    const missingDays = findMissingFoodDays(healthData.foodLogs, kstHour);
    if (missingDays.length > 0) {
        parts.push(`\n## ⚠️ 식단 미기입: ${missingDays.join(', ')} (${missingDays.length}일) — 반드시 언급할 것!`);
    }

    if (healthData.workoutLogs?.length > 0) {
        const sorted = [...healthData.workoutLogs].sort((a, b) => b.date.localeCompare(a.date));
        parts.push('\n## 최근 운동 (3일)');
        sorted.slice(0, 3).forEach(log => {
            parts.push(`${log.date}: ${log.entries.map((e: any) => e.name).join(', ')}`);
        });
    }

    return parts.join('\n');
}

export async function POST(request: NextRequest) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return new Response('GEMINI_API_KEY가 설정되지 않았습니다.', { status: 500 });
        }

        const body: ChatRequestBody = await request.json();
        const { message, history, healthData, image } = body;

        if (!message?.trim()) {
            return new Response('메시지를 입력해주세요.', { status: 400 });
        }

        // Notion read and context build in parallel
        const [notionHistory, contextMessage] = await Promise.all([
            readRecentChats(3).catch(() => [] as { question: string; answer: string; date: string }[]),
            Promise.resolve(buildContextMessage(healthData)),
        ]);

        let notionContext = '';
        if (notionHistory.length > 0) {
            notionContext = '\n\n## 과거 대화 기록\n' +
                notionHistory.map(h =>
                    `회원: ${h.question.slice(0, 80)}\n코치: ${h.answer.slice(0, 120)}${h.answer.length > 120 ? '...' : ''}`
                ).join('\n');
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-3.1-pro-preview' });

        const contents: Content[] = [];
        contents.push({
            role: 'user',
            parts: [{ text: `${SYSTEM_PROMPT}\n\n${contextMessage}${notionContext}\n\n위 데이터를 참고해 답변하세요. 첫 인사 생략.` }],
        });
        contents.push({
            role: 'model',
            parts: [{ text: '데이터 확인 완료. 무엇이든 물어보세요! 💪' }],
        });

        const recentHistory = history.slice(-6);
        for (const msg of recentHistory) {
            contents.push({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }],
            });
        }
        const userParts: any[] = [{ text: message }];
        if (image?.base64) {
            userParts.push({
                inlineData: {
                    mimeType: image.mimeType,
                    data: image.base64,
                },
            });
        }
        contents.push({ role: 'user', parts: userParts });

        const result = await model.generateContentStream({ contents });

        let fullResponse = '';
        const encoder = new TextEncoder();

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of result.stream) {
                        const text = chunk.text();
                        if (text) {
                            fullResponse += text;
                            controller.enqueue(encoder.encode(text));
                        }
                    }
                } catch (err) {
                    controller.error(err);
                } finally {
                    // ① Notion 저장을 먼저 await — Vercel이 스트림 닫히는 순간 함수를 종료하므로
                    //    fire-and-forget(.catch(()=>{}))으로 하면 저장 전에 프로세스가 죽음
                    try {
                        await saveChatEntry(message, fullResponse);
                    } catch {
                        // Notion 저장 실패해도 스트림은 정상 종료
                    }
                    controller.close(); // ② 저장 완료 후 스트림 닫기
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
                'X-Accel-Buffering': 'no',
            },
        });
    } catch (error: any) {
        console.error('Chat error:', error);
        return new Response(`AI 응답 오류: ${error?.message || error?.toString()}`, { status: 500 });
    }
}
