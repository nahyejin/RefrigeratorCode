/**
 * 프리미엄 재료 사전 — 「특별한 날 특별한 음식」 매칭·정렬
 *
 * - **정렬 우선순위는 `rank` 숫자만 사용합니다.** (작을수록 상단)
 * - `// --- 해산물 ---` 같은 주석은 읽기용 구역일 뿐, 카테고리로 자동 정렬되지 않습니다.
 * - 순서를 바꾸려면 **이름 옆 `rank`만 수정**하면 됩니다 (줄 위치/주석 블록은 마음대로).
 * - 같은 `rank`를 쓰면 그 재료들은 동급으로 취급됩니다.
 *
 * ── 2026-09-06 전면 정리 ────────────────────────────────────────────────
 *
 * 목록에 **일상 재료가 잔뜩 들어 있었다.** 인기 목록 110건 중 **58건(53%)** 이
 * 「특별한 날」로 뽑히고 있었고, 뽑힌 이유가 이랬다:
 *
 *   파김치 · 배추 겉절이 · 김치찌개 · 애호박볶음   ← `새우` (실제로는 **새우젓**)
 *   단호박빵 · 명란솥밥                        ← `버터`
 *   감자반찬 · 청소년 아침식단                   ← `소고기`
 *   찹쌀떡                                  ← `꿀`
 *   닭다리살 소금구이                          ← `새송이버섯` 이 `송이버섯` 에 걸림
 *
 * 카탈로그 전체(43,320건)로 재 봐도 `버터` 9.0% · `새우` 8.9% · `표고버섯` 5.2% ·
 * `소고기` 4.8% · `꿀` 4.2% 였다. 이 정도로 흔한 것이 있으면 그 섹션은
 * "특별한 날" 이 아니라 "아무 날" 이 된다.
 *
 * 그래서 **일상 재료를 전부 뺐다** — 버터·생크림·크림치즈·모짜렐라·올리브오일·
 * 꿀·메이플시럽·소고기·삼겹살·목살·참치·오징어·바지락·홍합·골뱅이·새우·
 * 표고버섯·새송이버섯·느타리버섯·로메인·치커리.
 *
 * `exclude` 를 새로 뒀다. 앞뒤에 말이 붙으면 **뜻이 달라지는** 것들이 있다:
 *   송이버섯 ← 새송이버섯 · 양송이버섯   갈비 ← 돼지갈비 · 갈비양념 · 갈비탕
 *   굴 ← 굴소스 · 굴비                안심/등심 ← 돼지안심 · 돼지등심
 *   와인 ← 와인식초                   도미 ← 도미노
 *
 * 정리 뒤 같은 인기 목록에서 **58건 → 7건**이 됐다. 적어 보이지만 그게 맞다 —
 * 「이번 주 인기」는 원래 집밥 위주라 그 안에 특별한 날 음식이 많을 수가 없다.
 * (풀 자체를 인기 목록이 아니라 카탈로그 전체로 넓히는 것은 별도 문제다)
 */

/** 카테고리 주석은 문서화용. `rank`가 우선순위. `exclude` 는 그 말이 든 토큰을 뺀다. */
const PREMIUM_INGREDIENT_DEFS: ReadonlyArray<{
  rank: number;
  name: string;
  exclude?: readonly string[];
}> = [
  // --- 초고가·희귀 ---
  { rank: 0, name: '캐비어' },
  { rank: 1, name: '푸아그라' },
  { rank: 2, name: '트러플' },

  // --- 해산물 (사서 상에 올리는 것만. 새우·오징어·바지락은 일상이라 뺐다) ---
  { rank: 10, name: '킹크랩' },
  { rank: 11, name: '랍스터' },
  { rank: 12, name: '대게' },
  { rank: 13, name: '전복' },
  { rank: 14, name: '성게' },
  { rank: 15, name: '멍게' },
  { rank: 16, name: '해삼' },
  { rank: 17, name: '가리비' },
  { rank: 18, name: '관자' },
  { rank: 19, name: '대하' },
  { rank: 20, name: '방어' },
  { rank: 21, name: '참돔' },
  { rank: 22, name: '광어' },
  { rank: 23, name: '도미', exclude: ['도미노'] },
  { rank: 24, name: '문어' },
  { rank: 25, name: '낙지' },
  { rank: 26, name: '굴', exclude: ['굴소스', '굴비'] },
  { rank: 27, name: '연어' },

  // --- 고급 육류 (소고기·삼겹살·목살은 일상이라 뺐다) ---
  { rank: 40, name: '와규' },
  { rank: 41, name: '한우' },
  { rank: 42, name: '갈비', exclude: ['돼지갈비', '갈비양념', '갈비탕', '갈비살'] },
  { rank: 43, name: '채끝' },
  { rank: 44, name: '안심', exclude: ['돼지안심'] },
  { rank: 45, name: '등심', exclude: ['돼지등심'] },
  { rank: 46, name: '스테이크', exclude: ['스테이크소스'] },
  { rank: 47, name: '양갈비' },

  // --- 고급 버섯·채소 (표고·새송이·느타리는 일상이라 뺐다) ---
  { rank: 60, name: '송이버섯', exclude: ['새송이버섯', '양송이버섯'] },
  { rank: 61, name: '능이버섯' },
  { rank: 62, name: '아스파라거스' },
  { rank: 63, name: '루꼴라' },

  // --- 고급 치즈 (모짜렐라·크림치즈는 일상이라 뺐다) ---
  { rank: 70, name: '고르곤졸라' },
  { rank: 71, name: '부라타' },
  { rank: 72, name: '브리치즈' },
  { rank: 73, name: '리코타' },

  // --- 주류·조미료 (꿀·메이플시럽·올리브오일은 일상이라 뺐다) ---
  { rank: 80, name: '샴페인' },
  { rank: 81, name: '와인', exclude: ['와인식초'] },
  { rank: 82, name: '발사믹' },
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
 * - 다만 앞뒤에 말이 붙으면 **뜻이 달라지는** 것이 있어서 `exclude` 로 뺀다.
 *   `새우젓`은 조미료지 새우가 아니고, `새송이버섯`은 `송이버섯`이 아니다.
 *   실제로 이것 때문에 `파김치`·`배추 겉절이`가 「특별한 날」로 올라와 있었다.
 * - 카드 pill과 다른 규칙을 두지 않음(동의어 치환 없이, 파싱된 문자열 기준).
 */
function tokenMatchesPremiumToken(
  ing: string,
  premium: string,
  exclude?: readonly string[],
): boolean {
  const i = ing.trim().toLowerCase();
  const p = premium.trim().toLowerCase();
  if (!i || !p) return false;
  if (!i.includes(p)) return false;
  if (exclude && exclude.some(e => i.includes(e.trim().toLowerCase()))) return false;
  return true;
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
  return PREMIUM_INGREDIENT_DEFS.some(({ name, exclude }) =>
    normalizedIngredients.some(ing => tokenMatchesPremiumToken(ing, name, exclude))
  );
}

/**
 * 레시피에서 프리미엄 재료만 추출 (우선순위 rank 오름차순)
 */
export function getPremiumIngredients(recipeIngredients: string[]): string[] {
  const normalizedIngredients = recipeIngredients.map(ing => ing.trim().toLowerCase());
  const matched = PREMIUM_INGREDIENT_DEFS.filter(({ name, exclude }) =>
    normalizedIngredients.some(ing => tokenMatchesPremiumToken(ing, name, exclude))
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
