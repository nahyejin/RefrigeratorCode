/**
 * 재료별 유통기한 추정.
 *
 * 왜 카테고리 단위인가:
 *   재료 사전에 등록된 재료는 2,900개가 넘는다. 하나하나 보관 일수를 채워 넣는 것은
 *   현실적이지 않고, 채워 넣어도 "돼지고기 목살 3일 / 앞다리살 3일" 처럼 결국
 *   같은 값이 반복된다. 재료 사전에는 이미 대분류~세분류가 들어 있으므로
 *   그 층위에 값을 붙이면 30~40줄로 전체를 덮을 수 있다.
 *
 * 정확도에 대해:
 *   유통기한은 포장·손질 상태·온도에 따라 크게 달라져서 애초에 정확한 값을 낼 수 없다.
 *   여기서 내는 값은 "대략 이 즈음" 이고, 화면에도 `약 D-5` 처럼 추정임을 표시한다.
 *   그래서 실제 유통기한을 입력한 재료가 있으면 그쪽을 항상 우선한다.
 *
 * 값이 없으면 추정하지 않는다:
 *   카테고리를 못 찾은 재료에 임의의 기본값을 씌우면, 맞을 때보다 틀릴 때의 손해가 크다
 *   (실제로는 한 달 가는 재료에 D-7 이 붙어 멀쩡한 재료를 버리게 됨).
 *   그래서 매칭 실패 시에는 아무 표시도 하지 않는다.
 *
 * ── 값을 정하는 기준 (2026-09-06 손봄) ────────────────────────────────
 *
 * 처음 값은 냉장·실온이 전반적으로 짧았다. 위 문단이 경계한 바로 그 손해 —
 * **멀쩡한 재료를 버리게 만드는 쪽** — 으로 기울어 있었다.
 *
 *  1. **냉장은 안전과 직결되므로 짧게 둔다.** 생선 2일, 조개·연체 2일은
 *     그대로고 생고기는 3 → 4일뿐이다. 여기서 늘리면 사람이 상한 것을 먹게
 *     된다. 대신 뿌리채소(21→30)·과일(7→14)·치즈(30→45)처럼 **상하는 데
 *     원래 오래 걸리는 것**만 올렸다.
 *  2. **실온은 "서늘한 곳" 을 가정한다.** 감자·양파를 베란다에 두면 한두 달
 *     간다. 뿌리채소 14 → 30일.
 *  3. **냉동은 거의 안 건드린다.** 한때 USDA 기준(8~12개월)을 그대로 옮겨
 *     240일까지 올렸다가 되돌렸다. 두 가지가 틀렸다:
 *       - 그 숫자는 **−18°C 를 계속 유지하고 제대로 포장한** 조건의 값이다.
 *         가정 냉동실은 문을 자주 여닫고 성에가 끼고 소분 포장도 아니라,
 *         실제로는 한두 달이면 냉동상이 온다.
 *       - **`약 D-238` 은 정보가 아니다.** 아무 행동도 부르지 않고, 그러면
 *         냉동실 재료가 임박 목록에 영영 안 올라온다. 이 앱은 냉장고를 털게
 *         하려고 있는 것인데 냉동실이 무덤이 된다.
 *     명백히 짧았던 둘만 남겼다 — 잎채소 30 → 60, 과일 90 → 120.
 *
 * 그래도 이 값은 대략이다 — 포장·손질 상태·문 여닫는 횟수에 따라 달라진다.
 * 그래서 화면에는 늘 `약 D-5` 처럼 짐작임을 밝히고, 사용자가 적은 실제
 * 유통기한이 있으면 그쪽을 무조건 먼저 쓴다.
 */

import { fetchCsvOnce } from './csvOnce';

export type StorageKind = 'frozen' | 'fridge' | 'room';

/** 보관 방법별 보관 가능 일수. null 은 "그 방법으로는 보관하지 않음"(추정하지 않음) */
type ShelfLife = { frozen: number | null; fridge: number | null; room: number | null };

/**
 * 세분류 → 소분류 → 중분류 순으로 찾는다.
 * 아래로 갈수록 뭉뚱그린 값이므로, 구체적인 층위에 값이 있으면 그것을 쓴다.
 */
const BY_DETAIL: Record<string, ShelfLife> = {
  // 채소 — 잎채소가 가장 빨리 무르고, 뿌리채소가 가장 오래 간다
  '잎채소류': { frozen: 60, fridge: 7, room: 2 },
  '열매채소류': { frozen: 90, fridge: 10, room: 5 },
  '뿌리채소류': { frozen: 180, fridge: 30, room: 30 },
  '과일': { frozen: 120, fridge: 14, room: 7 },

  // 육류·수산 — 실온 보관은 권하지 않으므로 room 은 추정하지 않는다
  '육류': { frozen: 120, fridge: 4, room: null },
  '가공육': { frozen: 60, fridge: 10, room: null },
  '생선류': { frozen: 90, fridge: 2, room: null },
  '조개류/연체류': { frozen: 60, fridge: 2, room: null },
  '갑각류': { frozen: 90, fridge: 3, room: null },
  '달걀/난류': { frozen: null, fridge: 35, room: 10 },
  '건조해산물류': { frozen: 365, fridge: 180, room: 180 },

  // ── 아래는 소분류만 보면 **위험할 만큼 길게** 잡히던 것들 ───────────────
  // 소분류 하나에 성격이 아주 다른 것이 섞여 있어, 세분류로 갈라 준다.

  // `완제품·조리불요`(냉장 10일) 안에 지어 둔 밥이 섞여 있었다. 밥은 냉장 2~3일이다.
  '즉석밥/곡류': { frozen: 90, fridge: 3, room: 2 },
  // `감칠맛/육수`(냉장 14일) 안에 끓인 육수가 섞여 있었다. 국물은 냉장 3일이다.
  // (다시다·라면스프 같은 건조·분말은 같은 소분류지만 세분류가 달라 안 걸린다)
  '기타 육수보완재': { frozen: 90, fridge: 3, room: 1 },
  // `즉석조리 필요`(냉장 180일) 안에 냉장 만두·피자·밀키트가 섞여 있었다.
  // 라면(즉석면류)은 세분류가 달라 그대로 180일이다.
  '즉석조리식/밀키트': { frozen: 180, fridge: 7, room: 3 },
  '즉석조리식': { frozen: 180, fridge: 7, room: 3 },
  '즉석국/탕류': { frozen: 180, fridge: 7, room: 30 },
  // `조리완성형 재료`(냉장 90일) 안에 생지·만두피·떡이 섞여 있었다.
  '반죽류(베이스)': { frozen: 90, fridge: 7, room: 1 },
  '반죽류(피/피대체)': { frozen: 90, fridge: 14, room: 2 },
  '떡류': { frozen: 90, fridge: 7, room: 2 },
  // `완제품·조리불요`(냉장 10일) 안에 김치가 있었다. 김치는 몇 달 간다 —
  // 한국 냉장고에 늘 있는 것이라 10일로 잡으면 임박 목록이 김치로 덮인다.
  // (같은 칸의 묵은 5일이라 아래 이름 예외로 뺀다)
  '즉석반찬/김치류': { frozen: 180, fridge: 90, room: 14 },
  '해조류': { frozen: 180, fridge: 21, room: 180 },
};

const BY_SUB: Record<string, ShelfLife> = {
  '곡류': { frozen: 365, fridge: 180, room: 180 },
  '두류/콩류': { frozen: 365, fridge: 180, room: 180 },
  '견과/씨앗/고추류': { frozen: 365, fridge: 180, room: 90 },
  '버섯류': { frozen: 90, fridge: 10, room: 5 },
  '기타 기능성 식재료': { frozen: 180, fridge: 90, room: 90 },

  // 유제품
  '우유/분유': { frozen: null, fridge: 10, room: 60 }, // 실온 보관을 골랐다면 멸균 제품으로 본다
  '요거트/발효유': { frozen: null, fridge: 21, room: 2 },
  '버터류': { frozen: 180, fridge: 90, room: 7 },
  '크림류': { frozen: 60, fridge: 10, room: 2 },
  '치즈': { frozen: 180, fridge: 45, room: 3 },
  '치즈(디저트용)': { frozen: 180, fridge: 45, room: 3 },
  '치즈(분말)': { frozen: 365, fridge: 180, room: 90 },
  '치즈(샐러드용)': { frozen: 180, fridge: 30, room: 3 },
  '치즈(스프레드)': { frozen: 180, fridge: 45, room: 3 },
  '치즈(슬라이스)': { frozen: 180, fridge: 45, room: 3 },
  '치즈(토핑용)': { frozen: 180, fridge: 45, room: 3 },
  '치즈(폼)': { frozen: 180, fridge: 30, room: 3 },
  '치즈(피자용)': { frozen: 180, fridge: 45, room: 3 },
  '기타 유제품': { frozen: 90, fridge: 21, room: 7 },

  // 양념 — 대부분 오래 가지만, 다진마늘·육수처럼 짧은 것이 섞여 있어 따로 둔다
  '향신다짐류': { frozen: 180, fridge: 30, room: 3 },
  '감칠맛/육수': { frozen: 180, fridge: 14, room: 180 },
  '요리베이스/소스': { frozen: 180, fridge: 90, room: 90 },
  '디핑/스프레드': { frozen: 180, fridge: 90, room: 60 },
  '디핑/혼합 소스': { frozen: 180, fridge: 90, room: 60 },
  '풍미오일': { frozen: null, fridge: 365, room: 180 },

  // 즉석식
  '통조림/보존식품': { frozen: null, fridge: 730, room: 730 },
  '완제품·조리불요': { frozen: 90, fridge: 10, room: 30 },
  '즉석조리 필요': { frozen: 180, fridge: 180, room: 180 },
  '디저트/간식류': { frozen: 90, fridge: 45, room: 90 },

  // 베이킹
  '조리보조 기능성 재료': { frozen: 365, fridge: 365, room: 365 },
  '조리완성형 재료': { frozen: 180, fridge: 90, room: 90 },
  '완제품/준완제품': { frozen: 90, fridge: 21, room: 30 },

  // 음료
  '주류': { frozen: null, fridge: 730, room: 730 },
  '차류': { frozen: null, fridge: 365, room: 365 },
  '커피류': { frozen: null, fridge: 365, room: 365 },
  '탄산 음료': { frozen: null, fridge: 180, room: 180 },
  '비탄산 음료': { frozen: null, fridge: 180, room: 180 },
  '기타 음료': { frozen: null, fridge: 180, room: 180 },

  '조리용 얼음류': { frozen: 90, fridge: null, room: null },
};

const BY_MID: Record<string, ShelfLife> = {
  // 소금·간장·설탕 같은 기본 양념은 사실상 상하지 않는다
  '양념/조미료': { frozen: 365, fridge: 365, room: 365 },
  '유제품': { frozen: 90, fridge: 21, room: 7 },
  '즉석식/간편식': { frozen: 180, fridge: 30, room: 90 },
  '베이킹·제면·디저트용 재료': { frozen: 180, fridge: 90, room: 90 },
  '베이킹·제면·디저트용': { frozen: 180, fridge: 90, room: 90 },
  '음료/주류': { frozen: null, fridge: 180, room: 180 },
  '빙재료': { frozen: 90, fridge: null, room: null },
};

/**
 * **분류로는 못 가르는 것들.** 이름을 그대로 보고 먼저 걸러 낸다.
 *
 * 사전의 분류는 "무엇으로 만들었나" 기준이라, 보관 기간이 전혀 다른 것이 한
 * 칸에 들어오는 경우가 있다. 실제로 확인된 것만 적는다:
 *
 *  - 두부·콩나물·숙주가 `두류/콩류`(냉장 **180일**)에 있었다. 마른 콩과 같은
 *    칸이라 그렇다. 두부는 5일, 콩나물·숙주는 3일이다. **가장 위험했던 칸.**
 *  - 내장·곱창이 `육류`(4일)에 있었다. 부산물은 1~2일이다.
 *  - 게장이 `가공육`(10일)에 있었다. 3일이다.
 *  - 푸딩·커스터드가 `디저트/간식류`(45일)에 과자와 같이 있었다. 3일이다.
 *  - 반대로 건과일·곶감이 생과일(`과일`, 냉장 14일)과 같은 칸이라 너무 짧았다.
 *    말린 것은 반년 간다.
 *  - 햇반은 `즉석밥/곡류`(실온 2일)인데 실온 보관이 되는 제품이다.
 */
const BY_NAME: Record<string, ShelfLife> = {
  // 두부류 — 물에 담긴 채로 팔려 빨리 상한다
  '두부': { frozen: 90, fridge: 5, room: 1 },
  '순두부': { frozen: 90, fridge: 3, room: 1 },
  '연두부': { frozen: 90, fridge: 3, room: 1 },
  '전두부': { frozen: 90, fridge: 5, room: 1 },
  '동두부': { frozen: 90, fridge: 5, room: 1 },
  '포두부': { frozen: 90, fridge: 7, room: 1 },
  '건두부': { frozen: 180, fridge: 30, room: 14 },
  '비지': { frozen: 90, fridge: 3, room: 1 },
  '콩물': { frozen: 60, fridge: 3, room: 1 },

  // 콩나물·숙주 — 냉장고에서 가장 빨리 무르는 축이다
  '콩나물': { frozen: 30, fridge: 3, room: 1 },
  '숙주': { frozen: 30, fridge: 2, room: 1 },
  '숙주나물': { frozen: 30, fridge: 2, room: 1 },

  // 부산물 — 같은 육류라도 훨씬 빨리 상한다
  '내장': { frozen: 60, fridge: 2, room: null },
  '곱창': { frozen: 60, fridge: 2, room: null },
  '염통': { frozen: 60, fridge: 2, room: null },
  '소 부산물': { frozen: 60, fridge: 2, room: null },
  '닭 부산물': { frozen: 60, fridge: 2, room: null },
  '거위 부산물': { frozen: 60, fridge: 2, room: null },
  '닭똥집': { frozen: 60, fridge: 2, room: null },

  '게장': { frozen: 60, fridge: 3, room: null },

  // 냉장 디저트 — 과자와 한 칸에 있었다
  '푸딩': { frozen: null, fridge: 3, room: 1 },
  '커스터드': { frozen: null, fridge: 3, room: 1 },
  '크레페': { frozen: 30, fridge: 3, room: 1 },
  '생크림': { frozen: null, fridge: 5, room: 1 },

  // 말린 과일 — 생과일과 한 칸이라 너무 짧았다
  '건과일': { frozen: 365, fridge: 180, room: 180 },
  '건포도': { frozen: 365, fridge: 180, room: 180 },
  '건크렌베리': { frozen: 365, fridge: 180, room: 180 },
  '곶감': { frozen: 365, fridge: 90, room: 30 },
  '대추야자': { frozen: 365, fridge: 180, room: 180 },

  // 묵 — 김치와 한 칸(`즉석반찬/김치류`)이라 90일로 잡혔다. 묵은 5일이다.
  '도토리묵': { frozen: null, fridge: 5, room: 1 },
  '메밀묵': { frozen: null, fridge: 5, room: 1 },
  '녹두묵': { frozen: null, fridge: 5, room: 1 },
  '우무묵': { frozen: null, fridge: 5, room: 1 },
  '옥수수묵': { frozen: null, fridge: 5, room: 1 },

  // 실온 보관 제품
  '햇반': { frozen: null, fridge: 270, room: 270 },
};

export type IngredientCategory = { mid: string; sub: string; detail: string };
export type CategoryMap = Record<string, IngredientCategory>;

const CSV_URL = '/ingredient_profile_dict_with_substitutes.csv';
const CACHE_KEY = 'ingredient_category_map_v1';

let cached: Promise<CategoryMap> | null = null;

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/**
 * 재료명(및 동의어) → 카테고리 표를 만든다.
 * 앱 전체에서 한 번만 받아오면 되므로 모듈 수준에서 Promise 를 재사용하고,
 * localStorage 에도 남겨 다음 방문 때 네트워크를 타지 않게 한다.
 */
export function loadIngredientCategoryMap(): Promise<CategoryMap> {
  if (cached) return cached;

  cached = (async () => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) return JSON.parse(raw) as CategoryMap;
    } catch {
      // 캐시가 깨졌으면 그냥 새로 받는다
    }

    const text = await fetchCsvOnce(CSV_URL);

    const lines = text.split('\n');
    const header = splitCsvLine(lines[0]);
    const idx = {
      keyword: header.indexOf('keyword'),
      synonyms: header.indexOf('synonyms'),
      main: header.indexOf('대분류'),
      mid: header.indexOf('중분류'),
      sub: header.indexOf('소분류'),
      detail: header.indexOf('세분류'),
    };

    const map: CategoryMap = {};
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const cols = splitCsvLine(lines[i]);
      // 요리이름·단위·TPO 등은 냉장고에 들어갈 대상이 아니므로 건너뛴다
      if (cols[idx.main] !== '재료') continue;

      const keyword = cols[idx.keyword];
      if (!keyword) continue;
      const cat: IngredientCategory = {
        mid: (cols[idx.mid] || '').trim(),
        sub: (cols[idx.sub] || '').trim(),
        detail: (cols[idx.detail] || '').trim(),
      };
      map[keyword] = cat;

      // 동의어로 저장된 재료도 찾을 수 있게 함께 등록
      const syn = cols[idx.synonyms] || '';
      syn
        .split(/[,/|]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s) => {
          if (!map[s]) map[s] = cat;
        });
    }

    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(map));
    } catch {
      // 용량 초과 등으로 못 남겨도 동작에는 지장이 없다
    }
    return map;
  })();

  return cached;
}

/**
 * 카테고리 + 보관 방법으로 보관 가능 일수를 찾는다. 못 찾으면 null
 *
 * 이름 예외 → 세분류 → 소분류 → 중분류 순. 위로 갈수록 구체적이다.
 */
export function lookupShelfLifeDays(
  cat: IngredientCategory | undefined,
  storage: StorageKind,
  name?: string,
): number | null {
  const byName = name ? BY_NAME[name] : undefined;
  if (byName) return byName[storage];
  if (!cat) return null;
  const table = BY_DETAIL[cat.detail] || BY_SUB[cat.sub] || BY_MID[cat.mid];
  if (!table) return null;
  return table[storage];
}

/** 'yyyy.mm.dd' 또는 'yyyy-mm-dd' → Date. 형식이 어긋나면 null */
function parseDate(value: string): Date | null {
  const d = new Date(value.replace(/\./g, '-'));
  return isNaN(d.getTime()) ? null : d;
}

/**
 * 구매일 + 재료 카테고리로 유통기한을 추정한다.
 * @returns 'yyyy.mm.dd' 형식 문자열, 추정할 수 없으면 null
 */
export function estimateExpiry(
  ingredientName: string,
  storage: StorageKind,
  purchaseDate: string,
  categoryMap: CategoryMap
): string | null {
  const days = lookupShelfLifeDays(categoryMap[ingredientName], storage, ingredientName);
  if (days == null) return null;

  const base = parseDate(purchaseDate);
  if (!base) return null;

  base.setDate(base.getDate() + days);
  const yyyy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, '0');
  const dd = String(base.getDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
}
