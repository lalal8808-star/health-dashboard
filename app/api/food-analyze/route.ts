import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: NextRequest) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ success: false, error: 'API key not configured' }, { status: 500 });
        }

        const formData = await request.formData();
        const imageFile = formData.get('image') as File;

        if (!imageFile) {
            return NextResponse.json({ success: false, error: 'No image provided' }, { status: 400 });
        }

        const buffer = Buffer.from(await imageFile.arrayBuffer());
        const base64 = buffer.toString('base64');
        const mimeType = imageFile.type || 'image/jpeg';

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `이 음식 사진을 분석하세요. 다음 JSON 형식으로만 응답해 주세요. 다른 텍스트 없이 JSON만 반환하세요.

{
  "name": "음식 이름 (한국어)",
  "description": "재료 및 조리법 간단 설명",
  "calories": 예상 칼로리(숫자),
  "protein": 단백질 그램(숫자),
  "carbs": 탄수화물 그램(숫자),
  "fat": 지방 그램(숫자)
}

참고사항:
- 가능한 정확한 1인분 기준으로 추정
- 숫자는 정수로 반환
- 한국 음식이면 한국어 음식명 사용`;

        const result = await model.generateContent([
            { inlineData: { data: base64, mimeType } },
            { text: prompt },
        ]);

        const responseText = result.response.text();
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return NextResponse.json({
                success: true,
                name: parsed.name,
                description: parsed.description,
                calories: parsed.calories || 0,
                protein: parsed.protein || 0,
                carbs: parsed.carbs || 0,
                fat: parsed.fat || 0,
            });
        }

        return NextResponse.json({ success: false, error: '응답을 파싱할 수 없습니다.' }, { status: 500 });
    } catch (error: any) {
        console.error('Food analysis error:', error);

        // Handle Gemini API specific errors (like Quota Exceeded 429)
        if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('quota')) {
            return NextResponse.json({
                success: false,
                error: 'AI 분석 API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.'
            }, { status: 429 });
        }

        return NextResponse.json({ success: false, error: '분석 중 오류가 발생했습니다. (' + (error?.message || '알 수 없는 오류') + ')' }, { status: 500 });
    }
}
