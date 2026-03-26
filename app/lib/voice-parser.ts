/**
 * 음성 입력 텍스트를 파싱하여 식사 종류 + 음식 검색어로 분리
 *
 * 예시:
 * - "아침에 닭가슴살 200g 먹었어"  →  { meal: 'breakfast', foodQuery: '닭가슴살 200g' }
 * - "점심 김치찌개 먹음"           →  { meal: 'lunch', foodQuery: '김치찌개' }
 * - "닭가슴살 200g"               →  { meal: null, foodQuery: '닭가슴살 200g' }
 */

type MealKey = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface VoiceParsed {
    meal: MealKey | null;
    foodQuery: string;
    rawText: string;
}

const MEAL_MAP: { patterns: RegExp; key: MealKey }[] = [
    { patterns: /아침|조식|모닝/, key: 'breakfast' },
    { patterns: /점심|중식|런치/, key: 'lunch' },
    { patterns: /저녁|석식|디너/, key: 'dinner' },
    { patterns: /간식|야식|디저트|스낵/, key: 'snack' },
];

// 한국어 숫자→아라비아 숫자 변환
const KR_NUMBERS: [RegExp, string][] = [
    [/천/g, '000'], // 처리 순서 중요
    [/이백/g, '200'], [/삼백/g, '300'], [/사백/g, '400'], [/오백/g, '500'],
    [/육백/g, '600'], [/칠백/g, '700'], [/팔백/g, '800'], [/구백/g, '900'],
    [/백/g, '100'],
    [/이십/g, '20'], [/삼십/g, '30'], [/사십/g, '40'], [/오십/g, '50'],
    [/십/g, '10'],
    [/한\s*개/g, '1개'], [/두\s*개/g, '2개'], [/세\s*개/g, '3개'], [/네\s*개/g, '4개'],
    [/다섯\s*개/g, '5개'],
    [/한\s*인분/g, '1인분'], [/두\s*인분/g, '2인분'], [/세\s*인분/g, '3인분'],
    [/반\s*공기/g, '0.5공기'], [/한\s*공기/g, '1공기'],
    [/한\s*그릇/g, '1그릇'], [/두\s*그릇/g, '2그릇'],
    [/한\s*잔/g, '1잔'], [/두\s*잔/g, '2잔'],
    [/한\s*조각/g, '1조각'], [/두\s*조각/g, '2조각'], [/세\s*조각/g, '3조각'],
];

// 단위 정규화
const UNIT_NORMALIZE: [RegExp, string][] = [
    [/그램|그람/g, 'g'],
    [/킬로그램|킬로/g, 'kg'],
    [/밀리리터|밀리/g, 'ml'],
    [/리터/g, 'L'],
];

// 제거할 불용어
const NOISE_WORDS = /에서?|으?로|먹었어요?|먹었다|먹었습니다|먹었음|먹음|먹어|섭취했어|섭취|했어|했다|오늘|방금|좀|조금|약간|한|정도|식단/g;

function normalizeNumbers(text: string): string {
    let result = text;
    for (const [pattern, replacement] of KR_NUMBERS) {
        result = result.replace(pattern, replacement);
    }
    for (const [pattern, replacement] of UNIT_NORMALIZE) {
        result = result.replace(pattern, replacement);
    }
    return result;
}

export function parseVoiceInput(text: string): VoiceParsed {
    const raw = text.trim();
    let processed = normalizeNumbers(raw);

    // 1. 식사 종류 추출
    let meal: MealKey | null = null;
    for (const { patterns, key } of MEAL_MAP) {
        if (patterns.test(processed)) {
            meal = key;
            processed = processed.replace(patterns, '');
            break;
        }
    }

    // 2. 불용어 제거
    processed = processed.replace(NOISE_WORDS, '');

    // 3. 공백 정리
    processed = processed.replace(/\s+/g, ' ').trim();

    return { meal, foodQuery: processed, rawText: raw };
}
