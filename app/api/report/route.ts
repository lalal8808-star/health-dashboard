import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { summary } = await req.json();

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'GEMINI_API_KEY 환경변수가 설정되지 않았습니다.' }, { status: 500 });
        }

        const prompt = `당신은 전문 헬스 트레이너이자 영양사입니다. 아래는 사용자의 ${summary.period} 건강 데이터입니다.

## 체성분 변화
${summary.body ? `- 체중 변화: ${summary.body.weightDelta}kg
- 골격근량 변화: ${summary.body.muscleDelta}kg
- 체지방량 변화: ${summary.body.fatDelta}kg
- 인바디 점수 변화: ${summary.body.scoreDelta}점` : '데이터 없음'}

## 식단 (일평균)
${summary.food ? `- 평균 칼로리: ${summary.food.avgCalories}kcal
- 평균 단백질: ${summary.food.avgProtein}g
- 평균 탄수화물: ${summary.food.avgCarbs}g
- 평균 지방: ${summary.food.avgFat}g` : '데이터 없음'}

## 운동
${summary.workout ? `- 운동 일수: ${summary.workout.workoutDays}일
- 총 운동 수: ${summary.workout.totalExercises}개` : '데이터 없음'}

위 데이터를 기반으로 다음 형식으로 한국어 피드백을 작성하세요:

## ✅ 잘한 점
(구체적인 칭찬 2-3개)

## ⚠️ 개선할 점
(구체적인 개선 방안 2-3개)

## 💡 다음 주 목표 제안
(실천 가능한 구체적 목표 2개)`;

        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
            }
        );

        if (!res.ok) {
            const errText = await res.text();
            console.error('Gemini API error:', res.status, errText);
            return NextResponse.json({ error: `Gemini API 오류 (${res.status}): ${errText}` }, { status: 500 });
        }

        const data = await res.json();
        const feedback = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!feedback) {
            console.error('No feedback in response:', JSON.stringify(data));
            return NextResponse.json({ error: 'AI 응답에 내용이 없습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
        }

        return NextResponse.json({ feedback });
    } catch (error) {
        console.error('Report AI error:', error);
        return NextResponse.json({ error: `서버 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}` }, { status: 500 });
    }
}
