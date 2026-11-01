"""DM 으로 보내는 레시피 정리 HTML → PDF (크롬 헤드리스 인쇄).

    python scripts/make_dm_pdf.py scripts/hub_post_files/dm/camping_alioolio.html
같은 이름의 .pdf 가 옆에 생긴다. 쪽 크기는 HTML 의 @page 를 따른다(폰 화면 비율). 쪽은 .pg 로 직접 나누고 한 쪽 안에서는 자르지 않는다 — 넘치면 쪽 수가 늘어나니 쪽 수를 확인할 것.
"""
import subprocess
import sys
from pathlib import Path

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

src = Path(sys.argv[1]).resolve()
out = src.with_suffix(".pdf")
subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=8000",
                f"--print-to-pdf={out}", src.as_uri()], check=True, capture_output=True)
print(out, out.stat().st_size)
