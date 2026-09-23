"""요리 캘린더 위젯(4×2·4×3) 레이아웃의 달력 42칸을 다시 만든다.

칸이 42개 × 점 3개라 손으로 고치면 id 가 어긋나기 쉬워서 스크립트로 통째로 교체한다.
`<LinearLayout android:id="@+id/calendar_grid"`(4×2) / `big_grid`(4×3) 블록만 바꾸고 나머지는 그대로 둔다.

칸 구조(2026-09-23 개정 — 숫자와 점이 겹치고 카드 아래가 비던 문제):
  주(week) 줄은 높이 0dp + weight 1 → 남는 세로 공간을 6주가 나눠 갖는다(5주짜리 달은 6번째 줄을 숨김).
  칸 안은 [숫자 원(계획 동그라미를 겹쳐 그림)] 아래에 [점 줄] 을 세로로 쌓아 가운데 둔다.

    python scripts/gen_widget_calendar_grid.py
"""
import re
from pathlib import Path

LAYOUT = Path(__file__).resolve().parent.parent / "frontend/android/app/src/main/res/layout"

VARIANTS = [
    # 파일, 그리드 id, id 앞머리, 숫자 원 지름(dp), 글자(sp), 점 지름(dp)
    ("widget_calendar.xml", "calendar_grid", "", 18, 10, 3),
    ("widget_calendar_big.xml", "big_grid", "big_", 22, 10, 4),
]


def cell(p: str, i: int, box: int, text_sp: int, dot: int) -> str:
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
                            android:textSize="{text_sp}sp"
                            android:textColor="@color/widget_label" />

                        <!-- 오늘(노란 칠) 위에도 보이도록 숫자보다 뒤에 둔다 -->
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


def grid(grid_id: str, p: str, box: int, text_sp: int, dot: int) -> str:
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
    return f"""<LinearLayout
            android:id="@+id/{grid_id}"
            android:layout_width="match_parent"
            android:layout_height="0dp"
            android:layout_weight="1"
            android:orientation="vertical">{''.join(weeks)}
        </LinearLayout>"""


def replace_block(xml: str, grid_id: str, new: str) -> str:
    start = xml.index(f'<LinearLayout\n            android:id="@+id/{grid_id}"')
    # 여는/닫는 LinearLayout 을 세어 그리드 블록의 끝을 찾는다(자기 닫힘 태그는 없다).
    depth, pos = 0, start
    for m in re.finditer(r"<LinearLayout\b|</LinearLayout>", xml[start:]):
        depth += 1 if m.group(0).startswith("<LinearLayout") else -1
        if depth == 0:
            pos = start + m.end()
            break
    return xml[:start] + new + xml[pos:]


for name, grid_id, p, box, text_sp, dot in VARIANTS:
    path = LAYOUT / name
    xml = path.read_text(encoding="utf-8")
    xml = replace_block(xml, grid_id, grid(grid_id, p, box, text_sp, dot))
    path.write_text(xml, encoding="utf-8", newline="\r\n")  # 저장소의 레이아웃 파일은 CRLF
    print("rewrote", path.name)
