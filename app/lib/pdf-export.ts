'use client';

import { getRecords } from './storage';

// ── Colors ───────────────────────────────────────────────
type RGB = [number, number, number];
const C: Record<string, RGB> = {
    primary:   [15,  98, 154],
    accent:    [56, 189, 248],
    green:     [52, 211, 153],
    red:       [248, 113, 113],
    orange:    [251, 146,  60],
    dark:      [15,  23,  42],
    gray:      [100, 116, 139],
    lightGray: [226, 232, 240],
    white:     [255, 255, 255],
    bgLight:   [248, 250, 252],
    bgSection: [241, 245, 249],
};

export async function exportDashboardPDF() {
    const { jsPDF } = await import('jspdf');

    const records = getRecords();
    if (records.length === 0) {
        alert('분석 기록이 없습니다. 먼저 인바디 데이터를 업로드해주세요.');
        return;
    }

    const loadingEl = document.createElement('div');
    loadingEl.style.cssText = `position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.65);
        display:flex;align-items:center;justify-content:center;color:white;
        font-size:18px;font-weight:600;font-family:sans-serif;backdrop-filter:blur(8px);`;
    loadingEl.textContent = '📄 PDF 보고서 생성 중...';
    document.body.appendChild(loadingEl);

    try {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const PW = 210;
        const PH = 297;
        const ML = 14;
        const MR = 14;
        const CW = PW - ML - MR;

        const sorted = [...records].sort((a, b) =>
            new Date(a.metrics.date).getTime() - new Date(b.metrics.date).getTime()
        );
        const latest = sorted[sorted.length - 1].metrics;
        const first  = sorted[0].metrics;
        const today  = new Date().toLocaleDateString('ko-KR');

        const sf = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
        const sd = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
        const st = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
        const bold   = () => doc.setFont('helvetica', 'bold');
        const normal = () => doc.setFont('helvetica', 'normal');
        const fmt = (v: number | null | undefined, unit = '', dec = 1): string =>
            v != null ? `${Number(v).toFixed(dec)}${unit}` : '-';
        const diff = (curr: number | null | undefined, prev: number | null | undefined): string => {
            if (curr == null || prev == null) return '';
            const d = +(curr - prev).toFixed(1);
            return d > 0 ? `+${d}` : d < 0 ? `${d}` : '±0';
        };

        // ── PAGE 1 ───────────────────────────────────────

        // Header bar
        sf(C.primary); doc.rect(0, 0, PW, 38, 'F');
        sf(C.accent);  doc.rect(0, 35, PW, 3, 'F');
        st(C.white); bold(); doc.setFontSize(20);
        doc.text('HealthLens AI', ML, 17);
        normal(); doc.setFontSize(10);
        doc.text('체성분 분석 보고서', ML, 25);
        st([180, 210, 240] as RGB); doc.setFontSize(8.5);
        doc.text(`생성일: ${today}    |    측정기간: ${first.date} ~ ${latest.date}    |    총 ${sorted.length}회`, ML, 32);

        let y = 46;

        // SECTION: 최신 체성분 요약
        secTitle(doc, ML, y, CW, '📊 최신 체성분 측정 요약');
        y += 9;

        const cardW = (CW - 6) / 4;
        const metCards: [string, string, string, boolean][] = [
            ['체중', fmt(latest.weight, ' kg'), diff(latest.weight, first.weight), false],
            ['골격근량', fmt(latest.skeletalMuscle, ' kg'), diff(latest.skeletalMuscle, first.skeletalMuscle), true],
            ['체지방량', fmt(latest.bodyFatMass, ' kg'), diff(latest.bodyFatMass, first.bodyFatMass), false],
            ['체지방률', fmt(latest.bodyFatPercent, '%'), diff(latest.bodyFatPercent, first.bodyFatPercent), false],
        ];
        drawMetCards(doc, ML, y, cardW, metCards);
        y += 26;

        const metCards2: [string, string, string, boolean][] = [
            ['BMI', fmt(latest.bmi), diff(latest.bmi, first.bmi), false],
            ['기초대사량', fmt(latest.basalMetabolicRate, ' kcal', 0), diff(latest.basalMetabolicRate, first.basalMetabolicRate), true],
            ['내장지방', fmt(latest.visceralFatLevel, ' lv', 0), diff(latest.visceralFatLevel, first.visceralFatLevel), false],
            ['인바디 점수', fmt(latest.inbodyScore, '점', 0), diff(latest.inbodyScore, first.inbodyScore), true],
        ];
        drawMetCards(doc, ML, y, cardW, metCards2);
        y += 28;

        // SECTION: 변화 추이 차트
        secTitle(doc, ML, y, CW, '📈 체성분 변화 추이');
        y += 9;
        y = drawLineChart(doc, ML, y, CW, 62, sorted.map(r => ({
            date: r.metrics.date.slice(5),
            weight: r.metrics.weight,
            muscle: r.metrics.skeletalMuscle,
            fat:    r.metrics.bodyFatMass,
        })));
        y += 6;

        // SECTION: 신체 구성 바
        secTitle(doc, ML, y, CW, '⚖️ 신체 구성 분포');
        y += 9;
        const segments: [number | null | undefined, RGB, string][] = [
            [latest.totalBodyWater, C.accent, `체수분 ${fmt(latest.totalBodyWater, 'L')}`],
            [latest.protein,        C.green,  `단백질 ${fmt(latest.protein, 'kg')}`],
            [latest.minerals,       C.orange, `무기질 ${fmt(latest.minerals, 'kg')}`],
            [latest.bodyFatMass,    C.red,    `체지방 ${fmt(latest.bodyFatMass, 'kg')}`],
        ].filter(([v]) => v != null) as [number, RGB, string][];
        const total = segments.reduce((s, [v]) => s + (v as number), 0) || 1;
        let bx = ML;
        segments.forEach(([v, c]) => {
            const bw = ((v as number) / total) * CW;
            sf(c as RGB); doc.rect(bx, y, bw, 8, 'F'); bx += bw;
        });
        y += 9;
        let lx = ML;
        segments.forEach(([, c, label]) => {
            sf(c); doc.rect(lx, y, 4, 2.5, 'F');
            st(C.dark); normal(); doc.setFontSize(7);
            doc.text(label, lx + 5, y + 2.2);
            lx += CW / segments.length;
        });
        y += 8;

        // Footer p1
        sf(C.lightGray); doc.rect(0, PH - 12, PW, 12, 'F');
        st(C.gray); normal(); doc.setFontSize(7.5);
        doc.text('HealthLens AI  |  본 보고서는 참고용이며 의학적 진단을 대체하지 않습니다.  |  1 / 2', PW / 2, PH - 5, { align: 'center' });

        // ── PAGE 2 ───────────────────────────────────────
        doc.addPage();

        // Header
        sf(C.primary); doc.rect(0, 0, PW, 12, 'F');
        st(C.white); bold(); doc.setFontSize(9.5);
        doc.text('HealthLens AI  |  체성분 분석 보고서', ML, 8);
        st([180,210,240] as RGB); normal(); doc.setFontSize(8);
        doc.text(today, PW - MR, 8, { align: 'right' });

        y = 20;

        // SECTION: 전체 측정 이력 테이블
        secTitle(doc, ML, y, CW, '📋 전체 측정 이력');
        y += 9;

        const cols = ['날짜', '체중(kg)', '골격근(kg)', '체지방(kg)', '체지방%', 'BMI', '인바디'];
        const cws  = [26, 24, 26, 26, 22, 18, 20];
        const rh   = 8;

        sf(C.primary); doc.rect(ML, y, CW, rh, 'F');
        st(C.white); bold(); doc.setFontSize(8);
        let tx = ML + 2;
        cols.forEach((h, i) => { doc.text(h, tx, y + 5.5); tx += cws[i]; });
        y += rh;

        sorted.forEach((r, idx) => {
            const m = r.metrics;
            const isLast = idx === sorted.length - 1;
            sf(isLast ? [220, 242, 255] as RGB : idx % 2 === 0 ? C.white : C.bgLight);
            doc.rect(ML, y, CW, rh, 'F');
            sd(C.lightGray); doc.line(ML, y + rh, ML + CW, y + rh);
            const row = [m.date, fmt(m.weight), fmt(m.skeletalMuscle), fmt(m.bodyFatMass),
                         fmt(m.bodyFatPercent), fmt(m.bmi), fmt(m.inbodyScore, '', 0)];
            st(isLast ? C.primary : C.dark);
            isLast ? bold() : normal();
            doc.setFontSize(8);
            tx = ML + 2;
            row.forEach((v, i) => { doc.text(v, tx, y + 5.5); tx += cws[i]; });
            y += rh;
        });
        y += 8;

        // SECTION: 변화 요약
        if (sorted.length >= 2) {
            secTitle(doc, ML, y, CW, '🎯 기간 내 변화 요약');
            y += 9;
            const changes: [string, number | null | undefined, number | null | undefined, boolean][] = [
                ['체중', first.weight, latest.weight, false],
                ['골격근량', first.skeletalMuscle, latest.skeletalMuscle, true],
                ['체지방량', first.bodyFatMass, latest.bodyFatMass, false],
                ['체지방률', first.bodyFatPercent, latest.bodyFatPercent, false],
                ['인바디 점수', first.inbodyScore, latest.inbodyScore, true],
                ['기초대사량', first.basalMetabolicRate, latest.basalMetabolicRate, true],
            ].filter(([, f, l]) => f != null && l != null) as [string, number, number, boolean][];

            const cColW = (CW - 4) / 3;
            changes.forEach(([label, from, to, higherIsBetter], i) => {
                if (i > 0 && i % 3 === 0) y += 16;
                const cx = ML + (i % 3) * (cColW + 2);
                const d  = +((to as number) - (from as number)).toFixed(1);
                const isGood = higherIsBetter ? d >= 0 : d <= 0;
                const tc: RGB = d === 0 ? C.gray : isGood ? C.green : C.red;
                sf(C.bgLight); sd(C.lightGray);
                doc.roundedRect(cx, y, cColW, 14, 1.5, 1.5, 'FD');
                st(C.gray); normal(); doc.setFontSize(7.5);
                doc.text(label, cx + 3, y + 5);
                st(C.dark); bold(); doc.setFontSize(8.5);
                doc.text(`${from} → ${to}`, cx + 3, y + 10.5);
                st(tc); doc.setFontSize(8);
                doc.text(d > 0 ? `+${d}` : `${d}`, cx + cColW - 4, y + 10.5, { align: 'right' });
            });
            y += 20;
        }

        // SECTION: 건강 평가
        secTitle(doc, ML, y, CW, '🛡️ 건강 지표 평가');
        y += 9;
        const assess: [string, string, RGB][] = [];
        if (latest.bmi != null) {
            const b = latest.bmi;
            assess.push(['BMI', b < 18.5 ? '저체중' : b < 23 ? '정상' : b < 25 ? '과체중' : '비만',
                b < 23 ? C.green : b < 25 ? C.orange : C.red]);
        }
        if (latest.bodyFatPercent != null) {
            const b = latest.bodyFatPercent;
            assess.push(['체지방률', b < 10 ? '매우 낮음' : b < 20 ? '정상' : b < 25 ? '경계' : '높음',
                b < 20 ? C.green : b < 25 ? C.orange : C.red]);
        }
        if (latest.visceralFatLevel != null) {
            const v = latest.visceralFatLevel;
            assess.push(['내장지방', v <= 9 ? '정상' : v <= 14 ? '주의' : '위험',
                v <= 9 ? C.green : v <= 14 ? C.orange : C.red]);
        }
        if (latest.waistHipRatio != null) {
            const w = latest.waistHipRatio;
            assess.push(['허리/엉덩이', w < 0.85 ? '정상' : w < 0.90 ? '주의' : '위험',
                w < 0.85 ? C.green : w < 0.90 ? C.orange : C.red]);
        }
        const aColW = (CW - 6) / 4;
        assess.forEach(([label, status, color], i) => {
            const ax = ML + i * (aColW + 2);
            sf(C.bgLight); sd(C.lightGray);
            doc.roundedRect(ax, y, aColW, 14, 1.5, 1.5, 'FD');
            st(C.gray); normal(); doc.setFontSize(7.5);
            doc.text(label, ax + aColW / 2, y + 5, { align: 'center' });
            sf(color); doc.roundedRect(ax + 4, y + 7, aColW - 8, 5, 1, 1, 'F');
            st(C.white); bold(); doc.setFontSize(7.5);
            doc.text(status, ax + aColW / 2, y + 10.8, { align: 'center' });
        });

        // Footer p2
        sf(C.lightGray); doc.rect(0, PH - 12, PW, 12, 'F');
        st(C.gray); normal(); doc.setFontSize(7.5);
        doc.text('HealthLens AI  |  본 보고서는 참고용이며 의학적 진단을 대체하지 않습니다.  |  2 / 2', PW / 2, PH - 5, { align: 'center' });

        doc.save(`HealthLens_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
        console.error('PDF export failed:', err);
        alert('PDF 생성 실패: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
        loadingEl.remove();
    }
}

function secTitle(doc: any, x: number, y: number, w: number, text: string) {
    doc.setFillColor(15, 98, 154);
    doc.rect(x, y, 3, 6.5, 'F');
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(x + 4, y - 0.5, w - 4, 7.5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 98, 154);
    doc.text(text, x + 8, y + 5.2);
}

function drawMetCards(doc: any, x: number, y: number, cardW: number,
    cards: [string, string, string, boolean][]) {
    cards.forEach(([label, value, d, higherIsBetter], i) => {
        const cx = x + i * (cardW + 2);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(cx, y, cardW, 22, 2, 2, 'FD');
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text(label, cx + cardW / 2, y + 6, { align: 'center' });
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(value, cx + cardW / 2, y + 14, { align: 'center' });
        const dNum = parseFloat(d);
        let tc: RGB = [100, 116, 139];
        if (!isNaN(dNum) && dNum !== 0) {
            const isGood = higherIsBetter ? dNum > 0 : dNum < 0;
            tc = isGood ? [52, 211, 153] : [248, 113, 113];
        }
        doc.setTextColor(tc[0], tc[1], tc[2]);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text(d || '-', cx + cardW / 2, y + 20, { align: 'center' });
    });
}

function drawLineChart(doc: any, x: number, y: number, w: number, h: number,
    data: { date: string; weight?: number | null; muscle?: number | null; fat?: number | null }[]
): number {
    if (data.length < 2) return y + h;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, w, h, 2, 2, 'FD');

    const pad = { t: 6, b: 14, l: 18, r: 6 };
    const cw  = w - pad.l - pad.r;
    const ch  = h - pad.t - pad.b;
    const cx0 = x + pad.l;
    const cy0 = y + pad.t;

    const allVals = data.flatMap(d => [d.weight, d.muscle, d.fat]).filter((v): v is number => v != null);
    if (allVals.length === 0) return y + h;
    const minV = Math.floor(Math.min(...allVals) * 0.96);
    const maxV = Math.ceil(Math.max(...allVals) * 1.04);
    const range = maxV - minV || 1;

    // Grid
    doc.setLineWidth(0.2);
    for (let i = 0; i <= 4; i++) {
        const gy = cy0 + ch - (i / 4) * ch;
        doc.setDrawColor(226, 232, 240);
        doc.line(cx0, gy, cx0 + cw, gy);
        doc.setTextColor(148, 163, 184);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.5);
        doc.text(String((minV + (range * i) / 4).toFixed(0)), cx0 - 2, gy + 1, { align: 'right' });
    }

    // X labels
    const step = Math.max(1, Math.floor(data.length / 9));
    data.forEach((d, i) => {
        if (i % step !== 0 && i !== data.length - 1) return;
        const px = cx0 + (i / (data.length - 1)) * cw;
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(5.5);
        doc.text(d.date, px, cy0 + ch + 5, { align: 'center' });
    });

    const series: [string, RGB, string][] = [
        ['weight', [15, 98, 154],  '체중'],
        ['muscle', [52, 211, 153], '골격근량'],
        ['fat',    [248, 113, 113],'체지방량'],
    ];

    series.forEach(([key, color, label]) => {
        const pts = data.map((d, i) => {
            const v = (d as any)[key as string] as number | null | undefined;
            if (v == null) return null;
            return { px: cx0 + (i / (data.length - 1)) * cw, py: cy0 + ch - ((v - minV) / range) * ch };
        }).filter((p): p is { px: number; py: number } => p != null);
        if (pts.length < 2) return;
        doc.setDrawColor(color[0], color[1], color[2]);
        doc.setLineWidth(0.7);
        for (let i = 1; i < pts.length; i++) doc.line(pts[i-1].px, pts[i-1].py, pts[i].px, pts[i].py);
        pts.forEach(p => { doc.setFillColor(color[0], color[1], color[2]); doc.circle(p.px, p.py, 0.7, 'F'); });
    });

    // Legend
    let lx = cx0;
    series.forEach(([, color, label]) => {
        doc.setFillColor((color as RGB)[0], (color as RGB)[1], (color as RGB)[2]);
        doc.rect(lx, cy0 + ch + 8, 5, 2, 'F');
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.text(label as string, lx + 6, cy0 + ch + 9.5);
        lx += 28;
    });

    return y + h;
}
