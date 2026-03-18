import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: NextRequest) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ success: false, error: 'API key not configured' }, { status: 500 });
        }

        const body = await request.json();
        const query: string = body.query?.trim();

        if (!query) {
            return NextResponse.json({ success: false, error: '검색어를 입력해주세요.' }, { status: 400 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `"${query}"의 영양 정보를 알려주세요.

다음 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만 반환하세요.

{
  "name": "음식 이름 (한국어, 용량 포함)",
  "description": "재료 및 특징 간단 설명",
  "calories": 칼로리(kcal, 숫자),
  "protein": 단백질(g, 숫자),
  "carbs": 탄수화물(g, 숫자),
  "fat": 지방(g, 숫자)
}

참고:
- 용량이 명시된 경우("연어 400g", "바나나 1개" 등) 해당 양 기준으로 계산
- 용량 미명시 시 일반적인 1인분 기준
- 모든 숫자는 정수(소수점 없음)
- 한국 음식명 우선 사용`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            return NextResponse.json({ success: false, error: '영양 정보를 찾을 수 없습니다.' }, { status: 500 });
        }

        const parsed = JSON.parse(jsonMatch[0]);
        return NextResponse.json({
            success: true,
            name: parsed.name || query,
            description: parsed.description || '',
            calories: Math.round(Number(parsed.calories) || 0),
            protein: Math.round(Number(parsed.protein) || 0),
            carbs: Math.round(Number(parsed.carbs) || 0),
            fat: Math.round(Number(parsed.fat) || 0),
        });
    } catch (error: unknown) {
        console.error('Food search error:', error);
        const err = error as { status?: number; message?: string };
        if (err?.status === 429 || err?.message?.includes('quota')) {
            return NextResponse.json({ success: false, error: 'API 요청 한도 초과. 잠시 후 다시 시도해주세요.' }, { status: 429 });
        }
        return NextResponse.json({ success: false, error: '검색 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
