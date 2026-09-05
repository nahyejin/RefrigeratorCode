# -*- coding: utf-8 -*-
"""사용자가 적은 한 줄을 **찾을 수 있는 말**로 바꾼다.

왜 필요한가:
    "아이 먹을 거" 라고 적어도 후보를 뽑는 SQL 은 그 말을 몰랐다. 재료 매칭만으로
    40개를 뽑아 LLM 에게 넘겼으니, 그 40개 안에 아이가 먹을 만한 게 없으면
    LLM 이 아무리 잘해도 나올 수가 없었다. **고르기 전에 걸러야 한다.**

왜 사전으로 두나:
    앱의 레시피 필터가 이미 같은 분류(효능·대상·TPO·스타일)를 쓰고 있다.
    화면에서 버튼으로 고르든 글로 적든 **같은 말로 찾아야** 결과가 어긋나지
    않는다. 그래서 그 분류를 여기에 그대로 옮겨 놓고, 글에서도 같은 것을 찾는다.

한계를 분명히:
    형태소 분석 같은 건 안 한다. 레시피 제목·본문은 사람이 쓴 블로그 글이라
    "아이" 를 찾으면 "아이들", "아이가" 도 걸린다. 그 정도면 충분하고,
    무겁게 만들면 매 요청마다 느려진다.
"""

import csv
import os
import re
import threading

# 적은 말 → 레시피에서 찾을 말.
#
# 왼쪽은 **사용자가 쓸 법한 표현**, 오른쪽은 **블로그 글에 실제로 나오는 말**이다.
# 둘은 다르다 — 아무도 "저속노화 레시피" 라고 적지 않고 "노화" 라고 적는다.
INTENT = [
    # ── 대상 ────────────────────────────────────────────────────────
    (("아이", "애기", "아기", "유아", "어린이", "아들", "딸", "초등"),
     ["아이", "아이들", "유아", "어린이", "키즈", "아기"],
     "아이가 먹을 것 — 맵지 않고 자극이 적어야 한다"),
    (("부모님", "어르신", "노인", "시부모", "장인", "장모", "할머니", "할아버지"),
     ["부모님", "어르신", "효도"],
     "어르신 상 — 부드럽고 짜지 않아야 한다"),
    (("남편", "아내", "와이프", "신랑"), ["남편", "와이프", "신랑"], None),
    (("손님", "집들이", "잔치", "파티", "생일"),
     ["손님", "집들이", "잔치상", "파티", "생일"],
     "상에 올릴 것 — 보기 좋고 양이 넉넉한 쪽"),
    (("자취", "혼밥", "일인분", "1인분", "혼자"),
     ["자취", "혼밥", "1인분"], "혼자 먹을 것 — 재료와 설거지가 적은 쪽"),

    # ── 건강·식이 ───────────────────────────────────────────────────
    (("다이어트", "살", "체중", "칼로리", "가볍게", "저칼로리"),
     ["다이어트", "저칼로리", "저지방", "칼로리", "포만감", "저당"],
     "다이어트 — 튀김·설탕이 많은 것은 피한다"),
    (("단백질", "근육", "벌크", "운동"),
     ["단백질", "고단백", "운동"], "단백질 위주"),
    (("담백", "슴슴", "삼삼", "안 맵", "안맵", "순한", "자극적이지"),
     ["담백", "슴슴", "순한", "부드러운"], "담백하게 — 맵고 짠 것을 피한다"),
    (("당뇨", "혈당"), ["당뇨", "저당", "무설탕"], None),
    (("채식", "비건", "고기 빼", "고기빼"), ["채식", "비건"], "고기를 쓰지 않는 쪽"),
    (("해장", "숙취"), ["해장", "숙취해소"], None),
    (("보양", "기력", "몸보신"), ["보양", "건강", "한방"], None),

    # ── TPO ─────────────────────────────────────────────────────────
    (("반찬", "밑반찬"), ["반찬", "밑반찬"], None),
    (("술안주", "안주", "술"), ["안주", "술안주"], None),
    (("아침", "브런치"), ["아침", "브런치"], None),
    (("야식", "밤"), ["야식"], None),
    (("간식", "디저트", "후식"), ["간식", "디저트"], None),
    (("도시락", "소풍"), ["도시락", "소풍"], None),
    (("캠핑", "야외", "바베큐"), ["캠핑", "바베큐"], None),
    (("명절", "설", "추석"), ["명절", "차례", "전"], None),

    # ── 난이도·시간 ─────────────────────────────────────────────────
    (("간단", "초간단", "쉬운", "빨리", "10분", "15분", "20분", "귀찮"),
     ["초간단", "간단", "10분", "15분", "쉬운", "간편"],
     "손이 적게 가는 쪽"),
    (("한 그릇", "한그릇", "원팬", "설거지"),
     ["한그릇", "원팬", "한 그릇"], None),

    # ── 조리법·형태 ─────────────────────────────────────────────────
    (("국물", "국", "찌개", "탕"), ["국", "찌개", "탕", "국물"], None),
    (("볶음",), ["볶음"], None),
    (("구이", "굽"), ["구이"], None),
    (("찜",), ["찜"], None),
    (("면", "파스타", "국수"), ["파스타", "국수", "면"], None),
    (("밥", "덮밥", "볶음밥"), ["덮밥", "볶음밥", "비빔밥"], None),

    # ── 스타일 ──────────────────────────────────────────────────────
    (("한식",), ["한식"], None),
    (("양식", "서양"), ["양식", "서양", "이탈리안"], None),
    (("중식", "중국"), ["중식", "중화"], None),
    (("일식", "일본"), ["일식", "일본"], None),
]

# 뺄 것을 말하는 표현.
#
# 바로 뒤만 보면 안 된다 — "국물 **요리는** 빼고" 처럼 사이에 말이 낀다.
# 그렇다고 문장 전체를 보면 "국물 좋아하는데 매운 건 빼고" 가 잘못 걸린다.
# 뒤로 열두 글자쯤이 실제 말버릇에 맞는다.
_EXCLUDE = re.compile(r"(?:빼|말고|없이|제외|싫|안\s*(?:들어|넣))")
_LOOKAHEAD = 12

# "X 없이" 처럼 **재료를 콕 집어** 빼 달라는 말.
#
# 위 INTENT 는 분류(아이·다이어트·국물 …)만 안다. 그런데 사람들이 실제로 가장
# 많이 적는 건 재료 이름이다 — "고기 없이", "우유 빼고", "견과류 말고".
# 그런 말은 INTENT 어디에도 안 걸려서 **통째로 무시됐다.**
_BAN = re.compile(
    r"([가-힣]{1,10}?)\s*(?:은|는|이|가|을|를|도)?\s*"
    r"(?:없이|빼고|빼 주|빼줘|빼주|말고|제외|안\s*들어|안\s*넣)"
)

# 빼 달라는 말 하나가 실제로는 **여러 이름**을 뜻한다.
#
# 레시피의 재료는 "고기" 라고 안 적혀 있다 — 돼지고기·삼겹살·베이컨이라고
# 적혀 있다. 글자만 맞춰 지우면 삼겹살이 그대로 남는다.
#
# 손으로 적은 목록의 한계 (실측으로 드러났다):
#   "고기 없이" 라고 말해도 닭봉·닭날개·닭똥집·닭발·닭껍질·닭안심살이 든
#   요리가 그대로 나왔다 — 이 목록에 그 부위들이 없었기 때문이다. 사전에는
#   이미 이 부위들이 `세분류=육류` 로 분류돼 있는데, 여기 목록은 그걸 안 쓰고
#   따로 손으로 적고 있었다. 새 부위가 사전에 추가될 때마다 이 목록도 같이
#   고쳐야 하는데, 그럴 이유가 없다 — **사전이 이미 아는 것을 다시 베끼지
#   않는다.**
BAN_EXPAND = {
    # 우유·계란처럼 사전의 소분류/세분류 만으로는 깔끔히 안 갈리는 것,
    # 또는 애초에 사전에 없는 것(오리 등)만 손으로 남긴다.
    "오리": ["오리", "오리고기", "훈제오리", "청둥오리"],
    "우유": ["우유", "생크림", "휘핑"],
    "유제품": ["우유", "치즈", "버터", "생크림", "요거트", "요구르트"],
    "계란": ["계란", "달걀"],
    "달걀": ["계란", "달걀"],
    "밀가루": ["밀가루", "부침가루", "튀김가루", "빵가루", "박력분", "강력분"],
    "매운": ["고춧가루", "고추장", "청양고추", "매운", "매콤", "얼큰", "칼칼"],
    "술": ["소주", "맥주", "청주", "와인", "막걸리"],
}


# ── 재료 사전을 **직접 보고** 넓힌다 ─────────────────────────────
#
# "고기·해산물·생선·계란·견과류" 처럼 **카테고리 전체**를 빼 달라는 말은
# 사전의 분류(세분류·소분류·hyperonym)를 그대로 따라간다. 손으로 적은
# 목록과 달리, 사전에 재료가 늘면 **다음 요청부터 자동으로 같이 커버된다.**
_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(_HERE)
_DICT_NAME = "ingredient_profile_dict_with_substitutes.csv"


def _dict_csv_path():
    override = (os.getenv("INGREDIENT_DICT_CSV") or "").strip()
    candidates = [override] if override else []
    candidates += [
        os.path.join(_ROOT, "frontend", "public", _DICT_NAME),
        os.path.join(_HERE, _DICT_NAME),
    ]
    for p in candidates:
        if p and os.path.exists(p):
            return p
    return None


_category_lock = threading.Lock()
_category_cache = None


def _category_index():
    """사전을 한 번만 읽어 `세분류`·`소분류`·`hyperonym` 색인을 만든다.

    CSV 를 못 찾아도 조용히 빈 색인을 준다 — 그러면 카테고리 확장이 안 될
    뿐이고, 위 손으로 적은 목록과 원 단어 자체는 그대로 걸러진다. 이 기능
    하나가 안 된다고 전체 요청이 실패해서는 안 된다.
    """
    global _category_cache
    with _category_lock:
        if _category_cache is not None:
            return _category_cache
        fine, mid, hyper_children = {}, {}, {}
        path = _dict_csv_path()
        if path:
            try:
                with open(path, encoding="utf-8-sig", newline="") as f:
                    for row in csv.DictReader(f):
                        if (row.get("대분류") or "").strip() != "재료":
                            continue
                        kw = (row.get("keyword") or "").strip()
                        if not kw:
                            continue
                        f_name = (row.get("세분류") or "").strip()
                        m_name = (row.get("소분류") or "").strip()
                        hy = (row.get("hyperonym") or "").strip()
                        if f_name:
                            fine.setdefault(f_name, set()).add(kw)
                        if m_name:
                            mid.setdefault(m_name, set()).add(kw)
                        if hy:
                            hyper_children.setdefault(hy, set()).add(kw)
            except OSError:
                pass
        _category_cache = (fine, mid, hyper_children)
        return _category_cache


def _by_fine(*names):
    fine, _mid, _hy = _category_index()
    out = set()
    for n in names:
        out |= fine.get(n, set())
    return out


def _by_mid(*names):
    _fine, mid, _hy = _category_index()
    out = set()
    for n in names:
        out |= mid.get(n, set())
    return out


def _animal_family(root, core_token, pool):
    """`root`(예: 닭고기) 하나를 **그 동물 부위 전체**로 넓힌다.

    `root` 자신 + hyperonym 이 root 를 가리키는 부위(사전에 이미 있는 관계,
    예: 닭봉·닭날개·닭똥집 -> hyperonym=닭고기) + `pool`(육류/가공육) 안에서
    이름에 `core_token` 이 들어간 것(hyperonym 이 안 달린 예외, 예: 훈제닭고기).
    `닭새우` 처럼 이름은 겹쳐도 `pool` 밖(세분류=갑각류)이면 안 걸린다 —
    `pool` 로 먼저 좁혀 놓고 이름을 보기 때문이다.
    """
    _fine, _mid, hyper_children = _category_index()
    out = {root}
    out |= hyper_children.get(root, set())
    if core_token:
        out |= {k for k in pool if core_token in k}
    return out


def _dynamic_ban_expand():
    """카테고리 기준 확장 목록. 사전을 못 읽으면 빈 dict — 안전하게 건너뛴다."""
    meat_pool = _by_fine("육류", "가공육")
    if not meat_pool:
        return {}
    seafood_pool = (_by_fine("생선류", "조개류/연체류", "갑각류", "건조해산물류"))
    dairy_pool = _by_mid(
        "우유/분유", "요거트/발효유", "크림류", "버터류", "기타 유제품",
        "치즈", "치즈(토핑용)", "치즈(디저트용)", "치즈(샐러드용)",
        "치즈(슬라이스)", "치즈(분말)", "치즈(폼)", "치즈(스프레드)", "치즈(피자용)",
    )
    egg_pool = _by_fine("달걀/난류")
    nuts_pool = _by_fine("견과류")

    return {
        "고기": meat_pool | {"고기", "육류"},
        "육류": meat_pool | {"고기", "육류"},
        "고기류": meat_pool | {"고기", "육류"},
        "닭": _animal_family("닭고기", "닭", meat_pool) | {"닭"},
        "닭고기": _animal_family("닭고기", "닭", meat_pool),
        "치킨": _animal_family("닭고기", "닭", meat_pool) | {"치킨"},
        "돼지": _animal_family("돼지고기", "돼지", meat_pool) | {"돼지"},
        "돼지고기": _animal_family("돼지고기", "돼지", meat_pool),
        "소고기": _animal_family("소고기", None, meat_pool) | {"소고기", "쇠고기"},
        "쇠고기": _animal_family("소고기", None, meat_pool) | {"소고기", "쇠고기"},
        "양고기": _animal_family("양고기", "양", meat_pool),
        "해산물": seafood_pool | {"해산물"},
        "생선": _by_fine("생선류") | {"생선"},
        "조개": _by_fine("조개류/연체류") | {"조개"},
        "우유": dairy_pool | {"우유"},
        "유제품": dairy_pool | {"유제품"},
        "계란": egg_pool | {"계란", "달걀"},
        "달걀": egg_pool | {"계란", "달걀"},
        "견과": nuts_pool | {"견과"},
        "견과류": nuts_pool | {"견과류"},
    }

# 재료로 안 보이는 말. 여기 걸리면 재료 금지로 안 읽는다 —
# "국물 요리는 빼고" 의 `요리`, "간단한 거 말고" 의 `거` 같은 것.
_NOT_INGREDIENT = {
    "요리", "메뉴", "반찬", "음식", "거", "것", "게", "건", "면", "만",
    "그건", "이건", "저건", "너무", "조금", "많이", "그냥", "좀",
}


def bans(text):
    """"X 없이" 에서 **빼야 할 이름들**. 넓혀서 돌려준다.

    사전 기반 확장(`_dynamic_ban_expand`)을 먼저 보고, 없으면 손으로 적은
    목록(`BAN_EXPAND`)을, 그것도 없으면 적은 말 그대로를 쓴다.
    """
    dynamic = _dynamic_ban_expand()
    out, seen = [], set()
    for m in _BAN.finditer(text or ""):
        word = m.group(1).strip()
        if word in _NOT_INGREDIENT:
            continue
        # 한 글자는 보통 잡음이다("것", "거" 부류) — 그래서 원래 걸러 냈다.
        # 그런데 "닭" 처럼 실제로 한 글자인 재료명도 있다. **알려진 분류
        # 표제어일 때만** 한 글자를 통과시킨다. "닭 없이" 가 그렇게 걸린다.
        if len(word) < 2 and word not in dynamic and word not in BAN_EXPAND:
            continue
        names = dynamic.get(word) or BAN_EXPAND.get(word) or [word]
        for name in names:
            if name not in seen:
                seen.add(name)
                out.append(name)
    # 카테고리 하나를 통째로 뺄 때(예: "고기") 사전이 주는 이름이 100개를
    # 넘는다("육류"+"가공육"만 122개). 40개로 잘랐더니 앞쪽 40개 안에 우연히
    # 안 든 재료(돼지고기·베이컨 등)가 걸러지지 않고 그대로 통과했다 —
    # 실측으로 잡은 버그다. 넉넉히 둔다.
    return out[:400]


def read(text):
    """적은 글에서 **찾을 말**과 **모델에게 줄 지침**을 뽑는다.

    반환: `(keywords, hints, excluded)`
      - `keywords` — 레시피 제목·본문에서 찾을 말 (후보를 추리는 데 쓴다)
      - `hints` — 모델에게 줄 한 줄 지침
      - `excluded` — 빼 달라고 한 말 (찾기에서 제외한다)
    """
    text = (text or "").strip()
    if not text:
        return [], [], []

    # "고기 없이" 처럼 재료를 콕 집어 뺀 것. 분류표에 없는 말이라 여기서 읽는다.
    banned = bans(text)

    keywords, hints, excluded = [], [], []
    for triggers, words, hint in INTENT:
        hit = next((t for t in triggers if t in text), None)
        if not hit:
            continue
        # "국물 요리는 빼고" 처럼 뒤쪽에 부정이 오면 빼 달라는 뜻이다.
        at = text.index(hit) + len(hit)
        if _EXCLUDE.search(text[at:at + _LOOKAHEAD]):
            excluded.extend(words)
            continue
        keywords.extend(words)
        if hint:
            hints.append(hint)

    # 중복은 앞선 것을 남긴다 — 먼저 적은 말이 더 중요한 뜻일 때가 많다.
    if banned:
        excluded.extend(banned)
        hints.append(", ".join(banned[:6]) + " 가 들어간 요리는 고르지 마라")

    seen, uniq = set(), []
    for w in keywords:
        if w not in seen and w not in excluded:
            seen.add(w)
            uniq.append(w)
    # 중복 제거 — 같은 이름이 분류와 재료 양쪽에서 올 수 있다.
    ex_seen, ex_uniq = set(), []
    for w in excluded:
        if w not in ex_seen:
            ex_seen.add(w)
            ex_uniq.append(w)
    return uniq[:24], hints[:6], ex_uniq[:400]
