/**
 * 같은 CSV 를 **한 번만** 받는다.
 *
 * 무엇이 문제였나 (실측):
 *   냉장고 요리 화면에 들어가면 `ingredient_substitute_table.csv` 가 **두 번**
 *   내려왔다. 이 파일은 12.2MB 다 — 한 번 들어가는 데 24MB 를 받는다.
 *   `ingredient_profile_dict_with_substitutes.csv` 는 네 번 내려왔다.
 *
 *   화면마다 각자 `fetch` 를 하고, localStorage 캐시는 **다 받은 뒤에야** 써진다.
 *   그래서 처음 들어갈 때는 여러 곳이 동시에 출발해 아무도 캐시를 못 본다.
 *   개발 컴퓨터에서는 82ms 라 안 보였지만, 휴대폰에서 이건 그대로 몇 초다.
 *
 * 무엇을 하나:
 *   받는 중인 약속을 주소별로 들고 있다가, 같은 것을 또 달라고 하면 **그 약속을
 *   그대로 돌려준다.** 이미 다 받았으면 그 글자를 그대로 준다.
 *
 * 왜 localStorage 가 아닌가:
 *   12MB 는 localStorage 에 안 들어간다(보통 5~10MB 한도). 화면들이 각자
 *   **파싱한 결과**를 캐시하는 것은 그대로 두고, 여기서는 **받는 일**만 합친다.
 */

const inflight = new Map<string, Promise<string>>();
const done = new Map<string, string>();

/** 이 주소의 CSV 글자. 이미 받았거나 받는 중이면 그것을 쓴다. */
export function fetchCsvOnce(url: string): Promise<string> {
  const has = done.get(url);
  if (has !== undefined) return Promise.resolve(has);

  const running = inflight.get(url);
  if (running) return running;

  const p = fetch(url)
    .then(r => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
    .then(text => {
      done.set(url, text);
      return text;
    })
    .finally(() => {
      inflight.delete(url);
    });

  inflight.set(url, p);
  return p;
}

/**
 * 받아 둔 글자를 놓아 준다.
 *
 * 12MB 짜리를 계속 들고 있을 이유가 없다 — 화면들은 각자 **파싱한 결과**를
 * 따로 캐시하므로, 원본 글자는 한 화면이 다 쓰고 나면 버려도 된다.
 */
export function releaseCsv(url: string): void {
  done.delete(url);
}
