/**
 * 초대 링크(카카오톡/문자 등으로 공유)로 들어온 사람을 로그인 이후까지
 * 이어주기 위한 저장소.
 *
 * 로그인이 안 된 상태로 초대 링크를 열면 로그인/회원가입부터 해야 하는데,
 * 그 사이 URL의 초대 코드가 사라지면 다시 링크를 받아야 한다. 로그인 완료
 * 시점까지 코드를 기기에 잠깐 들고 있다가, 로그인 직후 참여 화면으로
 * 이어준다.
 */
const PENDING_CODE_KEY = 'cookmatch_pending_invite_code';

export function stashPendingInviteCode(code: string): void {
  try {
    localStorage.setItem(PENDING_CODE_KEY, code);
  } catch {
    // 저장 실패해도 치명적이지 않음 — 그냥 이어받기가 안 될 뿐
  }
}

export function getPendingInviteCode(): string | null {
  try {
    return localStorage.getItem(PENDING_CODE_KEY);
  } catch {
    return null;
  }
}

export function clearPendingInviteCode(): void {
  try {
    localStorage.removeItem(PENDING_CODE_KEY);
  } catch {
    // ignore
  }
}

/** 로그인 직후 이동할 경로. 대기 중인 초대 코드가 있으면 참여 화면으로. */
export function getPostLoginRedirectPath(defaultPath: string): string {
  const code = getPendingInviteCode();
  return code ? `/join-household?code=${encodeURIComponent(code)}` : defaultPath;
}
