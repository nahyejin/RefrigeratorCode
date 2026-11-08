// 앱 frontend/src/index.css 의 브랜드 마크 모션 키프레임을 그대로 옮긴 것(2026-11-08, 스플래시 인트로용).
export const BRAND_MOTION_CSS = `

/* ── 브랜드 마크 모션(components/brand/BrandMark.tsx) ──────────────────────────
   「딱 맞는다」 = 재료가 받침에 딱 앉는다. 위에서 내려와 앉고 → 한 번 눌렸다 → 올라온다.
   좌표(px)는 SVG 사용자 좌표(마크 기준 1024 캔버스)다 — 받침 바닥선은 y≈733, 재료 아랫면은 y≈642.
   prefers-reduced-motion 에서는 이동·눌림 없이 0.12초 페이드만 한다. */
.brand-mark .brand-mark__ingredient { transform-origin: 512px 642px; }
.brand-mark .brand-mark__leaves { transform-origin: 514px 290px; }

/* 1) seat — 0.4초(마이크로 인터랙션: 레시피 N/M 완성·사진 인식 완료·식단 완성) */
.brand-mark--seat .brand-mark__ingredient { animation: brand-seat .4s cubic-bezier(.2,.9,.3,1) both; }
@keyframes brand-seat {
  0%   { transform: translateY(-96px); opacity: 0; }
  60%  { transform: translateY(0); opacity: 1; }
  78%  { transform: translateY(0) scale(1.04, .94); }
  100% { transform: translateY(0) scale(1, 1); }
}

/* 2) intro — 스플래시(웹·안드로이드): 받침 → 재료가 내려와 앉음 → 눌림 → 잎이 펴짐(약 1.2초) */
.brand-mark--intro .brand-mark__bowl { animation: brand-bowl-in .3s cubic-bezier(.2,.8,.3,1) both; }
.brand-mark--intro .brand-mark__ingredient { animation: brand-drop 1.15s linear .3s both, brand-idle-hop 2.2s ease-in-out 2.1s infinite; }
.brand-mark--intro .brand-mark__leaves { animation: brand-leaf-open .5s cubic-bezier(.2,.9,.3,1) 1.2s both, brand-leaf-idle 2.2s ease-in-out 2.1s infinite; }
@keyframes brand-bowl-in {
  0%   { transform: translateY(36px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
/* 위에서 떨어져 받침에 닿고 → 통통 세 번 튕기며 잦아들다가 → 「딱」 앉는다(2026-11-08 「떨어져서 몇 번 통통 튕기다가 딱 맞는 게 보이는 게 낫다」) */
@keyframes brand-drop {
  0%   { transform: translateY(-190px); opacity: 0; animation-timing-function: cubic-bezier(.45, 0, .85, .55); }
  10%  { opacity: 1; }
  34%  { transform: translateY(0) scale(1, 1); opacity: 1; animation-timing-function: ease-out; }
  38%  { transform: translateY(0) scale(1.07, .9); animation-timing-function: ease-out; }
  52%  { transform: translateY(-52px) scale(1, 1); animation-timing-function: cubic-bezier(.5, 0, .9, .5); }
  66%  { transform: translateY(0) scale(1, 1); animation-timing-function: ease-out; }
  69%  { transform: translateY(0) scale(1.045, .94); animation-timing-function: ease-out; }
  79%  { transform: translateY(-20px) scale(1, 1); animation-timing-function: cubic-bezier(.5, 0, .9, .5); }
  88%  { transform: translateY(0) scale(1, 1); animation-timing-function: ease-out; }
  90%  { transform: translateY(0) scale(1.02, .97); }
  100% { transform: translateY(0) scale(1, 1); }
}
@keyframes brand-leaf-open {
  0%   { transform: scale(.15) rotate(-12deg); opacity: 0; }
  50%  { transform: scale(1.08) rotate(5deg); opacity: 1; }
  75%  { transform: scale(1) rotate(-3deg); }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}

/* 3) hop — 스플래시(iOS 등 네이티브 정지 스플래시에서 이어질 때): 완성된 마크에서 시작해 한 번 떴다 「딱」 앉는다 */
.brand-mark--hop .brand-mark__ingredient { animation: brand-hop .62s cubic-bezier(.3,.1,.4,1) .14s both, brand-idle-hop 2.2s ease-in-out 1.5s infinite; }
.brand-mark--hop .brand-mark__leaves { animation: brand-leaf-wiggle .5s ease-in-out .62s both, brand-leaf-idle 2.2s ease-in-out 1.5s infinite; }
@keyframes brand-hop {
  0%   { transform: translateY(0); }
  34%  { transform: translateY(-72px); animation-timing-function: cubic-bezier(.5,0,.9,.5); }
  66%  { transform: translateY(0); animation-timing-function: ease-out; }
  82%  { transform: translateY(0) scale(1.05, .92); }
  100% { transform: translateY(0) scale(1, 1); }
}
@keyframes brand-leaf-wiggle {
  0%   { transform: rotate(0deg); }
  30%  { transform: rotate(6deg); }
  60%  { transform: rotate(-4deg); }
  100% { transform: rotate(0deg); }
}

/* 2-b) idle — 스플래시가 레시피 수를 기다리는 동안(앉은 뒤 최대 몇 초) 멈춰 있지 않게: 재료가 2.2초마다 살짝 떴다가 「딱」 다시 앉고, 잎이 숨 쉬듯 흔들린다.
   움직임 줄이기에서는 아래 감소-모션 블록이 animation 전체를 덮어써 멈춘다. */
@keyframes brand-idle-hop {
  0%, 62%, 100% { transform: translateY(0) scale(1, 1); }
  18%  { transform: translateY(-26px) scale(1, 1); animation-timing-function: cubic-bezier(.5, 0, .9, .5); }
  34%  { transform: translateY(0) scale(1, 1); animation-timing-function: ease-out; }
  42%  { transform: translateY(0) scale(1.04, .94); }
  52%  { transform: translateY(0) scale(1, 1); }
}
@keyframes brand-leaf-idle {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(3.5deg); }
  75% { transform: rotate(-3.5deg); }
}

@keyframes brand-wordmark-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
`;
