import React, { useEffect, useRef, useState, useMemo } from 'react';
import { loadCoupangLinks, coupangLinksCache, preloadCoupangLinks, convertSynonymToKeywordSync, ingredientSynonymDictCache, loadIngredientSynonymDict } from '../utils/recipeUtils';

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
  const [coupangLinks, setCoupangLinks] = useState<{ [key: string]: string } | null>(null);
  const [isLoadingLinks, setIsLoadingLinks] = useState(false);
  const [synonymDict, setSynonymDict] = useState<{ [key: string]: string } | null>(null);

  // 동의어 사전 및 쿠팡 링크 로드
  useEffect(() => {
    // 동의어 사전 로드
    if (ingredientSynonymDictCache) {
      setSynonymDict(ingredientSynonymDictCache);
    } else {
      loadIngredientSynonymDict().then(dict => {
        setSynonymDict(dict);
      });
    }

    // 쿠팡 링크 로드
    if (coupangLinksCache) {
      setCoupangLinks(coupangLinksCache);
      return;
    }

    // 캐시가 없으면 로드
    if (!isLoadingLinks) {
      setIsLoadingLinks(true);
      loadCoupangLinks().then(links => {
        // coupangLinksCache는 loadCoupangLinks 내부에서 업데이트됨
        setCoupangLinks(links);
        setIsLoadingLinks(false);
      }).catch(() => {
        setIsLoadingLinks(false);
      });
    }
  }, []);

  // 쿠팡 검색 URL 생성 (fallback용)
  const generateCoupangSearchUrl = (keyword: string): string => {
    // 쿠팡 검색 결과 페이지 URL
    const searchUrl = `https://www.coupang.com/np/search?q=${encodeURIComponent(keyword)}`;
    return searchUrl;
  };

  // 파트너스 링크 생성
  // 1. 동의어를 keyword로 변환
  // 2. CSV에 저장된 링크가 있으면 사용
  // 3. 없으면 검색 URL을 파트너스 링크 형식으로 변환
  const generatePartnerLink = (ingredientName: string): string => {
    // 동의어를 keyword로 변환
    const keyword = synonymDict ? convertSynonymToKeywordSync(ingredientName, synonymDict) : ingredientName;
    
    // 디버깅 로그
    console.log(`[CoupangProductAd] 링크 생성 시도: ${ingredientName} → keyword: ${keyword}`);
    console.log(`[CoupangProductAd] coupangLinks 상태:`, coupangLinks ? '로드됨' : '로드 안됨');
    if (coupangLinks) {
      console.log(`[CoupangProductAd] coupangLinks에 '${keyword}' 키 존재:`, keyword in coupangLinks);
      if (coupangLinks[keyword]) {
        console.log(`[CoupangProductAd] 찾은 링크:`, coupangLinks[keyword]);
      }
    }
    
    // CSV에서 로드한 링크가 있으면 사용
    if (coupangLinks && coupangLinks[keyword]) {
      console.log(`[CoupangProductAd] ✅ CSV 링크 사용: ${ingredientName} (${keyword}) → ${coupangLinks[keyword]}`);
      return coupangLinks[keyword];
    }

    // 링크가 없으면 검색 URL 생성 (fallback)
    if (!partnerIdFinal) {
      console.log(`[CoupangProductAd] ⚠️ 파트너 ID 없음, 검색 URL 사용: ${keyword}`);
      return generateCoupangSearchUrl(keyword);
    }
    
    // 검색 URL을 파트너스 링크 형식으로 변환
    const searchUrl = generateCoupangSearchUrl(keyword);
    console.log(`[CoupangProductAd] ⚠️ CSV 링크 없음, 검색 URL 사용 (fallback): ${ingredientName} (${keyword})`);
    return `https://link.coupang.com/a/${partnerIdFinal}?linkCode=as2&url=${encodeURIComponent(searchUrl)}`;
  };

  // coupangLinks가 로드될 때마다 링크 재생성
  const partnerLink = useMemo(() => {
    const link = generatePartnerLink(ingredientName);
    console.log(`[CoupangProductAd] 최종 생성된 링크: ${link}`);
    return link;
  }, [ingredientName, coupangLinks, synonymDict, partnerIdFinal]);

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
        padding: '4px 12px 0px 12px',
        backgroundColor: '#fff',
        border: 'none',
        borderRadius: '8px',
        ...style
      }}
    >
      <a
        href={partnerLink}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          // 쿠팡 파트너스 링크 클릭 추적
          console.log('[CoupangProductAd] 클릭:', ingredientName, '링크:', partnerLink);
          // 이벤트 전파 중지 (RecipeCard의 handleCardClick이 링크를 가로채지 않도록)
          e.stopPropagation();
          // 기본 동작 허용 (링크 이동)
          // e.preventDefault()를 호출하지 않음
        }}
        style={{
          display: 'inline-block',
          padding: '8px 16px',
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
        fontSize: '9px',
        color: '#999',
        marginTop: '4px',
        marginBottom: '0',
        paddingBottom: '0',
        textAlign: 'center',
        lineHeight: '1.3',
        whiteSpace: 'pre-line'
      }}>
        이 게시물은 쿠팡 파트너스 활동의 일환으로,{'\n'}이에 따른 일정액의 수수료를 제공받습니다.
      </div>
    </div>
  );
};

export default CoupangProductAd;



