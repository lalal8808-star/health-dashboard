import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 60;

const REPORT_PROMPT = `당신은 의료 수준의 체성분 건강 보고서를 작성하는 전문 AI입니다.
제공된 인바디 데이터와 식단/운동 기록을 분석하여 전문 보고서를 작성하세요.

규칙:
- 모든 내용은 한국어로 작성
- 구체적인 수치를 반드시 인용
- 의학적 근거에 기반한 전문적 문체 사용
- 각 섹션은 3~6문장으로 작성
- JSON 외 다른 텍스트는 절대 포함하지 말 것

반드시 아래 JSON 형식만 반환:
{
  "executiveSummary": "전반적 건강 상태 종합 평가 (3~4문장)",
  "bodyCompositionAnalysis": "체성분 상세 분석 - 각 지표의 의미와 현재 상태 (5~6문장)",
  "trendAnalysis": "측정 기간 동안의 변화 추이 분석 (4~5문장)",
  "riskAssessment": "현재 데이터 기반 위험 요인 및 주의사항 (3~4문장)",
  "recommendations": ["실천 권고사항 1", "실천 권고사항 2", "실천 권고사항 3", "실천 권고사항 4", "실천 권고사항 5"],
  "nutritionGuidance": "개인 맞춤 영양 섭취 지침 (4~5문장)",
  "exerciseGuidance": "체성분 개선을 위한 운동 처방 (4~5문장)",
  "goals": ["단기 목표 (1개월)", "중기 목표 (3개월)", "장기 목표 (6개월)"]
}`;

export async function POST(request: NextRequest) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' }, { status: 500 });
        }

        const { healthData } = await request.json();

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-pro-latest' });

        const contextParts: string[] = ['[체성분 데이터]'];

        if (healthData.records?.length > 0) {
            const sorted = [...healthData.records].sort(
                (a: any, b: any) => new Date(a.metrics.date).getTime() - new Date(b.metrics.date).getTime()
            );
            const latest = sorted[sorted.length - 1].metrics;
            const first = sorted[0].metrics;

            contextParts.push(`\n최신 측정 (${latest.date}):`);
            if (latest.weight != null) contextParts.push(`- 체중: ${latest.weight}kg`);
            if (latest.skeletalMuscle != null) contextParts.push(`- 골격근량: ${latest.skeletalMuscle}kg`);
            if (latest.bodyFatPercent != null) contextParts.push(`- 체지방률: ${latest.bodyFatPercent}%`);
            if (latest.bodyFatMass != null) contextParts.push(`- 체지방량: ${latest.bodyFatMass}kg`);
            if (latest.bmi != null) contextParts.push(`- BMI: ${latest.bmi}`);
            if (latest.basalMetabolicRate != null) contextParts.push(`- 기초대사량: ${latest.basalMetabolicRate}kcal`);
            if (latest.visceralFatLevel != null) contextParts.push(`- 내장지방 레벨: ${latest.visceralFatLevel}`);
            if (latest.inbodyScore != null) contextParts.push(`- 인바디 점수: ${latest.inbodyScore}점`);
            if (latest.waistHipRatio != null) contextParts.push(`- 허리엉덩이비율: ${latest.waistHipRatio}`);
            if (latest.height != null) contextParts.push(`- 키: ${latest.height}cm`);

            contextParts.push(`\n첫 측정 대비 변화 (${first.date} → ${latest.date}):`);
            if (first.weight != null && latest.weight != null)
                contextParts.push(`- 체중: ${first.weight}kg → ${latest.weight}kg (${(latest.weight - first.weight).toFixed(1)}kg)`);
            if (first.skeletalMuscle != null && latest.skeletalMuscle != null)
                contextParts.push(`- 골격근량: ${first.skeletalMuscle}kg → ${latest.skeletalMuscle}kg (${(latest.skeletalMuscle - first.skeletalMuscle).toFixed(1)}kg)`);
            if (first.bodyFatPercent != null && latest.bodyFatPercent != null)
                contextParts.push(`- 체지방률: ${first.bodyFatPercent}% → ${latest.bodyFatPercent}% (${(latest.bodyFatPercent - first.bodyFatPercent).toFixed(1)}%)`);
            if (first.inbodyScore != null && latest.inbodyScore != null)
                contextParts.push(`- 인바디 점수: ${first.inbodyScore}점 → ${latest.inbodyScore}점`);

            contextParts.push(`\n전체 측정 횟수: ${sorted.length}회`);
            contextParts.push(`측정 기간: ${first.date} ~ ${latest.date}`);
        }

        if (healthData.foodLogs?.length > 0) {
            const recentFood = [...healthData.foodLogs]
                .sort((a: any, b: any) => b.date.localeCompare(a.date))
                .slice(0, 3);
            contextParts.push('\n[최근 식단 기록]');
            recentFood.forEach((log: any) => {
                const totalCal = log.entries.reduce((s: number, e: any) => s + (e.calories || 0), 0);
                const totalP = log.entries.reduce((s: number, e: any) => s + (e.protein || 0), 0);
                contextParts.push(`${log.date}: ${totalCal}kcal / 단백질 ${totalP.toFixed(0)}g`);
            });
        }

        if (healthData.workoutLogs?.length > 0) {
            const recentWorkout = [...healthData.workoutLogs]
                .sort((a: any, b: any) => b.date.localeCompare(a.date))
                .slice(0, 3);
            contextParts.push('\n[최근 운동 기록]');
            recentWorkout.forEach((log: any) => {
                contextParts.push(`${log.date}: ${log.entries.map((e: any) => e.name).join(', ')}`);
            });
        }

        const prompt = `${REPORT_PROMPT}\n\n${contextParts.join('\n')}`;
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim()
            .replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

        const reportData = JSON.parse(text);
        return NextResponse.json(reportData);
    } catch (error: any) {
        console.error('Report generation error:', error);
        return NextResponse.json(
            { error: `보고서 생성 오류: ${error?.message || error?.toString()}` },
            { status: 500 }
        );
    }
}
