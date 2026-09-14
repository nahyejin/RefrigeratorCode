"""public/reelN_narration_*.mp3 길이를 재서 src/narrationFrames.ts 를 다시 쓴다.

나레이션을 새로 만들거나 교체할 때마다 이걸 돌리면, 각 릴스의 비트 길이(fitToNarration)가
실제 음성 길이에 맞춰 자동으로 늘어난다 — 손으로 프레임 수를 다시 계산할 필요가 없다.
usage: python my-video/scripts/narration_frames.py
"""
import glob
import math
import os
import re
import subprocess

FPS = 30
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "public")
OUT = os.path.join(ROOT, "src", "narrationFrames.ts")


def duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
        capture_output=True, text=True, check=True,
    ).stdout
    return float(out.strip())


def main():
    rows = []
    for path in sorted(glob.glob(os.path.join(PUBLIC, "reel*_narration_*.mp3"))):
        key = os.path.splitext(os.path.basename(path))[0]
        if not re.fullmatch(r"reel\d_narration_\w+", key):
            continue
        sec = duration(path)
        rows.append((key, math.ceil(sec * FPS), sec))

    lines = [
        "// 자동 생성 파일 — 직접 고치지 말고 `python my-video/scripts/narration_frames.py` 로 다시 만든다.",
        "// public/reelN_narration_*.mp3 의 실제 길이(30fps 프레임, 올림).",
        "export const NARRATION_FRAMES: Record<string, number> = {",
    ]
    lines += [f'  {key}: {frames}, // {sec:.2f}s' for key, frames, sec in rows]
    lines += [
        "};",
        "",
        "// 나레이션이 끝난 뒤 다음 비트로 넘어가기 전 남겨두는 여유(0.27s).",
        "export const NARRATION_TAIL = 8;",
        "",
        "// 비트 원래 길이(base)와 \"나레이션 길이 + 여유\" 중 긴 쪽 — 나레이션이 비트보다 길면 그만큼",
        "// 늘어난 길이를 돌려주고, 늘어난 차이(fit - base)는 각 릴스에서 정지 컷으로 채운다.",
        "export const fitToNarration = (base: number, key: string, tail = NARRATION_TAIL): number => {",
        "  const n = NARRATION_FRAMES[key];",
        "  return n === undefined ? base : Math.max(base, n + tail);",
        "};",
        "",
    ]
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))
    for key, frames, sec in rows:
        print(f"{key}\t{sec:.2f}s\t{frames}f")


if __name__ == "__main__":
    main()
