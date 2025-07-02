import React, { useState, useEffect } from 'react';
import { isOnline, addOnlineStatusListener } from '../utils/pwa';

const OfflineIndicator: React.FC = () => {
  const [online, setOnline] = useState(isOnline());

  useEffect(() => {
    addOnlineStatusListener(setOnline);
  }, []);

  if (online) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 bg-red-500 text-white text-center py-2 px-4 z-50">
      <div className="flex items-center justify-center space-x-2">
        <svg 
          className="w-4 h-4" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" 
          />
        </svg>
        <span className="text-sm font-medium">
          오프라인 상태입니다. 일부 기능이 제한될 수 있습니다.
        </span>
      </div>
    </div>
  );
};

export default OfflineIndicator; 