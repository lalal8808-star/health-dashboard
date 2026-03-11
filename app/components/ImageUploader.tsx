'use client';

import { useState, useRef, useCallback } from 'react';
import { Image, X, FileImage, Loader2, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';
import { CSVParseResult } from '@/app/lib/csv-parser';

interface ImageUploaderProps {
    onAnalyze: (file: File) => void;
    onCSVImport: (file: File) => void;
    isAnalyzing: boolean;
    progress: number;
    progressMessage: string;
    csvResult: CSVParseResult | null;
}

type UploadMode = 'select' | 'image' | 'csv';

export default function ImageUploader({ onAnalyze, onCSVImport, isAnalyzing, progress, progressMessage, csvResult }: ImageUploaderProps) {
    const [dragActive, setDragActive] = useState(false);
    const [previewFile, setPreviewFile] = useState<{ file: File; url: string } | null>(null);
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [uploadMode, setUploadMode] = useState<UploadMode>('select');
    const imageInputRef = useRef<HTMLInputElement>(null);
    const csvInputRef = useRef<HTMLInputElement>(null);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        const file = e.dataTransfer.files?.[0];
        if (!file) return;

        if (file.name.endsWith('.csv') || file.type === 'text/csv') {
            setCsvFile(file);
            setUploadMode('csv');
        } else if (file.type.startsWith('image/')) {
            setPreviewFile({ file, url: URL.createObjectURL(file) });
            setUploadMode('image');
        }
    }, []);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPreviewFile({ file, url: URL.createObjectURL(file) });
            setUploadMode('image');
        }
    };

    const handleCSVSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setCsvFile(file);
            setUploadMode('csv');
        }
    };

    const handleAnalyze = () => {
        if (previewFile) {
            onAnalyze(previewFile.file);
        }
    };

    const handleCSVImport = () => {
        if (csvFile) {
            onCSVImport(csvFile);
        }
    };

    const clearFile = () => {
        setPreviewFile(null);
        setCsvFile(null);
        setUploadMode('select');
        if (imageInputRef.current) imageInputRef.current.value = '';
        if (csvInputRef.current) csvInputRef.current.value = '';
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
        <div className="upload-section">
            <h2 className="section-title">📄 건강 검진 결과 업로드</h2>
            <p className="section-subtitle">
                인바디(InBody) CSV 내보내기 파일 또는 결과지 사진을 업로드하면 자동으로 지표를 추출합니다.
            </p>

            {/* Upload Mode Selection & Drop Zone */}
            {uploadMode === 'select' && !isAnalyzing && !csvResult && (
                <>
                    {/* Combined Drop Zone */}
                    <div
                        className={`upload-area ${dragActive ? 'dragging' : ''}`}
                        onDragEnter={handleDrag}
                        onDragOver={handleDrag}
                        onDragLeave={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => { }} // no default click
                        style={{ cursor: 'default' }}
                    >
                        <div className="upload-area-icon">
                            <FileSpreadsheet size={48} color="#38bdf8" strokeWidth={1.5} />
                        </div>
                        <h3>파일을 드래그하거나 아래 버튼을 클릭하세요</h3>
                        <p>인바디 CSV 내보내기 파일 또는 결과지 이미지</p>
                        <div className="upload-area-formats">
                            <span className="upload-format-badge" style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)', borderColor: 'rgba(52, 211, 153, 0.2)' }}>CSV</span>
                            <span className="upload-format-badge">JPG</span>
                            <span className="upload-format-badge">PNG</span>
                            <span className="upload-format-badge">WEBP</span>
                            <span className="upload-format-badge">HEIC</span>
                        </div>

                        {/* Two Upload Buttons */}
                        <div style={{ display: 'flex', gap: '16px', marginTop: '28px', justifyContent: 'center' }}>
                            <button
                                className="btn btn-primary btn-lg"
                                onClick={(e) => { e.stopPropagation(); csvInputRef.current?.click(); }}
                                style={{ background: 'var(--gradient-green)', boxShadow: 'var(--shadow-glow-green)' }}
                            >
                                <FileSpreadsheet size={18} /> 인바디 CSV 업로드
                            </button>
                            <button
                                className="btn btn-secondary btn-lg"
                                onClick={(e) => { e.stopPropagation(); imageInputRef.current?.click(); }}
                            >
                                <FileImage size={18} /> 결과지 사진 업로드
                            </button>
                        </div>
                    </div>

                    <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />
                    <input ref={csvInputRef} type="file" accept=".csv,text/csv" onChange={handleCSVSelect} style={{ display: 'none' }} />
                </>
            )}

            {/* Image Preview */}
            {uploadMode === 'image' && previewFile && !isAnalyzing && (
                <div className="upload-preview animate-scaleIn">
                    <div className="upload-preview-card">
                        <img src={previewFile.url} alt="미리보기" className="upload-preview-image" />
                        <div className="upload-preview-info">
                            <div className="upload-preview-name">{previewFile.file.name}</div>
                            <div className="upload-preview-size">{formatFileSize(previewFile.file.size)}</div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                                <button className="btn btn-primary" onClick={handleAnalyze}>
                                    <Image size={16} /> AI 분석 시작
                                </button>
                                <button className="btn btn-secondary" onClick={clearFile}>
                                    <X size={16} /> 취소
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CSV Preview */}
            {uploadMode === 'csv' && csvFile && !isAnalyzing && !csvResult && (
                <div className="upload-preview animate-scaleIn">
                    <div className="upload-preview-card">
                        <div style={{
                            width: '120px',
                            height: '120px',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--accent-green-dim)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}>
                            <FileSpreadsheet size={48} color="var(--accent-green)" />
                        </div>
                        <div className="upload-preview-info">
                            <div className="upload-preview-name">{csvFile.name}</div>
                            <div className="upload-preview-size">{formatFileSize(csvFile.size)} · CSV 파일</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
                                인바디 내보내기 CSV 파일의 모든 기록을 한번에 가져옵니다.
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                                <button className="btn btn-primary" onClick={handleCSVImport} style={{ background: 'var(--gradient-green)', boxShadow: 'var(--shadow-glow-green)' }}>
                                    <FileSpreadsheet size={16} /> CSV 데이터 가져오기
                                </button>
                                <button className="btn btn-secondary" onClick={clearFile}>
                                    <X size={16} /> 취소
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CSV Import Result */}
            {csvResult && !isAnalyzing && (
                <div className="analysis-result animate-slideUp">
                    <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
                        {csvResult.success ? (
                            <>
                                <CheckCircle2 size={56} color="var(--accent-green)" style={{ marginBottom: '16px' }} />
                                <h3 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>
                                    CSV 데이터를 성공적으로 가져왔습니다!
                                </h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '15px', marginBottom: '24px' }}>
                                    총 <strong style={{ color: 'var(--accent-green)' }}>{csvResult.parsedRows}개</strong>의 측정 기록을 가져왔습니다.
                                    {csvResult.errors.length > 0 && (
                                        <span style={{ color: 'var(--accent-orange)', display: 'block', marginTop: '4px' }}>
                                            ({csvResult.errors.length}개 행에서 경고 발생)
                                        </span>
                                    )}
                                </p>
                                <button className="btn btn-primary btn-lg" onClick={clearFile}>
                                    대시보드에서 확인하기
                                </button>
                            </>
                        ) : (
                            <>
                                <AlertCircle size={56} color="var(--accent-red)" style={{ marginBottom: '16px' }} />
                                <h3 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>
                                    CSV 파싱에 실패했습니다
                                </h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '15px', marginBottom: '16px' }}>
                                    {csvResult.errors.map((err, i) => (
                                        <span key={i} style={{ display: 'block', marginBottom: '4px' }}>{err}</span>
                                    ))}
                                </p>
                                <button className="btn btn-secondary" onClick={clearFile}>
                                    다시 시도
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Analyzing Spinner */}
            {isAnalyzing && (
                <div className="loading-overlay animate-fadeIn">
                    <Loader2 size={40} style={{ color: 'var(--accent-blue)', animation: 'spin 1s linear infinite' }} />
                    <div className="loading-text">{progressMessage}</div>
                    <div className="progress-bar-container" style={{ width: '100%', maxWidth: '400px' }}>
                        <div className="progress-bar-header">
                            <span className="progress-bar-label">분석 진행중...</span>
                            <span className="progress-bar-value">{progress}%</span>
                        </div>
                        <div className="progress-bar-track">
                            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
