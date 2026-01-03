import React, { useEffect, useRef } from 'react';

interface CoupangProductAdProps {
  /** 재료명 (쿠팡에서 검색할 키워드) */
  ingredientName: string;
  /** 광고 스타일 */
  style?: React.CSSProperties;
  /** 광고 클래스명 */
  className?: string;
  /** 쿠팡 파트너스 ID (없으면 환경변수 사용) */
  partnerId?: string;
}

/**
 * 쿠팡 파트너스 상품 링크 광고 컴포넌트
 * 
 * 재료명을 기반으로 쿠팡 검색 결과 페이지의 파트너스 링크를 생성합니다.
 * 
 * 사용 방법:
 * 1. 쿠팡 파트너스 계정에서 간편 링크 생성
 * 2. 재료명을 prop으로 전달: <CoupangProductAd ingredientName="돼지고기" />
 */
const CoupangProductAd: React.FC<CoupangProductAdProps> = ({ 
  ingredientName,
  style,
  className = '',
  partnerId
}) => {
  const adRef = useRef<HTMLDivElement>(null);
  const partnerIdFinal = partnerId || import.meta.env.VITE_COUPANG_PARTNER_ID || '';

  // 쿠팡 검색 URL 생성 (간편 링크로 변환 필요)
  const generateCoupangSearchUrl = (keyword: string): string => {
    // 쿠팡 검색 결과 페이지 URL
    const searchUrl = `https://www.coupang.com/np/search?q=${encodeURIComponent(keyword)}`;
    return searchUrl;
  };

  // 파트너스 링크 생성 (간편 링크 사용)
  // 실제로는 쿠팡 파트너스 대시보드에서 간편 링크를 생성하고 그 링크를 사용해야 합니다
  const generatePartnerLink = (keyword: string): string => {
    if (!partnerIdFinal) {
      return generateCoupangSearchUrl(keyword);
    }
    
    // 간편 링크 형식: https://link.coupang.com/a/{partnerId}?linkCode=as2&tag={tag}&itemId={itemId}
    // 검색 결과 페이지의 경우 간편 링크로 변환 필요
    const searchUrl = generateCoupangSearchUrl(keyword);
    
    // 간편 링크 생성 페이지에서 변환한 링크를 사용해야 함
    // 여기서는 검색 URL을 반환하고, 실제로는 쿠팡 파트너스 대시보드에서 변환한 링크를 사용
    return searchUrl;
  };

  const partnerLink = generatePartnerLink(ingredientName);

  // 파트너 ID가 없으면 개발 모드에서만 표시
  if (!partnerIdFinal) {
    if (import.meta.env.DEV) {
      return (
        <div 
          style={{
            ...style,
            padding: '16px',
            backgroundColor: '#f5f5f5',
            border: '1px dashed #ccc',
            borderRadius: '8px',
            textAlign: 'center',
            color: '#999',
            fontSize: '12px',
            margin: '12px 0'
          }}
          className={className}
        >
          [쿠팡 상품 광고: {ingredientName}]<br />
          VITE_COUPANG_PARTNER_ID 환경변수를 설정해주세요.
        </div>
      );
    }
    return null;
  }

  return (
    <div
      ref={adRef}
      className={`coupang-product-ad ${className}`}
      style={{
        margin: '12px 0',
        padding: '12px',
        backgroundColor: '#fff',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        ...style
      }}
    >
      <div style={{
        fontSize: '12px',
        color: '#666',
        marginBottom: '8px',
        fontWeight: '500'
      }}>
        부족한 재료 구매하기
      </div>
      <a
        href={partnerLink}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          // 쿠팡 파트너스 링크 클릭 추적
          console.log('[CoupangProductAd] 클릭:', ingredientName);
        }}
        style={{
          display: 'inline-block',
          padding: '10px 16px',
          backgroundColor: '#FF6B00',
          color: '#fff',
          textDecoration: 'none',
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: '600',
          transition: 'background-color 0.2s',
          width: '100%',
          textAlign: 'center',
          boxSizing: 'border-box'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#E55A00';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#FF6B00';
        }}
      >
        {ingredientName} 쿠팡에서 구매하기
      </a>
      <div style={{
        fontSize: '10px',
        color: '#999',
        marginTop: '8px',
        textAlign: 'center'
      }}>
        이 게시물은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
      </div>
    </div>
  );
};

export default CoupangProductAd;



