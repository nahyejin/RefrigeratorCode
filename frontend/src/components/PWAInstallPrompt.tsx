import React, { useState, useEffect } from 'react';
import { canInstallPWA, showInstallPrompt, isPWAInstalled } from '../utils/pwa';

const PWAInstallPrompt: React.FC = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // PWA 설치 상태 확인
    setIsInstalled(isPWAInstalled());
    
    // 이미 설치되었으면 프롬프트 표시하지 않음
    if (isPWAInstalled()) {
      return;
    }

    // 설치 가능 여부 확인
    const checkInstallable = () => {
      if (canInstallPWA() && !isPWAInstalled()) {
        // 사용자가 이전에 거부했는지 확인
        const dismissedTime = localStorage.getItem('pwa-prompt-dismissed');
        const hasDismissedRecently = dismissedTime && 
          (Date.now() - parseInt(dismissedTime)) < 24 * 60 * 60 * 1000; // 24시간

        if (!hasDismissedRecently) {
          setShowPrompt(true);
        }
      }
    };

    // 초기 확인
    checkInstallable();

    // beforeinstallprompt 이벤트 리스너
    const handleBeforeInstallPrompt = () => {
      const dismissedTime = localStorage.getItem('pwa-prompt-dismissed');
      const hasDismissedRecently = dismissedTime && 
        (Date.now() - parseInt(dismissedTime)) < 24 * 60 * 60 * 1000;

      if (!hasDismissedRecently) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = () => {
    showInstallPrompt();
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // 24시간 동안 다시 표시하지 않음
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  };

  // 이미 설치되었거나 프롬프트를 닫은 경우 표시하지 않음
  if (isInstalled || !showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50">
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0">
          <img 
            src="/src/assets/cookmatch_icon.png" 
            alt="쿡매치" 
            className="w-12 h-12 rounded-lg"
          />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900">
            쿡매치 앱 설치
          </h3>
          <p className="text-xs text-gray-600 mt-1">
            홈화면에 추가하여 더 빠르게 접근하세요
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleInstall}
            className="px-3 py-1 bg-yellow-400 text-black text-xs font-medium rounded-md hover:bg-yellow-500 transition-colors"
          >
            설치
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-1 text-gray-500 text-xs hover:text-gray-700 transition-colors"
          >
            나중에
          </button>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt; 