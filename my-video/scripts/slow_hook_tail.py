"""훅 클립의 대사가 끝난 뒤 꼬리를 프레임 보간 슬로로 늘린다 — 웃음 포인트 자막이 읽힐 시간을 벌기 위해.
(2026-11-01 사용자: 훅 끝에 뜨는 자막이 너무 금방 끝난다 → 자막이 최소 3.5초는 보이게)
사용: python scripts/slow_hook_tail.py 입력.mp4 출력.mp4 대사끝초 배율
"""
import subprocess, sys
src, dst, t, k = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
# atempo 는 0.5 미만을 못 받으니 나눠서 건다(소리는 대사 뒤 방 소리뿐이라 음높이 유지로 늘리기만)
tempos, r = [], 1 / k
while r < 0.5:
    tempos.append(0.5); r /= 0.5
tempos.append(r)
at = ",".join(f"atempo={x:.4f}" for x in tempos)
fc = (f"[0:v]trim=0:{t},setpts=PTS-STARTPTS[v0];"
      f"[0:v]trim=start={t},setpts=PTS-STARTPTS,minterpolate=fps={24*k:.3f}:mi_mode=mci:mc_mode=aobmc:vsbmc=1,setpts={k}*PTS,fps=24[v1];"
      f"[0:a]atrim=0:{t},asetpts=PTS-STARTPTS[a0];"
      f"[0:a]atrim=start={t},asetpts=PTS-STARTPTS,{at}[a1];"
      f"[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
                "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", dst], check=True)
out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", dst], capture_output=True, text=True).stdout.strip()
print(dst, out)
