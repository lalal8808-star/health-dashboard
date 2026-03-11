import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const EXTRACTION_PROMPT = `당신은 건강 검진 결과지와 체성분 분석(인바디 등) 결과지에서 건강 지표를 추출하는 전문 OCR AI입니다.

이미지에서 다음 지표들을 최대한 추출해 주세요. 찾을 수 없는 항목은 null로 설정하세요.

반드시 아래 JSON 형식으로만 응답해 주세요 (마크다운 코드블록 없이):

{
  "weight": number | null,
  "skeletalMuscle": number | null,
  "bodyFatPercent": number | null,
  "bodyFatMass": number | null,
  "bmi": number | null,
  "basalMetabolicRate": number | null,
  "visceralFatLevel": number | null,
  "totalBodyWater": number | null,
  "protein": number | null,
  "minerals": number | null,
  "height": number | null,
  "waistHipRatio": number | null,
  "date": "YYYY-MM-DD" | null,
  "notes": "결과지에서 특이사항이나 추가 정보"
}

- weight: 체중 (kg)
- skeletalMuscle: 골격근량 (kg)
- bodyFatPercent: 체지방률 (%)
- bodyFatMass: 체지방량 (kg)
- bmi: BMI 지수
- basalMetabolicRate: 기초대사량 (kcal)
- visceralFatLevel: 내장지방 레벨
- totalBodyWater: 체수분 (L)
- protein: 단백질 (kg)
- minerals: 무기질 (kg)
- height: 키 (cm)
- waistHipRatio: 허리엉덩이비율
- date: 측정 날짜
- notes: 특이사항

반드시 순수 JSON만 출력하세요.`;

export async function POST(request: NextRequest) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: 'GEMINI_API_KEY가 설정되지 않았습니다. .env.local 파일에 API 키를 설정해 주세요.' },
                { status: 500 }
            );
        }

        const formData = await request.formData();
        const file = formData.get('image') as File;
        if (!file) {
            return NextResponse.json({ error: '이미지 파일이 필요합니다.' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const base64 = Buffer.from(bytes).toString('base64');
        const mimeType = file.type || 'image/jpeg';

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const result = await model.generateContent([
            { text: EXTRACTION_PROMPT },
            {
                inlineData: {
                    mimeType,
                    data: base64,
                },
            },
        ]);

        const responseText = result.response.text();

        // Clean up potential markdown code blocks
        let jsonStr = responseText.trim();
        if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }

        let metrics;
        try {
            metrics = JSON.parse(jsonStr);
        } catch {
            return NextResponse.json(
                { error: 'AI 응답을 파싱할 수 없습니다.', rawResponse: responseText },
                { status: 500 }
            );
        }

        return NextResponse.json({ metrics, rawOcrText: responseText });
    } catch (error: any) {
        console.error('Analysis error:', error);

        // Handle Gemini API specific errors (like Quota Exceeded 429)
        if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('quota')) {
            return NextResponse.json({
                error: 'AI 분석 API 요청 한도를 초과했습니다. 잠시 후 1분 뒤에 다시 시도해주세요. (무료 사용자 제한)'
            }, { status: 429 });
        }

        return NextResponse.json(
            { error: '분석 중 오류가 발생했습니다. (' + (error?.message || '알 수 없는 오류') + ')' },
            { status: 500 }
        );
    }
}
