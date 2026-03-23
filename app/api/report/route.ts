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
- 평균 단백질: ${summary.food.avgProtein}g` : '데이터 없음'}

## 운동
${summary.workout ? `- 운동 일수: ${summary.workout.workoutDays}일
- 총 운동 수: ${summary.workout.totalExercises}개` : '데이터 없음'}

위 데이터를 분석하여 아래 JSON 형식으로만 응답하세요 (마크다운 코드블록 없이):

{
  "executiveSummary": "전체 건강 상태 요약 2-3문장",
  "bodyCompositionAnalysis": "체성분 변화 분석 2-3문장",
  "trendAnalysis": "현재 추이 및 향후 전망 2문장",
  "riskAssessment": "주의해야 할 사항 또는 위험 요인 2문장",
  "recommendations": ["실천 권고사항 1", "실천 권고사항 2", "실천 권고사항 3"],
  "nutritionGuidance": "식단 가이드 2문장",
  "exerciseGuidance": "운동 가이드 2문장",
  "goals": ["단기 목표(1개월)", "중기 목표(3개월)", "장기 목표(6개월)"]
}`;

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
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rawText) {
            console.error('No response text:', JSON.stringify(data));
            return NextResponse.json({ error: 'AI 응답에 내용이 없습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
        }

        // Parse JSON response
        let reportData;
        try {
            const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            reportData = JSON.parse(cleaned);
        } catch {
            // Fallback: wrap plain text into structure
            reportData = {
                executiveSummary: rawText.slice(0, 200),
                bodyCompositionAnalysis: '분석 데이터를 확인하세요.',
                trendAnalysis: '데이터 추이를 확인하세요.',
                riskAssessment: '전문의와 상담하세요.',
                recommendations: [rawText.slice(0, 100)],
                nutritionGuidance: '균형 잡힌 식단을 유지하세요.',
                exerciseGuidance: '규칙적인 운동을 권장합니다.',
                goals: ['체중 유지', '근육량 증가', '체지방 감소'],
            };
        }

        return NextResponse.json(reportData);
    } catch (error) {
        console.error('Report AI error:', error);
        return NextResponse.json({ error: `서버 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}` }, { status: 500 });
    }
}
