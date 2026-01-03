import React, { useEffect, useState } from 'react';
import CoupangAd from './CoupangAd';

/**
 * 페이지 맨 끝에 도달했을 때만 표시되는 쿠팡 광고 컴포넌트
 * 모든 페이지 하단에 동일하게 사용
 */
const BottomCoupangAd: React.FC<{
  /** 광고를 표시할 조건 (예: 로딩 중이 아니고 데이터가 있을 때) */
  showCondition?: boolean;
  /** 추가 스타일 */
  style?: React.CSSProperties;
}> = ({ 
  showCondition = true,
  style 
}) => {
  const [showAd, setShowAd] = useState(false);

  // 스크롤 감지 - 페이지 맨 끝에 도달했는지 확인
  useEffect(() => {
    const handleScroll = () => {
      // 스크롤 위치와 페이지 높이 확인
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      // 페이지 맨 끝에 도달했는지 확인 (50px 여유)
      const isAtBottom = scrollTop + windowHeight >= documentHeight - 50;
      
      if (isAtBottom && showCondition) {
        setShowAd(true);
      }
    };

    window.addEventListener('scroll', handleScroll);
    // 초기 로드 시에도 체크
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [showCondition]);

  // 조건을 만족하고 페이지 맨 끝에 도달했을 때만 광고 표시
  if (!showAd || !showCondition) {
    return null;
  }

  return (
    <CoupangAd 
      style={{ 
        marginTop: '24px',
        marginBottom: '24px',
        ...style
      }} 
    />
  );
};

export default BottomCoupangAd;

