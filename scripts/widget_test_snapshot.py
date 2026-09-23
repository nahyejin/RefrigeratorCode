"""에뮬레이터(디버그 빌드)의 마이캘린더 위젯에 **테스트용 요약본**을 넣고 위젯을 다시 그린다.

위젯은 앱이 마이캘린더를 열 때 남긴 요약본(SharedPreferences `CapacitorStorage` 의 `cookmatch_calendar`)만
읽는다. 에뮬레이터 앱은 로그아웃 상태라 실제로는 빈 달력이 나오므로, 화면 확인·캡처용 가짜 기록을 넣는다.
앱을 열어 마이캘린더에 들어가면 실제 값으로 다시 덮어써진다.

    python scripts/widget_test_snapshot.py            # 식구 3명
    python scripts/widget_test_snapshot.py --many     # 식구 10명(그룹 최대) — 범례 「외 N명」 확인용
"""
import json
import os
import subprocess
import sys
import time
from datetime import date, timedelta
from xml.sax.saxutils import escape

ADB = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Android", "Sdk", "platform-tools", "adb.exe")
PKG = "kr.cookmatch.app"

# 앱 MEMBER_COLORS 와 같은 순서(CookingCalendar.tsx)
COLORS = ["#3B82F6", "#F97316", "#22C55E", "#A855F7", "#65A30D", "#06B6D4", "#EC4899", "#92400E", "#64748B", "#4338CA"]


def build(many: bool) -> dict:
    today = date.today()
    ym = today.strftime("%Y-%m")
    if many:
        names = ["나", "엄마", "아빠", "동생", "할머니", "이모", "삼촌", "사촌", "고모", "막내"]
        counts = [5, 4, 3, 3, 2, 2, 1, 1, 1, 1]
    else:
        names, counts = ["나", "엄마", "동생"], [6, 3, 2]
    # 이미 범례 순서(많이 한 순, 같으면 나 먼저)로 정렬된 상태 — 앱 orderForLegend 결과를 흉내 낸다
    members = [{"name": n, "color": COLORS[i], "count": c} for i, (n, c) in enumerate(zip(names, counts))]

    days: dict = {}
    day = 2
    for i, m in enumerate(members):
        for k in range(m["count"]):
            d = min(day + (k * 3 + i) % 20, today.day)
            key = f"{ym}-{d:02d}"
            days.setdefault(key, {"dots": []})["dots"].append(m["color"])
    for off in (0, 1, 3):
        key = (today + timedelta(days=off)).strftime("%Y-%m-%d")
        if key.startswith(ym):
            days.setdefault(key, {"dots": []})["planned"] = True

    upcoming = [
        {"when": "today", "title": "애호박 된장찌개 만들기 초간단 집밥 레시피 백종원 스타일", "kind": "plan", "color": COLORS[0]},
        {"when": "today", "title": "계란말이 도시락 반찬", "kind": "done", "color": COLORS[2]},
        {"when": "tomorrow", "title": "돼지고기 김치찜 묵은지 활용 저녁메뉴 추천", "kind": "plan", "color": COLORS[1]},
        {"when": "tomorrow", "title": "콩나물국", "kind": "plan", "color": COLORS[2]},
    ]
    done = sum(counts)
    return {"month": ym, "days": days, "goal": 20 if not many else 30, "done": done,
            "goalSavings": 320000 if not many else 480000, "members": members,
            "upcoming": upcoming, "updatedAt": today.isoformat()}


def main():
    snap = build("--many" in sys.argv)
    xml = ("<?xml version='1.0' encoding='utf-8' standalone='yes' ?>\n<map>\n"
           f'    <string name="cookmatch_calendar">{escape(json.dumps(snap, ensure_ascii=False), {chr(34): "&quot;"})}</string>\n'
           "</map>\n")
    subprocess.run([ADB, "shell", "am", "force-stop", PKG], check=True)
    subprocess.run([ADB, "shell", f"run-as {PKG} sh -c 'cat > shared_prefs/CapacitorStorage.xml'"],
                   input=xml.encode("utf-8"), check=True)
    # 위젯 다시 그리기 — 갱신 방송(APPWIDGET_UPDATE)은 시스템만 보낼 수 있어서, 앱을 잠깐 열었다가 홈으로 나간다.
    # 앱이 화면에서 빠질 때 MainActivity.onPause 가 위젯을 다시 그린다(첫 화면은 마이캘린더가 아니라 요약본을 덮어쓰지 않는다).
    subprocess.run([ADB, "shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1"],
                   check=True, capture_output=True)
    time.sleep(4)
    subprocess.run([ADB, "shell", "input", "keyevent", "KEYCODE_HOME"], check=True)
    time.sleep(2)
    print("ok", len(snap["members"]), "members")



if __name__ == "__main__":
    main()
