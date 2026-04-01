const CACHE_NAME = 'healthlens-v3';

// 오프라인 대응용 페이지만 캐시 (JS/CSS는 Vercel CDN이 처리)
const OFFLINE_URLS = ['/'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // 이전 버전 캐시 전부 삭제 (v1, v2 포함)
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

    // API 요청: 항상 네트워크 우선
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request).catch(() => caches.match(request))
        );
        return;
    }

    // Next.js JS/CSS 번들: 항상 네트워크 우선 (캐시하면 구버전 코드 실행 위험)
    if (url.pathname.startsWith('/_next/')) {
        event.respondWith(fetch(request));
        return;
    }

    // HTML 페이지: 네트워크 우선, 실패 시 캐시 (오프라인 대응)
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() => caches.match('/'))
        );
        return;
    }

    // 아이콘 등 기타 정적 파일: 캐시 우선
    event.respondWith(
        caches.match(request).then((cached) =>
            cached || fetch(request)
        )
    );
});
