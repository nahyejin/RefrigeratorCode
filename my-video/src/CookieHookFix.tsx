import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { FONT_FAMILY, INK, WHITE, YELLOW, useCustomFont } from "./shared";

// 쿠키 릴스 첫 3.4초 다시 만들기(2026-11-09 사용자): 제목이 아래쪽(1480~1840)에 있어 프로필 그리드(3:4 가운데 = y 240~1680)에서 잘림.
// 원본 사진(work/hook.jpg)이 남아 있지 않아 완성본 첫 프레임의 제목 없는 윗부분(810×1440)을 키워 배경으로 쓰고, 제목 없는 윗부분을 원래 크기로 y 240~1680(그리드 영역)에 두고 위아래는 흐린 배경, 제목은 머리 위(y 300~).
// 커버 이미지는 프레임 0 스틸(--frame=0).
export const COOKIE_HOOK_FIX_LEN = 102;
const TEXT = "아이랑 집에서 뭐 하지?\n쿠키 반죽 하나로\n오감 놀이 끝";
const SUB = "반죽 꾹 · 틀 쏙 · 오븐 구경";

export const CookieHookFix: React.FC = () => {
  useCustomFont();
  const frame = useCurrentFrame();
  const len = COOKIE_HOOK_FIX_LEN;
  const scale = interpolate(frame, [0, len], [1, 1.04]);
  const o = interpolate(frame, [len - 6, len], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: "#000", fontFamily: FONT_FAMILY }}>
      {/* 뒤: 같은 장면을 흐리게 꽉 채움 / 앞: 제목 없는 윗부분 1080×1440 을 그리드 영역(y 240~1680)에 원래 크기로 */}
      <Img src={staticFile("cookie_fix/hook_top.png")} style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", filter: "blur(28px) brightness(0.85)", transform: "scale(1.1)" }} />
      <div style={{ position: "absolute", top: 240, left: 0, width: 1080, height: 1440, overflow: "hidden" }}>
        <Img src={staticFile("cookie_fix/hook_top.png")} style={{ width: "100%", height: "100%", transform: `scale(${scale})`, transformOrigin: "50% 40%" }} />
      </div>
      <div style={{ position: "absolute", top: 300, left: 30, right: 30, textAlign: "center", opacity: o }}>
        <span style={{ display: "inline-block", whiteSpace: "pre-line", wordBreak: "keep-all", fontSize: 100, fontWeight: 900, lineHeight: 1.16, color: YELLOW, textShadow: "0 6px 22px rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.8)" }}>{TEXT}</span>
        <div style={{ marginTop: 26 }}>
          <span style={{ display: "inline-block", backgroundColor: WHITE, color: INK, fontSize: 64, fontWeight: 900, padding: "10px 36px", borderRadius: 999, boxShadow: "0 10px 26px rgba(0,0,0,0.35)" }}>{SUB}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
