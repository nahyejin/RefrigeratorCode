/**
 * 지금 보고 있는 화면의 **조건**을 쿡 픽(밖의 추천 챗봇)이 읽을 수 있게 담아 두는 곳(2026-11-06).
 *
 * 왜 필요한가: 냉장고요리 화면에서 검색어·매칭률·임박 재료·정렬을 걸어 놓고 쿡 픽에게 물으면, 쿡 픽은 그걸 몰라서 화면과 상관없는
 * 추천을 했다. 요즘인기에서 「급상승」이나 「유튜브」를 보다가 물어도 마찬가지. 화면이 자기 조건을 여기에 적어 두면, 쿡 픽이
 * 질문을 보낼 때 같이 보내서 **그 조건을 기본값으로 반영**한다(사용자가 이번 말에서 다르게 말하면 이번 말이 우선).
 *
 * 화면은 조건이 바뀔 때마다 `setPageContext` 를 부르고, 화면을 떠날 때 `null` 로 비운다. 쿡 픽은 보낼 때 `getPageContext` 로 읽는다.
 * 어느 화면인지(`page`)는 주소로 정하고, 여기에는 **화면이 아는 조건 문장들**(`lines`)만 둔다.
 */
export interface PageContext {
  page: 'recipe-list' | 'popular';
  lines: string[];
}

let current: PageContext | null = null;

export function setPageContext(ctx: PageContext | null): void {
  current = ctx;
}

export function getPageContext(): PageContext | null {
  return current;
}
