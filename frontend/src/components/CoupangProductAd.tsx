import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  loadCoupangLinks,
  coupangLinksCache,
  convertSynonymToKeywordSync,
  ingredientSynonymDictCache,
  loadIngredientSynonymDict,
  loadCoupangAds,
  coupangAdsCache,
  CoupangAdsMap,
} from '../utils/recipeUtils';

interface CoupangProductAdProps {
  /** 단일 재료명(하위호환) */
  ingredientName?: string;
  /** 부족 재료 후보들 (여러 개일 때 내부 우선순위/안정랜덤으로 1개 선택) */
  ingredientCandidates?: string[];
  /** 같은 카드에서 선택 안정화용 seed */
  seedKey?: string | number;
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
  ingredientCandidates,
  seedKey,
  style,
  className = '',
  partnerId
}) => {
  const adRef = useRef<HTMLDivElement>(null);
  const partnerIdFinal = partnerId || import.meta.env.VITE_COUPANG_PARTNER_ID || '';
  const [coupangLinks, setCoupangLinks] = useState<{ [key: string]: string } | null>(null);
  const [coupangAds, setCoupangAds] = useState<CoupangAdsMap | null>(null);
  const [isLoadingLinks, setIsLoadingLinks] = useState(false);
  const [isLoadingAds, setIsLoadingAds] = useState(false);
  const [synonymDict, setSynonymDict] = useState<{ [key: string]: string } | null>(null);

  const selectedIngredientCandidates = useMemo(() => {
    const candidates = ingredientCandidates && ingredientCandidates.length > 0
      ? ingredientCandidates
      : (ingredientName ? [ingredientName] : []);
    return candidates.filter(Boolean);
  }, [ingredientCandidates, ingredientName]);

  const toKeyword = (name: string): string => {
    return synonymDict ? convertSynonymToKeywordSync(name, synonymDict) : name;
  };

  const stableHash = (input: string): number => {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
    }
    return hash;
  };

  const pickStable = <T,>(arr: T[], seed: string): T => {
    const idx = arr.length === 1 ? 0 : stableHash(seed) % arr.length;
    return arr[idx];
  };

  // 동의어 사전 + 기존 링크 CSV + 별도 광고 CSV 로드
  useEffect(() => {
    if (ingredientSynonymDictCache) {
      setSynonymDict(ingredientSynonymDictCache);
    } else {
      loadIngredientSynonymDict().then(dict => {
        setSynonymDict(dict);
      });
    }

    if (coupangLinksCache) {
      setCoupangLinks(coupangLinksCache);
    }
    if (!isLoadingLinks) {
      setIsLoadingLinks(true);
      loadCoupangLinks()
        .then(links => {
          setCoupangLinks(links);
          setIsLoadingLinks(false);
        })
        .catch(() => {
          setIsLoadingLinks(false);
          if (coupangLinksCache) setCoupangLinks(coupangLinksCache);
        });
    }

    if (coupangAdsCache) {
      setCoupangAds(coupangAdsCache);
    }
    if (!isLoadingAds) {
      setIsLoadingAds(true);
      loadCoupangAds()
        .then(ads => {
          setCoupangAds(ads);
          setIsLoadingAds(false);
        })
        .catch(() => {
          setIsLoadingAds(false);
          if (coupangAdsCache) setCoupangAds(coupangAdsCache);
        });
    }
  }, []);

  // 쿠팡 검색 URL 생성 (fallback용)
  const generateCoupangSearchUrl = (keyword: string): string => {
    // 쿠팡 검색 결과 페이지 URL
    const searchUrl = `https://www.coupang.com/np/search?q=${encodeURIComponent(keyword)}`;
    return searchUrl;
  };

  // 기존 ingredient CSV(coupang_link) 기반 fallback
  const generateFallbackPartnerLink = (targetIngredientName: string): string => {
    const keyword = toKeyword(targetIngredientName);
    if (coupangLinks && coupangLinks[keyword]) {
      return coupangLinks[keyword];
    }

    if (!partnerIdFinal) {
      return generateCoupangSearchUrl(keyword);
    }

    const searchUrl = generateCoupangSearchUrl(keyword);
    return `https://link.coupang.com/a/${partnerIdFinal}?linkCode=as2&url=${encodeURIComponent(searchUrl)}`;
  };

  const selectedAdInfo = useMemo(() => {
    if (!selectedIngredientCandidates.length) return null;
    const keywordCandidates = selectedIngredientCandidates.map(name => ({
      original: name,
      keyword: toKeyword(name),
    }));

    if (coupangAds) {
      const adCandidates: Array<{ ingredient: string; keyword: string; url: string; priority: number }> = [];
      keywordCandidates.forEach(({ original, keyword }) => {
        const entries = coupangAds[keyword];
        if (entries && entries.length > 0) {
          entries.forEach(entry => {
            adCandidates.push({
              ingredient: original,
              keyword,
              url: entry.url,
              priority: entry.priority,
            });
          });
        }
      });

      if (adCandidates.length > 0) {
        const minPriority = Math.min(...adCandidates.map(c => c.priority));
        const topPriority = adCandidates.filter(c => c.priority === minPriority);
        const seed = `${seedKey ?? ''}|${keywordCandidates.map(c => c.keyword).join(',')}`;
        return pickStable(topPriority, seed);
      }
    }

    const seed = `${seedKey ?? ''}|${keywordCandidates.map(c => c.keyword).join(',')}`;
    const picked = pickStable(keywordCandidates, seed);
    return {
      ingredient: picked.original,
      keyword: picked.keyword,
      url: generateFallbackPartnerLink(picked.original),
      priority: 1000,
    };
  }, [selectedIngredientCandidates, coupangAds, seedKey, synonymDict, coupangLinks, partnerIdFinal, isLoadingLinks]);

  const partnerLink = useMemo(() => {
    if ((coupangLinks === null && isLoadingLinks) || (coupangAds === null && isLoadingAds)) {
      return null;
    }
    if (!selectedAdInfo) return null;
    return selectedAdInfo.url;
  }, [coupangLinks, isLoadingLinks, coupangAds, isLoadingAds, selectedAdInfo]);

  // 링크가 아직 준비되지 않았으면 렌더링하지 않음
  if (!partnerLink) {
    return null;
  }

  // 파트너 ID가 없고 fallback 링크만 가능한 상황이면 개발 모드에서만 안내 표시
  const hasCsvLink = !!(selectedAdInfo && coupangLinks && coupangLinks[selectedAdInfo.keyword]);

  if (!partnerIdFinal && !hasCsvLink) {
    if (import.meta.env.DEV) {
      return (
        <div 
          style={{
            ...style,
            padding: '16px',
            backgroundColor: '#F5F5F7',
            border: '1px dashed #D2D2D8',
            borderRadius: '8px',
            textAlign: 'center',
            color: '#9A9AA2',
            fontSize: '12px',
            margin: '12px 0'
          }}
          className={className}
        >
          [쿠팡 상품 광고: {selectedAdInfo?.ingredient || ingredientName || '-'}]<br />
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
        margin: '2px 0 0 0',
        padding: '2px 6px 0 6px',
        backgroundColor: '#FFFFFF',
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
          e.stopPropagation();
        }}
        // 예전엔 주황색 꽉 찬 버튼이라 카드에서 가장 눈에 띄었음 — 광고가 정작 주인공인
        // 레시피보다 강조되는 문제. 외곽선 스타일로 낮춰 존재감만 남김
        style={{
          display: 'inline-block',
          padding: '7px 12px',
          backgroundColor: '#FFFFFF',
          color: '#FF6B00',
          border: '1px solid #FFD3B0',
          textDecoration: 'none',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: 600,
          transition: 'background-color 0.15s, border-color 0.15s',
          width: '100%',
          textAlign: 'center',
          boxSizing: 'border-box'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#FFF6EF';
          e.currentTarget.style.borderColor = '#FF6B00';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#FFFFFF';
          e.currentTarget.style.borderColor = '#FFD3B0';
        }}
      >
        {selectedAdInfo?.keyword || ingredientName} 쿠팡에서 구매하기
      </a>
      <div
        style={{
          fontSize: '7px',
          color: '#9A9AA2',
          marginTop: '1px',
          marginBottom: 0,
          paddingBottom: 0,
          textAlign: 'center',
          lineHeight: 1.12,
          letterSpacing: '-0.02em',
          wordBreak: 'keep-all',
        }}
      >
        이 게시물은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
      </div>
    </div>
  );
};

export default CoupangProductAd;



