import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const RECOMMEND_PROMPT = `당신은 운동생리학과 영양학 전문가입니다. 아래 건강 지표를 분석하여 맞춤형 운동 및 식단 가이드를 생성해 주세요.

건강 지표:
{METRICS}

반드시 아래 JSON 형식으로만 응답해 주세요 (마크다운 코드블록 없이):

{
  "exerciseGuide": {
    "summary": "전체 운동 프로그램 요약 (2-3문장)",
    "weeklyPlan": [
      { "day": "월요일", "focus": "상체 근력", "routines": ["운동1", "운동2"] }
    ],
    "routines": [
      {
        "name": "운동 이름",
        "type": "HIIT | strength | cardio | flexibility | recovery",
        "description": "운동 설명",
        "duration": "시간",
        "sets": 4,
        "reps": "반복수",
        "intensity": "low | moderate | high",
        "icon": "이모지"
      }
    ],
    "tips": ["운동 팁1", "운동 팁2"]
  },
  "dietGuide": {
    "summary": "식단 프로그램 요약 (2-3문장)",
    "dailyCalories": 2200,
    "macroRatio": { "protein": 35, "carbs": 40, "fat": 25 },
    "meals": {
      "breakfast": [{ "name": "메뉴명", "description": "설명", "calories": 350, "protein": 25, "carbs": 40, "fat": 10 }],
      "lunch": [{ "name": "메뉴명", "description": "설명", "calories": 550, "protein": 45, "carbs": 40, "fat": 20 }],
      "dinner": [{ "name": "메뉴명", "description": "설명", "calories": 500, "protein": 42, "carbs": 35, "fat": 18 }],
      "snack": [{ "name": "메뉴명", "description": "설명", "calories": 200, "protein": 20, "carbs": 15, "fat": 8 }]
    },
    "tips": ["식단 팁1", "식단 팁2"],
    "supplements": ["보충제1", "보충제2"]
  }
}

주의사항:
- 주간 운동 스케줄은 월~일 7일 모두 포함해 주세요.
- 운동 루틴은 최소 5개 이상 추천해 주세요.
- 각 식사별 2개 이상의 메뉴를 추천해 주세요.
- 체지방 감소가 필요한 경우 HIIT 위주로, 근육 증가가 필요한 경우 근력 운동 위주로 구성해 주세요.
- 미토콘드리아 활성화를 위한 운동도 포함해 주세요.
- 반드시 순수 JSON만 출력하세요.`;

export async function POST(request: NextRequest) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: 'GEMINI_API_KEY가 설정되지 않았습니다.' },
                { status: 500 }
            );
        }

        const { metrics } = await request.json();
        if (!metrics) {
            return NextResponse.json({ error: '건강 지표 데이터가 필요합니다.' }, { status: 400 });
        }

        const prompt = RECOMMEND_PROMPT.replace('{METRICS}', JSON.stringify(metrics, null, 2));

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        let jsonStr = responseText.trim();
        if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }

        let guides;
        try {
            guides = JSON.parse(jsonStr);
        } catch {
            return NextResponse.json(
                { error: 'AI 응답을 파싱할 수 없습니다.', rawResponse: responseText },
                { status: 500 }
            );
        }

        return NextResponse.json(guides);
    } catch (error) {
        console.error('Recommend error:', error);
        return NextResponse.json(
            { error: '추천 생성 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
