'use client';

export async function exportDashboardPDF() {
    // Dynamically import to avoid SSR issues
    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');

    const dashboard = document.querySelector('.animate-fadeIn') as HTMLElement;
    if (!dashboard) {
        alert('대시보드를 먼저 로드해주세요.');
        return;
    }

    // Show loading state
    const loadingEl = document.createElement('div');
    loadingEl.id = 'pdf-loading';
    loadingEl.style.cssText = `
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(0,0,0,0.7); display: flex;
        align-items: center; justify-content: center;
        color: white; font-size: 18px; font-weight: 600;
        backdrop-filter: blur(8px);
    `;
    loadingEl.textContent = 'PDF 리포트 생성 중...';
    document.body.appendChild(loadingEl);

    try {
        const canvas = await html2canvas(dashboard, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#0a0e1a',
            logging: false,
            windowWidth: 1200,
        });

        const imgWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        const pdf = new jsPDF('p', 'mm', 'a4');

        // Title
        pdf.setFontSize(20);
        pdf.setTextColor(56, 189, 248);
        pdf.text('HealthLens AI Report', 105, 15, { align: 'center' });
        pdf.setFontSize(10);
        pdf.setTextColor(148, 163, 184);
        pdf.text(`Generated: ${new Date().toLocaleDateString('ko-KR')} ${new Date().toLocaleTimeString('ko-KR')}`, 105, 22, { align: 'center' });

        const imgData = canvas.toDataURL('image/png');
        const yOffset = 28;

        if (imgHeight + yOffset <= pageHeight) {
            pdf.addImage(imgData, 'PNG', 0, yOffset, imgWidth, imgHeight);
        } else {
            // Multi-page
            let remainingHeight = imgHeight;
            let position = 0;
            let isFirst = true;

            while (remainingHeight > 0) {
                if (!isFirst) pdf.addPage();
                const sliceHeight = isFirst ? pageHeight - yOffset : pageHeight;
                pdf.addImage(imgData, 'PNG', 0, isFirst ? yOffset : 0, imgWidth, imgHeight, undefined, 'FAST', 0);
                remainingHeight -= sliceHeight;
                position += sliceHeight;
                isFirst = false;
            }
        }

        pdf.save(`HealthLens_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
        console.error('PDF export failed:', err);
        alert('PDF 생성에 실패했습니다.');
    } finally {
        document.getElementById('pdf-loading')?.remove();
    }
}
