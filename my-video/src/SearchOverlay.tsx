import React from "react";
import { AbsoluteFill } from "remotion";
import { useCustomFont } from "./shared";
import { SearchBanner } from "./TalkReels";
import { BANNER_STYLE } from "./CookingCampPasta";

// 이미 만든 릴스(mp4)에 ffmpeg 로 얹을 검색 안내 한 장(투명 PNG). 요리 릴스 3편과 같은 자리·모양(자막 아래 맨 아래 가운데).
// npx remotion still src/index.ts SearchOverlay out/search_overlay.png --image-format=png
export const SearchOverlay: React.FC = () => {
  useCustomFont();
  return (
    <AbsoluteFill style={{ backgroundColor: "transparent" }}>
      <SearchBanner style={BANNER_STYLE} />
    </AbsoluteFill>
  );
};
