import { AnalysisRecord, ExerciseGuide, DietGuide } from './types';

export const sampleExerciseGuide: ExerciseGuide = {
    summary: '현재 체성분 분석 결과를 바탕으로, 체지방 감소와 근육량 증가를 동시에 달성하기 위한 맞춤형 운동 프로그램입니다. 주 4-5회 운동을 권장하며, HIIT와 근력 운동을 병행합니다.',
    weeklyPlan: [
        { day: '월요일', focus: '상체 근력', routines: ['벤치프레스', '덤벨 숄더프레스', '바이셉 컬'] },
        { day: '화요일', focus: 'HIIT 카디오', routines: ['버피', '마운틴 클라이머', '점프 스쿼트'] },
        { day: '수요일', focus: '하체 근력', routines: ['스쿼트', '런지', '레그프레스'] },
        { day: '목요일', focus: '휴식 / 스트레칭', routines: ['요가', '폼롤링'] },
        { day: '금요일', focus: '전신 HIIT', routines: ['케틀벨 스윙', '박스점프', '배틀로프'] },
        { day: '토요일', focus: '유산소', routines: ['조깅 40분', '사이클링'] },
        { day: '일요일', focus: '완전 휴식', routines: ['가벼운 산책'] },
    ],
    routines: [
        { name: '버피 테스트', type: 'HIIT', description: '전신 고강도 인터벌 운동으로 심폐 기능과 근력을 동시에 향상시킵니다.', duration: '20분', sets: 4, reps: '30초 운동 / 15초 휴식', intensity: 'high', icon: '🔥' },
        { name: '바벨 스쿼트', type: 'strength', description: '하체 전체 근육과 코어를 강화하는 복합 운동입니다.', duration: '30분', sets: 4, reps: '8-12회', intensity: 'high', icon: '🏋️' },
        { name: '인터벌 러닝', type: 'cardio', description: '미토콘드리아 활성화에 효과적인 인터벌 러닝입니다.', duration: '30분', sets: 6, reps: '2분 전력 질주 / 1분 걷기', intensity: 'high', icon: '🏃' },
        { name: '요가 플로우', type: 'flexibility', description: '근육 회복과 유연성 향상을 위한 요가 시퀀스입니다.', duration: '40분', intensity: 'low', icon: '🧘' },
        { name: '게틀벨 스윙', type: 'strength', description: '후면 사슬 근육을 강화하고 폭발적 파워를 기릅니다.', duration: '15분', sets: 5, reps: '15회', intensity: 'moderate', icon: '💪' },
        { name: '폼롤러 릴리즈', type: 'recovery', description: '근막 이완을 통해 근육 회복을 촉진합니다.', duration: '20분', intensity: 'low', icon: '🔄' },
    ],
    tips: [
        '운동 전 5-10분 동적 스트레칭을 반드시 수행하세요.',
        '운동 후 30분 이내에 단백질 보충을 권장합니다.',
        'HIIT 운동은 주 2-3회를 초과하지 않도록 합니다.',
        '수면은 최소 7시간 이상 확보하세요.',
        '운동 중 수분 섭취를 충분히 하세요 (체중 1kg당 30-40ml).',
    ],
};

export const sampleDietGuide: DietGuide = {
    summary: '체지방 감소와 근육 유지를 위한 고단백 식단입니다. 기초대사량과 활동량을 고려하여 적절한 칼로리 적자를 유지하면서도 근육 손실을 최소화합니다.',
    dailyCalories: 2200,
    macroRatio: { protein: 35, carbs: 40, fat: 25 },
    meals: {
        breakfast: [
            { name: '그릭 요거트 볼', description: '그릭 요거트 200g + 블루베리 + 귀리 + 아몬드', calories: 350, protein: 25, carbs: 40, fat: 10 },
            { name: '계란 스크램블', description: '계란 3개 + 시금치 + 토마토 + 통밀 토스트', calories: 400, protein: 28, carbs: 30, fat: 18 },
        ],
        lunch: [
            { name: '닭가슴살 샐러드', description: '닭가슴살 200g + 퀴노아 + 아보카도 + 혼합 채소', calories: 550, protein: 45, carbs: 40, fat: 20 },
            { name: '연어 포케 볼', description: '연어 150g + 현미밥 + 에다마메 + 아보카도', calories: 600, protein: 38, carbs: 55, fat: 22 },
        ],
        dinner: [
            { name: '소고기 스테이크', description: '안심 200g + 고구마 + 브로콜리 + 아스파라거스', calories: 500, protein: 42, carbs: 35, fat: 18 },
            { name: '두부 스테이크', description: '두부 300g + 현미밥 + 된장국 + 나물 3종', calories: 450, protein: 30, carbs: 50, fat: 12 },
        ],
        snack: [
            { name: '프로틴 쉐이크', description: '유청 프로틴 30g + 바나나 + 우유 200ml', calories: 250, protein: 30, carbs: 25, fat: 5 },
            { name: '견과류 믹스', description: '아몬드 + 호두 + 캐슈넛 30g', calories: 180, protein: 6, carbs: 8, fat: 15 },
        ],
    },
    tips: [
        '하루 물 섭취량은 최소 2L 이상 유지하세요.',
        '식사 사이 간격은 3-4시간이 적당합니다.',
        '가공식품과 정제 탄수화물을 피하세요.',
        '저녁 식사는 취침 3시간 전에 마치세요.',
        '채소를 매 끼니 2주먹 이상 섭취하세요.',
    ],
    supplements: ['비타민 D3 (2000IU)', '오메가-3 (1000mg)', '마그네슘 (400mg)', '유청 프로틴', '크레아틴 (5g)'],
};

export const sampleRecords: AnalysisRecord[] = [
    {
        id: 'sample-1', createdAt: '2026-02-23T10:00:00Z', imageFileName: 'sample.csv', exerciseGuide: null, dietGuide: null,
        metrics: { id: 'm-1', date: '2026-02-23', weight: 76.8, skeletalMuscle: 33.5, bodyFatMass: 17.6, bodyFatPercent: 23.0, bmi: 26.6, basalMetabolicRate: 1648, inbodyScore: 78, waistHipRatio: 0.87, visceralFatLevel: null, totalBodyWater: null, protein: null, minerals: null, height: null, metabolicAge: null, notes: '' }
    },
    {
        id: 'sample-2', createdAt: '2026-02-24T10:00:00Z', imageFileName: 'sample.csv', exerciseGuide: null, dietGuide: null,
        metrics: { id: 'm-2', date: '2026-02-24', weight: 76.5, skeletalMuscle: 33.0, bodyFatMass: 18.3, bodyFatPercent: 24.0, bmi: 26.5, basalMetabolicRate: 1626, inbodyScore: 76, waistHipRatio: 0.87, visceralFatLevel: null, totalBodyWater: null, protein: null, minerals: null, height: null, metabolicAge: null, notes: '' }
    },
    {
        id: 'sample-3', createdAt: '2026-02-25T10:00:00Z', imageFileName: 'sample.csv', exerciseGuide: null, dietGuide: null,
        metrics: { id: 'm-3', date: '2026-02-25', weight: 76.7, skeletalMuscle: 33.4, bodyFatMass: 18.0, bodyFatPercent: 23.5, bmi: 26.5, basalMetabolicRate: 1637, inbodyScore: 77, waistHipRatio: 0.87, visceralFatLevel: null, totalBodyWater: null, protein: null, minerals: null, height: null, metabolicAge: null, notes: '' }
    },
    {
        id: 'sample-4', createdAt: '2026-02-26T10:00:00Z', imageFileName: 'sample.csv', exerciseGuide: null, dietGuide: null,
        metrics: { id: 'm-4', date: '2026-02-26', weight: 76.5, skeletalMuscle: 33.2, bodyFatMass: 18.1, bodyFatPercent: 23.6, bmi: 26.8, basalMetabolicRate: 1632, inbodyScore: 77, waistHipRatio: 0.88, visceralFatLevel: null, totalBodyWater: null, protein: null, minerals: null, height: null, metabolicAge: null, notes: '' }
    },
    {
        id: 'sample-5', createdAt: '2026-02-27T10:00:00Z', imageFileName: 'sample.csv', exerciseGuide: null, dietGuide: null,
        metrics: { id: 'm-5', date: '2026-02-27', weight: 76.4, skeletalMuscle: 33.2, bodyFatMass: 18.0, bodyFatPercent: 23.5, bmi: 26.7, basalMetabolicRate: 1632, inbodyScore: 77, waistHipRatio: 0.87, visceralFatLevel: null, totalBodyWater: null, protein: null, minerals: null, height: null, metabolicAge: null, notes: '' }
    },
    {
        id: 'sample-6', createdAt: '2026-02-28T10:00:00Z', imageFileName: 'sample.csv', exerciseGuide: null, dietGuide: null,
        metrics: { id: 'm-6', date: '2026-02-28', weight: 75.9, skeletalMuscle: 32.8, bodyFatMass: 18.1, bodyFatPercent: 23.9, bmi: 26.6, basalMetabolicRate: 1618, inbodyScore: 76, waistHipRatio: 0.86, visceralFatLevel: null, totalBodyWater: null, protein: null, minerals: null, height: null, metabolicAge: null, notes: '' }
    },
    {
        id: 'sample-7', createdAt: '2026-03-01T10:00:00Z', imageFileName: 'sample.csv', exerciseGuide: null, dietGuide: null,
        metrics: { id: 'm-7', date: '2026-03-01', weight: 75.6, skeletalMuscle: 32.7, bodyFatMass: 18.0, bodyFatPercent: 23.8, bmi: 26.5, basalMetabolicRate: 1614, inbodyScore: 76, waistHipRatio: 0.86, visceralFatLevel: null, totalBodyWater: null, protein: null, minerals: null, height: null, metabolicAge: null, notes: '' }
    },
    {
        id: 'sample-8', createdAt: '2026-03-03T10:00:00Z', imageFileName: 'sample.csv', exerciseGuide: null, dietGuide: null,
        metrics: { id: 'm-8', date: '2026-03-03', weight: 76.1, skeletalMuscle: 32.8, bodyFatMass: 18.2, bodyFatPercent: 23.9, bmi: 26.6, basalMetabolicRate: 1621, inbodyScore: 77, waistHipRatio: 0.87, visceralFatLevel: null, totalBodyWater: null, protein: null, minerals: null, height: null, metabolicAge: null, notes: '' }
    },
    {
        id: 'sample-9', createdAt: '2026-03-04T10:00:00Z', imageFileName: 'sample.csv', exerciseGuide: null, dietGuide: null,
        metrics: { id: 'm-9', date: '2026-03-04', weight: 75.6, skeletalMuscle: 32.6, bodyFatMass: 18.2, bodyFatPercent: 24.1, bmi: 26.5, basalMetabolicRate: 1610, inbodyScore: 76, waistHipRatio: 0.87, visceralFatLevel: null, totalBodyWater: null, protein: null, minerals: null, height: null, metabolicAge: null, notes: '' }
    },
    {
        id: 'sample-10', createdAt: '2026-03-05T10:00:00Z', imageFileName: 'sample.csv', exerciseGuide: null, dietGuide: null,
        metrics: { id: 'm-10', date: '2026-03-05', weight: 75.0, skeletalMuscle: 31.9, bodyFatMass: 18.6, bodyFatPercent: 24.8, bmi: 26.3, basalMetabolicRate: 1588, inbodyScore: 74, waistHipRatio: 0.88, visceralFatLevel: null, totalBodyWater: null, protein: null, minerals: null, height: null, metabolicAge: null, notes: '' }
    },
    {
        id: 'sample-11', createdAt: '2026-03-06T10:00:00Z', imageFileName: 'sample.csv', exerciseGuide: sampleExerciseGuide, dietGuide: sampleDietGuide,
        metrics: { id: 'm-11', date: '2026-03-06', weight: 74.9, skeletalMuscle: 33.2, bodyFatMass: 16.4, bodyFatPercent: 21.8, bmi: 26.2, basalMetabolicRate: 1635, inbodyScore: 79, waistHipRatio: 0.86, visceralFatLevel: null, totalBodyWater: null, protein: null, minerals: null, height: null, metabolicAge: null, notes: '' }
    },
];
