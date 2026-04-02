const CACHE_NAME = 'healthlens-v4';

// 오프라인 대응용 페이지만 캐시 (JS/CSS/이미지는 Vercel CDN이 처리)
const OFFLINE_URLS = ['/'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // 이전 버전 캐시 전부 삭제 (v1~v3 포함)
    event.waitUntil(
        caches.keys().then((names) =>
            Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // API 요청: 항상 네트워크 직접 통과 (SW 개입 안 함)
    if (url.pathname.startsWith('/api/')) {
        return; // SW가 가로채지 않음 → 브라우저 기본 동작
    }

    // /_next/static/ 번들: SW 개입 안 함 → Vercel CDN이 처리
    // 구버전 JS 캐시 문제 완전 차단
    if (url.pathname.startsWith('/_next/')) {
        return; // SW가 가로채지 않음
    }

    // HTML 페이지: 네트워크 우선, 실패 시 오프라인 폴백
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() => caches.match('/'))
        );
        return;
    }

    // 아이콘 등 기타 정적 파일(/public): 캐시 우선
    event.respondWith(
        caches.match(request).then((cached) =>
            cached || fetch(request).then((response) => {
                if (response.ok) {
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
                }
                return response;
            })
        )
    );
});
