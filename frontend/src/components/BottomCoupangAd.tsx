import React, { useEffect, useState } from 'react';
import CoupangAd from './CoupangAd';
import CoupangDisclaimer from './CoupangDisclaimer';

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
    <div style={{ marginTop: 24, marginBottom: 24 }}>
      {/* 이 배너도 광고이므로 대가성 문구를 바로 위에 둔다.
          예전에는 페이지 맨 아래(또는 맨 위)에 페이지 단위로 한 번만 있었는데,
          광고가 없는 화면에서도 문구가 보여 서비스 전체가 광고처럼 읽혔다. */}
      <CoupangDisclaimer compact style={{ marginBottom: 8, textAlign: 'center' }} />
      <CoupangAd style={style} />
    </div>
  );
};

export default BottomCoupangAd;

