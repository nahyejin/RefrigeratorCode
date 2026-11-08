import React from 'react';
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

/**
 * 레시피 「읽어 주기」의 소리 내기 — 2026-11-08.
 *
 * 왜 둘로 나뉘나:
 *   웹·아이폰 앱은 브라우저 내장 음성(`speechSynthesis`)으로 읽는다. 그런데 **안드로이드 앱의 웹뷰(WebView)에는
 *   `speechSynthesis` 가 없다**(크롬에는 있지만 앱에 담는 엔진에는 빠져 있다). 그래서 안드로이드에서는 버튼이 아예
 *   숨어 있었다. 안드로이드 폰 자체의 음성 엔진(TTS)을 부르는 플러그인
 *   `@capacitor-community/text-to-speech` 로 안드로이드만 따로 읽는다. 웹·아이폰은 예전 그대로다.
 *
 * 쓰는 법: `speakText(글, 속도)` 는 다 읽으면 끝나는 Promise, 실패하면 reject. `stopSpeech()` 로 멈춘다.
 *   멈춘 뒤 이전 Promise 는 끝나지 않을 수도 있다(안드로이드는 stop 때 콜백이 없다) — 부르는 쪽이 「몇 번째 읽기인가」로 거른다.
 */

const isAndroidApp = () => Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('TextToSpeech');

const hasWebSpeech = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/** 안드로이드에서 한국어 음성을 쓸 수 있는가 — 기기에 한국어 음성이 없으면 버튼을 숨긴다. null = 아직 모름. */
let androidKorean: boolean | null = null;
let androidCheck: Promise<boolean> | null = null;

function checkAndroidKorean(): Promise<boolean> {
  if (!androidCheck) {
    androidCheck = TextToSpeech.isLanguageSupported({ lang: 'ko-KR' })
      .then(r => !!r.supported)
      .catch(() => false)
      .then(ok => { androidKorean = ok; return ok; });
  }
  return androidCheck;
}

/** 지금 소리 내어 읽을 수 있는가(동기). 안드로이드는 확인이 끝나기 전에는 false. */
export function canSpeak(): boolean {
  if (isAndroidApp()) return androidKorean === true;
  return hasWebSpeech();
}

/** 화면에서 버튼을 보일지 정할 때 쓴다 — 안드로이드는 한국어 음성 확인이 끝나면 다시 그린다. */
export function useCanSpeak(): boolean {
  const [ok, setOk] = React.useState(canSpeak());
  React.useEffect(() => {
    if (!isAndroidApp() || androidKorean !== null) return;
    let alive = true;
    checkAndroidKorean().then(v => { if (alive) setOk(v); });
    return () => { alive = false; };
  }, []);
  return ok;
}

/** 한 덩어리를 읽는다. 다 읽으면 resolve, 실패하면 reject. `rate` 는 1 이 보통 속도. */
export function speakText(text: string, rate: number): Promise<void> {
  if (isAndroidApp()) {
    return TextToSpeech.speak({ text, lang: 'ko-KR', rate, pitch: 1, volume: 1 });
  }
  return new Promise((resolve, reject) => {
    if (!hasWebSpeech()) { reject(new Error('speech unsupported')); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    u.rate = rate;
    u.onend = () => resolve();
    u.onerror = e => reject(e);
    window.speechSynthesis.speak(u);
  });
}

/** 읽기를 멈춘다(읽는 중이 아니어도 괜찮다). */
export function stopSpeech(): void {
  if (isAndroidApp()) {
    TextToSpeech.stop().catch(() => {});
    return;
  }
  if (hasWebSpeech()) window.speechSynthesis.cancel();
}
