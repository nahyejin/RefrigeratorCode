// 자동 생성 파일 — 직접 고치지 말고 `python my-video/scripts/narration_frames.py` 로 다시 만든다.
// public/reelN_narration_*.mp3 의 실제 길이(30fps 프레임, 올림).
export const NARRATION_FRAMES: Record<string, number> = {
  reel1_narration_1: 146, // 4.85s
  reel1_narration_2: 96, // 3.17s
  reel1_narration_cta: 170, // 5.65s
  reel2_narration_1: 109, // 3.61s
  reel2_narration_2: 116, // 3.85s
  reel2_narration_3: 108, // 3.57s
  reel2_narration_cta: 213, // 7.09s
  reel3_narration_1: 115, // 3.81s
  reel3_narration_2: 102, // 3.37s
  reel3_narration_cta: 230, // 7.65s
  reel3_narration_hook1: 84, // 2.77s
  reel3_narration_hook2: 120, // 3.97s
  reel4_narration_1: 140, // 4.65s
  reel4_narration_2: 127, // 4.21s
  reel4_narration_3: 164, // 5.45s
  reel4_narration_cta: 207, // 6.89s
  reel5_narration_cta: 201, // 6.69s
  reel6_narration_1: 98, // 3.25s
  reel6_narration_cta: 219, // 7.29s
  reel7_narration_cta: 230, // 7.65s
};

// 나레이션이 끝난 뒤 다음 비트로 넘어가기 전 남겨두는 여유(0.27s).
export const NARRATION_TAIL = 8;

// 비트 원래 길이(base)와 "나레이션 길이 + 여유" 중 긴 쪽 — 나레이션이 비트보다 길면 그만큼
// 늘어난 길이를 돌려주고, 늘어난 차이(fit - base)는 각 릴스에서 정지 컷으로 채운다.
export const fitToNarration = (base: number, key: string, tail = NARRATION_TAIL): number => {
  const n = NARRATION_FRAMES[key];
  return n === undefined ? base : Math.max(base, n + tail);
};
