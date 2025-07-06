const CACHE_NAME = 'cookmatch-v1.0.0';
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

  // 정적 리소스는 캐시 우선
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
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : '새로운 레시피가 추가되었습니다!',
    icon: '/src/assets/cookmatch_icon.png',
    badge: '/src/assets/cookmatch_icon.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: '레시피 보기',
        icon: '/src/assets/navigator_search.png'
      },
      {
        action: 'close',
        title: '닫기',
        icon: '/src/assets/done.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('쿡매치', options)
  );
});

// Notification click - 알림 클릭 시 처리
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
}); 