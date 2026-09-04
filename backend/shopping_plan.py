# -*- coding: utf-8 -*-
"""**장보기를 최소로** 하는 식단 고르기.

무엇이 문제였나:
    지금까지 장보기 목록은 **결과**였다. 매칭률 높은 7개를 먼저 고르고 나서
    "그중 냉장고에 없는 것" 을 세었다. 그러면 일곱 요리가 저마다 다른 재료를
    요구해서 장을 열다섯 개 봐야 하는 일이 생긴다.

무엇을 하나:
    거꾸로 푼다. **사야 할 재료의 합집합이 가장 작아지도록** 요리를 고른다.
    그러면 "애호박·두부 두 개만 사면 일주일" 같은 결과가 나온다. 싱싱한 재료를
    몇 개만 사서 여러 날에 나눠 쓰는 것이 실제로 사람이 장을 보는 방식이다.

왜 그리디인가:
    이건 집합 덮기(set cover) 문제의 변형이라 정확한 최적해는 비싸다. 그런데
    후보가 200개, 고를 것이 7개라 **매번 가장 적게 늘어나는 것을 집는** 그리디로
    충분히 좋은 답이 나온다. 그리고 사람이 검산할 수 있는 방식이라야
    "왜 이걸 골랐지" 에 답할 수 있다.

무엇을 안 하나:
    재료가 겹치는 것을 **피하지 않는다.** 겹치는 게 이 기능의 목적이다.
    다만 같은 요리가 반복되면 곤란하므로 **제목이 비슷한 것**만 거른다.
"""

import re

# 제목에서 요리 이름을 가려내려고 걷어 내는 말. 이런 게 겹친다고 같은 요리가 아니다.
_NOISE = re.compile(
    r"(레시피|만드는\s*법|만들기|만드는법|황금\s*레시피|초간단|간단|백종원|"
    r"맛있게|맛있는|비법|추천|방법|하는\s*법|요리|메뉴|반찬|만드는)"
)


def _title_key(title):
    """제목에서 요리 이름에 해당하는 토막들. 겹치면 같은 요리로 본다."""
    cleaned = _NOISE.sub(" ", title or "")
    return {w for w in re.split(r"[\s,·|/\[\]()]+", cleaned) if len(w) >= 2}


def _too_similar(title, chosen_keys):
    """이미 고른 것과 **요리 이름이** 겹치나."""
    key = _title_key(title)
    if not key:
        return False
    for other in chosen_keys:
        if not other:
            continue
        overlap = len(key & other)
        if overlap and overlap >= min(len(key), len(other)) * 0.6:
            return True
    return False


def choose(candidates, have, days=7, max_new_per_dish=4, soon=None):
    """장보기가 가장 적어지도록 `days` 개를 고른다.

    `candidates` 는 `{id, title, ingredients, match_rate}` 목록.
    `have` 는 냉장고에 있는 재료 이름.
    `soon` 은 **곧 상하는** 재료 이름. 같은 값이면 이걸 쓰는 쪽을 고른다 —
    화면에서 "유통기한도 봤다" 고 말하려면 실제로 봐야 한다. 다만 장보기를
    줄이는 것보다 뒤다: 상해서 버리는 것보다 안 사는 것이 크다.

    반환: `(고른 것, 사야 할 재료)`

    `max_new_per_dish` — 한 요리가 새 재료를 이만큼 넘게 요구하면 건너뛴다.
    이 상한이 없으면 후보가 부족할 때 장바구니가 갑자기 커진다.
    """
    have_set = {str(x).strip() for x in (have or []) if str(x).strip()}
    soon_set = {str(x).strip() for x in (soon or []) if str(x).strip()}

    rows = []
    for c in candidates:
        ings = {str(x).strip() for x in (c.get("ingredients") or []) if str(x).strip()}
        if not ings:
            continue
        rows.append({
            "c": c,
            "need": ings - have_set,          # 사야 하는 것
            "rate": c.get("match_rate") or 0,
            # 사용자가 적은 조건("아이 먹을 것")에 얼마나 맞는지. 장보기만
            # 줄이면 조건이 무시된다 — 둘 다 본다.
            "want": c.get("want_hit") or 0,
            # 곧 상하는 것을 **몇 개나** 쓰나. 같은 값이면 이 쪽을 고른다.
            "soon": len(ings & soon_set),
        })

    picked, keys, basket = [], [], set()

    while len(picked) < days and rows:
        best, best_score = None, None
        for r in rows:
            extra = r["need"] - basket      # **이 요리 때문에 새로 사야 하는 것**
            if len(extra) > max_new_per_dish:
                continue
            if _too_similar(r["c"].get("title", ""), keys):
                continue
            # 새로 살 게 적을수록, 조건에 맞을수록, 곧 상하는 걸 쓸수록, 매칭률 높을수록.
            score = (len(extra), -r["want"], -r["soon"], -r["rate"])
            if best_score is None or score < best_score:
                best, best_score = r, score

        if best is None:
            # 상한·유사도에 다 걸렸다. 상한을 풀어 한 번 더 본다 —
            # 빈 칸을 남기는 것보다 한 개 더 사는 쪽이 낫다.
            loosened = [r for r in rows if not _too_similar(r["c"].get("title", ""), keys)]
            if not loosened:
                break
            best = min(loosened,
                       key=lambda r: (len(r["need"] - basket), -r["want"],
                                      -r["soon"], -r["rate"]))

        picked.append(best["c"])
        keys.append(_title_key(best["c"].get("title", "")))
        basket |= best["need"]
        rows.remove(best)

    return picked, sorted(basket)


def summary(picked, basket, have):
    """화면에 그대로 쓸 한 줄 요약과 숫자들."""
    have_set = {str(x).strip() for x in (have or []) if str(x).strip()}
    # 냉장고 재료만으로 되는 요리가 몇 개인가 — 이게 클수록 장이 가볍다.
    free = 0
    for c in picked:
        ings = {str(x).strip() for x in (c.get("ingredients") or []) if str(x).strip()}
        if ings and not (ings - have_set):
            free += 1
    return {
        "basket": basket,
        "buy_count": len(basket),
        "days": len(picked),
        "no_buy_days": free,
    }
