import React, { useState, useEffect } from 'react';
import { 
  isPWAInstalled, 
  canInstallPWA, 
  showInstallPrompt, 
  requestNotificationPermission,
  sendNotification,
  isOnline
} from '../utils/pwa';

const PWATestPage: React.FC = () => {
  const [pwaInstalled, setPwaInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [online, setOnline] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState('default');

  useEffect(() => {
    setPwaInstalled(isPWAInstalled());
    setCanInstall(canInstallPWA());
    setOnline(isOnline());
    setNotificationPermission(Notification.permission);

    const handleOnlineStatusChange = () => {
      setOnline(isOnline());
    };

    window.addEventListener('online', handleOnlineStatusChange);
    window.addEventListener('offline', handleOnlineStatusChange);

    return () => {
      window.removeEventListener('online', handleOnlineStatusChange);
      window.removeEventListener('offline', handleOnlineStatusChange);
    };
  }, []);

  const handleInstall = () => {
    showInstallPrompt();
  };

  const handleRequestNotification = async () => {
    const granted = await requestNotificationPermission();
    setNotificationPermission(Notification.permission);
    if (granted) {
      sendNotification('쿡매치', {
        body: '알림 권한이 허용되었습니다!',
        icon: '/src/assets/cookmatch_icon.png'
      });
    }
  };

  const handleTestNotification = () => {
    sendNotification('쿡매치 테스트', {
      body: '이것은 테스트 알림입니다!',
      icon: '/src/assets/cookmatch_icon.png'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
          PWA 테스트 페이지
        </h1>

        <div className="space-y-4">
          {/* PWA 설치 상태 */}
          <div className="p-4 bg-blue-50 rounded-lg">
            <h2 className="font-semibold text-blue-800 mb-2">PWA 설치 상태</h2>
            <p className="text-sm text-blue-600">
              {pwaInstalled ? '✅ PWA가 설치되어 있습니다' : '❌ PWA가 설치되지 않았습니다'}
            </p>
          </div>

          {/* 설치 가능 여부 */}
          <div className="p-4 bg-green-50 rounded-lg">
            <h2 className="font-semibold text-green-800 mb-2">설치 가능 여부</h2>
            <p className="text-sm text-green-600">
              {canInstall ? '✅ PWA를 설치할 수 있습니다' : '❌ PWA를 설치할 수 없습니다'}
            </p>
            {canInstall && (
              <button
                onClick={handleInstall}
                className="mt-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
              >
                앱 설치하기
              </button>
            )}
          </div>

          {/* 온라인 상태 */}
          <div className={`p-4 rounded-lg ${online ? 'bg-green-50' : 'bg-red-50'}`}>
            <h2 className={`font-semibold mb-2 ${online ? 'text-green-800' : 'text-red-800'}`}>
              네트워크 상태
            </h2>
            <p className={`text-sm ${online ? 'text-green-600' : 'text-red-600'}`}>
              {online ? '✅ 온라인' : '❌ 오프라인'}
            </p>
          </div>

          {/* 알림 권한 */}
          <div className="p-4 bg-yellow-50 rounded-lg">
            <h2 className="font-semibold text-yellow-800 mb-2">알림 권한</h2>
            <p className="text-sm text-yellow-600 mb-2">
              현재 상태: {notificationPermission}
            </p>
            {notificationPermission === 'default' && (
              <button
                onClick={handleRequestNotification}
                className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors"
              >
                알림 권한 요청
              </button>
            )}
            {notificationPermission === 'granted' && (
              <button
                onClick={handleTestNotification}
                className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors"
              >
                테스트 알림 보내기
              </button>
            )}
          </div>

          {/* PWA 기능 설명 */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h2 className="font-semibold text-gray-800 mb-2">PWA 기능</h2>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• 홈화면에 앱 아이콘 추가</li>
              <li>• 오프라인에서도 기본 기능 사용</li>
              <li>• 푸시 알림 지원</li>
              <li>• 앱과 같은 사용자 경험</li>
              <li>• 자동 업데이트</li>
            </ul>
          </div>

          {/* 설치 가이드 */}
          <div className="p-4 bg-purple-50 rounded-lg">
            <h2 className="font-semibold text-purple-800 mb-2">설치 방법</h2>
            <div className="text-sm text-purple-600 space-y-2">
              <p><strong>Chrome/Edge:</strong> 주소창 옆 설치 아이콘 클릭</p>
              <p><strong>Safari:</strong> 공유 버튼 → 홈 화면에 추가</p>
              <p><strong>Android:</strong> 브라우저 메뉴 → 홈 화면에 추가</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PWATestPage; 