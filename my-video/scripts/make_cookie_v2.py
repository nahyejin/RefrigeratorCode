# -*- coding: utf-8 -*-
"""요리 릴스 6편(쿠키) v2 붙이기 — 2026-11-08.

사용자가 확정한 완성본(쿠키_20261105_v1, 124.8초, 이야기·자막·음악이 이미 들어 있음)의 0~98.333초(2950프레임, 「도아가 만들었다고 자랑해」까지)는
그대로 쓰고, 그 뒤(옛 UI 앱 구간·옛 로고 CTA·옛 이름 기능 칩)를 CookieTailV2(새 UI 앱 구간 + 새 로고 CTA + 그 밖에도 + 새 기능영상 8개) 렌더로 갈아 끼운다.

음악: 완성본에 깔린 쿠키 편 곡(Mixkit Little Bells — bgm_lib 에 원본 파일이 없음)을 그대로 이어 쓴다. 98.333초부터는 완성본의 음악만 나오는 구간
(앱 화면, 말소리 없음)을 그대로 잇고, 모자라는 길이는 같은 구간(99.5~114.6초)을 1.2초 겹쳐 돌려 채운 뒤 끝 2초를 줄인다. 새 곡을 받지 않는다.

사용: python make_cookie_v2.py <완성본 mp4> <tail 무음 mp4> <출력 mp4>
"""
import os, subprocess, sys

ref, tail, out = sys.argv[1], sys.argv[2], sys.argv[3]
CUT = 2950 / 30  # 98.333…
LOOP_A, LOOP_B, XF = 99.5, 114.6, 1.2


def dur(p):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p], capture_output=True, text=True).stdout.strip())


tail_len = dur(tail)
first = 114.6 - CUT  # 완성본에서 바로 이어지는 음악
loop_len = LOOP_B - LOOP_A
need = tail_len - first
n = 0
covered = first
while covered < tail_len + 0.5:
    covered += loop_len - XF
    n += 1
print(f"tail {tail_len:.2f}s, 이어 붙일 반복 {n}회")

inputs = ["-i", ref, "-i", tail]
fc = []
fc.append(f"[0:v]trim=end_frame=2950,setpts=PTS-STARTPTS,scale=1080:1920:flags=lanczos,setsar=1,fps=30[v0]")
fc.append(f"[1:v]setpts=PTS-STARTPTS,fps=30,setsar=1[v1]")
fc.append("[v0][v1]concat=n=2:v=1:a=0[v]")
fc.append(f"[0:a]atrim=0:{CUT:.5f},asetpts=PTS-STARTPTS,aresample=48000[a0]")
fc.append(f"[0:a]atrim={CUT:.5f}:{LOOP_B},asetpts=PTS-STARTPTS,aresample=48000[m0]")
for i in range(n):
    fc.append(f"[0:a]atrim={LOOP_A}:{LOOP_B},asetpts=PTS-STARTPTS,aresample=48000[l{i}]")
prev = "m0"
for i in range(n):
    fc.append(f"[{prev}][l{i}]acrossfade=d={XF}:c1=tri:c2=tri[x{i}]")
    prev = f"x{i}"
fc.append(f"[{prev}]atrim=0:{tail_len:.3f},afade=t=out:st={tail_len - 2.2:.3f}:d=2.2[a1]")
fc.append("[a0][a1]concat=n=2:v=0:a=1[a]")
cmd = ["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(fc), "-map", "[v]", "-map", "[a]",
       "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out]
subprocess.run(cmd, check=True)
print(out, f"{dur(out):.2f}s")
