/**
 * 로그인하러 갔다가 **보던 자리로 돌아오게** 하는 저장소(2026-10-29).
 *
 * 레시피 패널(요리 모드 시트)을 보다가 「3초 만에 저장하기」·한도 안내의 「로그인하기」를 누르면, 예전에는
 * `/login` 으로 이동만 했다. 패널은 앱 전체 위에 떠 있는 별도 층이라 로그인 화면이 그 **뒤**에 그려졌고
 * (패널을 닫아야 보임), 로그인을 마쳐도 보던 레시피로 돌아올 길이 없었다.
 *
 * 이제 이동하기 전에 「어느 화면 + 열려 있던 레시피」를 기기에 잠깐 적어 두고 패널을 닫은 뒤 로그인 화면을 보여 준다.
 * 로그인(가입)이 끝나면 그 화면으로 돌아가 같은 레시피 패널을 다시 연다(`getPostLoginRedirectPath` 가 읽는다).
 * 소셜 로그인은 다른 사이트(또는 시스템 브라우저)를 다녀오며 화면 상태가 사라지므로 메모리가 아니라 localStorage 에 둔다.
 */
import { CookTarget, getCookTarget, openCookMode, closeCookMode } from './cookMode';

const KEY = 'cookmatch_post_login_return';
/** 이 시간이 지나면 잊는다 — 로그인하러 갔다가 마음을 바꿔 한참 뒤에 로그인할 때 엉뚱한 자리로 보내지 않으려고 */
const MAX_AGE_MS = 15 * 60 * 1000;
/** 로그인과 관계된 화면은 돌아갈 자리로 적지 않는다(로그인 화면으로 되돌아오는 꼴이 된다) */
const NO_RETURN_PATHS = ['/login', '/signup', '/auth', '/find-email', '/reset-password', '/join-household'];

interface Saved {
  path: string;
  cook: CookTarget | null;
  at: number;
}

/** 로그인 화면으로 가기 직전에 부른다. 지금 화면과 열려 있는 레시피 패널을 적어 두고, 패널은 닫는다. */
export function rememberPostLoginReturn(): void {
  try {
    const { pathname, search } = window.location;
    const cook = getCookTarget();
    const path = NO_RETURN_PATHS.some(p => pathname.startsWith(p)) ? null : `${pathname}${search}`;
    if (path) {
      const saved: Saved = { path, cook, at: Date.now() };
      localStorage.setItem(KEY, JSON.stringify(saved));
    }
  } catch {
    /* 못 적으면 로그인 뒤 기본 화면으로 간다 — 로그인은 막지 않는다 */
  }
  // 패널이 열려 있으면 로그인 화면을 가린다 — 돌아올 때 다시 열 것이므로 닫아 둔다
  closeCookMode();
}

/** 로그인 화면에서 「뒤로」·「비회원으로 계속하기」를 골랐다 — 돌아갈 자리를 잊는다 */
export function clearPostLoginReturn(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* 무시 */
  }
}

/**
 * 로그인(가입)이 끝난 직후 부른다. 적어 둔 자리가 있으면 그 경로를 돌려주고, 레시피 패널이 있었으면
 * 화면이 바뀐 뒤 다시 연다. 한 번 읽으면 지운다.
 */
export function takePostLoginReturn(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    localStorage.removeItem(KEY);
    const saved = JSON.parse(raw) as Saved;
    if (!saved?.path || typeof saved.at !== 'number' || Date.now() - saved.at > MAX_AGE_MS) return null;
    if (saved.cook) {
      const cook = saved.cook;
      // 화면 이동이 끝난 뒤에 열어야 새 화면에 가려지지 않는다
      window.setTimeout(() => openCookMode(cook), 600);
    }
    return saved.path;
  } catch {
    return null;
  }
}
