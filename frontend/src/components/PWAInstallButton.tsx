import React, { useState, useEffect } from 'react';
import { canInstallPWA, showInstallPrompt, isPWAInstalled } from '../utils/pwa';

interface PWAInstallButtonProps {
  className?: string;
  children?: React.ReactNode;
}

const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ 
  className = "", 
  children = "앱 설치하기" 
}) => {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    setIsInstalled(isPWAInstalled());
    setCanInstall(canInstallPWA() && !isPWAInstalled());

    const handleBeforeInstallPrompt = () => {
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = () => {
    showInstallPrompt();
  };

  // 이미 설치되었거나 설치할 수 없는 경우 버튼 숨김
  if (isInstalled || !canInstall) {
    return null;
  }

  return (
    <button
      onClick={handleInstall}
      className={`inline-flex items-center px-4 py-2 bg-yellow-400 text-black font-medium rounded-lg hover:bg-yellow-500 transition-colors ${className}`}
    >
      <svg 
        className="w-4 h-4 mr-2" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" 
        />
      </svg>
      {children}
    </button>
  );
};

export default PWAInstallButton; 