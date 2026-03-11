export interface HealthMetrics {
  id: string;
  date: string;
  weight: number | null;           // kg
  skeletalMuscle: number | null;   // kg
  bodyFatPercent: number | null;   // %
  bodyFatMass: number | null;      // kg
  bmi: number | null;
  basalMetabolicRate: number | null; // kcal
  visceralFatLevel: number | null;
  totalBodyWater: number | null;   // L
  protein: number | null;          // kg
  minerals: number | null;         // kg
  height: number | null;           // cm
  metabolicAge: number | null;
  waistHipRatio: number | null;
  inbodyScore: number | null;
  notes: string;
  imageUrl?: string;
}

export interface AnalysisRecord {
  id: string;
  createdAt: string;
  imageFileName: string;
  metrics: HealthMetrics;
  exerciseGuide: ExerciseGuide | null;
  dietGuide: DietGuide | null;
  rawOcrText?: string;
}

export interface ExerciseRoutine {
  name: string;
  type: 'HIIT' | 'strength' | 'cardio' | 'flexibility' | 'recovery';
  description: string;
  duration: string;
  sets?: number;
  reps?: string;
  intensity: 'low' | 'moderate' | 'high';
  icon: string;
}

export interface ExerciseGuide {
  summary: string;
  weeklyPlan: WeeklyPlan[];
  routines: ExerciseRoutine[];
  tips: string[];
}

export interface WeeklyPlan {
  day: string;
  focus: string;
  routines: string[];
}

export interface MealSuggestion {
  name: string;
  description: string;
  calories: number;
  protein: number;  // g
  carbs: number;    // g
  fat: number;      // g
}

export interface DietGuide {
  summary: string;
  dailyCalories: number;
  macroRatio: {
    protein: number;  // %
    carbs: number;    // %
    fat: number;      // %
  };
  meals: {
    breakfast: MealSuggestion[];
    lunch: MealSuggestion[];
    dinner: MealSuggestion[];
    snack: MealSuggestion[];
  };
  tips: string[];
  supplements: string[];
}

export interface ChartDataPoint {
  date: string;
  weight?: number;
  skeletalMuscle?: number;
  bodyFatPercent?: number;
  bmi?: number;
  basalMetabolicRate?: number;
  inbodyScore?: number;
  bodyFatMass?: number;
  waistHipRatio?: number;
}

// Food Diary
export interface FoodEntry {
  id: string;
  time: string;          // HH:mm
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  name: string;
  description: string;
  calories: number;
  protein: number;       // g
  carbs: number;         // g
  fat: number;           // g
  imageUrl?: string;
}

export interface DailyFoodLog {
  date: string;          // YYYY-MM-DD
  entries: FoodEntry[];
  targetCalories: number;
}

// Meal Preset (저장된 식단 템플릿)
export interface MealPresetEntry {
  name: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealPreset {
  id: string;
  name: string;              // 프리셋 이름 (예: "닭가슴살 런치")
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  entries: MealPresetEntry[];
  totalCalories: number;
  createdAt: string;         // ISO string
}

// Workout Log
export interface WorkoutEntry {
  id: string;
  name: string;
  type: 'strength' | 'cardio' | 'flexibility' | 'HIIT' | 'recovery' | 'other';
  duration: string;
  sets?: number;
  reps?: string;
  weight?: string;
  description: string;
  memo?: string;
}

export interface WorkoutLog {
  date: string;          // YYYY-MM-DD
  entries: WorkoutEntry[];
}

export type TabType = 'dashboard' | 'upload' | 'history' | 'workout-diary' | 'food-diary' | 'compare';
