import { HealthMetrics, AnalysisRecord } from './types';

// ─── 기본 파생 지표 ───────────────────────────────────────────────────────────

/** LBM: 제지방량 (kg) = 체중 - 체지방량 */
export function calcLBM(m: HealthMetrics): number | null {
    if (m.weight == null || m.bodyFatMass == null) return null;
    return +(m.weight - m.bodyFatMass).toFixed(1);
}

/** FFMI: 제지방 체질량지수 = LBM / (키m)² */
export function calcFFMI(m: HealthMetrics): number | null {
    const lbm = calcLBM(m);
    if (lbm == null || !m.height) return null;
    const hm = m.height / 100;
    return +(lbm / (hm * hm)).toFixed(1);
}

/** SMI: 골격근지수 = 골격근량 / (키m)² */
export function calcSMI(m: HealthMetrics): number | null {
    if (m.skeletalMuscle == null || !m.height) return null;
    const hm = m.height / 100;
    return +(m.skeletalMuscle / (hm * hm)).toFixed(1);
}

/** SMM/BFM Ratio: 골격근 대 체지방 비율 */
export function calcSMMBFMRatio(m: HealthMetrics): number | null {
    if (m.skeletalMuscle == null || !m.bodyFatMass || m.bodyFatMass <= 0) return null;
    return +(m.skeletalMuscle / m.bodyFatMass).toFixed(2);
}

/** TBW%: 체수분율 = 체수분 / 체중 × 100 */
export function calcTBWPercent(m: HealthMetrics): number | null {
    if (m.totalBodyWater == null || !m.weight) return null;
    return +((m.totalBodyWater / m.weight) * 100).toFixed(1);
}

/** Protein-to-Weight Ratio: 단백질 충분도 = 단백질(kg) / 체중 × 100 */
export function calcProteinRatio(m: HealthMetrics): number | null {
    if (m.protein == null || !m.weight) return null;
    return +((m.protein / m.weight) * 100).toFixed(1);
}

/** BMR Efficiency: BMR per kg LBM = 기초대사량 / 제지방량 */
export function calcBMREfficiency(m: HealthMetrics): number | null {
    const lbm = calcLBM(m);
    if (lbm == null || lbm <= 0 || m.basalMetabolicRate == null) return null;
    return +(m.basalMetabolicRate / lbm).toFixed(1);
}

/** 일일 권장 단백질 범위 (g): 체중 × 1.6 ~ 2.2 */
export function calcProteinRecommendation(m: HealthMetrics): { min: number; max: number } | null {
    if (!m.weight) return null;
    return {
        min: Math.round(m.weight * 1.6),
        max: Math.round(m.weight * 2.2),
    };
}

// ─── 내장지방 위험등급 ────────────────────────────────────────────────────────

export function calcVisceralFatScore(level: number | null): {
    score: number;
    status: string;
    color: string;
} {
    if (level == null) return { score: 0, status: '-', color: '#6b7280' };
    // 1~9: 정상, 10~14: 경계, 15+: 위험
    let score: number;
    let status: string;
    if (level <= 5) { score = 100; status = '정상'; }
    else if (level <= 9) { score = 85; status = '정상'; }
    else if (level <= 12) { score = 55; status = '경계'; }
    else if (level <= 14) { score = 35; status = '높음'; }
    else { score = Math.max(0, 20 - (level - 15) * 5); status = '위험'; }

    const color = score >= 80 ? '#10b981' : score >= 60 ? '#3b82f6' : score >= 40 ? '#f59e0b' : score >= 20 ? '#f97316' : '#ef4444';
    return { score, status, color };
}

// ─── 체성분 변화 속도 ─────────────────────────────────────────────────────────

export interface RateOfChange {
    weightPerWeek: number | null;
    musclePerWeek: number | null;
    fatPerWeek: number | null;
    weightWarning: string | null;
}

export function calcRateOfChange(records: AnalysisRecord[]): RateOfChange {
    if (records.length < 2) return { weightPerWeek: null, musclePerWeek: null, fatPerWeek: null, weightWarning: null };

    const sorted = [...records].sort((a, b) => new Date(a.metrics.date).getTime() - new Date(b.metrics.date).getTime());
    const first = sorted[0].metrics;
    const latest = sorted[sorted.length - 1].metrics;

    const days = (new Date(latest.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24);
    if (days <= 0) return { weightPerWeek: null, musclePerWeek: null, fatPerWeek: null, weightWarning: null };

    const weeks = days / 7;
    const wDelta = first.weight && latest.weight ? latest.weight - first.weight : null;
    const mDelta = first.skeletalMuscle && latest.skeletalMuscle ? latest.skeletalMuscle - first.skeletalMuscle : null;
    const fDelta = first.bodyFatMass && latest.bodyFatMass ? latest.bodyFatMass - first.bodyFatMass : null;

    const weightPerWeek = wDelta != null ? +(wDelta / weeks).toFixed(2) : null;
    const musclePerWeek = mDelta != null ? +(mDelta / weeks).toFixed(2) : null;
    const fatPerWeek = fDelta != null ? +(fDelta / weeks).toFixed(2) : null;

    let weightWarning: string | null = null;
    if (weightPerWeek != null) {
        if (weightPerWeek < -1.0) weightWarning = '주당 1kg 이상 급격한 감량 — 근손실 위험이 있습니다.';
        else if (weightPerWeek > 1.0) weightWarning = '주당 1kg 이상 급격한 증가 — 체지방 증가가 우려됩니다.';
    }

    return { weightPerWeek, musclePerWeek, fatPerWeek, weightWarning };
}

// ─── 참고 범위 ────────────────────────────────────────────────────────────────

export interface MetricRef {
    label: string;
    value: number | null;
    unit: string;
    min: number;
    max: number;
    optimal: [number, number];
    description: string;
    tooltip: string;
    color: string;
}

/** 모든 파생 지표를 한 번에 계산 */
export function getAllDerivedMetrics(m: HealthMetrics): MetricRef[] {
    return [
        {
            label: 'FFMI',
            value: calcFFMI(m),
            unit: '',
            min: 14, max: 28,
            optimal: [18, 22],
            description: '제지방 체질량지수 — 키 보정 근육량',
            tooltip: 'Fat-Free Mass Index\n공식: (체중 - 체지방량) ÷ (키m)²\n\nBMI는 체지방과 근육을 구분하지 못하지만, FFMI는 순수 근육 발달 수준을 키 보정하여 평가합니다.\n\n남성 기준:\n• 16~18: 평균 이하\n• 18~20: 평균\n• 20~22: 평균 이상 (꾸준한 운동자)\n• 22~25: 상당한 근육량 (고급 운동자)\n• 25+: 자연적으로 도달하기 어려운 수준',
            color: '#8b5cf6',
        },
        {
            label: 'SMI',
            value: calcSMI(m),
            unit: 'kg/m²',
            min: 6, max: 14,
            optimal: [8.5, 11],
            description: '골격근지수 — 근감소증 진단 기준',
            tooltip: 'Skeletal Muscle Index\n공식: 골격근량 ÷ (키m)²\n\n근감소증(sarcopenia) 진단의 국제 표준 지표입니다. 나이가 들수록 골격근이 감소하므로 장기 추적이 중요합니다.\n\n남성 기준:\n• 7.0 미만: 근감소증 (저근육)\n• 7.0~8.5: 경계\n• 8.5~11.0: 정상\n• 11.0+: 우수',
            color: '#10b981',
        },
        {
            label: '근육/지방 비',
            value: calcSMMBFMRatio(m),
            unit: '',
            min: 0.5, max: 4,
            optimal: [2.0, 3.5],
            description: '골격근÷체지방 — 높을수록 좋음',
            tooltip: 'SMM/BFM Ratio (골격근량 ÷ 체지방량)\n\n체성분의 질적 균형을 한눈에 보여주는 지표입니다. 체중 변화보다 이 비율의 추세가 더 의미 있는 경우가 많습니다.\n\n판정 기준:\n• 1.0 미만: 지방 과다 (개선 필요)\n• 1.0~2.0: 보통\n• 2.0~3.0: 양호 (근육이 지방의 2~3배)\n• 3.0+: 우수 (운동 선수급)\n\n다이어트 시 이 비율이 유지/상승하면 건강한 감량입니다.',
            color: '#3b82f6',
        },
        {
            label: '체수분율',
            value: calcTBWPercent(m),
            unit: '%',
            min: 40, max: 75,
            optimal: [55, 65],
            description: '체수분/체중 — 남성 55~65% 정상',
            tooltip: 'TBW% (Total Body Water Percentage)\n공식: 체수분(L) ÷ 체중(kg) × 100\n\n체내 수분 보유량을 체중 대비로 평가합니다.\n\n정상 범위:\n• 남성: 55~65%\n• 여성: 50~60%\n\n낮으면 탈수 상태, 높으면 부종이 의심됩니다. 근육은 약 75%가 수분이므로, 근육량이 많을수록 체수분율이 높아지는 경향이 있습니다.',
            color: '#06b6d4',
        },
        {
            label: '단백질 충분도',
            value: calcProteinRatio(m),
            unit: '%',
            min: 10, max: 25,
            optimal: [15, 20],
            description: '체내 단백질/체중 — 체내 단백질 수준',
            tooltip: 'Protein-to-Weight Ratio\n공식: 체내 단백질(kg) ÷ 체중(kg) × 100\n\n인바디에서 측정한 체내 단백질 보유량을 체중 대비로 평가합니다. (식사 섭취량이 아닌 체내 보유량)\n\n판정 기준:\n• 14% 미만: 부족 (근육 합성 저하 우려)\n• 15~20%: 정상\n• 20%+: 우수 (높은 근육 밀도)\n\n이 수치가 낮으면 단백질 섭취 부족이나 근육 분해가 진행 중일 수 있습니다.',
            color: '#f59e0b',
        },
        {
            label: '제지방량(LBM)',
            value: calcLBM(m),
            unit: 'kg',
            min: 40, max: 80,
            optimal: [55, 70],
            description: '체중 - 체지방량',
            tooltip: 'Lean Body Mass (제지방량)\n공식: 체중 - 체지방량\n\n체지방을 제외한 나머지 무게로, 근육·뼈·장기·수분을 모두 포함합니다.\n\n다이어트 시 이 수치가 감소하면 근육 손실이 발생하고 있다는 신호입니다. 이상적인 체중 감량은 체지방만 줄고 제지방량은 유지/증가하는 것입니다.\n\nFFMI, BMR 효율 등 다른 파생 지표의 기초가 되는 핵심 수치입니다.',
            color: '#ec4899',
        },
        {
            label: 'BMR 효율',
            value: calcBMREfficiency(m),
            unit: 'kcal/kg',
            min: 20, max: 35,
            optimal: [25, 30],
            description: '기초대사량÷제지방량 — 대사 활성도',
            tooltip: 'BMR per kg LBM (기초대사 효율)\n공식: 기초대사량(kcal) ÷ 제지방량(kg)\n\n같은 근육량이라도 대사 활성도가 다를 수 있습니다. 이 지표로 대사 효율의 변화를 추적할 수 있습니다.\n\n판정 기준:\n• 25 미만: 대사 효율 저하 (극단적 다이어트, 갑상선 저하 등)\n• 25~30: 정상 범위\n• 30+: 높은 대사 활성도\n\n다이어트 중 이 수치가 급격히 떨어지면 기초대사량 감소(요요 위험)를 의미합니다.',
            color: '#f97316',
        },
    ];
}
