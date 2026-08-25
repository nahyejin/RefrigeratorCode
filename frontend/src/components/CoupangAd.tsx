import React, { useEffect, useRef } from 'react';

interface CoupangAdProps {
  /** 광고 단위 ID (쿠팡 파트너스에서 발급받은 ID) */
  adUnitId?: string;
  /** 광고 스타일 */
  style?: React.CSSProperties;
  /** 광고 클래스명 */
  className?: string;
}

/**
 * 쿠팡 파트너스 광고 컴포넌트
 * 
 * 사용 방법:
 * 1. 쿠팡 파트너스 계정 생성 및 광고 단위 생성
 * 2. 환경변수에 COUPANG_AD_UNIT_ID 설정
 * 3. 컴포넌트 사용: <CoupangAd />
 */
const CoupangAd: React.FC<CoupangAdProps> = ({ 
  adUnitId,
  style,
  className = ''
}) => {
  const adRef = useRef<HTMLDivElement>(null);
  const scriptLoaded = useRef(false);

  // 환경변수에서 광고 ID 가져오기 (없으면 기본값 사용)
  const finalAdUnitId = adUnitId || import.meta.env.VITE_COUPANG_AD_UNIT_ID || '';

  useEffect(() => {
    if (!finalAdUnitId || scriptLoaded.current) {
      return;
    }

    // 쿠팡 파트너스 스크립트 로드
    const loadCoupangScript = () => {
      if (document.getElementById('coupang-partner-script')) {
        scriptLoaded.current = true;
        return;
      }

      const script = document.createElement('script');
      script.id = 'coupang-partner-script';
      script.src = 'https://ads-partners.coupang.com/g.js';
      script.async = true;
      script.setAttribute('data-partner', finalAdUnitId);
      
      script.onload = () => {
        scriptLoaded.current = true;
        console.log('[CoupangAd] 스크립트 로드 완료');
      };

      script.onerror = () => {
        console.error('[CoupangAd] 스크립트 로드 실패');
      };

      document.head.appendChild(script);
    };

    loadCoupangScript();

    // 광고 영역에 광고 표시
    if (adRef.current && scriptLoaded.current) {
      // 쿠팡 파트너스 광고는 스크립트가 자동으로 처리
      // 필요시 추가 로직 구현
    }
  }, [finalAdUnitId]);

  // 광고 ID가 없으면 아무것도 렌더링하지 않음
  if (!finalAdUnitId) {
    if (import.meta.env.DEV) {
      return (
        <div 
          style={{
            ...style,
            padding: '20px',
            backgroundColor: '#F5F5F7',
            border: '1px dashed #D2D2D8',
            textAlign: 'center',
            color: '#9A9AA2',
            fontSize: '13px'
          }}
          className={className}
        >
          [쿠팡 광고 영역]<br />
          COUPANG_AD_UNIT_ID 환경변수를 설정해주세요.
        </div>
      );
    }
    return null;
  }

  return (
    <div
      ref={adRef}
      className={`coupang-ad ${className}`}
      style={{
        minHeight: '250px',
        width: '100%',
        maxWidth: '100%',
        margin: '16px 0',
        boxSizing: 'border-box',
        ...style
      }}
      data-partner={finalAdUnitId}
    >
      {/* 쿠팡 파트너스 광고는 스크립트가 자동으로 이 영역에 광고를 삽입합니다 */}
    </div>
  );
};

export default CoupangAd;



