import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cookmatch.app',
  appName: '쿡매치',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    // 개발 중에는 localhost 사용 가능
    // url: 'http://localhost:5178',
    // cleartext: true
  },
  ios: {
    // 상태바(시계·배터리)와 홈 인디케이터 영역을 피해서 웹뷰를 그린다. 이게 없으면
    // 고정 헤더(GNB)가 상태바 밑에 깔려서 로그아웃 같은 버튼이 눌리지 않는다.
    // (맥 Xcode 시뮬레이터에서 확인하며 찾은 값 — 안드로이드·웹에는 영향 없음)
    contentInset: 'always',
    backgroundColor: '#FFFFFF'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#FFD600',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      iosSpinnerStyle: 'small',
      spinnerColor: '#FFD600'
    },
    PushNotifications: {
      // iOS: 앱을 보고 있는 중에 온 알림도 배너·소리로 띄운다(기본값은 아무것도 안 보임)
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;



