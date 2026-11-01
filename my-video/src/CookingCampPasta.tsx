import React from "react";
import { AbsoluteFill, Audio, Easing, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FAMILY, INK, WHITE, YELLOW, LINE, useCustomFont, CtaOutro, Caption } from "./shared";
import { Intro, INTRO, CTA_LEN, Mark, OverviewSegments, OverviewCta, SEGS_LEN } from "./ReelOverview";

// 요리 릴스 3편 — 캠핑 새우 알리오올리오(2026-10-31, 캠핑장 버너 하나로).
// ① 완성 사진 + 후킹(궁금증: 「이것」이 뭔지는 ③에서 풀린다) → ② 도아랑 캠핑, 텐트 → ③ 집에서 해 온 양념·재료 소분
// → ④ 버너 하나로 요리(단계 자막) → ⑤ 완성 → ⑥ 레시피는 쿡매치에서: 검색 · 대체 재료 → 「원팬 파스타」 → 캘린더 · 장 봐야 할 재료
// → ⑦ 이 편 슬로건(4편 장보기) → ⑧ 그 밖에도 → ⑨ 8개 기능 → ⑩ 대표 슬로건. 파스타를 먹는 영상은 없어서, 저녁 전에 먹던 모습을 ②에 시간 순서대로 넣었다.
// 사용자 요청(2026-11-01): 사진 한 장 뒤 바로 앱 화면이면 이탈이 많다 → 이야기·요리를 앞에, 앱은 완성 뒤로. 아빠는 화면에 안 나오게(흐림 말고 잘라 냄).
// 원본은 public/cooking/새우알리오올리오_20261031/ (git 제외). 가이드 my-video/COOKING_REEL_GUIDE.md.

const DIR = "cooking/새우알리오올리오_20261031/work/";
const f = (s: number) => Math.round(s * 30);

// 소분 체크리스트 — 항목이 at 초에 하나씩 체크되며 나타난다(사용자 2026-11-01: 무엇을 챙겼는지 구체적으로)
type PackList = { title: string; items: { at: number; text: string; head?: boolean }[]; bottom?: boolean; small?: boolean };

type Shot =
  | { kind: "video"; src: string; from: number; to: number; rate?: number; audio?: boolean; step?: string; app?: boolean; list?: PackList }
  | { kind: "photo"; src: string; len: number; caption?: string; origin?: string; pan?: boolean; list?: PackList }
  | { kind: "cta"; len: number }
  | { kind: "transition"; len: number }
  | { kind: "features"; len: number }
  | { kind: "finalCta"; len: number };

const shotLen = (s: Shot) => (s.kind === "video" ? Math.round((f(s.to) - f(s.from)) / (s.rate ?? 1)) : s.len);

// 첫 장면 = 완성 사진 + 큰 노란 후킹(썸네일 겸용)
const HOOK = { at: 0, len: 2.8, text: "캠핑 알리오올리오\n이렇게 소분해 가요" };
const OPEN: Shot[] = [{ kind: "photo", src: "hook.jpg", len: f(2.8), origin: "50% 55%" }];

// 도아랑 캠핑 — 가로 영상에서 도아만 9:16 으로 잘라 냄(d_*.mp4, 아빠는 화면 밖)
const STORY: Shot[] = [
  { kind: "video", src: "d_072234.mp4", from: 0, to: 2.6, step: "캠핑장 도착!\n도아는 폴대 들고 텐트 치기 거들기" },
  { kind: "video", src: "d_072359.mp4", from: 0, to: 2.6 },
  { kind: "video", src: "d_074745.mp4", from: 0, to: 5.0, rate: 1.3, step: "도아는 텐트가 신기해요" },
  // 18:05 먼저 먹던 모습(파스타 전이라 시간 순서대로 여기에. 파스타를 먹는 영상은 없다 — 사용자 결정 2026-11-01)
  { kind: "video", src: "d_090542.mp4", from: 0, to: 3.0, step: "해 질 녘, 배고픈 도아는\n먼저 냠냠" },
  { kind: "video", src: "d_090542b.mp4", from: 0, to: 2.2 },
];
// 후킹이 약속한 「무엇을 소분하나」 — 후킹 바로 뒤에 보여 준다(사용자 2026-11-01: 이 콘텐츠가 소분 정보라는 게 드러나야 이탈이 없다)
const PREP: Shot[] = [
  // prep_sauce.jpg 는 「설탕」 라벨을 흐리게 한 사본(원본 prep_sauce_orig.jpg) — 설탕은 이 요리에 안 쓴다
  { kind: "photo", src: "prep_sauce.jpg", len: f(4.4), origin: "40% 75%", list: { title: "① 양념은 작은 통에", items: [
    { at: 0.3, text: "올리브오일 (소스통)" }, { at: 0.9, text: "갈릭솔트 · 소금" }, { at: 1.5, text: "후춧가루" },
    { at: 2.1, text: "페퍼론치노" }, { at: 2.7, text: "코인육수 1알" },
  ] } },
  // 가로 사진 — 양옆이 잘리지 않게 왼쪽 끝에서 오른쪽 끝까지 천천히 훑는다(사용자 2026-11-01)
  { kind: "photo", src: "prep_bags.jpg", len: f(6.0), pan: true, list: { title: "② 재료는 지퍼백에", items: [
    { at: 0.4, text: "냉동 흰다리 새우살" }, { at: 1.2, text: "편마늘 · 다진 마늘" }, { at: 2.4, text: "잎채소" },
    { at: 3.0, text: "방울토마토 (반 잘라서)" }, { at: 3.9, text: "파스타면" }, { at: 4.8, text: "파마산 치즈가루" },
  ] } },
];

// 버너 하나로 요리 — 사용자가 실제로 한 순서(2026-11-01 사용자 설명). 쿡매치 「원팬 파스타」를 캠핑에 맞게 바꿨다
const COOK: Shot[] = [
  // 18:05 캠핑장 야경(같은 영상 뒷부분, 9:16 으로 잘라 냄) — 요리 제목이 이 위에 뜬다
  { kind: "video", src: "n_090542.mp4", from: 0, to: 2.8, rate: 1.2, step: "해가 지면\n버너 하나로 저녁 준비" },
  { kind: "video", src: "c_095555.mp4", from: 0, to: 7.0, rate: 2, step: "팬에 물 붓고\n소금 조금" },
  { kind: "video", src: "c_095638.mp4", from: 0, to: 9.4, rate: 2, step: "파스타면부터 삶아요" },
  { kind: "video", src: "c_100012.mp4", from: 2, to: 30, rate: 4, step: "저어 가며 8분" },
  { kind: "video", src: "c_100443.mp4", from: 30, to: 70, rate: 4, step: "새우는 살짝 데쳐서\n한켠에" },
  { kind: "video", src: "c_101422.mp4", from: 48, to: 123, rate: 5, step: "올리브오일에 편마늘·다진 마늘\n데워서 향 내기" },
  { kind: "video", src: "c_101422.mp4", from: 124, to: 142, rate: 3, step: "새우 → 코인육수 → 면\n갈릭솔트·후추·페퍼론치노" },
];
const PLATE: Shot[] = [{ kind: "photo", src: "plate.jpg", len: f(3.6), caption: "방울토마토 · 파마산 치즈\n잎채소 올려 완성!", origin: "50% 55%" }];

// 완성 바로 뒤 — 원래 레시피 → 캠핑에서 바꾼 점(사용자 2026-11-01: 너무 늦게 나와서 완성 직후로)
const RECIPE: Shot[] = [
  // 원래 레시피(읽어 주기 화면의 조리 순서) 요약 → 캠핑에서 바꾼 점(사용자 2026-11-01)
  { kind: "video", src: "app_raw.mp4", from: 40.5, to: 48.0, app: true, list: { title: "원래 레시피는 이래요", bottom: true, items: [
    { at: 0.3, text: "마늘 슬라이스, 토마토 썰기" }, { at: 0.8, text: "올리브오일 3T에 마늘 노릇하게" },
    { at: 1.3, text: "새우 볶다가 토마토" }, { at: 1.8, text: "물 500ml · 면 90g · 참치액 1T" },
    { at: 2.3, text: "저어 가며 10~12분, 소금 간" }, { at: 2.8, text: "잎채소 · 후추 · 치즈 올려 완성" },
  ] } },
  // 바꾼 점은 집에서 미리 소분한 것부터(사용자 2026-11-01)
  { kind: "photo", src: "hook.jpg", len: f(6.5), origin: "50% 60%", list: { title: "캠핑에서는 이렇게 바꿨어요", small: true, items: [
    { at: 0.2, text: "집에서 미리", head: true }, { at: 0.5, text: "마늘 슬라이스 · 토마토 반 자르기" }, { at: 1.1, text: "면 · 새우살 · 채소 · 치즈 지퍼백 소분" },
    { at: 1.9, text: "캠핑장에서", head: true }, { at: 2.2, text: "면은 물에 먼저 삶고" }, { at: 2.8, text: "참치액 대신 코인육수 · 갈릭솔트" },
    { at: 3.4, text: "페퍼론치노 · 파마산 치즈 추가" },
  ] } },
];

// 레시피는 쿡매치에서 — 앱 작업본(880x1784, 상태바 잘라 냄, 17.3~24.7s 알림 흐림) 시각
const APP: Shot[] = [
  { kind: "video", src: "app_raw.mp4", from: 2.0, to: 7.6, rate: 1.6, app: true, step: "레시피는 쿡매치에서 찾고\n캠핑에 맞게 살짝 바꿨어요" },
  { kind: "video", src: "app_raw.mp4", from: 24.8, to: 35.0, rate: 2, app: true, step: "없는 재료는 있는 걸로\n새우 → 새우살 · 치킨스톡 → 코인육수" },
  { kind: "video", src: "app_raw.mp4", from: 36.0, to: 40.0, rate: 1.2, app: true, step: "버너 하나라\n「원팬 파스타」로" },
  { kind: "video", src: "app_raw.mp4", from: 49.0, to: 53.0, rate: 1.2, app: true, step: "먹을 날을 골라\n캘린더에 담고" },
  { kind: "video", src: "app_raw.mp4", from: 89.5, to: 94.0, rate: 1.4, app: true, step: "장 봐야 할 재료만 챙겨요" },
];
const TAIL: Shot[] = [
  { kind: "cta", len: CTA_LEN },
  { kind: "transition", len: INTRO },
  { kind: "features", len: SEGS_LEN },
  { kind: "finalCta", len: CTA_LEN },
];
const SHOTS: Shot[] = [...OPEN, ...PREP, ...STORY, ...COOK, ...PLATE, ...RECIPE, ...APP, ...TAIL];
export const COOKING_CAMP_PASTA_TOTAL = SHOTS.reduce((a, s) => a + shotLen(s), 0);
const TITLE_LEN = f(3.4);
const COOK_START = [...OPEN, ...PREP, ...STORY].reduce((a, s) => a + shotLen(s), 0);
// 앱 화면·기능 소개 동안 오른쪽 위에 「앱스토어·플레이스토어에서 검색」 안내(셀카형 릴스와 같은 디자인, 사용자 2026-11-01).
// 쿡매치 앱 화면부터 8개 기능 영상 끝까지(레시피 카드·「그 밖에도」 기능 칩 화면은 겹쳐서 뺀다). 이 편 CTA·끝 화면에는 검색창이 따로 있어 뺀다
const BANNER_FROM = [...OPEN, ...PREP, ...STORY, ...COOK, ...PLATE, ...RECIPE].reduce((a, s) => a + shotLen(s), 0);
const BANNER_TO = COOKING_CAMP_PASTA_TOTAL - CTA_LEN;
// 오른쪽 위(사용자 2026-11-01): 인스타 위쪽 아이콘 아래, 앱 머리줄 오른쪽(이름·로그아웃)을 덮는 자리.
// 셀카형 SearchBanner 를 줄이면 글자가 너무 작아서, 같은 디자인(안내 한 줄 + 「🔍 쿡매치」 검색창)을 모서리용으로 짧게 다시 짰다.
// 아래쪽은 인스타 아이디·본문 줄에 가리고, 자막 바로 위는 화면 가운데를 가려서 뺐다
const CornerSearch: React.FC = () => (
  <div style={{ position: "absolute", top: 150, right: 26, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "14px 22px 16px", borderRadius: 26, backgroundColor: "rgba(0,0,0,0.62)", fontFamily: FONT_FAMILY }}>
    <div style={{ fontSize: 30, fontWeight: 700, color: WHITE, whiteSpace: "nowrap" }}>앱스토어·플레이스토어에서</div>
    <div style={{ display: "flex", alignItems: "center", gap: 12, height: 62, padding: "0 30px", borderRadius: 999, background: WHITE, border: `2px solid ${INK}` }}>
      <svg width="30" height="30" viewBox="0 0 46 46" fill="none">
        <circle cx="19" cy="19" r="13" stroke={INK} strokeWidth="5" />
        <line x1="29" y1="29" x2="41" y2="41" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      </svg>
      <div style={{ fontSize: 38, fontWeight: 800, color: INK }}>쿡매치</div>
    </div>
  </div>
);
const CTA_AT = BANNER_FROM + APP.reduce((a, s) => a + shotLen(s), 0);

const fadeInOut = (frame: number, len: number, k = 5) =>
  Math.min(
    interpolate(frame, [0, k], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    interpolate(frame, [len - k, len], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  );

const Video: React.FC<{ s: Extract<Shot, { kind: "video" }>; len: number }> = ({ s, len }) => {
  const video = (
    <OffthreadVideo
      src={staticFile(DIR + s.src)}
      trimBefore={f(s.from)}
      trimAfter={f(s.to)}
      playbackRate={s.rate ?? 1}
      muted={!s.audio}
      style={{ width: "100%", height: "100%", objectFit: s.app ? "contain" : "cover" }}
    />
  );
  return (
    <AbsoluteFill style={{ backgroundColor: s.app ? WHITE : "#000" }}>
      {s.app ? (
        // 앱 녹화 — 높이에 맞춰 가운데, 얇은 테두리
        <div style={{ position: "absolute", top: 0, left: (1080 - 956) / 2, width: 956, height: 1920, border: `1px solid ${LINE}` }}>{video}</div>
      ) : (
        video
      )}
      {s.step && <Caption from={6} len={len - 8} text={s.step} />}
      {s.list && <PackCard list={s.list} />}
    </AbsoluteFill>
  );
};

// 사진 — 천천히 다가간다. 첫 장면(후킹)은 첫 프레임부터 보이게 페이드 없이 시작.
// pan: 가로 사진을 높이에 맞추고 왼쪽 끝 → 오른쪽 끝으로 훑어 사진 전체를 보여 준다
const Photo: React.FC<{ s: Extract<Shot, { kind: "photo" }>; len: number; first: boolean }> = ({ s, len, first }) => {
  const frame = useCurrentFrame();
  const z = interpolate(frame, [0, len], [1.0, 1.12], { easing: Easing.inOut(Easing.cubic) });
  const x = interpolate(frame, [4, len - 4], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) });
  const o = first ? interpolate(frame, [len - 4, len], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : fadeInOut(frame, len, 4);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000", opacity: o }}>
      {s.pan ? (
        <Img src={staticFile(DIR + s.src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${x}% 50%` }} />
      ) : (
        <Img src={staticFile(DIR + s.src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: s.origin ?? "50% 50%", transform: `scale(${z})`, transformOrigin: s.origin ?? "50% 50%" }} />
      )}
      {s.caption && <Caption from={6} len={len - 8} text={s.caption} />}
      {s.list && <PackCard list={s.list} />}
    </AbsoluteFill>
  );
};

const PackCard: React.FC<{ list: PackList }> = ({ list }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 16, mass: 0.6 } });
  return (
    <div style={{ position: "absolute", top: list.bottom ? 960 : 150, left: 56, right: 56, padding: "30px 40px 34px", borderRadius: 36, backgroundColor: list.bottom ? "rgba(0,0,0,0.86)" : "rgba(0,0,0,0.62)", opacity: p, transform: `translateY(${(1 - p) * -20}px)`, fontFamily: FONT_FAMILY }}>
      <div style={{ color: YELLOW, fontSize: 62, fontWeight: 900, marginBottom: 14 }}>{list.title}</div>
      {list.items.map((it, k) => {
        const q = spring({ frame: frame - f(it.at), fps, config: { damping: 14, mass: 0.5 } });
        return (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 18, color: it.head ? YELLOW : WHITE, fontSize: it.head ? 40 : list.small ? 46 : 54, fontWeight: 800, lineHeight: 1.45, marginTop: it.head && k > 0 ? 14 : 0, opacity: q, transform: `translateX(${(1 - q) * -30}px)` }}>
            {!it.head && <span style={{ color: YELLOW }}>✓</span>}
            {it.head ? `― ${it.text}` : it.text}
          </div>
        );
      })}
    </div>
  );
};

// 오늘의 레시피 제목 — 요리 첫 장면 위쪽
const RecipeTitle: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - 2, fps, config: { damping: 15, mass: 0.7 } });
  const out = interpolate(frame, [TITLE_LEN - 8, TITLE_LEN], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: 210, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 18, opacity: Math.min(p, out), transform: `translateY(${(1 - p) * -24}px)`, fontFamily: FONT_FAMILY }}>
      <div style={{ backgroundColor: YELLOW, color: INK, fontSize: 52, fontWeight: 800, padding: "10px 34px", borderRadius: 999, boxShadow: "0 10px 26px rgba(0,0,0,0.25)" }}>버너 하나로</div>
      <div style={{ color: WHITE, fontSize: 104, fontWeight: 900, lineHeight: 1.15, textAlign: "center", textShadow: "0 4px 18px rgba(0,0,0,0.7), 0 0 4px rgba(0,0,0,0.6)" }}>
        새우 알리오올리오
      </div>
    </div>
  );
};

const Shots: React.FC = () => {
  let cursor = 0;
  return (
    <>
      {SHOTS.map((s, i) => {
        const from = cursor;
        const len = shotLen(s);
        cursor += len;
        let body: React.ReactNode;
        if (s.kind === "video") body = <Video s={s} len={len} />;
        else if (s.kind === "photo") body = <Photo s={s} len={len} first={i === 0} />;
        else if (s.kind === "cta")
          body = (
            <CtaOutro
              payoffLine={
                <>
                  이제 장보기도, <span style={{ color: "#D99A00" }}>가장 효율적으로</span>
                </>
              }
            />
          );
        else if (s.kind === "transition")
          body = (
            <Intro
              line1="그 밖에도"
              line2={
                <>
                  이런 <Mark>기능</Mark>이 있어요
                </>
              }
            />
          );
        else if (s.kind === "features") body = <OverviewSegments />;
        else body = <OverviewCta />;
        return (
          <Sequence key={i} from={from} durationInFrames={len} name={`${i + 1}-${s.kind}${s.kind === "video" || s.kind === "photo" ? "-" + s.src : ""}`}>
            {body}
          </Sequence>
        );
      })}
    </>
  );
};

// 캠핑 저녁 마림바 BGM(scripts/make_bgm_camp.py) — 원음 대사가 없어서 처음부터 끝까지 깐다
const Bgm: React.FC = () => (
  <Audio
    src={staticFile("bgm_camp_marimba.mp3")}
    volume={(fr) =>
      0.42 *
      Math.min(
        interpolate(fr, [0, 10], [0.6, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        interpolate(fr, [COOKING_CAMP_PASTA_TOTAL - 45, COOKING_CAMP_PASTA_TOTAL - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      )
    }
  />
);

const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const len = f(HOOK.len);
  // 썸네일로 쓰므로 첫 프레임부터 꽉 보이게 — 사라질 때만 페이드(COOKING_REEL_GUIDE 0-1)
  const o = interpolate(frame, [len - 6, len], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: 640, left: 40, right: 40, textAlign: "center", opacity: o, fontFamily: FONT_FAMILY }}>
      <span style={{ display: "inline-block", whiteSpace: "pre-line", fontSize: 118, fontWeight: 900, lineHeight: 1.18, color: YELLOW, textShadow: "0 6px 22px rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.8)" }}>{HOOK.text}</span>
    </div>
  );
};

export const CookingCampPasta: React.FC = () => {
  useCustomFont();
  return (
    <AbsoluteFill style={{ backgroundColor: "#000", fontFamily: FONT_FAMILY }}>
      <Shots />
      <Sequence from={COOK_START} durationInFrames={TITLE_LEN}>
        <RecipeTitle />
      </Sequence>
      <Sequence from={f(HOOK.at)} durationInFrames={f(HOOK.len)}>
        <Hook />
      </Sequence>
      <Sequence from={BANNER_FROM} durationInFrames={CTA_AT - BANNER_FROM}>
        <CornerSearch />
      </Sequence>
      <Sequence from={CTA_AT + CTA_LEN + INTRO} durationInFrames={BANNER_TO - CTA_AT - CTA_LEN - INTRO}>
        <CornerSearch />
      </Sequence>
      <Bgm />
    </AbsoluteFill>
  );
};
