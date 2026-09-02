// PWA 설치 상태 확인
export const isPWAInstalled = (): boolean => {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true;
};

/**
 * 앱(Capacitor) 안에서 도는 중인가.
 *
 * Capacitor 가 전역을 심어 주므로 패키지를 가져오지 않고 확인한다 —
 * 웹 번들에 앱 전용 코드를 끌어들이지 않기 위해서다.
 */
export const isNativeApp = (): boolean => {
  const cap = (window as any).Capacitor;
  return typeof cap?.isNativePlatform === 'function' ? !!cap.isNativePlatform() : false;
};

// 서비스 워커 등록
export const registerServiceWorker = async (): Promise<void> => {
  // 앱에서는 등록하지 않는다.
  //
  // 앱은 화면 파일을 이미 기기 안에 들고 있어서 캐시가 필요 없다. 그런데
  // 서비스워커가 그 위에 또 캐시를 얹으면, **앱을 새 버전으로 갱신해도
  // 옛 화면이 계속 뜬다.** 스토어 심사를 통과한 새 버전이 사용자에게는
  // 반영 안 되는, 알아채기도 어려운 상태가 된다.
  if (isNativeApp()) return;

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered successfully:', registration);
      
      // 업데이트 확인
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // 새로운 버전이 설치됨
              showUpdateNotification();
            }
          });
        }
      });
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }
};

// PWA 설치 프롬프트 표시
export const showInstallPrompt = (): void => {
  const deferredPrompt = (window as any).deferredPrompt;
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult: any) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      (window as any).deferredPrompt = null;
    });
  }
};

// 업데이트 알림 표시
const showUpdateNotification = (): void => {
  if (confirm('쿡매치 앱의 새로운 버전이 준비되었습니다. 업데이트하시겠습니까?')) {
    window.location.reload();
  }
};

// 푸시 알림 권한 요청
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

// 푸시 알림 보내기
export const sendNotification = (title: string, options?: NotificationOptions): void => {
  if (Notification.permission === 'granted') {
    new Notification(title, {
      icon: '/src/assets/cookmatch_icon.png',
      badge: '/src/assets/cookmatch_icon.png',
      ...options
    });
  }
};

// 오프라인 상태 확인
export const isOnline = (): boolean => {
  return navigator.onLine;
};

// 오프라인 상태 변경 이벤트 리스너
export const addOnlineStatusListener = (callback: (isOnline: boolean) => void): void => {
  window.addEventListener('online', () => callback(true));
  window.addEventListener('offline', () => callback(false));
};

// PWA 설치 가능 여부 확인
export const canInstallPWA = (): boolean => {
  return !isPWAInstalled() && 'serviceWorker' in navigator;
};

// 앱 설치 이벤트 리스너 설정
export const setupInstallListener = (): void => {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    (window as any).deferredPrompt = e;
    
    // 설치 버튼 표시 로직을 여기에 추가할 수 있습니다
    console.log('PWA install prompt ready');
  });
};

// 앱 설치 완료 이벤트 리스너
export const setupAppInstalledListener = (): void => {
  window.addEventListener('appinstalled', () => {
    console.log('PWA was installed');
    // 설치 완료 후 처리 로직
  });
}; 