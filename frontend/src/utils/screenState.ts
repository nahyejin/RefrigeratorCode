/**
 * 화면의 「보던 자리」(탭·기간·더 보기·스크롤)를 **방문 기록 한 칸(history entry)마다** 따로 기억해 둔다.
 *
 * 왜 만들었나(2026-11-07): 요즘인기에서 급상승 키워드를 눌러 상세로 갔다가 뒤로 오면 항상 첫 탭(인기 레시피)으로
 * 돌아왔다. 화면(컴포넌트)은 다른 페이지로 갈 때 사라졌다가 뒤로 올 때 **새로 만들어지는데**, 탭·기간이
 * 컴포넌트 state 에만 있어서 기본값으로 초기화됐기 때문이다. 안드로이드 뒤로·iOS 스와이프 뒤로·브라우저 뒤로는 모두
 * 같은 방문 기록(history)을 쓰므로, 방문 기록 칸의 고유 번호(`location.key`)로 열쇠를 삼으면 셋 다 한 번에 고쳐진다.
 *
 * - 하단 탭으로 새로 들어온 화면은 새 칸(새 key)이라 기본 상태로 시작한다(예전과 같다).
 * - 뒤로 와서 같은 칸이 되살아나면 그 칸에 적어 둔 상태가 돌아온다.
 * - sessionStorage 라 앱/탭을 닫으면 사라진다. 쓰기·읽기가 막혀도(사생활 보호 모드) 조용히 넘어간다.
 */
const PREFIX = 'cm_screen:';
/** 오래된 칸이 무한히 쌓이지 않게 화면 이름마다 이만큼만 남긴다. */
const KEEP = 30;

export function loadScreenState<T extends object>(name: string, entryKey: string): T | null {
  try {
    const raw = sessionStorage.getItem(`${PREFIX}${name}:${entryKey}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveScreenState(name: string, entryKey: string, value: object): void {
  try {
    const k = `${PREFIX}${name}:${entryKey}`;
    sessionStorage.setItem(k, JSON.stringify(value));
    // 이름별 인덱스로 오래된 것부터 지운다.
    const idxKey = `${PREFIX}${name}:__index`;
    const idx: string[] = JSON.parse(sessionStorage.getItem(idxKey) || '[]');
    const next = [...idx.filter(x => x !== k), k];
    while (next.length > KEEP) {
      const old = next.shift();
      if (old) sessionStorage.removeItem(old);
    }
    sessionStorage.setItem(idxKey, JSON.stringify(next));
  } catch {
    /* 저장이 안 돼도 화면은 그대로 동작한다 */
  }
}
