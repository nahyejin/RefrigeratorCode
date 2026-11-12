# -*- coding: utf-8 -*-
"""기능영상 v2 나레이션 생성 — Gemini TTS(gemini-2.5-flash-preview-tts, 목소리 Kore) → public/feature_v2/narr_<키>.mp3
사용: python gen_tts_v2.py 키1 키2 ...   (키는 TEXTS 의 키, 없으면 전부)
 - API 키는 backend/.env 의 GEMINI_API_KEY 를 읽기만 한다(저장소에 쓰지 않음).
 - 이미 파일이 있으면 건너뜀(--force 로 다시). 429(무료 한도)가 나면 멈추고 나머지는 건너뛴다 — 우회하지 않는다.
 - 문장은 서술어(동사)로 끝나게 쓴다(memory/feedback_reel_tts_narration.md). 생성 뒤 Whisper 로 재확인할 것.
"""
import base64, json, os, subprocess, sys, time, urllib.request, urllib.error, wave

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUTDIR = os.path.join(HERE, "..", "public", "feature_v2")
MODEL = "gemini-2.5-flash-preview-tts"

# 스토어 8장 헤드라인 순서를 따른 장면별 나레이션(짧게, 서술어로 끝맺음)
TEXTS = {
    "a_match": "내 냉장고 재료로 만들 수 있는 요리를, 매칭률 순으로 보여드려요.",
    "a_sub": "재료가 하나 모자라도, 대신 쓸 재료를 알려드려요.",
    "b_pick": "말하듯 물어보면, 쿡 픽이 골라드려요.",
    "b_plan": "식단 짜기는 일주일 식단을 짜드려요.",
    "c_coach": "요리하다 막히면, 쿡 코치에게 물어보세요. 대체 재료도 알려줘요.",
    "d_photo": "사진 한 장이면, 재료 등록이 끝나요.",
    "e_expiry": "소비기한은 자동으로 예상하고, 곧 상할 재료부터 알려드려요.",
    "f_listen": "레시피는 단계별로 요약해서, 귀로 들려드려요.",
    "g_family": "가족과 함께 쓰고, 아낀 돈도 한눈에 확인해요.",
    "cta": "쿡매치. 지금 프로필 링크에서 시작하세요.",
}


def key():
    for line in open(os.path.join(ROOT, "backend", ".env"), encoding="utf-8"):
        if line.startswith("GEMINI_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("GEMINI_API_KEY 없음")


def synth(text, k):
    body = {
        "contents": [{"parts": [{"text": text}]}],
        "generationConfig": {"responseModalities": ["AUDIO"],
                             "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": "Kore"}}}},
    }
    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": k})
    r = json.load(urllib.request.urlopen(req, timeout=120))
    part = r["candidates"][0]["content"]["parts"][0]["inlineData"]
    return base64.b64decode(part["data"])  # 24kHz 16bit mono PCM


def main():
    force = "--force" in sys.argv
    names = [a for a in sys.argv[1:] if not a.startswith("--")] or list(TEXTS)
    os.makedirs(OUTDIR, exist_ok=True)
    k = key()
    for n in names:
        mp3 = os.path.join(OUTDIR, f"narr_{n}.mp3")
        if os.path.exists(mp3) and not force:
            print("skip", n)
            continue
        try:
            pcm = synth(TEXTS[n], k)
        except urllib.error.HTTPError as e:
            print("HTTP", e.code, n, e.read()[:200])
            if e.code == 429:
                print("무료 한도(429) — 멈춤. 나머지는 자막 전용/로컬 TTS 로 대체하고 기록할 것.")
                break
            continue
        wav = mp3[:-4] + ".wav"
        with wave.open(wav, "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(pcm)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-codec:a", "libmp3lame", "-q:a", "3", mp3], check=True)
        os.remove(wav)
        print("ok", n, round(len(pcm) / 48000, 2), "s")
        time.sleep(7)


if __name__ == "__main__":
    main()
