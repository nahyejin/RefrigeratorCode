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

  // 3) 아무것도 없으면 **그냥 쿠팡 검색**으로 보낸다. 수수료는 안 붙는다.
  //
  // 예전에는 여기서 `link.coupang.com/a/{파트너ID}?...&url=검색URL` 을 만들었다.
  // **그 링크는 동작하지 않았다.** `/a/{코드}` 의 코드 자리는 파트너스에서
  // 링크 하나마다 발급하는 **짧은 링크 코드**이지 파트너 ID 가 아니다.
  // 실제로 눌러 보면 302 로 `https://www.coupang.com/` (쿠팡 첫 화면)으로만
  // 갔다 — 재료 이름은 사라지고, 당연히 성과도 안 잡혔다.
  // (정상 링크는 `link.coupang.com/a/dHedi7` 처럼 상품 페이지로 간다)
  //
  // 그래서 만들어 낼 수 없는 링크를 흉내 내지 않고, **적어도 그 재료를 찾을 수
  // 있는 곳**으로 보낸다. 수수료가 붙는 링크는 사람이 파트너스에서 하나씩
  // 만들어 `public/coupang_ads.csv` 에 넣는 수밖에 없다.
  return `https://www.coupang.com/np/search?q=${encodeURIComponent(keyword)}`;
}
