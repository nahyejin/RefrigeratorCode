"""영상 말소리 받아쓰기(시간 포함) — 자막 싱크용.
    ffmpeg -i 영상.mov -map 0:a:0 -ac 1 -ar 16000 a.wav
    python3 my-video/scripts/transcribe.py a.wav [b.wav ...]
faster-whisper(large-v3-turbo). 클라우드 세션은 네트워크 허용 목록에 huggingface.co · cas-server.xethub.hf.co · us.aws.cdn.hf.co 가 있어야 모델을 받는다.
끝에 붙는 「다음 영상에서 만나요」「감사합니다」 같은 줄은 Whisper 환각 — 버린다.
"""
import sys
from faster_whisper import WhisperModel
m=WhisperModel("deepdml/faster-whisper-large-v3-turbo-ct2",device="cpu",compute_type="int8",cpu_threads=8)
for f in sys.argv[1:]:
    print("=====",f,flush=True)
    import wave,numpy as np
    w=wave.open(f); a=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float32)/32768
    segs,_=m.transcribe(a,language="ko",word_timestamps=True,vad_filter=False,beam_size=5,condition_on_previous_text=False)
    for s in segs:
        print(f"[{s.start:6.2f}-{s.end:6.2f}] {s.text.strip()}",flush=True)
        print("   ", " ".join(f"{w.word.strip()}@{w.start:.2f}" for w in s.words),flush=True)
