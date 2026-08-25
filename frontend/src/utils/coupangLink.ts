import {
  coupangLinksCache,
  coupangAdsCache,
  ingredientSynonymDictCache,
  convertSynonymToKeywordSync,
} from './recipeUtils';

/**
 * 재료명 하나에 대한 쿠팡 구매 링크를 만든다.
 *
 * 예전에는 이 로직이 CoupangProductAd 안에만 있어서, 카드마다 전체폭 CTA 버튼을
 * 하나 띄우는 방식으로만 쓸 수 있었다. 그런데 부족 재료가 여러 개여도 버튼은 1개만
 * 골라 보여줘서, 사용자가 사고 싶은 재료가 다르면 쓸모가 없었다.
 * 링크 생성을 분리해 두면 "부족 재료 pill 을 눌러서 그 재료를 구매" 하는 동선을 만들 수 있다.
 *
 * 캐시가 아직 로드되지 않았으면 null 을 반환한다(그 경우 pill 은 그냥 표시만 된다).
 */
export function resolveCoupangUrl(ingredientName: string): string | null {
  const name = (ingredientName || '').trim();
  if (!name) return null;

  const keyword = ingredientSynonymDictCache
    ? convertSynonymToKeywordSync(name, ingredientSynonymDictCache)
    : name;

  // 1) 별도 광고 CSV — 우선순위(priority)가 가장 높은(값이 작은) 것
  const ads = coupangAdsCache?.[keyword];
  if (ads && ads.length > 0) {
    const best = ads.reduce((a, b) => (a.priority <= b.priority ? a : b));
    if (best?.url) return best.url;
  }

  // 2) 재료 사전의 coupang_link
  const direct = coupangLinksCache?.[keyword];
  if (direct) return direct;

  // 3) 파트너스 ID 가 있으면 검색 결과 파트너 링크로 폴백
  const partnerId = import.meta.env.VITE_COUPANG_PARTNER_ID || '';
  if (!partnerId) return null;

  const searchUrl = `https://www.coupang.com/np/search?q=${encodeURIComponent(keyword)}`;
  return `https://link.coupang.com/a/${partnerId}?linkCode=as2&url=${encodeURIComponent(searchUrl)}`;
}
