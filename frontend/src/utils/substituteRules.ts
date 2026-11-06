/**
 * 대체 재료 추천의 **품질 규칙** — 한 곳에서 정한다(2026-11-07 「레시피에 따라 맥락 없는 대체 재료 추천이 너무 많다」).
 *
 * 대체 재료 표(`ingredient_substitute_table.csv`, 약 12만 쌍)는 재료의 성질(Feature)·분류가 비슷한지만 보고 만든다. 그래서 **레시피 맥락과 재료의
 * 역할을 모른다** — 꽃굴무침에서 「알배추 → 대파」, 「굴 → 오징어」(0.64), 「알룰로스 → 라칸토 감미료」(브랜드 0.73) 같은 추천이 나왔다.
 * 규칙으로 막을 수 있는 것부터 막는다(비용 0). 남는 애매한 것은 레시피 창에서 칩을 눌러 쿡 코치에게 묻는다(맥락을 아는 AI).
 *
 *   1) 유사도 `MIN_SUBSTITUTE_SCORE`(0.60) 미만은 추천하지 않는다. 표는 점수순이라 예전엔 「냉장고에 있는 **첫** 후보」를 점수와 상관없이 골랐다.
 *      0.70 으로 시험했더니 괜찮은 대체(홍게간장→간장 0.62, 버터→마가린 0.62, 굴→홍합살 0.65)도 같이 빠져서 0.60 으로 낮췄다 — 확실히 무관한 것
 *      (알배추→대파 0.45)만 점수로 막고, 남는 애매한 것은 주재료 제외(3)와 쿡 코치 확인(칩을 누름)이 받친다.
 *   2) 브랜드·제품명 후보는 뺀다(없는 재료 쪽이 브랜드일 때만 허용 — 다시다 → 미원).
 *   3) **레시피 제목에 나오는 재료(주재료)는 대체하지 않는다** — 굴무침의 굴을 오징어로 바꾸면 다른 요리다.
 *
 * 목록 카드·목록 행·광고 계산·알약·레시피 창이 모두 이 파일을 거치므로 **「대체 가능 N」과 안의 칩 개수가 어긋나지 않는다.**
 */
export const MIN_SUBSTITUTE_SCORE = 0.6;

type Candidate = { ingredient_b: string; similarity_score?: number };

const norm = (s: string) => (s || '').trim().toLowerCase();

/** 사전에서 브랜드·제품명으로 확인된 이름(재료 사전 정돈, 2026-11-06). 목록이 늘면 여기에 더한다. */
const BRAND_NAMES = new Set([
  '신라면', '진라면', '짜파게티', '사리곰탕면', '빽라면', '불닭볶음면', '너구리', '육개장 사발면', '육개장사발면',
  '죠리퐁', '도리토스', '오레오', '다이제', '위트빅스', '초코파이', '닥터페퍼', '환타',
  '크라비아', '요플레', '필라델피아', '에쉬레', '버터랑', '라꽁비에뜨',
  '햇반', '미원', '다시다', '연두', '홍초', '불닭소스', '불닭마요소스', '라오간마', '라칸토 감미료', '말돈 소금', '올드베이',
].map(norm));

/** 점수 하한을 넘고 브랜드가 아닌 후보만. `missing` 은 없는 재료의 이름. */
export function usableSubstitutes<T extends Candidate>(list: T[] | undefined | null, missing: string): T[] {
  if (!Array.isArray(list)) return [];
  const missingIsBrand = BRAND_NAMES.has(norm(missing));
  return list.filter(c =>
    (c.similarity_score ?? 0) >= MIN_SUBSTITUTE_SCORE
    && (missingIsBrand || !BRAND_NAMES.has(norm(c.ingredient_b))));
}

/** 레시피 제목에 이름이 나오는 재료는 그 요리의 주재료로 본다(공백 무시). 제목을 모르면 판단하지 않는다. */
export function isMainIngredient(name: string, title?: string): boolean {
  const t = (title || '').replace(/\s+/g, '');
  const n = (name || '').replace(/\s+/g, '');
  return !!t && !!n && t.includes(n);
}

/** 이 재료를 **냉장고의 다른 재료로 대신할 수 있는지** — 있으면 가장 점수 높은 후보. 목록의 개수·칩·레시피 창이 같은 기준을 쓴다. */
export function pickSubstitute<T extends Candidate>(
  missing: string,
  list: T[] | undefined | null,
  mySet: Set<string>,
  title?: string,
): T | undefined {
  if (isMainIngredient(missing, title)) return undefined;
  return usableSubstitutes(list, missing)
    .filter(c => mySet.has(norm(c.ingredient_b)))
    .sort((a, b) => (b.similarity_score ?? 0) - (a.similarity_score ?? 0))[0];
}
