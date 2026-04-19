/**
 * 프리미엄 재료 사전 — 「특별한 날 특별한 음식」 매칭·정렬
 *
 * - **정렬 우선순위는 `rank` 숫자만 사용합니다.** (작을수록 상단)
 * - `// --- 해산물 ---` 같은 주석은 읽기용 구역일 뿐, 카테고리로 자동 정렬되지 않습니다.
 * - 아래 `PREMIUM_INGREDIENT_DEFS`는 **카테고리별로 묶어 두었지만**, 실제 순서는 `rank`로만 결정됩니다.
 * - 순서를 바꾸려면 **이름 옆 `rank`만 수정**하면 됩니다 (줄 위치/주석 블록은 마음대로).
 * - 같은 `rank`를 쓰면 그 재료들은 동급으로 취급됩니다.
 */

/** 카테고리 주석은 문서화용. `rank`가 우선순위. */
const PREMIUM_INGREDIENT_DEFS: ReadonlyArray<{ rank: number; name: string }> = [
  // --- 초고가·희귀 ---
  { rank: 0, name: '캐비어' },
  { rank: 1, name: '푸아그라' },
  { rank: 2, name: '트러플' },

  // --- 해산물 ---
  { rank: 10, name: '킹크랩' },
  { rank: 11, name: '랍스터' },
  { rank: 12, name: '대게' },
  { rank: 13, name: '전복' },
  { rank: 14, name: '성게' },
  { rank: 15, name: '멍게' },
  { rank: 16, name: '해삼' },
  { rank: 17, name: '가리비' },
  { rank: 18, name: '관자' },
  { rank: 19, name: '새우' },
  { rank: 20, name: '연어' },
  { rank: 21, name: '참치' },
  { rank: 22, name: '광어' },
  { rank: 23, name: '도미' },
  { rank: 24, name: '오징어' },
  { rank: 25, name: '문어' },
  { rank: 26, name: '바지락' },
  { rank: 27, name: '홍합' },
  { rank: 28, name: '골뱅이' },

  // --- 고급 육류 (예: 한우를 해산물보다 우선하고 싶으면 rank를 10 미만으로 옮기기) ---
  { rank: 40, name: '와규' },
  { rank: 41, name: '한우' },
  { rank: 42, name: '갈비' },
  { rank: 43, name: '안심' },
  { rank: 44, name: '등심' },
  { rank: 45, name: '스테이크' },
  { rank: 46, name: '소고기' },
  { rank: 47, name: '쇠고기' },
  { rank: 48, name: '삼겹살' },
  { rank: 49, name: '목살' },
  { rank: 50, name: '갈매기살' },

  // --- 고급 채소·버섯 ---
  { rank: 60, name: '송이버섯' },
  { rank: 61, name: '표고버섯' },
  { rank: 62, name: '새송이버섯' },
  { rank: 63, name: '느타리버섯' },
  { rank: 64, name: '아스파라거스' },
  { rank: 65, name: '로메인' },
  { rank: 66, name: '치커리' },
  { rank: 67, name: '루꼴라' },

  // --- 고급 유제품 ---
  { rank: 70, name: '모짜렐라' },
  { rank: 71, name: '고르곤졸라' },
  { rank: 72, name: '파마산' },
  { rank: 73, name: '리코타' },
  { rank: 74, name: '크림치즈' },
  { rank: 75, name: '버터' },
  { rank: 76, name: '생크림' },

  // --- 조미료·양념·주류 ---
  { rank: 80, name: '올리브오일' },
  { rank: 81, name: '발사믹' },
  { rank: 82, name: '와인' },
  { rank: 83, name: '샴페인' },
  { rank: 84, name: '꿀' },
  { rank: 85, name: '메이플시럽' },
];

const PREMIUM_RANK = new Map<string, number>();
for (const { rank, name } of PREMIUM_INGREDIENT_DEFS) {
  const key = name.toLowerCase();
  if (PREMIUM_RANK.has(key)) {
    throw new Error(`[premiumIngredients] duplicate name: ${name}`);
  }
  PREMIUM_RANK.set(key, rank);
}

/**
 * `used_ingredients`에서 쪼갠 재료 토큰(= 카드 pill과 동일 출처)이 프리미엄 키워드를 **포함**할 때만 매칭.
 * - 예: 토큰 `대게`, `황대게` → `대게` 프리미엄 O / 역방향 `premium.includes(토큰)` 은 쓰지 않음 (`게`만 있을 때 `대게`로 오인 방지)
 * - 카드 pill과 다른 규칙을 두지 않음(동의어 치환 없이, 파싱된 문자열 기준).
 */
function tokenMatchesPremiumToken(ing: string, premium: string): boolean {
  const i = ing.trim().toLowerCase();
  const p = premium.trim().toLowerCase();
  if (!i || !p) return false;
  return i.includes(p);
}

/** 매칭 시 이 순서로 순회(표시용). 정렬 우선순위는 항상 `rank`. */
export const PREMIUM_INGREDIENTS: string[] = [...PREMIUM_INGREDIENT_DEFS]
  .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
  .map(d => d.name);

/**
 * 재료 목록에 프리미엄 재료가 포함되어 있는지 확인
 */
export function hasPremiumIngredient(ingredients: string[]): boolean {
  const normalizedIngredients = ingredients.map(ing => ing.trim().toLowerCase());
  return PREMIUM_INGREDIENT_DEFS.some(({ name: premium }) =>
    normalizedIngredients.some(ing => tokenMatchesPremiumToken(ing, premium))
  );
}

/**
 * 레시피에서 프리미엄 재료만 추출 (우선순위 rank 오름차순)
 */
export function getPremiumIngredients(recipeIngredients: string[]): string[] {
  const normalizedIngredients = recipeIngredients.map(ing => ing.trim().toLowerCase());
  const matched = PREMIUM_INGREDIENT_DEFS.filter(({ name: premium }) =>
    normalizedIngredients.some(ing => tokenMatchesPremiumToken(ing, premium))
  ).map(d => d.name);
  return matched.sort(
    (a, b) =>
      (PREMIUM_RANK.get(a.toLowerCase()) ?? 9999) - (PREMIUM_RANK.get(b.toLowerCase()) ?? 9999) ||
      a.localeCompare(b)
  );
}

/**
 * 매칭된 프리미엄 중 가장 높은 등급(rank 최소값).
 */
export function getPremiumTierRank(recipeIngredients: string[]): number {
  const matched = getPremiumIngredients(recipeIngredients);
  if (matched.length === 0) return 999999;
  return Math.min(...matched.map(m => PREMIUM_RANK.get(m.toLowerCase()) ?? 999999));
}
