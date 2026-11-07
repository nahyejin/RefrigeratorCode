import { Capacitor, registerPlugin } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

/**
 * 스플래시(SplashScreen.tsx) 동안 상태바·홈 인디케이터(내비게이션 바) 영역까지 노랑 #FFD600 으로 맞춘다.
 *
 * 앱 화면(웹뷰)은 그 영역을 피해 그려져서(iOS capacitor.config.ts 의 contentInset 'always', 안드로이드 15+ 의 시스템 바 여백)
 * 웹이 칠할 수 없고 네이티브가 칠해야 한다 — iOS 는 SceneDelegate.swift 의 SafeAreaCovers, 안드로이드는 BarTintPlugin.java.
 * 끝나면(active=false) 원래 모습(상태바 영역 흰색)으로 돌아가므로 스플래시 뒤 앱 화면은 그대로다.
 * 웹 브라우저(개발·PWA)에서는 아무 일도 하지 않는다. 2026-11-08.
 */
interface BarTintPlugin {
  setSplash(options: { active: boolean }): Promise<void>;
}

const BarTint = registerPlugin<BarTintPlugin>('BarTint');

export async function setSplashBars(active: boolean): Promise<void> {
  const platform = Capacitor.getPlatform();
  if (platform !== 'ios' && platform !== 'android') return;
  try {
    // 노랑 위에서는 시계·배터리가 어두운 색(Style.Light = 밝은 배경용)이어야 읽힌다. 끝나면 기기 기본으로.
    await StatusBar.setStyle({ style: active ? Style.Light : Style.Default });
  } catch {
    // 상태바 글자색은 장식이다 — 실패해도 계속
  }
  try {
    await BarTint.setSplash({ active });
  } catch {
    // 옛 네이티브 빌드(플러그인 없음)에서도 앱은 정상 동작
  }
}
