# 쿠팡 링크 채우기

## 한 줄 요약

`frontend/public/coupang_ads.csv` 의 **`coupang_url` 칸**을 채우면 된다.
재료 250개가 **많이 쓰이는 순서로** 줄 세워져 있고, 링크만 비어 있다.

---

## 지금 상태 (2026-09-08)

| | 개수 |
|---|---|
| `coupang_ads.csv` 후보 | 250줄 |
| 링크가 채워진 것 | **2개** (다진마늘 · 설탕) |

**나머지는 누르면 그냥 쿠팡 검색으로 갑니다 — 수수료가 안 붙습니다.**
250개를 다 채울 필요는 없다. **상위 20~30개만 채워도 대부분 덮인다.**

> 예전에는 파트너 ID 로 링크를 자동으로 만들어 붙이고 있었다. 그런데
> **그 링크는 동작하지 않았다.** `link.coupang.com/a/{코드}` 의 코드 자리는
> 링크 하나마다 파트너스가 발급하는 **짧은 링크 코드**이지 파트너 ID 가 아니다.
> 실제로 눌러 보면 302 로 `https://www.coupang.com/` (쿠팡 첫 화면)으로만 갔다 —
> 재료 이름은 사라지고 성과도 안 잡혔다.
>
> 그래서 만들 수 없는 링크를 흉내 내지 않고, 적어도 **그 재료를 찾을 수 있는
> 검색 결과**로 보내도록 고쳤다(2026-09-08). 수수료가 붙는 링크는
> **사람이 하나씩 만드는 수밖에 없다.**

---

## 하는 법

### 1. 어떤 재료를 채울지 고른다

`frontend/public/coupang_ads.csv` 를 위에서부터 보면 된다. `rank` 순서가
**레시피에서 많이 쓰이는 순**이다.

```csv
ingredient_keyword,coupang_url,priority,active,recipe_count,rank
소금,,D,Y,21719,1
간장,,C,Y,18691,2
다진마늘,https://link.coupang.com/a/gSFYCCq4Zg,A,Y,17190,3
대파,,C,Y,15797,4
설탕,https://link.coupang.com/a/dHedi7,D,Y,14871,5
```

### 2. 파트너스에서 링크를 만든다

1. <https://partners.coupang.com/> 로그인
2. 왼쪽 메뉴 → **간편 링크 만들기**
3. URL 을 붙여넣고 **간편 링크 생성**
4. 나온 링크를 복사 — `https://link.coupang.com/a/dHedi7` 처럼 생겼다

3번에 넣을 URL 은 둘 중 아무거나 된다. 파트너스는 쿠팡 안의 아무 페이지나 받는다.

| 넣을 것 | 언제 |
|---|---|
| 상품 페이지 URL | 그 재료의 대표 상품을 정하고 싶을 때 |
| `https://www.coupang.com/np/search?q=대파` | 상품 하나 고르기 애매할 때. **품절돼도 안 죽는다** |

> **검색 URL 두 가지를 헷갈리지 마세요.**
>
> | | 수수료 |
> |---|---|
> | `https://www.coupang.com/np/search?q=대파` | **안 붙는다.** 그냥 쿠팡 검색이다 |
> | `https://link.coupang.com/a/XXXXXX` ← 위 주소로 **간편 링크를 만든 것** | **붙는다** |
>
> 검색 URL 은 파트너스에 넣을 **재료**일 뿐이고, 거기서 나온
> `link.coupang.com/a/...` 가 광고 링크다. CSV 에 넣을 것은 **언제나 아래쪽**이다.

> **검색어가 너무 넓으면 `q=` 뒤를 고쳐서 만드세요.**
> `파` 로 검색하면 파김치·파스타가 섞여 나온다. `대파` 로 바꿔서 만들면 된다.
> 마찬가지로 `고추`→`청양고추`, `면`→`소면`.
>
> 바꾸는 건 **검색어뿐**이다. CSV 첫 칸(`ingredient_keyword`)은 사전 대표어라
> 그걸로 매칭되므로 **절대 고치지 마세요.**

### 3. CSV 에 넣는다

**명령으로 넣는 게 안전하다.** 엑셀 사고(아래)가 원천적으로 안 나고,
파트너스 링크가 아니면 **거부한다** — 그냥 검색 URL 을 잘못 넣는 사고를 막는다.

```bash
python scripts/add_coupang_link.py 소금 https://link.coupang.com/a/XXXXXX
```

여러 개를 한 번에 넣어도 된다.

```bash
python scripts/add_coupang_link.py 소금 https://link.coupang.com/a/AAA 간장 https://link.coupang.com/a/BBB
```

지금 어디까지 채웠는지 보려면:

```bash
python scripts/add_coupang_link.py --check
```

파일을 직접 열어 두 번째 칸에 붙여넣어도 된다. **엑셀만 아니면 된다.**

### 4. 반영

커밋·푸시하면 Vercel 이 올린다. 브라우저가 이 CSV 를 캐시하므로 바로 확인하려면
개발자도구 → Application → Local Storage 에서 `coupang_ads_cache` 를 지운다.

---

## ⚠️ 엑셀로 열지 마세요

엑셀은 CSV 를 저장할 때 **파일 앞에 BOM 이라는 보이지 않는 글자**를 붙인다.
그러면 첫 열 이름이 `ingredient_keyword` 가 아니라 `﻿ingredient_keyword` 가
되어 **그 파일이 통째로 안 읽힌다.** 오류도 안 난다 — 그냥 조용히 0개가 된다.

실제로 재료 사전에서 이 일이 있었다. 사전이 0개로 읽히는 바람에 사진 인식이
재료를 하나도 못 알아보고, 사전 큐레이션은 모든 이름을 "새 재료" 로 판정했다.

**메모장, VS Code, 구글 시트** 중 아무거나 쓰세요. 굳이 엑셀을 써야 한다면
저장할 때 `CSV UTF-8` 이 아니라 그냥 `CSV` 를 고르세요.

---

## 칸 설명

| 칸 | 뜻 |
|---|---|
| `ingredient_keyword` | 사전의 **대표어**. 이걸로 매칭한다. **고치지 말 것** |
| `coupang_url` | 여기만 채우면 된다 |
| `priority` | **단가 등급** (A 가 비싼 것). 같은 재료에 여러 줄이면 A→B→C→D 순으로 쓴다 |
| `active` | `Y` 여야 나간다. 잠시 내리려면 `N` |
| `recipe_count`·`rank` | 참고용. 몇 개 레시피가 그 재료를 쓰는지 |

**한 재료에 여러 상품**을 넣고 싶으면 줄을 더 만들면 된다 (같은
`ingredient_keyword`, 다른 `priority`).

---

## 내 계정으로 정산되는 링크가 맞는지 확인

파트너스 링크는 눌리면 쿠팡으로 넘어가면서 `lptag` 를 붙인다. 그 값이
**누구의 성과인지**를 가른다. 남의 링크가 섞이면 눌려도 한 푼도 안 들어오는데
겉으로는 멀쩡해 보인다.

```bash
python scripts/check_coupang_links.py
```

---

## 순위가 낡으면 다시 센다

사전이 바뀌면 `recipe_count`·`rank` 가 안 맞게 된다. 실제로 한 번 이런 일이
있었다 — `파` 11,540 → 0, `황다랑어` 4,633 → 0. **안 걸리는 재료에 시간을
쓰게 되므로** 가끔 다시 센다. 채워 둔 링크는 잃지 않는다.

```bash
python scripts/refresh_coupang_ads.py            # 미리보기
python scripts/refresh_coupang_ads.py --write
```

---

## 재료 사전(`ingredient_profile_dict_with_substitutes.csv`)은 건드리지 마세요

거기에도 `coupang_link` 칸이 있고 예전 문서가 그걸 채우라고 했지만, 지금은
**그 파일을 매일 새벽 배치가 다시 쓰고 자동으로 커밋·푸시한다.** 손으로 고치면
충돌이 나기 쉽다. `coupang_ads.csv` 가 우선순위도 더 높다(먼저 본다).

## 성과 보기

어드민 → **통계** 탭의 `쿠팡 클릭 (30일)`. 실제 구매·수수료는 쿠팡 파트너스
대시보드에서 본다.
