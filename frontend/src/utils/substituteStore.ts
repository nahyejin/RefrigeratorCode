/**
 * 대체 재료 표와 「쿡 코치에게 물어볼 질문」을 화면들 사이에 **메모리로** 건네는 곳(2026-11-07).
 *
 * 왜 필요한가 — 표(`ingredient_substitute_table.csv`)는 **29MB** 다. 목록 화면들은 이것을 파싱해 브라우저 저장소(localStorage)에 넣으려 하지만
 * 휴대폰은 한도가 5MB 안팎이라 **저장이 조용히 실패한다**(실패를 경고로만 넘긴다). 그래서 목록 카드에는 「양념 소불고기 → 만두」 칩이 뜨는데,
 * 레시피 창은 저장소에서 표를 못 찾아 **칩이 하나도 안 떴다**(실사용 화면 녹화로 확인). 목록이 받은 표를 여기 메모리에 올려 두고 레시피 창이 읽는다.
 */
export type SharedSubstituteTable = { [key: string]: { ingredient_b: string; similarity_score?: number }[] };

let shared: SharedSubstituteTable | null = null;

/** 목록 화면이 표를 받았을 때 부른다. 비어 있으면 무시. */
export function shareSubstituteTable(table: SharedSubstituteTable | null | undefined): void {
  if (table && Object.keys(table).length > 0) shared = table;
}

export function getSharedSubstituteTable(): SharedSubstituteTable | null {
  return shared;
}

/**
 * 카드 바깥의 대체 칩(「쪽파 → 대파」)을 눌렀을 때 — 레시피 창을 열고 쿡 코치 카드가 **이 질문을 채운 채로** 열리게 한다.
 * 레시피 창이 아직 안 열려 있으므로 질문을 여기 맡겨 두고, 쿡 코치가 뜰 때 가져간다(레시피가 같을 때만).
 */
let pendingCoach: { recipeId: number; question: string } | null = null;

export function askCoachOnOpen(recipeId: number, question: string): void {
  pendingCoach = { recipeId, question };
}

export function takePendingCoachQuestion(recipeId: number): string | null {
  if (pendingCoach && pendingCoach.recipeId === recipeId) {
    const q = pendingCoach.question;
    pendingCoach = null;
    return q;
  }
  return null;
}
