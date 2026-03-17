'use client';

import { useState, useEffect, useCallback } from 'react';
import { Menu, Download, FileDown } from 'lucide-react';
import Sidebar from '@/app/components/Sidebar';
import MetricsCards from '@/app/components/MetricsCards';
import HealthCharts from '@/app/components/HealthCharts';
import DashboardInsights from '@/app/components/DashboardInsights';
import RawDataTable from '@/app/components/RawDataTable';
import PredictionChart from '@/app/components/PredictionChart';
import HealthRiskGauge from '@/app/components/HealthRiskGauge';
import CompareAnalysis from '@/app/components/CompareAnalysis';
import FoodDiary from '@/app/components/FoodDiary';
import ImageUploader from '@/app/components/ImageUploader';
import WorkoutDiary from '@/app/components/WorkoutDiary';
import AnalysisHistory from '@/app/components/AnalysisHistory';
import StorageSync from '@/app/components/StorageSync';
import DietChatbot from '@/app/components/DietChatbot';
import {
  getRecords,
  saveRecord,
  deleteRecord,
  getLatestRecord,
  getChartData,
  generateId,
} from '@/app/lib/storage';
import { parseInBodyCSV, CSVParseResult } from '@/app/lib/csv-parser';
import { sampleRecords } from '@/app/lib/sample-data';
import { TabType, AnalysisRecord, HealthMetrics, ChartDataPoint } from '@/app/lib/types';

const TAB_HEADERS: Record<TabType, { title: string; subtitle: string }> = {
  dashboard: { title: '대시보드', subtitle: '건강 지표 요약 및 추이 분석' },
  upload: { title: '결과지 업로드', subtitle: 'AI가 자동으로 건강 지표를 분석합니다' },
  history: { title: '분석 기록', subtitle: '과거 분석 결과를 확인하세요' },
  compare: { title: '비교 분석', subtitle: '두 날짜의 건강 지표를 비교합니다' },
  'workout-diary': { title: '운동 일지', subtitle: '일별 운동을 기록하고 관리하세요' },
  'food-diary': { title: '식단 일지', subtitle: '일별 식단을 기록하고 관리하세요' },
  chat: { title: 'AI 코치', subtitle: '체성분·식단·운동 데이터 기반 맞춤 다이어트 코칭' },
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [latestRecord, setLatestRecord] = useState<AnalysisRecord | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [csvResult, setCsvResult] = useState<CSVParseResult | null>(null);

  const refreshData = useCallback(() => {
    const allRecords = getRecords();
    setRecords(allRecords);
    setLatestRecord(getLatestRecord());
    setChartData(getChartData());
  }, []);

  // Initialize with sample data if no records
  useEffect(() => {
    const existing = getRecords();
    if (existing.length === 0) {
      sampleRecords.forEach((r) => saveRecord(r));
    }
    refreshData();
    setInitialized(true);
  }, [refreshData]);

  const handleAnalyze = async (file: File) => {
    setIsAnalyzing(true);
    setProgress(10);
    setProgressMessage('이미지를 업로드하는 중...');

    try {
      // Step 1: Upload and analyze image
      setProgress(20);
      setProgressMessage('AI가 이미지를 분석하고 있습니다...');

      const formData = new FormData();
      formData.append('image', file);

      const analyzeRes = await fetch('/api/analyze', { method: 'POST', body: formData });

      if (!analyzeRes.ok) {
        const errorData = await analyzeRes.json();
        throw new Error(errorData.error || '분석에 실패했습니다.');
      }

      const { metrics: extractedMetrics, rawOcrText } = await analyzeRes.json();
      setProgress(50);
      setProgressMessage('건강 지표를 추출했습니다. 맞춤 가이드를 생성 중...');

      // Step 2: Saved as simple record (Recommendations are now handled via manual diary)
      setProgress(80);
      setProgressMessage('분석 결과를 저장하는 중...');

      // Step 3: Save record
      const id = generateId();
      const newRecord: AnalysisRecord = {
        id,
        createdAt: new Date().toISOString(),
        imageFileName: file.name,
        metrics: {
          id: `metrics-${id}`,
          date: extractedMetrics.date || new Date().toISOString().split('T')[0],
          weight: extractedMetrics.weight,
          skeletalMuscle: extractedMetrics.skeletalMuscle,
          bodyFatPercent: extractedMetrics.bodyFatPercent,
          bodyFatMass: extractedMetrics.bodyFatMass,
          bmi: extractedMetrics.bmi,
          basalMetabolicRate: extractedMetrics.basalMetabolicRate,
          visceralFatLevel: extractedMetrics.visceralFatLevel,
          totalBodyWater: extractedMetrics.totalBodyWater,
          protein: extractedMetrics.protein,
          minerals: extractedMetrics.minerals,
          height: extractedMetrics.height,
          metabolicAge: null,
          waistHipRatio: extractedMetrics.waistHipRatio,
          inbodyScore: extractedMetrics.inbodyScore || null,
          notes: extractedMetrics.notes || '',
        },
        exerciseGuide: null,
        dietGuide: null,
        rawOcrText,
      };

      saveRecord(newRecord);
      setProgress(100);
      setProgressMessage('분석이 완료되었습니다!');

      setTimeout(() => {
        refreshData();
        setIsAnalyzing(false);
        setProgress(0);
        setActiveTab('dashboard');
      }, 1000);
    } catch (error) {
      console.error('Analysis failed:', error);
      setProgressMessage(`오류: ${error instanceof Error ? error.message : '분석에 실패했습니다.'}`);
      setTimeout(() => {
        setIsAnalyzing(false);
        setProgress(0);
      }, 3000);
    }
  };

  const handleCSVImport = async (file: File) => {
    setIsAnalyzing(true);
    setProgress(10);
    setProgressMessage('CSV 파일을 읽는 중...');
    setCsvResult(null);

    try {
      const text = await file.text();
      setProgress(30);
      setProgressMessage('데이터를 파싱하는 중...');

      const result = parseInBodyCSV(text);
      setProgress(60);
      setProgressMessage(`${result.parsedRows}개 기록을 저장하는 중...`);

      if (result.success) {
        // Remove sample data before importing real data
        const existing = getRecords();
        const sampleIds = sampleRecords.map(s => s.id);
        sampleIds.forEach(id => {
          if (existing.some(r => r.id === id)) {
            deleteRecord(id);
          }
        });

        for (const metrics of result.records) {
          const id = generateId();
          const newRecord: AnalysisRecord = {
            id,
            createdAt: new Date().toISOString(),
            imageFileName: file.name,
            metrics,
            exerciseGuide: null,
            dietGuide: null,
          };
          saveRecord(newRecord);
        }
        setProgress(100);
        setProgressMessage('가져오기 완료!');
        refreshData();
      }

      setTimeout(() => {
        setIsAnalyzing(false);
        setProgress(0);
        setCsvResult(result);
        if (result.success) {
          refreshData();
        }
      }, 500);
    } catch (error) {
      console.error('CSV import failed:', error);
      setIsAnalyzing(false);
      setProgress(0);
      setCsvResult({
        success: false,
        records: [],
        errors: [error instanceof Error ? error.message : 'CSV 처리 중 오류가 발생했습니다.'],
        totalRows: 0,
        parsedRows: 0,
      });
    }
  };

  const handleDeleteRecord = (id: string) => {
    deleteRecord(id);
    refreshData();
  };

  const handleSelectRecord = (record: AnalysisRecord) => {
    setLatestRecord(record);
    setActiveTab('dashboard');
  };

  if (!initialized) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Server Sync (invisible) */}
      <StorageSync onSynced={refreshData} />

      {/* Mobile Header */}
      <div className="mobile-header">
        <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
          <Menu size={20} />
        </button>
        <span style={{ fontWeight: 600, fontSize: '15px' }}>HealthLens AI</span>
        <div style={{ width: '40px' }} />
      </div>

      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        recordCount={records.length}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content */}
      <main className="main-content">
        <div className="main-header">
          <div className="main-header-left">
            <h2>{TAB_HEADERS[activeTab].title}</h2>
            <p>{TAB_HEADERS[activeTab].subtitle}</p>
          </div>
          {activeTab === 'dashboard' && latestRecord && (
            <div className="main-header-right" style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={async () => {
                  const { exportDashboardPDF } = await import('@/app/lib/pdf-export');
                  exportDashboardPDF();
                }}
              >
                <FileDown size={14} /> PDF 리포트
              </button>
              <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
                최근 측정: {new Date(latestRecord.metrics.date).toLocaleDateString('ko-KR')}
              </span>
            </div>
          )}
        </div>

        {/* Dashboard View */}
        {activeTab === 'dashboard' && (
          <div className="animate-fadeIn">
            <MetricsCards records={records} />
            <HealthCharts chartData={chartData} />
            <PredictionChart chartData={chartData} />
            <HealthRiskGauge records={records} />
            <DashboardInsights records={records} />
            <RawDataTable records={records} />
          </div>
        )}

        {/* Upload View */}
        {activeTab === 'upload' && (
          <ImageUploader
            onAnalyze={handleAnalyze}
            onCSVImport={handleCSVImport}
            isAnalyzing={isAnalyzing}
            progress={progress}
            progressMessage={progressMessage}
            csvResult={csvResult}
          />
        )}

        {/* History View */}
        {activeTab === 'history' && (
          <AnalysisHistory
            records={records}
            onSelectRecord={handleSelectRecord}
            onDeleteRecord={handleDeleteRecord}
            onGoToUpload={() => setActiveTab('upload')}
          />
        )}

        {/* Workout Diary View */}
        {activeTab === 'workout-diary' && (
          <WorkoutDiary onGoToUpload={() => setActiveTab('upload')} />
        )}

        {/* Compare Analysis View */}
        {activeTab === 'compare' && (
          <CompareAnalysis records={records} />
        )}

        {/* Food Diary View */}
        {activeTab === 'food-diary' && (
          <FoodDiary onGoToUpload={() => setActiveTab('upload')} />
        )}

        {/* AI Coach Chat View */}
        {activeTab === 'chat' && (
          <DietChatbot />
        )}
      </main>
    </div>
  );
}
