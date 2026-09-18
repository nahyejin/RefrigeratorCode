import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { NATIVE_PUSH_ENABLED, EXPIRY_CHANNEL_ID, refreshNativePushToken } from '../utils/push';

/**
 * 네이티브 앱(안드로이드/iOS) 푸시의 "앱 쪽 배선" — 화면은 없다.
 *
 *  1) 안드로이드 8+ 알림 채널을 만든다. 채널이 없으면 FCM 알림이 "기타" 채널로
 *     떨어져서, 사용자가 휴대폰 설정에서 "유통기한 임박 알림"만 골라 끄거나 켤 수 없다.
 *  2) 알림을 눌러 앱이 열리면 알림에 실린 경로(`data.url`, 예: `/my-fridge`)로 보낸다.
 *     웹 푸시에서 `public/sw.js`가 하던 일(알림 클릭 → 해당 화면)의 네이티브판.
 *  3) 앱을 켤 때마다 푸시 토큰을 갱신해 서버에 다시 등록한다(`refreshNativePushToken`
 *     주석 참고 — 토큰은 조용히 바뀔 수 있다).
 *
 * 라우터 안(AppRouter)에 한 번만 둔다 — `useNavigate`가 필요해서.
 * 웹이거나 네이티브 푸시가 아직 꺼져 있으면(`NATIVE_PUSH_ENABLED`) 아무것도 안 한다.
 */
const NativePushBridge: React.FC = () => {
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!Capacitor.isNativePlatform() || !NATIVE_PUSH_ENABLED) return;

    if (Capacitor.getPlatform() === 'android') {
      PushNotifications.createChannel({
        id: EXPIRY_CHANNEL_ID,
        name: '유통기한 임박 알림',
        description: '냉장고 재료가 곧 상할 때 알려드려요',
        importance: 4, // 기본 알림음 + 상단 표시
      }).catch(() => {});
    }

    let removed = false;
    let remove: (() => void) | null = null;
    PushNotifications.addListener('pushNotificationActionPerformed', action => {
      const url = action.notification?.data?.url;
      // 앱 안의 경로만 따라간다 — 외부 주소가 실려 와도 무시
      if (typeof url === 'string' && url.startsWith('/')) navigate(url);
    }).then(handle => {
      if (removed) handle.remove();
      else remove = () => handle.remove();
    });

    refreshNativePushToken();

    return () => {
      removed = true;
      remove?.();
    };
  }, [navigate]);

  return null;
};

export default NativePushBridge;
