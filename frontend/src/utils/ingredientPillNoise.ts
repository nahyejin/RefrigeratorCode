/**
 * 레시피 used_ingredients 파싱 (pill·매칭 공통).
 *
 * **한글 한 글자**로만 보이는 토큰은, 쉼표로 나눈 **원문 구간**이
 * ` (공백)(한 글자)(공백) ` 형태일 때만 조사·오분절 노이즈로 보고 제외합니다.
 * - `대게`, `게살`, `,게,`(공백 없음) 등은 한 글자 토큰이 아니거나 공백 패턴이 아니어서 유지
 * - `..., 게 ,...` 구간이 ` 게 ` → 제외 (게만이 아니라 같은 패턴의 한 글자 전부)
 */

function isSpacedStandaloneSingleHangulNoise(rawSegment: string): boolean {
  const t = rawSegment.trim();
  if (t.length !== 1 || !/^[가-힣]$/.test(t)) return false;
  return /^\s+.\s+$/.test(rawSegment);
}

export function parseUsedIngredientsForPills(
  ingredients: string | string[] | undefined | null
): string[] {
  if (ingredients == null) return [];
  if (Array.isArray(ingredients)) {
    return ingredients
      .filter((seg): seg is string => typeof seg === 'string')
      .filter(seg => {
        const t = seg.trim();
        if (!t) return false;
        if (isSpacedStandaloneSingleHangulNoise(seg)) return false;
        return true;
      })
      .map(seg => seg.trim());
  }
  const s = ingredients.trim();
  if (!s) return [];
  return s
    .split(',')
    .filter(seg => {
      const t = seg.trim();
      if (!t) return false;
      if (isSpacedStandaloneSingleHangulNoise(seg)) return false;
      return true;
    })
    .map(seg => seg.trim());
}
