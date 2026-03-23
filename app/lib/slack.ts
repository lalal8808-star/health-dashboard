/**
 * Slack 알림 헬퍼 (서버 사이드)
 * Incoming Webhook을 사용하여 다양한 건강 알림 메시지를 전송합니다.
 */

export async function sendSlackMessage(webhookUrl: string, message: object): Promise<boolean> {
    try {
        const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(message),
        });
        return res.ok;
    } catch {
        return false;
    }
}

/** 일일 건강 리포트 메시지 */
export function buildDailyReport(date: string, data: {
    totalCalories: number;
    targetCalories: number;
    protein: number;
    carbs: number;
    fat: number;
    mealCount: number;
    workoutName?: string;
    workoutDuration?: number;
}) {
    const { totalCalories, targetCalories, protein, carbs, fat, mealCount, workoutName, workoutDuration } = data;
    const calorieRate = targetCalories > 0 ? Math.round((totalCalories / targetCalories) * 100) : 0;
    const calorieStatus = calorieRate >= 90 && calorieRate <= 110 ? '✅' : calorieRate > 110 ? '⚠️' : '📉';

    return {
        text: `📊 ${date} 일일 건강 리포트`,
        blocks: [
            {
                type: 'header',
                text: { type: 'plain_text', text: `📊 ${date} 일일 건강 리포트` },
            },
            { type: 'divider' },
            {
                type: 'section',
                fields: [
                    { type: 'mrkdwn', text: `*🍽️ 식단 기록*\n${mealCount}끼 입력` },
                    { type: 'mrkdwn', text: `*🔥 칼로리*\n${calorieStatus} ${totalCalories} / ${targetCalories} kcal (${calorieRate}%)` },
                    { type: 'mrkdwn', text: `*🥩 단백질*\n${protein}g` },
                    { type: 'mrkdwn', text: `*🍚 탄수화물*\n${carbs}g` },
                    { type: 'mrkdwn', text: `*🥑 지방*\n${fat}g` },
                    workoutName
                        ? { type: 'mrkdwn', text: `*💪 운동*\n${workoutName} ${workoutDuration ? `(${workoutDuration}분)` : ''}` }
                        : { type: 'mrkdwn', text: `*💪 운동*\n미기록` },
                ],
            },
            {
                type: 'context',
                elements: [{ type: 'mrkdwn', text: `_HealthLens AI • ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}_` }],
            },
        ],
    };
}

/** 주간 리포트 메시지 */
export function buildWeeklyReport(weekLabel: string, data: {
    avgCalories: number;
    targetCalories: number;
    totalWorkouts: number;
    totalMealsLogged: number;
    avgProtein: number;
    weightChange?: number;
}) {
    const { avgCalories, targetCalories, totalWorkouts, totalMealsLogged, avgProtein, weightChange } = data;

    return {
        text: `📈 ${weekLabel} 주간 건강 리포트`,
        blocks: [
            {
                type: 'header',
                text: { type: 'plain_text', text: `📈 ${weekLabel} 주간 건강 리포트` },
            },
            { type: 'divider' },
            {
                type: 'section',
                fields: [
                    { type: 'mrkdwn', text: `*🔥 평균 칼로리*\n${avgCalories} / ${targetCalories} kcal` },
                    { type: 'mrkdwn', text: `*💪 운동 횟수*\n${totalWorkouts}회` },
                    { type: 'mrkdwn', text: `*🍽️ 식단 기록*\n${totalMealsLogged}끼` },
                    { type: 'mrkdwn', text: `*🥩 평균 단백질*\n${avgProtein}g` },
                    weightChange !== undefined
                        ? { type: 'mrkdwn', text: `*⚖️ 체중 변화*\n${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)}kg` }
                        : { type: 'mrkdwn', text: `*⚖️ 체중 변화*\n데이터 없음` },
                ],
            },
            {
                type: 'context',
                elements: [{ type: 'mrkdwn', text: `_HealthLens AI • 주간 자동 리포트_` }],
            },
        ],
    };
}

/** 목표 달성 알림 */
export function buildGoalAlert(type: 'calorie' | 'workout-streak', data: {
    value: number;
    target: number;
    streakDays?: number;
}) {
    if (type === 'calorie') {
        return {
            text: `🎯 칼로리 목표 달성!`,
            blocks: [
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `🎯 *칼로리 목표 달성!*\n오늘 ${data.value}kcal 섭취로 목표 ${data.target}kcal를 달성했어요! 💪`,
                    },
                },
            ],
        };
    }
    return {
        text: `🔥 ${data.streakDays}일 연속 운동 달성!`,
        blocks: [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `🔥 *${data.streakDays}일 연속 운동 달성!*\n대단해요! 꾸준한 운동 습관이 만들어지고 있어요! 💪`,
                },
            },
        ],
    };
}

/** 인바디 결과 알림 */
export function buildInbodyAlert(record: {
    date: string;
    weight?: number;
    skeletalMuscle?: number;
    bodyFatPercent?: number;
    bodyFatMass?: number;
    bmi?: number;
}) {
    return {
        text: `💪 새 인바디 결과가 등록됐습니다!`,
        blocks: [
            {
                type: 'header',
                text: { type: 'plain_text', text: `💪 인바디 결과 - ${record.date}` },
            },
            { type: 'divider' },
            {
                type: 'section',
                fields: [
                    record.weight != null ? { type: 'mrkdwn', text: `*⚖️ 체중*\n${record.weight}kg` } : null,
                    record.skeletalMuscle != null ? { type: 'mrkdwn', text: `*💪 골격근량*\n${record.skeletalMuscle}kg` } : null,
                    record.bodyFatPercent != null ? { type: 'mrkdwn', text: `*🔥 체지방률*\n${record.bodyFatPercent}%` } : null,
                    record.bodyFatMass != null ? { type: 'mrkdwn', text: `*🏋️ 체지방량*\n${record.bodyFatMass}kg` } : null,
                    record.bmi != null ? { type: 'mrkdwn', text: `*📊 BMI*\n${record.bmi}` } : null,
                ].filter(Boolean),
            },
            {
                type: 'context',
                elements: [{ type: 'mrkdwn', text: `_HealthLens AI • 인바디 자동 알림_` }],
            },
        ],
    };
}

/** 식단 미기록 리마인더 */
export function buildMealReminder(mealType: string, date: string) {
    return {
        text: `🍽️ ${mealType} 식단 기록을 잊지 마세요!`,
        blocks: [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `🍽️ *${date} ${mealType} 식단 기록을 잊지 마세요!*\n오늘 하루를 완성하려면 식단 기록이 필요해요. HealthLens AI에서 지금 바로 기록해보세요 📝`,
                },
            },
        ],
    };
}

/** 챗봇 대화 공유 */
export function buildChatShare(question: string, answer: string) {
    const truncAnswer = answer.length > 800 ? answer.slice(0, 800) + '...' : answer;
    return {
        text: `🤖 코치 조언 공유`,
        blocks: [
            {
                type: 'header',
                text: { type: 'plain_text', text: '🤖 코치 조언' },
            },
            {
                type: 'section',
                text: { type: 'mrkdwn', text: `*Q: ${question}*` },
            },
            {
                type: 'section',
                text: { type: 'mrkdwn', text: truncAnswer },
            },
            {
                type: 'context',
                elements: [{ type: 'mrkdwn', text: `_HealthLens AI 코치 • ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}_` }],
            },
        ],
    };
}
