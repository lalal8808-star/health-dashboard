import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, Content } from '@google/generative-ai';

const SYSTEM_PROMPT = `당신은 "코치"라는 이름의 전문 다이어트·건강 코칭 AI입니다.
회원님의 체성분 데이터(인바디), 식단 기록, 운동 기록, 그리고 과거 대화 기록을 모두 참고하여
맞춤형 조언을 제공합니다.

## 답변 스타일
- 생리학적·영양학적 근거를 바탕으로 설명하되, 전문 용어는 쉽게 풀어서 말한다.
- 이모지를 적극 활용하여 시각적으로 보기 좋게 답변한다 (🥇🥈🥉🚨💪🔥 등).
- 음식 추천 시 순위(1순위, 2순위, 3순위)를 매기고, 각각 생리학적 장점과 섭취 팁을 구체적으로 제시한다.
- 단순한 정보 나열이 아니라, 회원님의 실제 데이터를 인용하며 개인화된 조언을 한다.
  예: "현재 골격근량 33.2kg을 지키려면..." / "오늘 점심에 드신 삼겹살 때문에..."
- 위트있고 센스있는 비유를 섞어서 재미있게 답변한다.
  예: "근육 시멘트가 빈틈없이 채워집니다" / "완벽한 스텔스 단백질입니다"
- 마지막에는 반드시 🚨 "코치의 절대 수칙"을 1~3개 제시하여 핵심 실천사항을 강조한다.
- 답변 제목은 이모지 + 핵심 키워드로 시작한다.

## 중요 규칙
- 회원님의 실제 데이터가 있을 때는 반드시 구체적 수치를 인용한다.
- 근거 없는 의학적 진단은 하지 않는다. 전문의 상담이 필요한 경우 그렇게 안내한다.
- 칼로리, 영양소 수치를 제시할 때는 가능한 정확하게 한다.
- 한국 식문화에 맞는 음식과 식단을 추천한다.`;

interface ChatRequestBody {
    message: string;
    history: { role: 'user' | 'assistant'; content: string }[];
    healthData: {
        records: any[];
        foodLogs: any[];
        workoutLogs: any[];
    };
}

function buildContextMessage(healthData: ChatRequestBody['healthData']): string {
    const parts: string[] = ['[회원 건강 데이터 컨텍스트]'];

    // Health metrics (체성분)
    if (healthData.records && healthData.records.length > 0) {
        const sorted = [...healthData.records].sort(
            (a, b) => new Date(a.metrics.date).getTime() - new Date(b.metrics.date).getTime()
        );
        const latest = sorted[sorted.length - 1]?.metrics;
        const prev = sorted.length > 1 ? sorted[sorted.length - 2]?.metrics : null;

        parts.push('\n## 최신 체성분 (인바디)');
        if (latest) {
            parts.push(`- 측정일: ${latest.date}`);
            if (latest.weight != null) parts.push(`- 체중: ${latest.weight}kg${prev?.weight ? ` (이전: ${prev.weight}kg, 변화: ${(latest.weight - prev.weight).toFixed(1)}kg)` : ''}`);
            if (latest.skeletalMuscle != null) parts.push(`- 골격근량: ${latest.skeletalMuscle}kg${prev?.skeletalMuscle ? ` (이전: ${prev.skeletalMuscle}kg)` : ''}`);
            if (latest.bodyFatPercent != null) parts.push(`- 체지방률: ${latest.bodyFatPercent}%${prev?.bodyFatPercent ? ` (이전: ${prev.bodyFatPercent}%)` : ''}`);
            if (latest.bodyFatMass != null) parts.push(`- 체지방량: ${latest.bodyFatMass}kg`);
            if (latest.bmi != null) parts.push(`- BMI: ${latest.bmi}`);
            if (latest.basalMetabolicRate != null) parts.push(`- 기초대사량: ${latest.basalMetabolicRate}kcal`);
            if (latest.visceralFatLevel != null) parts.push(`- 내장지방 레벨: ${latest.visceralFatLevel}`);
            if (latest.inbodyScore != null) parts.push(`- 인바디 점수: ${latest.inbodyScore}`);
            if (latest.waistHipRatio != null) parts.push(`- 허리엉덩이비율: ${latest.waistHipRatio}`);
            if (latest.height != null) parts.push(`- 키: ${latest.height}cm`);
        }

        if (sorted.length > 1) {
            parts.push(`\n## 체성분 변화 추이 (최근 ${Math.min(sorted.length, 10)}회)`);
            sorted.slice(-10).forEach(r => {
                const m = r.metrics;
                parts.push(`  ${m.date}: 체중 ${m.weight ?? '-'}kg / 골격근 ${m.skeletalMuscle ?? '-'}kg / 체지방률 ${m.bodyFatPercent ?? '-'}% / 인바디 ${m.inbodyScore ?? '-'}점`);
            });
        }
    }

    // Food logs (오늘 + 최근 3일)
    if (healthData.foodLogs && healthData.foodLogs.length > 0) {
        const sorted = [...healthData.foodLogs].sort((a, b) => b.date.localeCompare(a.date));
        const recent = sorted.slice(0, 3);

        parts.push('\n## 최근 식단 기록');
        recent.forEach(log => {
            const totalCal = log.entries.reduce((s: number, e: any) => s + (e.calories || 0), 0);
            const totalP = log.entries.reduce((s: number, e: any) => s + (e.protein || 0), 0);
            const totalC = log.entries.reduce((s: number, e: any) => s + (e.carbs || 0), 0);
            const totalF = log.entries.reduce((s: number, e: any) => s + (e.fat || 0), 0);
            parts.push(`\n### ${log.date} (목표: ${log.targetCalories}kcal, 실제: ${totalCal}kcal)`);
            parts.push(`  총 영양소 - 단백질: ${totalP.toFixed(0)}g / 탄수화물: ${totalC.toFixed(0)}g / 지방: ${totalF.toFixed(0)}g`);
            log.entries.forEach((e: any) => {
                const mealKo: Record<string, string> = { breakfast: '아침', lunch: '점심', dinner: '저녁', snack: '간식' };
                parts.push(`  - [${mealKo[e.meal] || e.meal}] ${e.name} (${e.calories}kcal, P${e.protein}g/C${e.carbs}g/F${e.fat}g)`);
            });
        });
    }

    // Workout logs (최근 3일)
    if (healthData.workoutLogs && healthData.workoutLogs.length > 0) {
        const sorted = [...healthData.workoutLogs].sort((a, b) => b.date.localeCompare(a.date));
        const recent = sorted.slice(0, 3);

        parts.push('\n## 최근 운동 기록');
        recent.forEach(log => {
            parts.push(`\n### ${log.date}`);
            log.entries.forEach((e: any) => {
                let detail = `  - ${e.name} (${e.type}, ${e.duration})`;
                if (e.sets) detail += ` ${e.sets}세트`;
                if (e.reps) detail += ` x ${e.reps}회`;
                if (e.weight) detail += ` @ ${e.weight}kg`;
                if (e.memo) detail += ` - ${e.memo}`;
                parts.push(detail);
            });
        });
    }

    return parts.join('\n');
}

export async function POST(request: NextRequest) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: 'GEMINI_API_KEY가 설정되지 않았습니다.' },
                { status: 500 }
            );
        }

        const body: ChatRequestBody = await request.json();
        const { message, history, healthData } = body;

        if (!message?.trim()) {
            return NextResponse.json({ error: '메시지를 입력해주세요.' }, { status: 400 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-pro-latest' });

        // Build context from health data
        const contextMessage = buildContextMessage(healthData);

        // Build conversation history for Gemini
        const contents: Content[] = [];

        // First message: system prompt + health data context
        contents.push({
            role: 'user',
            parts: [{ text: `${SYSTEM_PROMPT}\n\n${contextMessage}\n\n위 데이터를 참고하여 답변해 주세요. 첫 인사는 생략하고, 바로 본론으로 들어가세요.` }],
        });
        contents.push({
            role: 'model',
            parts: [{ text: '네, 회원님의 모든 데이터를 확인했습니다. 무엇이든 물어보세요! 💪' }],
        });

        // Add past conversation history (last 20 messages to stay within context)
        const recentHistory = history.slice(-20);
        for (const msg of recentHistory) {
            contents.push({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }],
            });
        }

        // Add the current user message
        contents.push({
            role: 'user',
            parts: [{ text: message }],
        });

        const result = await model.generateContent({ contents });
        const responseText = result.response.text();

        return NextResponse.json({ response: responseText });
    } catch (error: any) {
        console.error('Chat error:', error);

        if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('quota')) {
            return NextResponse.json({
                error: 'API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.'
            }, { status: 429 });
        }

        if (error?.status === 404 || error?.message?.includes('not found') || error?.message?.includes('404')) {
            return NextResponse.json({
                error: '모델을 찾을 수 없습니다. (gemini-3.1-pro-preview) — 아직 출시되지 않았거나 API 키에서 접근이 불가할 수 있습니다.'
            }, { status: 404 });
        }

        return NextResponse.json(
            { error: '응답 생성 중 오류가 발생했습니다. (' + (error?.message || '알 수 없는 오류') + ')' },
            { status: 500 }
        );
    }
}
