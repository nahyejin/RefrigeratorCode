import React, { useState, useEffect } from 'react';
import { isPWAInstalled, canInstallPWA } from '../utils/pwa';
import PWAInstallButton from './PWAInstallButton';

const PWAInstallSection: React.FC = () => {
  const [isInstalled, setIsInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    setIsInstalled(isPWAInstalled());
    setCanInstall(canInstallPWA() && !isPWAInstalled());
  }, []);

  if (isInstalled) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center">
          <svg 
            className="w-5 h-5 text-green-600 mr-2" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M5 13l4 4L19 7" 
            />
          </svg>
          <div>
            <h3 className="text-sm font-medium text-green-800">
              쿡매치 앱이 설치되어 있습니다
            </h3>
            <p className="text-xs text-green-600 mt-1">
              홈화면에서 앱을 실행할 수 있습니다
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!canInstall) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center">
          <svg 
            className="w-5 h-5 text-gray-600 mr-2" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
          <div>
            <h3 className="text-sm font-medium text-gray-800">
              앱 설치가 불가능합니다
            </h3>
            <p className="text-xs text-gray-600 mt-1">
              HTTPS 연결이 필요하거나 브라우저가 지원하지 않습니다
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start">
          <img 
            src="/src/assets/cookmatch_icon.png" 
            alt="쿡매치" 
            className="w-12 h-12 rounded-lg mr-3"
          />
          <div>
            <h3 className="text-sm font-medium text-yellow-800">
              쿡매치 앱 설치
            </h3>
            <p className="text-xs text-yellow-600 mt-1">
              홈화면에 추가하여 더 빠르게 접근하세요
            </p>
            <ul className="text-xs text-yellow-600 mt-2 space-y-1">
              <li>• 오프라인에서도 사용 가능</li>
              <li>• 푸시 알림으로 새로운 레시피 알림</li>
              <li>• 앱과 같은 사용자 경험</li>
            </ul>
          </div>
        </div>
        <PWAInstallButton className="ml-4">
          설치하기
        </PWAInstallButton>
      </div>
    </div>
  );
};

export default PWAInstallSection; 