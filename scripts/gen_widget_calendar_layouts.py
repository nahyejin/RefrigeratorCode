"""마이캘린더 위젯(4×2·4×3) 레이아웃 두 개를 **통째로** 만든다.

칸이 42개 × 점 3개라 손으로 고치면 id 가 어긋나기 쉬워서 XML 을 직접 고치지 않고 이 스크립트를 고친 뒤 다시 돌린다.
id 는 CalendarWidgetProvider.java 가 찾는 이름과 한 쌍이다(4×2 는 앞머리 없음/small_, 4×3 은 big_).

    python scripts/gen_widget_calendar_layouts.py

구성(2026-09-23 개정 — "읽을 게 너무 많다"·"글꼴이 촌스럽다"·"범례와 목록 표식이 다르다" 지적):
  맨 위에 「2026년 9월」 한 번만 쓰고, 그 아래 구획은 작은 회색 부제목(「이번 달 목표」·「이번 달 캘린더」·「오늘」·「내일」).
  글꼴은 폰 기본 글꼴의 굵기로 위계를 준다(아래 REG·SEMI·BOLD 설명 참고).
  범례와 게이지는 Provider 가 위젯 폭에 맞춰 비트맵으로 그린다(RemoteViews 로는 줄바꿈·비율 폭을 못 준다).
  달력 칸: 주 줄이 남는 세로 공간을 나눠 갖고(5주짜리 달은 6번째 줄 숨김), 칸 안은 [숫자 원] 아래 [점 줄].
"""
from pathlib import Path

LAYOUT = Path(__file__).resolve().parent.parent / "frontend/android/app/src/main/res/layout"

# 글꼴: 홈 화면 위젯(RemoteViews)은 앱에 넣은 글꼴 파일(res/font)을 쓰지 않는다 — Pretendard 를 넣어 봤으나
# 적용되지 않았다(2026-09-23 에뮬레이터 확인). Pretendard 의 한글은 폰 기본 한글 글꼴(본고딕·Noto Sans CJK)을
# 바탕으로 만들어 모양이 거의 같으므로, 기본 글꼴의 **굵기**로 위계를 잡는다(제목 Bold · 부제목 Medium · 본문 Regular).
REG, SEMI, BOLD = "sans-serif", "sans-serif-medium", "bold"


def text(id_=None, size=11, font=REG, color="@color/widget_label", extra="", txt=None, width="wrap_content",
         weight=None, indent=0):
    pad = " " * indent
    attrs = []
    if id_:
        attrs.append(f'android:id="@+id/{id_}"')
    attrs.append(f'android:layout_width="{"0dp" if weight else width}"')
    attrs.append('android:layout_height="wrap_content"')
    if weight:
        attrs.append(f'android:layout_weight="{weight}"')
    if font == BOLD:
        attrs += ['android:fontFamily="sans-serif"', 'android:textStyle="bold"']
    else:
        attrs.append(f'android:fontFamily="{font}"')
    attrs += [f'android:textSize="{size}sp"', f'android:textColor="{color}"', 'android:includeFontPadding="false"']
    if txt is not None:
        attrs.append(f'android:text="{txt}"')
    attrs += [a for a in extra.split("|") if a]
    inner = f"\n{pad}    ".join(attrs)
    return f"{pad}<TextView\n{pad}    {inner} />\n"


def subtitle(txt, indent, extra=""):
    return text(size=11, font=SEMI, color="@color/widget_label", txt=txt, indent=indent, extra=extra)


# ── 달력 ────────────────────────────────────────────────────────────────

def cell(p, i, box, text_sp, dot):
    dots = "".join(
        f"""
                        <ImageView
                            android:id="@+id/{p}dot_{i}_{k}"
                            android:layout_width="{dot}dp"
                            android:layout_height="{dot}dp"
                            android:layout_marginStart="1dp"
                            android:layout_marginEnd="1dp"
                            android:src="@drawable/widget_dot"
                            android:visibility="gone"
                            android:importantForAccessibility="no" />"""
        for k in range(3)
    )
    return f"""
                <LinearLayout
                    android:layout_width="0dp"
                    android:layout_height="match_parent"
                    android:layout_weight="1"
                    android:gravity="center"
                    android:orientation="vertical">

                    <!-- 계획 동그라미는 두 자리 숫자를 감싸야 해서 숫자 원보다 가로로 넉넉하게 편다 -->
                    <FrameLayout
                        android:layout_width="{box + 8}dp"
                        android:layout_height="{box}dp">

                        <TextView
                            android:id="@+id/{p}cell_{i}"
                            android:layout_width="{box}dp"
                            android:layout_height="{box}dp"
                            android:layout_gravity="center"
                            android:gravity="center"
                            android:includeFontPadding="false"
                            android:fontFamily="{REG}"
                            android:textSize="{text_sp}sp"
                            android:textColor="@color/widget_icon" />

                        <!-- 오늘(회색 칠) 위에도 보이도록 숫자보다 뒤에 둔다 -->
                        <ImageView
                            android:id="@+id/{p}plan_{i}"
                            android:layout_width="match_parent"
                            android:layout_height="match_parent"
                            android:scaleType="fitXY"
                            android:src="@drawable/widget_plan_circle"
                            android:visibility="gone"
                            android:importantForAccessibility="no" />
                    </FrameLayout>

                    <LinearLayout
                        android:layout_width="wrap_content"
                        android:layout_height="{dot}dp"
                        android:layout_marginTop="1dp"
                        android:orientation="horizontal">{dots}
                    </LinearLayout>
                </LinearLayout>"""


def calendar(p, grid_id, box, text_sp, dot, weight):
    weekdays = "".join(
        f"""
                <TextView
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:gravity="center"
                    android:includeFontPadding="false"
                    android:fontFamily="{REG}"
                    android:textSize="9sp"
                    android:textColor="@color/widget_label"
                    android:text="{w}" />"""
        for w in "일월화수목금토"
    )
    weeks = []
    for w in range(6):
        cells = "".join(cell(p, w * 7 + d, box, text_sp, dot) for d in range(7))
        weeks.append(f"""
                <LinearLayout
                    android:id="@+id/{p}week_{w}"
                    android:layout_width="match_parent"
                    android:layout_height="0dp"
                    android:layout_weight="1"
                    android:orientation="horizontal">{cells}
                </LinearLayout>""")
    return f"""        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="{weight}"
            android:orientation="vertical">

{subtitle("이번 달 캘린더", 12)}
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:layout_marginTop="6dp"
                android:orientation="horizontal">{weekdays}
            </LinearLayout>

            <LinearLayout
                android:id="@+id/{grid_id}"
                android:layout_width="match_parent"
                android:layout_height="0dp"
                android:layout_weight="1"
                android:orientation="vertical">{''.join(weeks)}
            </LinearLayout>
        </LinearLayout>
"""


# ── 목표·범례·목록 ──────────────────────────────────────────────────────

def goal_block(p, indent):
    pad = " " * indent
    return f"""{pad}<LinearLayout
{pad}    android:layout_width="match_parent"
{pad}    android:layout_height="wrap_content"
{pad}    android:gravity="center_vertical"
{pad}    android:orientation="horizontal">

{subtitle("이번 달 목표", indent + 4, extra="android:layout_weight=\"1\"|android:maxLines=\"1\"").replace('android:layout_width="wrap_content"', 'android:layout_width="0dp"', 1)}
{text(f"{p}progress_text", 11, SEMI, "@color/widget_icon", "android:maxLines=\"1\"|android:layout_marginStart=\"6dp\"", indent=indent + 4)}{pad}</LinearLayout>

{pad}<!-- 게이지는 식구별 색으로 나눠 칠해야 해서(마이캘린더와 같게) Provider 가 위젯 폭에 맞춘 비트맵으로 그린다 -->
{pad}<ImageView
{pad}    android:id="@+id/{p}gauge"
{pad}    android:layout_width="match_parent"
{pad}    android:layout_height="8dp"
{pad}    android:layout_marginTop="7dp"
{pad}    android:scaleType="fitXY"
{pad}    android:importantForAccessibility="no" />

{text(f"{p}savings", 10, REG, "@color/widget_label", "android:layout_marginTop=\"6dp\"|android:maxLines=\"2\"|android:ellipsize=\"end\"", width="match_parent", indent=indent)}"""


def legend(p, indent, margin_top):
    pad = " " * indent
    return f"""{pad}<!-- 범례(식구 색·이름·횟수 + 계획 표식) — 폭에 맞춰 두 줄까지, 넘치면 「외 N명」. Provider 가 그린다 -->
{pad}<ImageView
{pad}    android:id="@+id/{p}legend"
{pad}    android:layout_width="match_parent"
{pad}    android:layout_height="wrap_content"
{pad}    android:layout_marginTop="{margin_top}dp"
{pad}    android:adjustViewBounds="true"
{pad}    android:scaleType="fitStart"
{pad}    android:importantForAccessibility="no" />
"""


def list_row(id_prefix, i, indent, max_lines):
    """목록 한 줄 — 점은 범례와 같은 **꽉 찬 사람 색 점**, 이미 한 요리면 끝에 회색 「완료」."""
    pad = " " * indent
    return f"""{pad}<LinearLayout
{pad}    android:id="@+id/{id_prefix}_row_{i}"
{pad}    android:layout_width="match_parent"
{pad}    android:layout_height="wrap_content"
{pad}    android:layout_marginTop="5dp"
{pad}    android:gravity="top"
{pad}    android:orientation="horizontal"
{pad}    android:visibility="gone">

{pad}    <ImageView
{pad}        android:id="@+id/{id_prefix}_dot_{i}"
{pad}        android:layout_width="7dp"
{pad}        android:layout_height="7dp"
{pad}        android:layout_marginTop="4dp"
{pad}        android:src="@drawable/widget_dot"
{pad}        android:importantForAccessibility="no" />

{text(f"{id_prefix}_text_{i}", 11, REG, "@color/widget_icon", f"android:layout_marginStart=\"6dp\"|android:maxLines=\"{max_lines}\"|android:ellipsize=\"end\"|android:lineSpacingExtra=\"1dp\"", weight=1, indent=indent + 4)}
{text(f"{id_prefix}_done_{i}", 10, REG, "@color/widget_label", "android:layout_marginStart=\"4dp\"|android:layout_marginTop=\"1dp\"|android:visibility=\"gone\"", txt="완료", indent=indent + 4)}{pad}</LinearLayout>
"""


def day_list(id_prefix, title, rows, indent, max_lines, margin_top):
    pad = " " * indent
    body = "".join(list_row(id_prefix, i, indent + 4, max_lines) for i in range(rows))
    return f"""{pad}<LinearLayout
{pad}    android:layout_width="match_parent"
{pad}    android:layout_height="wrap_content"
{pad}    android:layout_marginTop="{margin_top}dp"
{pad}    android:orientation="vertical">

{subtitle(title, indent + 4)}{body}
{text(f"{id_prefix}_empty", 11, REG, "@color/widget_label", "android:layout_marginTop=\"5dp\"|android:visibility=\"gone\"", txt="계획 없음", width="match_parent", indent=indent + 4)}{pad}</LinearLayout>
"""


def header(indent, size):
    return text("month_title", size, BOLD, "@color/widget_icon", "android:maxLines=\"1\"", txt="2026년 9월",
                indent=indent)


def root(id_, comment, body, pad_h, pad_v):
    return f"""<?xml version="1.0" encoding="utf-8"?>
<!-- 이 파일은 scripts/gen_widget_calendar_layouts.py 가 만든다 — 직접 고치지 말고 스크립트를 고쳐서 다시 돌릴 것.
{comment} -->
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/{id_}"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:background="@drawable/widget_card_bg"
    android:paddingLeft="{pad_h}dp"
    android:paddingRight="{pad_h}dp"
    android:paddingTop="{pad_v}dp"
    android:paddingBottom="{pad_v}dp">
{body}</LinearLayout>
"""


def small():
    right = f"""        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="1"
            android:layout_marginStart="14dp"
            android:orientation="vertical">

{goal_block("small_", 12)}
            <!-- 목표 아래 남는 자리에 「오늘」 한 줄 — 오른쪽 가운데가 비어 보이던 것(2026-09-23) -->
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:layout_marginTop="10dp"
                android:gravity="center_vertical"
                android:orientation="horizontal">

{subtitle("오늘", 16)}
{text("small_today_more", 10, REG, "@color/widget_label", "android:layout_marginStart=\"6dp\"|android:maxLines=\"1\"|android:visibility=\"gone\"", indent=16)}            </LinearLayout>
{list_row("small_today", 0, 12, 1)}
{text("small_today_empty", 11, REG, "@color/widget_label", "android:layout_marginTop=\"5dp\"|android:visibility=\"gone\"", txt="계획 없음", width="match_parent", indent=12)}
            <FrameLayout
                android:layout_width="match_parent"
                android:layout_height="0dp"
                android:layout_weight="1" />

{legend("small_", 12, 6)}        </LinearLayout>
"""
    body = f"""
{header(4, 14)}
    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1"
        android:layout_marginTop="8dp"
        android:orientation="horizontal">

{calendar("", "calendar_grid", 18, 10, 3, 1)}
{right}    </LinearLayout>
"""
    return root("small_root", """     마이캘린더 위젯 4×2 — **보기 전용**. 맨 위 「2026년 9월」
     왼쪽: 이번 달 캘린더  |  오른쪽: 이번 달 목표(게이지·달성·절약액) + 오늘 한 줄 + 범례
     완료=사람 색 점, 계획=빨간 손글씨 동그라미, 오늘=옅은 회색 칠. 누르면 앱의 마이캘린더로 간다.""",
                body, 14, 12)


def big():
    body = f"""
{header(4, 15)}
    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="10dp"
        android:orientation="vertical">

{goal_block("big_", 8)}
{legend("big_", 8, 8)}    </LinearLayout>

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1"
        android:layout_marginTop="14dp"
        android:orientation="horizontal">

{calendar("big_", "big_grid", 22, 10, 4, 1.25)}
        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="1"
            android:layout_marginStart="14dp"
            android:orientation="vertical">

{day_list("today", "오늘", 3, 12, 2, 0)}
{day_list("tmr", "내일", 3, 12, 2, 12)}        </LinearLayout>
    </LinearLayout>
"""
    return root("big_root", """     마이캘린더 위젯 4×3(늘리면 4×4) — **보기 전용**. 마이캘린더 화면의 축약판.
     맨 위 「2026년 9월」 → 이번 달 목표(달성·게이지·절약액) + 범례(달력 점·게이지 색을 함께 설명하므로 둘 위에)
     아래: 왼쪽 이번 달 캘린더  |  오른쪽 「오늘」·「내일」 목록(레시피 제목 그대로, 점=사람 색, 이미 한 것은 「완료」)
     조작은 없고 누르면 앱의 마이캘린더로 간다.""", body, 14, 14)


for name, xml in (("widget_calendar.xml", small()), ("widget_calendar_big.xml", big())):
    (LAYOUT / name).write_text(xml, encoding="utf-8", newline="\r\n")  # 저장소의 레이아웃 파일은 CRLF
    print("wrote", name)
