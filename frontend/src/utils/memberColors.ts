/**
 * 식구(그룹원) 색 — 요리캘린더와 내냉장고 「재료 기록」 이 같이 쓴다.
 *
 * 그룹원을 색으로 구분하기 위한 팔레트. 그룹 최대 인원(서버 `HOUSEHOLD_MAX_MEMBERS`,
 * 10명)과 같은 10색이다 — 인원을 늘리면 이 색도 같이 늘릴 것.
 * 브랜드 강조색(노랑)·"요리 계획 있는 날" 표식(빨강)과 헷갈리지 않게 빨강·노랑 계열은 뺐다.
 */
export const MEMBER_COLORS = [
  '#3B82F6', // 파랑
  '#F97316', // 주황
  '#22C55E', // 초록
  '#A855F7', // 보라
  '#65A30D', // 올리브
  '#06B6D4', // 하늘
  '#EC4899', // 분홍
  '#92400E', // 갈색
  '#64748B', // 회색
  '#4338CA', // 남색
];

/** 그룹원 id 오름차순 목록에서 몇 번째인지로 색을 고른다. 화면마다 같은 사람은 같은 색. */
export function colorForUser(userId: number, orderedIds: number[]): string {
  const idx = orderedIds.indexOf(userId);
  return MEMBER_COLORS[idx % MEMBER_COLORS.length];
}
