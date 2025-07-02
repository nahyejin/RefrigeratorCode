// PWA 성능 및 사용자 행동 분석

// Google Analytics 타입 선언
declare global {
  interface Window {
    gtag?: (command: string, eventName: string, parameters?: any) => void;
  }
}

interface PWAMetrics {
  installTime?: number;
  firstLoadTime: number;
  cacheHitRate: number;
  offlineUsage: number;
  notificationClicks: number;
}

class PWAAnalytics {
  private metrics: PWAMetrics = {
    firstLoadTime: 0,
    cacheHitRate: 0,
    offlineUsage: 0,
    notificationClicks: 0
  };

  constructor() {
    this.initializeMetrics();
    this.trackPerformance();
    this.trackUserBehavior();
  }

  private initializeMetrics(): void {
    // 로컬 스토리지에서 기존 메트릭 로드
    const savedMetrics = localStorage.getItem('pwa-metrics');
    if (savedMetrics) {
      this.metrics = { ...this.metrics, ...JSON.parse(savedMetrics) };
    }

    // 첫 로드 시간 측정
    if (performance.timing) {
      this.metrics.firstLoadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
    }
  }

  private trackPerformance(): void {
    // 캐시 히트율 추적
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'CACHE_HIT') {
          this.metrics.cacheHitRate++;
          this.saveMetrics();
        }
      });
    }

    // 오프라인 사용 추적
    window.addEventListener('offline', () => {
      this.metrics.offlineUsage++;
      this.saveMetrics();
    });
  }

  private trackUserBehavior(): void {
    // PWA 설치 추적
    window.addEventListener('appinstalled', () => {
      this.metrics.installTime = Date.now();
      this.saveMetrics();
      this.sendAnalytics('pwa_installed');
    });

    // 알림 클릭 추적
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
          this.metrics.notificationClicks++;
          this.saveMetrics();
          this.sendAnalytics('notification_clicked');
        }
      });
    }
  }

  private saveMetrics(): void {
    localStorage.setItem('pwa-metrics', JSON.stringify(this.metrics));
  }

  private sendAnalytics(event: string, data?: any): void {
    // 실제 분석 서비스로 데이터 전송
    console.log('PWA Analytics:', event, data);
    
    // Google Analytics 4 예시
    if (typeof window.gtag !== 'undefined') {
      window.gtag('event', event, {
        event_category: 'PWA',
        event_label: 'CookMatch',
        ...data
      });
    }
  }

  // 성능 메트릭 가져오기
  public getMetrics(): PWAMetrics {
    return { ...this.metrics };
  }

  // 캐시 효율성 측정
  public measureCacheEfficiency(): number {
    const totalRequests = this.metrics.cacheHitRate + 1; // 최소 1
    return (this.metrics.cacheHitRate / totalRequests) * 100;
  }

  // 사용자 참여도 측정
  public measureEngagement(): number {
    const factors = [
      this.metrics.offlineUsage > 0 ? 1 : 0,
      this.metrics.notificationClicks > 0 ? 1 : 0,
      this.metrics.installTime ? 1 : 0
    ];
    return (factors.reduce((a, b) => a + b, 0) / factors.length) * 100;
  }

  // 성능 리포트 생성
  public generateReport(): object {
    return {
      metrics: this.metrics,
      cacheEfficiency: this.measureCacheEfficiency(),
      engagement: this.measureEngagement(),
      timestamp: Date.now()
    };
  }

  // 사용자 행동 이벤트 추적
  public trackEvent(eventName: string, properties?: object): void {
    this.sendAnalytics(eventName, properties);
  }

  // 오류 추적
  public trackError(error: Error, context?: string): void {
    this.sendAnalytics('pwa_error', {
      error: error.message,
      stack: error.stack,
      context
    });
  }
}

// 싱글톤 인스턴스 생성
export const pwaAnalytics = new PWAAnalytics();

// 성능 모니터링 함수들
export const trackPWAPerformance = () => {
  // Core Web Vitals 측정
  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'largest-contentful-paint') {
          pwaAnalytics.trackEvent('lcp', { value: entry.startTime });
        }
        if (entry.entryType === 'first-input') {
          const firstInputEntry = entry as PerformanceEventTiming;
          pwaAnalytics.trackEvent('fid', { value: firstInputEntry.processingStart - firstInputEntry.startTime });
        }
        if (entry.entryType === 'layout-shift') {
          const layoutShiftEntry = entry as any;
          pwaAnalytics.trackEvent('cls', { value: layoutShiftEntry.value });
        }
      }
    });

    observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
  }
};

// 오프라인 사용 추적
export const trackOfflineUsage = () => {
  let offlineStartTime: number | null = null;

  window.addEventListener('offline', () => {
    offlineStartTime = Date.now();
    pwaAnalytics.trackEvent('offline_start');
  });

  window.addEventListener('online', () => {
    if (offlineStartTime) {
      const offlineDuration = Date.now() - offlineStartTime;
      pwaAnalytics.trackEvent('offline_end', { duration: offlineDuration });
      offlineStartTime = null;
    }
  });
};

// 서비스 워커 성능 추적
export const trackServiceWorkerPerformance = () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'PERFORMANCE') {
        pwaAnalytics.trackEvent('sw_performance', event.data.metrics);
      }
    });
  }
}; 