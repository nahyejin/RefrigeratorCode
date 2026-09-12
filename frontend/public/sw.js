// 배포할 때마다 이 값을 올려야 새 코드가 실제로 반영된다 — 아래 fetch 핸들러가
// HTML 문서를 "캐시 우선"으로 서빙해서, 값이 그대로면 activate 의 캐시 정리도
// 안 걸리고 사용자는 예전에 저장된 index.html(예전 빌드의 JS/CSS 경로를 가리킴)을
// 계속 받는다. 실제로 이것 때문에 여러 버그 수정을 배포해도 PWA로 설치했거나
// 예전에 한 번 방문한 사용자에게는 반영되지 않는 문제가 있었다.
const CACHE_NAME = 'cookmatch-v1.8.9';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/src/assets/cookmatch_icon.png',
  '/src/assets/open_loading_page.png',
  '/src/assets/navigator_myfridge_black.png',
  '/src/assets/navigator_search.png',
  '/src/assets/navigator_popularity_black.png'
];

// Install event - 캐시에 리소스 저장
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: Files cached');
        return self.skipWaiting();
      })
  );
});

// Activate event - 이전 캐시 정리
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activated');
      return self.clients.claim();
    })
  );
});

// Fetch event - 네트워크 우선, 캐시 폴백 전략
self.addEventListener('fetch', (event) => {
  // chrome-extension, moz-extension 등의 요청은 무시
  if (event.request.url.startsWith('chrome-extension://') || 
      event.request.url.startsWith('moz-extension://') ||
      event.request.url.startsWith('edge-extension://')) {
    return;
  }
  
  // API 요청은 네트워크 우선 (오프라인일 때만 폴백)
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // 성공적인 응답이면 그대로 반환
          if (response.ok) {
            return response;
          }
          // HTTP 에러가 있으면 오프라인 응답 반환
          throw new Error('API request failed');
        })
        .catch(() => {
          // 네트워크 오류나 HTTP 에러일 때만 오프라인 메시지
          return new Response(JSON.stringify({
            error: '오프라인 상태입니다. 인터넷 연결을 확인해주세요.'
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // HTML 문서(페이지 이동)는 네트워크 우선으로.
  // 캐시 우선으로 두면, index.html 이 한 번 캐시된 뒤로는 새로 배포해서 JS/CSS
  // 파일이 바뀌어도 브라우저가 계속 예전 index.html(예전 파일 경로를 가리킴)을
  // 받아서, 새 코드가 배포돼도 반영되지 않는 문제가 있었다(실제로 겪음).
  // 온라인이면 항상 최신 문서를, 오프라인일 때만 캐시로 폴백한다.
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // 그 외 정적 리소스(해시된 JS/CSS, 이미지 등)는 캐시 우선 — Vite가 파일명에
  // 콘텐츠 해시를 붙이므로 내용이 바뀌면 파일명도 바뀌어 안전하게 오래 캐시해도 된다.
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 캐시에서 찾으면 반환
        if (response) {
          return response;
        }

        // 캐시에 없으면 네트워크에서 가져오기
        return fetch(event.request)
          .then((response) => {
            // 유효한 응답이 아니면 그대로 반환
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // 응답을 복제하여 캐시에 저장
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // 오프라인 페이지 반환
            if (event.request.destination === 'document') {
              return caches.match('/');
            }
          });
      })
  );
});

// Background sync - 오프라인에서 수행된 작업을 온라인 복구 시 동기화
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

function doBackgroundSync() {
  // 백그라운드 동기화 로직
  console.log('Background sync triggered');
  return Promise.resolve();
}

// Push notification - 푸시 알림 처리
//
// 서버(scripts/send_expiry_push_notifications.py)는 JSON으로
// {title, body, url} 을 보낸다. 예전엔 이 핸들러가 그 문자열을 그대로
// body 에 넣어서 화면에 `{"title":...}` 처럼 날것이 보였을 것이다 — 실제로
// 한 번도 연결된 적 없는 미완성 코드였다(아이콘 경로도 `/src/assets/...`
// 였는데, 그건 빌드 산출물에 없는 개발 전용 경로다. `public/` 바로 밑의
// `/cookmatch_icon.png` 가 실제로 서빙되는 경로).
self.addEventListener('push', (event) => {
  let payload = { title: '쿡매치', body: '새 소식이 있어요.', url: '/' };
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  const options = {
    body: payload.body,
    icon: '/cookmatch_icon.png',
    badge: '/cookmatch_icon.png',
    vibrate: [100, 50, 100],
    data: { url: payload.url || '/' },
    tag: payload.tag || 'cookmatch-push', // 같은 종류 알림이 쌓이지 않게
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// Notification click - 알림 클릭 시 처리
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(clients.openWindow(url));
});