'use client';

import { getRecords } from './storage';
import { getFoodLogs } from './food-storage';
import { getWorkoutLogs } from './workout-storage';

interface ReportData {
    executiveSummary: string;
    bodyCompositionAnalysis: string;
    trendAnalysis: string;
    riskAssessment: string;
    recommendations: string[];
    nutritionGuidance: string;
    exerciseGuidance: string;
    goals: string[];
}

function fmt(v: number | null | undefined, unit = '', dec = 1): string {
    return v != null ? `${Number(v).toFixed(dec)}${unit}` : '-';
}

function diff(curr: number | null | undefined, prev: number | null | undefined): string {
    if (curr == null || prev == null) return '';
    const d = +(curr - prev).toFixed(1);
    return d > 0 ? `+${d}` : d < 0 ? `${d}` : '±0';
}

function makeSvgChart(
    records: { date: string; weight?: number | null; skeletalMuscle?: number | null; bodyFatMass?: number | null }[]
): string {
    if (records.length < 2) return '<p style="text-align:center;color:#94a3b8;padding:20px">데이터 2개 이상 필요</p>';

    const W = 560, H = 160;
    const pad = { t: 20, b: 36, l: 40, r: 10 };
    const cw = W - pad.l - pad.r;
    const ch = H - pad.t - pad.b;

    const allVals = records.flatMap(r => [r.weight, r.skeletalMuscle, r.bodyFatMass]).filter((v): v is number => v != null);
    if (!allVals.length) return '';
    const minV = Math.floor(Math.min(...allVals) * 0.96);
    const maxV = Math.ceil(Math.max(...allVals) * 1.04);
    const range = maxV - minV || 1;

    const px = (i: number) => pad.l + (i / (records.length - 1)) * cw;
    const py = (v: number) => pad.t + ch - ((v - minV) / range) * ch;

    let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%">`;

    // Grid lines
    for (let i = 0; i <= 4; i++) {
        const gy = pad.t + (i / 4) * ch;
        const label = (maxV - (range * i) / 4).toFixed(0);
        svg += `<line x1="${pad.l}" y1="${gy}" x2="${W - pad.r}" y2="${gy}" stroke="#e2e8f0" stroke-width="0.8"/>`;
        svg += `<text x="${pad.l - 4}" y="${gy + 3.5}" font-size="9" fill="#94a3b8" text-anchor="end">${label}</text>`;
    }

    // X labels
    const step = Math.max(1, Math.floor(records.length / 8));
    records.forEach((r, i) => {
        if (i % step !== 0 && i !== records.length - 1) return;
        const label = r.date.slice(5);
        svg += `<text x="${px(i)}" y="${H - 4}" font-size="8" fill="#94a3b8" text-anchor="middle">${label}</text>`;
    });

    const series = [
        { key: 'weight' as const, color: '#0f629a', label: '체중' },
        { key: 'skeletalMuscle' as const, color: '#34d399', label: '골격근량' },
        { key: 'bodyFatMass' as const, color: '#f87171', label: '체지방량' },
    ];

    series.forEach(({ key, color, label }) => {
        const pts = records.map((r, i) => {
            const v = r[key];
            return v != null ? { x: px(i), y: py(v) } : null;
        }).filter((p): p is { x: number; y: number } => p != null);
        if (pts.length < 2) return;
        const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
        svg += `<path d="${d}" stroke="${color}" stroke-width="1.8" fill="none"/>`;
        pts.forEach(p => svg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5" fill="${color}"/>`);

        // Legend
        const li = series.findIndex(s => s.key === key);
        const lx = pad.l + li * 85;
        svg += `<rect x="${lx}" y="${H - 14}" width="12" height="4" fill="${color}" rx="1"/>`;
        svg += `<text x="${lx + 15}" y="${H - 10}" font-size="9" fill="#64748b">${label}</text>`;
    });

    svg += '</svg>';
    return svg;
}

function buildReportHTML(
    sorted: ReturnType<typeof getRecords>,
    report: ReportData
): string {
    const latest = sorted[sorted.length - 1].metrics;
    const first = sorted[0].metrics;
    const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

    const chartData = sorted.map(r => ({
        date: r.metrics.date,
        weight: r.metrics.weight,
        skeletalMuscle: r.metrics.skeletalMuscle,
        bodyFatMass: r.metrics.bodyFatMass,
    }));

    const bmiStatus = (bmi: number | null | undefined) => {
        if (bmi == null) return '';
        if (bmi < 18.5) return '저체중';
        if (bmi < 23) return '정상';
        if (bmi < 25) return '과체중';
        return '비만';
    };
    const bmiColor = (bmi: number | null | undefined) => {
        if (bmi == null) return '#64748b';
        if (bmi < 23) return '#10b981';
        if (bmi < 25) return '#f59e0b';
        return '#ef4444';
    };
    const fatColor = (pct: number | null | undefined) => {
        if (pct == null) return '#64748b';
        if (pct < 20) return '#10b981';
        if (pct < 25) return '#f59e0b';
        return '#ef4444';
    };

    const historyRows = sorted.slice().reverse().slice(0, 15).map((r, idx) => {
        const m = r.metrics;
        const isLatest = idx === 0;
        return `<tr style="${isLatest ? 'background:#eff6ff;font-weight:600;' : idx % 2 === 0 ? 'background:#f8fafc;' : ''}">
            <td>${m.date}</td>
            <td>${fmt(m.weight, ' kg')}</td>
            <td>${fmt(m.skeletalMuscle, ' kg')}</td>
            <td>${fmt(m.bodyFatMass, ' kg')}</td>
            <td>${fmt(m.bodyFatPercent, '%')}</td>
            <td>${fmt(m.bmi)}</td>
            <td>${fmt(m.inbodyScore, '점', 0)}</td>
        </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>HealthLens AI 건강 보고서</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Nanum+Gothic:wght@400;700;800&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Nanum Gothic', sans-serif; color: #1e293b; background: white; font-size: 11pt; line-height: 1.7; }

  .cover { background: linear-gradient(135deg, #0f629a 0%, #1e3a5f 100%); color: white; padding: 48px 40px; min-height: 140px; }
  .cover h1 { font-size: 26pt; font-weight: 800; letter-spacing: -0.5px; }
  .cover .subtitle { font-size: 12pt; opacity: 0.85; margin-top: 6px; }
  .cover .meta { margin-top: 16px; font-size: 9pt; opacity: 0.7; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 12px; }

  .page { padding: 32px 40px; }
  .section { margin-bottom: 28px; }
  .section-title {
    font-size: 13pt; font-weight: 800; color: #0f629a;
    border-left: 4px solid #0f629a; padding-left: 10px;
    margin-bottom: 12px;
  }
  .section-body { color: #334155; line-height: 1.85; }

  .metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 8px; }
  .metric-card {
    background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;
    padding: 12px 10px; text-align: center;
  }
  .metric-label { font-size: 8pt; color: #94a3b8; margin-bottom: 4px; }
  .metric-value { font-size: 16pt; font-weight: 800; color: #0f629a; }
  .metric-unit { font-size: 8pt; color: #64748b; }
  .metric-diff { font-size: 8.5pt; margin-top: 3px; }
  .diff-good { color: #10b981; }
  .diff-bad  { color: #ef4444; }
  .diff-neutral { color: #94a3b8; }

  .status-badge {
    display: inline-block; padding: 2px 10px; border-radius: 20px;
    font-size: 8.5pt; font-weight: 700; color: white;
  }

  .rec-list { list-style: none; padding: 0; }
  .rec-list li {
    padding: 8px 12px 8px 32px; position: relative;
    border-left: 3px solid #e2e8f0; margin-bottom: 6px;
    background: #f8fafc; border-radius: 0 6px 6px 0;
  }
  .rec-list li::before {
    content: "✓"; position: absolute; left: 8px;
    color: #10b981; font-weight: 800;
  }

  .goal-list { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .goal-card {
    background: linear-gradient(135deg, #eff6ff, #dbeafe);
    border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px;
  }
  .goal-label { font-size: 8pt; color: #3b82f6; font-weight: 700; margin-bottom: 6px; }
  .goal-text { font-size: 9.5pt; color: #1e3a5f; font-weight: 700; }

  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  th { background: #0f629a; color: white; padding: 8px 6px; text-align: center; font-weight: 700; }
  td { padding: 7px 6px; text-align: center; border-bottom: 1px solid #e2e8f0; }

  .divider { border: none; border-top: 1px solid #e2e8f0; margin: 8px 0 20px; }

  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .subsection-title { font-size: 10.5pt; font-weight: 700; color: #475569; margin-bottom: 8px; }
  .text-box { background: #f8fafc; border-radius: 8px; padding: 14px; border: 1px solid #e2e8f0; }

  .chart-wrap { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
  .chart-title { font-size: 9pt; font-weight: 700; color: #64748b; margin-bottom: 10px; }

  .risk-box { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 14px; }
  .risk-title { color: #c2410c; font-weight: 700; font-size: 10pt; margin-bottom: 8px; }

  .footer { text-align: center; font-size: 8pt; color: #94a3b8; padding: 20px 40px; border-top: 1px solid #e2e8f0; }

  @media print {
    body { font-size: 10pt; }
    .cover { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .metric-card, .goal-card, .rec-list li, .text-box, .risk-box, .chart-wrap { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    th { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .status-badge { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .page-break { page-break-before: always; }
  }
</style>
</head>
<body>

<!-- COVER -->
<div class="cover">
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <div style="font-size:10pt;opacity:0.7;margin-bottom:6px">HealthLens AI</div>
      <h1>체성분 건강 분석 보고서</h1>
      <div class="subtitle">Body Composition Health Report</div>
    </div>
    <div style="text-align:right;opacity:0.8;font-size:9pt">
      <div>생성일: ${today}</div>
      <div style="margin-top:4px">측정 기간: ${first.date} ~ ${latest.date}</div>
      <div style="margin-top:4px">총 ${sorted.length}회 측정</div>
    </div>
  </div>
</div>

<!-- PAGE 1 -->
<div class="page">

  <!-- 핵심 지표 요약 -->
  <div class="section">
    <div class="section-title">📊 핵심 체성분 지표 요약</div>
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">체중</div>
        <div class="metric-value">${latest.weight != null ? latest.weight.toFixed(1) : '-'}<span class="metric-unit"> kg</span></div>
        <div class="metric-diff ${(() => { const d = diff(latest.weight, first.weight); return d.startsWith('-') ? 'diff-good' : d.startsWith('+') ? 'diff-bad' : 'diff-neutral'; })()}">${diff(latest.weight, first.weight) || '-'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">골격근량</div>
        <div class="metric-value">${latest.skeletalMuscle != null ? latest.skeletalMuscle.toFixed(1) : '-'}<span class="metric-unit"> kg</span></div>
        <div class="metric-diff ${(() => { const d = diff(latest.skeletalMuscle, first.skeletalMuscle); return d.startsWith('+') ? 'diff-good' : d.startsWith('-') ? 'diff-bad' : 'diff-neutral'; })()}">${diff(latest.skeletalMuscle, first.skeletalMuscle) || '-'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">체지방률</div>
        <div class="metric-value">${latest.bodyFatPercent != null ? latest.bodyFatPercent.toFixed(1) : '-'}<span class="metric-unit"> %</span></div>
        <div class="metric-diff ${(() => { const d = diff(latest.bodyFatPercent, first.bodyFatPercent); return d.startsWith('-') ? 'diff-good' : d.startsWith('+') ? 'diff-bad' : 'diff-neutral'; })()}">${diff(latest.bodyFatPercent, first.bodyFatPercent) || '-'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">인바디 점수</div>
        <div class="metric-value">${latest.inbodyScore != null ? latest.inbodyScore.toFixed(0) : '-'}<span class="metric-unit"> 점</span></div>
        <div class="metric-diff ${(() => { const d = diff(latest.inbodyScore, first.inbodyScore); return d.startsWith('+') ? 'diff-good' : d.startsWith('-') ? 'diff-bad' : 'diff-neutral'; })()}">${diff(latest.inbodyScore, first.inbodyScore) || '-'}</div>
      </div>
    </div>
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">BMI</div>
        <div class="metric-value" style="font-size:14pt">${fmt(latest.bmi)}</div>
        <div style="margin-top:5px">
          ${latest.bmi != null ? `<span class="status-badge" style="background:${bmiColor(latest.bmi)}">${bmiStatus(latest.bmi)}</span>` : '-'}
        </div>
      </div>
      <div class="metric-card">
        <div class="metric-label">기초대사량</div>
        <div class="metric-value" style="font-size:13pt">${fmt(latest.basalMetabolicRate, '', 0)}<span class="metric-unit"> kcal</span></div>
        <div class="metric-diff ${(() => { const d = diff(latest.basalMetabolicRate, first.basalMetabolicRate); return d.startsWith('+') ? 'diff-good' : d.startsWith('-') ? 'diff-bad' : 'diff-neutral'; })()}">${diff(latest.basalMetabolicRate, first.basalMetabolicRate) || '-'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">내장지방 레벨</div>
        <div class="metric-value" style="font-size:14pt">${fmt(latest.visceralFatLevel, '', 0)}</div>
        <div style="margin-top:5px">
          ${latest.visceralFatLevel != null ? `<span class="status-badge" style="background:${latest.visceralFatLevel <= 9 ? '#10b981' : latest.visceralFatLevel <= 14 ? '#f59e0b' : '#ef4444'}">${latest.visceralFatLevel <= 9 ? '정상' : latest.visceralFatLevel <= 14 ? '주의' : '위험'}</span>` : '-'}
        </div>
      </div>
      <div class="metric-card">
        <div class="metric-label">체지방량</div>
        <div class="metric-value" style="font-size:13pt">${fmt(latest.bodyFatMass, '', 1)}<span class="metric-unit"> kg</span></div>
        <div style="margin-top:5px">
          ${latest.bodyFatPercent != null ? `<span class="status-badge" style="background:${fatColor(latest.bodyFatPercent)}">${latest.bodyFatPercent < 20 ? '정상' : latest.bodyFatPercent < 25 ? '경계' : '높음'}</span>` : '-'}
        </div>
      </div>
    </div>
  </div>

  <!-- 종합 평가 -->
  <div class="section">
    <div class="section-title">📋 종합 건강 평가</div>
    <div class="text-box section-body">${report.executiveSummary}</div>
  </div>

  <!-- 체성분 변화 추이 차트 -->
  <div class="section">
    <div class="section-title">📈 체성분 변화 추이</div>
    <div class="chart-wrap">
      <div class="chart-title">체중 / 골격근량 / 체지방량 (kg)</div>
      ${makeSvgChart(chartData)}
    </div>
  </div>

</div>

<!-- PAGE 2 -->
<div class="page page-break">

  <div class="section">
    <div class="section-title">🔬 체성분 상세 분석</div>
    <div class="text-box section-body">${report.bodyCompositionAnalysis}</div>
  </div>

  <div class="section">
    <div class="section-title">📉 변화 추이 분석</div>
    <div class="text-box section-body">${report.trendAnalysis}</div>
  </div>

  <div class="section">
    <div class="section-title">⚠️ 위험 요인 평가</div>
    <div class="risk-box">
      <div class="risk-title">주의사항 및 위험 요인</div>
      <div class="section-body">${report.riskAssessment}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">✅ 실천 권고사항</div>
    <ul class="rec-list">
      ${report.recommendations.map(r => `<li>${r}</li>`).join('')}
    </ul>
  </div>

  <div class="section">
    <div class="section-title">🎯 목표 설정</div>
    <div class="goal-list">
      ${report.goals.map((g, i) => `
        <div class="goal-card">
          <div class="goal-label">${i === 0 ? '단기 목표 (1개월)' : i === 1 ? '중기 목표 (3개월)' : '장기 목표 (6개월)'}</div>
          <div class="goal-text">${g}</div>
        </div>
      `).join('')}
    </div>
  </div>

</div>

<!-- PAGE 3 -->
<div class="page page-break">

  <div class="section">
    <div class="two-col">
      <div>
        <div class="section-title">🥗 영양 섭취 지침</div>
        <div class="text-box section-body">${report.nutritionGuidance}</div>
      </div>
      <div>
        <div class="section-title">💪 운동 처방</div>
        <div class="text-box section-body">${report.exerciseGuidance}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">📋 전체 측정 이력</div>
    <table>
      <thead>
        <tr>
          <th>측정일</th><th>체중(kg)</th><th>골격근(kg)</th><th>체지방(kg)</th><th>체지방%</th><th>BMI</th><th>인바디</th>
        </tr>
      </thead>
      <tbody>${historyRows}</tbody>
    </table>
  </div>

</div>

<div class="footer">
  HealthLens AI | 본 보고서는 참고용이며 의학적 진단을 대체하지 않습니다. 건강 관련 결정은 반드시 전문의와 상담하세요. | ${today}
</div>

</body>
</html>`;
}

export async function exportDashboardPDF() {
    const records = getRecords();
    if (records.length === 0) {
        alert('분석 기록이 없습니다. 먼저 인바디 데이터를 업로드해주세요.');
        return;
    }

    // Loading overlay with close button
    const loadingEl = document.createElement('div');
    loadingEl.style.cssText = `position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);
        display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;
        font-family:sans-serif;gap:16px;`;
    loadingEl.innerHTML = `
        <div style="font-size:18px;font-weight:700">🤖 AI가 전문 보고서를 작성 중입니다...</div>
        <div style="font-size:13px;opacity:0.7">Gemini AI로 분석 중 (10~30초 소요)</div>
        <div id="report-progress" style="font-size:12px;opacity:0.5">건강 데이터 분석 시작...</div>
        <button onclick="this.closest('div[style*=fixed]').remove()" style="
            margin-top:8px;padding:8px 20px;background:rgba(255,255,255,0.15);
            border:1px solid rgba(255,255,255,0.3);border-radius:8px;color:white;
            font-size:13px;cursor:pointer;">✕ 취소</button>`;
    document.body.appendChild(loadingEl);

    const updateProgress = (msg: string) => {
        const el = document.getElementById('report-progress');
        if (el) el.textContent = msg;
    };

    try {
        updateProgress('체성분 데이터 수집 중...');
        const sorted = [...records].sort((a, b) =>
            new Date(a.metrics.date).getTime() - new Date(b.metrics.date).getTime()
        );

        let foodLogs: any[] = [];
        let workoutLogs: any[] = [];
        try { foodLogs = getFoodLogs(); } catch {}
        try { workoutLogs = getWorkoutLogs(); } catch {}

        updateProgress('Gemini AI에게 분석 요청 중...');

        // 60초 타임아웃
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);

        let res: Response;
        try {
            res = await fetch('/api/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ healthData: { records, foodLogs, workoutLogs } }),
                signal: controller.signal,
            });
        } finally {
            clearTimeout(timeout);
        }

        // 이미 취소된 경우 (사용자가 닫기 누름) 중단
        if (!document.body.contains(loadingEl)) return;

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'API 오류');
        }

        updateProgress('보고서 HTML 생성 중...');
        const reportData: ReportData = await res.json();
        const html = buildReportHTML(sorted, reportData);

        const printWin = window.open('', '_blank', 'width=900,height=700');
        if (!printWin) {
            alert('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.');
            return;
        }
        printWin.document.write(html);
        printWin.document.close();

        printWin.onload = () => {
            setTimeout(() => {
                printWin.focus();
                printWin.print();
            }, 1500);
        };
    } catch (err: any) {
        if (err?.name === 'AbortError') {
            alert('보고서 생성 시간이 초과되었습니다. 다시 시도해주세요.');
        } else {
            console.error('Report generation failed:', err);
            alert('보고서 생성 실패: ' + (err instanceof Error ? err.message : String(err)));
        }
    } finally {
        loadingEl.remove();
    }
}
