import { HealthMetrics } from './types';
import { generateId } from './storage';

/**
 * InBody CSV 파서
 * 인바디 내보내기 CSV 파일을 파싱하여 HealthMetrics 배열로 변환합니다.
 * 
 * 컬럼 매핑 (인바디 CSV 기준):
 * - 날짜 → date
 * - 체중(kg) → weight
 * - 골격근량(kg) → skeletalMuscle
 * - 체지방량(kg) → bodyFatMass
 * - BMI(kg/m²) → bmi
 * - 체지방률(%) → bodyFatPercent
 * - 기초대사량(kcal) → basalMetabolicRate
 * - 인바디점수 → notes (InBody Score)
 * - 복부지방률 → waistHipRatio
 * - 내장지방레벨 → visceralFatLevel
 */

// Flexible column name matching
const COLUMN_MAP: Record<string, keyof HealthMetrics | 'inbodyScore' | 'ignore'> = {
    '날짜': 'date',
    '측정장비': 'ignore',
    '체중': 'weight',
    '체중(kg)': 'weight',
    '골격근량': 'skeletalMuscle',
    '골격근량(kg)': 'skeletalMuscle',
    '근육량': 'ignore',         // separate from skeletal muscle
    '근육량(kg)': 'ignore',
    '체지방량': 'bodyFatMass',
    '체지방량(kg)': 'bodyFatMass',
    'bmi': 'bmi',
    'bmi(kg/m²)': 'bmi',
    'bmi(kg/m2)': 'bmi',
    '체지방률': 'bodyFatPercent',
    '체지방률(%)': 'bodyFatPercent',
    '기초대사량': 'basalMetabolicRate',
    '기초대사량(kcal)': 'basalMetabolicRate',
    '인바디점수': 'inbodyScore',
    '인바디 점수': 'inbodyScore',
    '복부지방률': 'waistHipRatio',
    '내장지방레벨': 'visceralFatLevel',
    '내장지방 레벨': 'visceralFatLevel',
    '체수분': 'totalBodyWater',
    '체수분(l)': 'totalBodyWater',
    '체수분(ℓ)': 'totalBodyWater',
    '단백질': 'protein',
    '단백질(kg)': 'protein',
    '무기질': 'minerals',
    '무기질(kg)': 'minerals',
    '신장': 'height',
    '신장(cm)': 'height',
    '키': 'height',
    '키(cm)': 'height',
    '상체좌우': 'ignore',
    '하체좌우': 'ignore',
    '다리근육레벨': 'ignore',
    '다리근육레벨(level)': 'ignore',
};

function normalizeColumnName(col: string): string {
    return col
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/["""]/g, '');
}

function matchColumn(header: string): keyof HealthMetrics | 'inbodyScore' | 'ignore' | null {
    const normalized = normalizeColumnName(header);

    // Direct match
    for (const [key, value] of Object.entries(COLUMN_MAP)) {
        if (normalizeColumnName(key) === normalized) {
            return value;
        }
    }

    // Partial match
    for (const [key, value] of Object.entries(COLUMN_MAP)) {
        if (normalized.includes(normalizeColumnName(key)) || normalizeColumnName(key).includes(normalized)) {
            return value;
        }
    }

    return null;
}

function parseInBodyDate(rawDate: string): string {
    // Formats: "*20260306", "20260306", "2026-03-06", "2026/03/06", "*2026030600H40"
    let cleaned = rawDate.replace(/[*"]/g, '').trim();

    // Remove device info if appended (e.g., "2026030600H40" -> "20260306")
    // The pattern is: YYYYMMDD followed by optional time/device info
    const match = cleaned.match(/^(\d{4})(\d{2})(\d{2})/);
    if (match) {
        return `${match[1]}-${match[2]}-${match[3]}`;
    }

    // Try ISO format
    const isoMatch = cleaned.match(/^(\d{4})[/-](\d{2})[/-](\d{2})/);
    if (isoMatch) {
        return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }

    return new Date().toISOString().split('T')[0];
}

function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

export interface CSVParseResult {
    success: boolean;
    records: HealthMetrics[];
    errors: string[];
    totalRows: number;
    parsedRows: number;
}

export function parseInBodyCSV(csvContent: string): CSVParseResult {
    const errors: string[] = [];
    const records: HealthMetrics[] = [];

    // Split lines, handle different line endings
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);

    if (lines.length < 2) {
        return { success: false, records: [], errors: ['CSV 파일에 데이터가 없습니다.'], totalRows: 0, parsedRows: 0 };
    }

    // Parse header
    const headers = parseCSVLine(lines[0]);
    const columnMapping: Array<{ index: number; field: keyof HealthMetrics | 'inbodyScore' | 'ignore' | null }> =
        headers.map((h, i) => ({ index: i, field: matchColumn(h) }));

    const mappedFields = columnMapping.filter(c => c.field !== null && c.field !== 'ignore').map(c => c.field);

    if (mappedFields.length === 0) {
        return {
            success: false,
            records: [],
            errors: [`인식 가능한 컬럼을 찾을 수 없습니다. 헤더: ${headers.join(', ')}`],
            totalRows: lines.length - 1,
            parsedRows: 0
        };
    }

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length === 0 || values.every(v => !v.trim())) continue;

        try {
            const id = generateId();
            const metrics: HealthMetrics = {
                id,
                date: new Date().toISOString().split('T')[0],
                weight: null,
                skeletalMuscle: null,
                bodyFatPercent: null,
                bodyFatMass: null,
                bmi: null,
                basalMetabolicRate: null,
                visceralFatLevel: null,
                totalBodyWater: null,
                protein: null,
                minerals: null,
                height: null,
                metabolicAge: null,
                waistHipRatio: null,
                inbodyScore: null,
                notes: '',
            };

            for (const col of columnMapping) {
                if (col.field === null || col.field === 'ignore') continue;
                const rawValue = values[col.index]?.replace(/[*"]/g, '').trim();
                if (!rawValue) continue;

                if (col.field === 'date') {
                    metrics.date = parseInBodyDate(rawValue);
                } else if (col.field === 'notes') {
                    metrics.notes = rawValue;
                } else {
                    const numVal = parseFloat(rawValue);
                    if (!isNaN(numVal)) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (metrics as any)[col.field] = numVal;
                    }
                }
            }

            // Only add if we have at least some data
            const hasData = metrics.weight !== null || metrics.skeletalMuscle !== null ||
                metrics.bodyFatPercent !== null || metrics.bmi !== null;
            if (hasData) {
                records.push(metrics);
            }
        } catch (e) {
            errors.push(`행 ${i + 1} 파싱 오류: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
        }
    }

    return {
        success: records.length > 0,
        records,
        errors,
        totalRows: lines.length - 1,
        parsedRows: records.length,
    };
}
