/**
 * 레시피 제목을 **목록용으로 최대한 짧게** 줄인다(2026-11-07 식단 짜기 결과 「제목을 줄일 수 있는 만큼 줄여 달라」).
 * 블로그·유튜브 제목은 「꽃굴무침 레시피 생굴 500g 손질법과 대게백간장 소스」처럼 검색용 꼬리가 길다 → 요리 이름만 남긴다.
 * 표시용일 뿐이다(원문 제목은 그대로 두고, 접근성 이름·창 제목에는 원문을 쓴다).
 *
 *  1. 앞의 이모지·괄호 머리말을 걷는다.
 *  2. 「레시피 / 만드는법 / 만들기 / 끓이는법 / 조리법…」 같은 **꼬리 신호 낱말 앞에서 자른다**(앞이 2글자 이상일 때).
 *  3. 그래도 길면 구분자( | ｜ - , ! ? ~ ) 앞에서 자른다.
 *  4. 마지막으로 18자를 넘으면 … 로 줄인다.
 */
const TAIL_WORDS = /\s*(황금\s*레시피|초간단\s*레시피|레시피|만드는\s*법|만드는법|만들기|만들어\s*먹|끓이는\s*법|끓이는법|삶는\s*법|삶는법|조리법|요리법|비법|꿀팁)/;
const SEPARATORS = /\s*[|｜\-–—,，!?~·:：]\s*/;
const MAX_LEN = 18;

export function shortRecipeTitle(raw: string | null | undefined): string {
  let t = String(raw || '').trim();
  if (!t) return '';
  // 앞머리 이모지·기호·괄호 머리말( 【…】 [..] (..) )
  t = t.replace(/^(?:[\s\p{Extended_Pictographic}\u200d\ufe0f✔✅★☆♥♡❤]+|[\[【(（][^\]】)）]{0,12}[\]】)）])+/u, '').trim();
  // 남은 이모지는 공백으로
  t = t.replace(/[\p{Extended_Pictographic}\u200d\ufe0f✔✅]+/gu, ' ').replace(/\s{2,}/g, ' ').trim();

  const tail = t.match(TAIL_WORDS);
  if (tail && tail.index !== undefined && tail.index >= 2) t = t.slice(0, tail.index).trim();

  if (t.length > MAX_LEN) {
    const sep = t.match(SEPARATORS);
    if (sep && sep.index !== undefined && sep.index >= 3) t = t.slice(0, sep.index).trim();
  }
  if (t.length > MAX_LEN) t = t.slice(0, MAX_LEN - 1).trim() + '…';
  return t || String(raw || '').trim();
}
