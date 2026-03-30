'use client';

/**
 * 이미지 파일을 압축해 Blob으로 반환
 * - 최대 1200px 리사이즈
 * - JPEG 85% 품질
 * - Gemini API는 최대 4MB base64를 권장 → 일반 사진 5MB → ~300KB로 절감
 */
export function compressImage(file: File, maxPx = 1200, quality = 0.85): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(
                blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
                'image/jpeg',
                quality
            );
        };
        img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')); };
        img.src = objectUrl;
    });
}
