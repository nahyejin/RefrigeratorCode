# -*- coding: utf-8 -*-
"""프리미엄 재료 사전 — 「특별한 날 특별한 음식」의 매칭·정렬 기준.

왜 서버에 있나
--------------
예전에는 이 목록이 `frontend/src/utils/premiumIngredients.ts` 에 있었고, 화면이
**이번 주 인기 목록(유튜브 30 + 네이버 30)** 안에서만 프리미엄을 골랐다. 그러면
「특별한 날」에 걸리는 게 한 자리 수였다 — 인기 목록은 원래 집밥 위주라 그 안에
특별한 날 음식이 많을 수가 없다.

풀을 카탈로그 전체로 넓히려면 **DB 를 훑어야** 하고, 그건 서버 일이다. 그리고
고르는 규칙이 두 곳에 있으면 반드시 갈라지므로, 목록도 여기 하나만 둔다.

두 가지를 지킨다:
  - **기간 범위는 그대로 지킨다.** 화면 위 기간 바는 아래 모든 섹션에 걸리는
    조건이라, 이 섹션만 전 기간을 보면 사용자가 고른 조건이 조용히 무시된다.
  - **`llm_ingredients_at IS NOT NULL`** — 재료가 아직 임시값인 글은 안 쓴다.
    다른 목록과 같은 기준이다.

무엇을 뺐나 (2026-09-06 정리)
-----------------------------
목록에 **일상 재료가 잔뜩 들어 있었다.** 인기 목록 110건 중 58건(53%)이
「특별한 날」로 뽑히고 있었고, 뽑힌 이유가 이랬다:

    파김치 · 배추 겉절이 · 김치찌개   <- `새우` (실제로는 **새우젓**)
    단호박빵 · 명란솥밥              <- `버터`
    감자반찬                       <- `소고기`
    닭다리살 소금구이               <- `새송이버섯` 이 `송이버섯` 에 걸림

카탈로그 전체로 재 봐도 `버터` 9.0% · `새우` 8.9% · `표고버섯` 5.2% ·
`소고기` 4.8% 였다. 이 정도로 흔하면 그 섹션은 "특별한 날" 이 아니라 "아무 날"이
된다. 그래서 일상 재료를 전부 뺐다 — 버터·생크림·크림치즈·모짜렐라·올리브오일·
꿀·메이플시럽·소고기·삼겹살·목살·참치·오징어·바지락·홍합·골뱅이·새우·
표고버섯·새송이버섯·느타리버섯·로메인·치커리.

두 가지 안전장치
----------------
1) `exclude` — 앞뒤에 말이 붙으면 **뜻이 달라지는** 것들.
   `새우젓`은 조미료지 새우가 아니고, `새송이버섯`은 `송이버섯`이 아니다.
2) **요리명은 재료로 치지 않는다.** 사전이 `김치`·`갈비찜` 같은 요리 이름도
   재료로 함께 등록하게 된 뒤로, `갈비` 가 `닭갈비`·`갈비만두`·`함박스테이크`
   같은 요리 이름에 줄줄이 걸렸다. 사전의 중분류가 `요리명` 인 이름은
   프리미엄 판정에서 제외한다 (`_is_dish_name`).

이름은 **사전 대표어 기준**이다
-------------------------------
`used_ingredients` 에는 사전이 정한 **대표어만** 남는다. 그래서 여기 적은 이름이
대표어로 존재하지 않으면 **영영 매칭되지 않는다.** 실제로 `캐비어`·`푸아그라`·
`킹크랩`·`고르곤졸라` 가 사전에 없어 한 번도 걸릴 수 없는 상태였고,
`랍스터`·`광어` 는 사전이 `바닷가재`·`넙치` 로 대표어를 잡고 있어 마찬가지였다.
앞의 넷은 사전에 넣었고, 뒤의 둘은 **대표어 이름을 여기 같이 적는다.**
`scripts/check_premium_ingredients.py` 가 이 어긋남을 잡아 준다.
"""

import csv
import json
import os

# (rank, 이름, 제외어). rank 가 작을수록 위. 같은 rank 는 동급.
#
# 이것은 **손으로 적은 목록**이다. 사전은 매일 자동으로 늘어나므로, 새로 들어온
# 재료 중 「특별한 날」 감은 `scripts/propose_premium_ingredients.py` 가 골라
# `premium_ingredients_auto.json` 에 쌓고 아래에서 합친다.
# 이름이 겹치면 **손으로 적은 쪽이 이긴다.**
_HANDPICKED = (
    # --- 초고가·희귀 ---
    (0, "캐비어", ()),
    (1, "푸아그라", ()),
    (2, "트러플", ()),

    # --- 해산물 (사서 상에 올리는 것만. 새우·오징어·바지락은 일상이라 뺐다) ---
    (10, "킹크랩", ()),
    (11, "랍스터", ()),
    (11, "바닷가재", ()),          # 사전 대표어가 이쪽이다
    (12, "대게", ()),
    (13, "전복", ()),
    (14, "성게", ()),
    (15, "멍게", ()),
    (16, "해삼", ()),
    (17, "가리비", ()),
    (18, "관자", ()),
    (19, "대하", ()),
    (20, "방어", ()),
    (22, "광어", ()),
    (22, "넙치", ()),              # 사전 대표어가 이쪽이다
    # 참돔·참도미는 사전이 `도미` 로 대표어를 잡는다. 따로 적으면 영영 안 걸린다.
    (23, "도미", ("도미노", "오분도미", "도미나리")),
    (24, "문어", ()),
    (25, "낙지", ()),
    (26, "굴", ("굴소스", "굴비")),
    (27, "연어", ()),

    # --- 고급 육류 (소고기·삼겹살·목살은 일상이라 뺐다) ---
    (40, "와규", ()),
    (41, "한우", ()),
    (42, "갈비", ("돼지갈비", "갈비양념", "갈비탕", "갈비살", "떡갈비",
                 "등갈비", "쪽갈비", "닭갈비", "갈비소스", "갈비만두", "갈비산적")),
    (43, "채끝", ()),
    (44, "안심", ("돼지안심", "돼지고기안심")),
    (45, "등심", ("돼지등심", "돼지고기등심")),
    (46, "스테이크", ("스테이크소스", "두부스테이크", "함박스테이크",
                    "떡갈비스테이크", "버섯스테이크", "감바스")),
    (47, "양갈비", ()),

    # --- 고급 버섯·채소 (표고·새송이·느타리는 일상이라 뺐다) ---
    (60, "송이버섯", ("새송이버섯", "양송이버섯", "백만송이버섯", "만송이버섯")),
    (61, "능이버섯", ()),
    (62, "아스파라거스", ()),
    (63, "루꼴라", ()),

    # --- 고급 치즈 (모짜렐라·크림치즈는 일상이라 뺐다) ---
    (70, "고르곤졸라", ()),
    (71, "부라타", ()),
    (72, "브리치즈", ()),
    (73, "리코타", ()),

    # --- 주류·조미료 (꿀·메이플시럽·올리브오일은 일상이라 뺐다) ---
    (80, "샴페인", ()),
    (81, "와인", ("와인식초",)),
    (82, "발사믹", ("발사믹드레싱", "발사믹소스")),
)

_AUTO_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                          "premium_ingredients_auto.json")


def _load_auto():
    """자동으로 뽑힌 것들. 파일이 없거나 깨져도 **손으로 적은 목록은 살아야 한다.**"""
    try:
        with open(_AUTO_PATH, encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        return ()
    except Exception as e:  # noqa: BLE001
        print(f"[premium] 자동 목록 읽기 실패(무시): {e}", flush=True)
        return ()

    handpicked = {name for _, name, _ in _HANDPICKED}
    # **일부러 뺀 이름은 자동 경로로도 못 들어온다.**
    # `등갈비` 는 `갈비` 의 제외어다 — 사람이 "이건 특별한 날 감이 아니다" 라고
    # 판단해서 뺀 것인데, 자동 판정이 그것을 모르고 새 항목으로 다시 넣으면
    # 그 판단이 조용히 뒤집힌다.
    excluded = {e for _, _, ex in _HANDPICKED for e in ex}
    out = []
    for item in (data.get("items") or []):
        name = str(item.get("name") or "").strip()
        if not name or name in handpicked or name in excluded:
            continue
        try:
            rank = int(item.get("rank"))
        except (TypeError, ValueError):
            continue
        out.append((rank, name, ()))
    return tuple(out)


PREMIUM_INGREDIENT_DEFS = _HANDPICKED + _load_auto()

NO_MATCH_RANK = 999999

# LIKE 조건에 쓸 이름들. 대표어에 이 글자가 들어간 것만 후보로 훑는다.
PREMIUM_NAMES = tuple(sorted({name for _, name, _ in PREMIUM_INGREDIENT_DEFS}))

_dish_names = None


def _load_dish_names():
    """사전에서 **중분류가 `요리명`** 인 대표어·동의어를 모은다."""
    global _dish_names
    if _dish_names is not None:
        return _dish_names

    here = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(here, "ingredient_profile_dict_with_substitutes.csv")
    names = set()
    try:
        # BOM 이 붙어 있어도 벗겨 낸다 (`ingredient_dictionary` 와 같은 이유).
        with open(path, encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                if (row.get("중분류") or "").strip() != "요리명":
                    continue
                keyword = (row.get("keyword") or "").strip()
                if keyword:
                    names.add(keyword)
    except Exception as e:  # noqa: BLE001
        # 사전을 못 읽어도 섹션 자체는 돌아야 한다. 요리명만 못 걸러진다.
        print(f"[premium] 요리명 목록 읽기 실패(무시): {e}", flush=True)
        names = set()
    _dish_names = names
    return names


def _is_dish_name(token):
    return token.strip() in _load_dish_names()


def split_tokens(used_ingredients):
    """`used_ingredients` 문자열 → 재료 토큰. 카드의 재료 칩과 같은 출처다."""
    if not used_ingredients:
        return []
    return [t.strip() for t in str(used_ingredients).split(",") if t.strip()]


def premium_hits(tokens):
    """[(rank, 프리미엄 이름, 걸린 토큰)] — rank 오름차순."""
    hits = []
    for rank, name, excludes in PREMIUM_INGREDIENT_DEFS:
        # **띄어쓰기를 지우고 견준다.** `저당 굴 소스` 는 `굴소스` 제외어에
        # 걸려야 하는데, 띄어쓰기가 하나 끼면 그대로 통과해 버린다.
        needle = name.replace(" ", "").lower()
        for token in tokens:
            low = token.strip().replace(" ", "").lower()
            if needle not in low:
                continue
            if any(e.replace(" ", "").lower() in low for e in excludes):
                continue
            # 요리 이름은 재료로 치지 않는다 — `닭갈비`·`함박스테이크` 가
            # `갈비`·`스테이크` 로 걸려 올라오던 것을 여기서 막는다.
            if _is_dish_name(token):
                continue
            hits.append((rank, name, token))
            break
    hits.sort()
    return hits


def tier_rank(tokens):
    """가장 높은 등급(rank 최소값). 하나도 없으면 `NO_MATCH_RANK`."""
    hits = premium_hits(tokens)
    return hits[0][0] if hits else NO_MATCH_RANK
