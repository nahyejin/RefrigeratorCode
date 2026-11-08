/**
 * BrandMark — 쿡매치 마크(재료가 받침에 「딱」 앉는다). P1 확정판(앰버·주황 없음).
 *
 * 구성: 받침(bowl) + 재료(ingredient) + 잎(leaves). 받침은 항상 같고 재료 모양/색만 바뀐다(패밀리).
 * 모양은 확정 시안(store/logo_proposals/e9_final/p1_final)과 같다 — 받침·잎의 윤곽은 시안의 래스터 마스크를
 * `scripts/make_brand_mark_paths.py` 로 따라 그린 경로라서 둥근 모서리까지 앱 아이콘과 일치한다. 좌표는 시안의
 * 기준 좌표(1024 캔버스, 배율 1.0). 앱 아이콘은 이 좌표에 ×1.32(y 중심 420)를 적용한 것이다.
 * 둥근 재료(ball·tomato·mandarin)는 받침에 재료 자리(틈 18)가 이미 파여 있다. 그 밖의 재료 모양은 재료를
 * 18 만큼 부풀려(stroke) 받침에서 빼는 마스크로 같은 폭의 틈을 만든다(「딱 맞는다」).
 *
 * 색은 CSS 변수에 기댄다(없으면 폴백):
 *   --brand #FFD600  --ink-900 #1A1A1E  --surface #FFFFFF
 *   --brand-leaf #1E9252  --brand-leaf-on-dark #3CBE6E   (index.css :root)
 *   ※ 받침 전용 토큰·앰버/주황 띠는 만들지 않는다 — 받침은 --ink-900(밝은/노랑 바탕) 또는 --brand(검정 바탕).
 *
 * 모션(index.css 의 brand-* 키프레임):
 *   motion="seat"  재료가 위에서 내려와 0.4초에 앉고 한 번 눌렸다 올라온다(마운트 때 1회).
 *   motion="intro" 스플래시용 — 받침이 먼저 나타나고 → 재료가 내려와 앉고 → 눌림 → 잎이 펴짐/흔들림(약 1.1초).
 *   motion="hop"   스플래시용 — 완성된 마크에서 시작(네이티브 정지 스플래시와 이어짐)해 한 번 떴다 다시 「딱」 앉는다.
 *   motion="loop" 매칭 계산 로딩용 — 재료가 내려와 앉고 → 잠깐 머물고 → 사라진다를 1.2초 주기로 되풀이(onIteration 으로 재료를 바꿔 끼울 수 있다).
 *   prefers-reduced-motion 에서는 이동·눌림 없이 0.12초 페이드만 한다(loop 는 밝기만 숨 쉬듯 — 로딩 표시가 멈춰 보이지 않게).
 * 쓰지 말 곳: AI 대기 화면(StepLoading)·쿡 픽/쿡 코치 아바타(크레딧·AI 기능 표시 체계), 모든 버튼·카드에 깔기.
 */
import * as React from 'react';

export type BrandIngredient =
  | 'ball' | 'tomato' | 'mandarin' | 'egg' | 'tofu' | 'persimmon' | 'strawberry' | 'potato' | 'zucchini' | 'eggplant' | 'melon'
  /** 재료 없이 받침 + 점선 재료 자리 — 「내 냉장고가 비었어요」 빈 화면 */
  | 'slot';
/**
 * onYellow = 노랑 바탕 위(앱 아이콘과 같은 색: 받침 검정·재료 흰색·잎 진초록),
 * color = 밝은/흰 배경 위(받침 검정·재료 노랑·잎 진초록),
 * reverse = 검정 배경 위(받침 노랑·재료 흰색·잎 연초록),
 * mono = 한 색 실루엣(currentColor)
 */
export type BrandTone = 'onYellow' | 'color' | 'reverse' | 'mono';
export type BrandMotion = 'none' | 'seat' | 'intro' | 'hop' | 'loop';

export interface BrandMarkProps {
  ingredient?: BrandIngredient;
  /** 마크 가로 px(재료가 받침에 앉은 기본 모양 기준). 세로는 비율대로. 최소 16, 알림은 24 단색 */
  size?: number;
  tone?: BrandTone;
  /** 마운트 때 한 번 재생되는 모션. 기본 none */
  motion?: BrandMotion;
  /** 잎 한 장(작은 크기·알림) 또는 두 장(기본) */
  leaves?: 1 | 2;
  /**
   * 재료가 받침 옆으로 굴러 나간 모양 — 「맞는 레시피가 없어요」 빈 화면 전용(맞지 않음을 뜻한다).
   * 다른 곳에서는 쓰지 않는다(둥둥 뜬 재료·받침에 안 닿는 재료는 로고 규칙 위반).
   */
  rolledOut?: boolean;
  /** motion="loop" 에서 한 바퀴가 끝날 때마다(재료가 안 보이는 순간) 불린다 */
  onIteration?: () => void;
  /** 접근성 이름. 장식이면 생략(aria-hidden) */
  title?: string;
  className?: string;
  style?: React.CSSProperties;
}

const GAP = 18;
/** 마크가 차지하는 영역(받침 x 202~822, 잎 끝 y 94 ~ 받침 바닥 y 733)에 여백을 준 보기 상자 */
const BOX = { x: 182, y: 74, w: 660, h: 679 };
/** 굴러 나간 재료까지 담는 넓은 보기 상자 */
const BOX_ROLLED = { x: 182, y: 74, w: 1130, h: 679 };

interface Shape {
  /** 재료 도형을 그리는 함수 — extra>0 이면 받침에서 파낼 자리(스트로크로 부풀림)로 쓴다 */
  draw: (fill: string, extra: number) => React.ReactNode;
  color: { color: string; reverse: string; onYellow: string };
  /** 받침에 이미 재료 자리가 파여 있는(둥근) 재료인가 */
  round?: boolean;
}

const shapeProps = (fill: string, extra: number) =>
  extra > 0
    ? { fill, stroke: fill, strokeWidth: extra * 2, strokeLinejoin: 'round' as const }
    : { fill };

const EGG_D =
  'M666,476 L659,442 L648,409 L634,378 L617,351 L598,326 L577,307 L556,293 L534,284 L512,281 L490,284 L468,293 L447,307 L426,326 L407,351 L390,378 L376,409 L365,442 L358,476 L356,510 L359,543 L368,574 L381,601 L400,626 L424,645 L451,659 L481,668 L512,671 L543,668 L573,659 L600,645 L624,626 L643,601 L656,574 L665,543 L668,510 Z';
const STRAWBERRY_D =
  'M666,460 L668,426 L665,393 L656,362 L643,335 L624,310 L600,291 L573,277 L543,268 L512,265 L481,268 L451,277 L424,291 L400,310 L381,335 L368,362 L359,393 L356,426 L358,460 L365,494 L376,527 L390,558 L407,585 L426,610 L447,629 L468,643 L490,652 L512,655 L534,652 L556,643 L577,629 L598,610 L617,585 L634,558 L648,527 L659,494 Z';

const CIRCLE = (f: string, e: number) => <circle cx={512} cy={470} r={172} {...shapeProps(f, e)} />;
const SHAPES: Record<Exclude<BrandIngredient, 'slot'>, Shape> = {
  ball: { draw: CIRCLE, round: true, color: { color: 'var(--brand, #FFD600)', reverse: 'var(--surface, #FFFFFF)', onYellow: 'var(--surface, #FFFFFF)' } },
  tomato: { draw: CIRCLE, round: true, color: { color: '#EE403A', reverse: '#EE403A', onYellow: '#EE403A' } },
  mandarin: { draw: CIRCLE, round: true, color: { color: '#FF961E', reverse: '#FF961E', onYellow: '#FF961E' } },
  egg: { draw: (f, e) => <path d={EGG_D} {...shapeProps(f, e)} />, color: { color: '#FAECCE', reverse: '#FAECCE', onYellow: '#FAECCE' } },
  tofu: { draw: (f, e) => <rect x={360} y={332} width={304} height={304} rx={76} {...shapeProps(f, e)} />, color: { color: '#FFFFFF', reverse: '#FFFFFF', onYellow: '#FFFFFF' } },
  persimmon: { draw: (f, e) => <ellipse cx={512} cy={466} rx={190} ry={160} {...shapeProps(f, e)} />, color: { color: '#EC7028', reverse: '#EC7028', onYellow: '#EC7028' } },
  strawberry: { draw: (f, e) => <path d={STRAWBERRY_D} {...shapeProps(f, e)} />, color: { color: '#EC3C5A', reverse: '#EC3C5A', onYellow: '#EC3C5A' } },
  potato: { draw: (f, e) => <ellipse cx={512} cy={464} rx={196} ry={150} {...shapeProps(f, e)} />, color: { color: '#C49660', reverse: '#C49660', onYellow: '#C49660' } },
  zucchini: { draw: (f, e) => <rect x={304} y={374} width={416} height={192} rx={96} {...shapeProps(f, e)} />, color: { color: '#8CC43E', reverse: '#8CC43E', onYellow: '#8CC43E' } },
  eggplant: { draw: (f, e) => <rect x={408} y={252} width={208} height={338} rx={104} {...shapeProps(f, e)} />, color: { color: '#8C64BE', reverse: '#8C64BE', onYellow: '#8C64BE' } },
  melon: { draw: (f, e) => <path d="M298 432 A214 214 0 0 0 726 432 Z" {...shapeProps(f, e)} />, color: { color: '#F0505A', reverse: '#F0505A', onYellow: '#F0505A' } },
};

/** 받침: 반원(R 310)을 평평하게 자른 U, 모서리 둥글림(8). 둥근 재료 자리(r 190)가 이미 파여 있다. */
export const BOWL_CUT_PATH =
  'M202.1 484.1 L202.6 498.1 L205.9 522.9 L210.1 543.4 L215.6 563.1 L222.4 582.4 L230.1 600.6 L238.4 617.1 L249.6 636.4 L262.1 654.6 L275.6 671.6 L286.6 683.9 L306.9 703.4 L324.6 717.9 L339.4 727.9 L347.4 731.1 L358.4 732.6 L665.9 732.6 L675.9 731.4 L684.9 727.9 L696.6 720.1 L711.9 708.1 L726.1 695.4 L737.6 683.9 L748.6 671.6 L759.1 658.6 L768.4 645.9 L780.1 627.4 L788.1 612.9 L797.4 593.4 L803.1 579.1 L808.6 563.1 L812.9 548.4 L817.4 528.4 L820.1 511.4 L822.1 491.9 L822.1 484.1 L820.1 476.9 L815.4 472.1 L809.4 470.1 L805.1 469.6 L719.4 469.6 L713.6 470.4 L708.9 472.1 L705.6 474.6 L702.6 479.4 L700.9 486.1 L697.9 507.4 L693.6 524.4 L687.1 542.6 L680.1 557.6 L671.4 572.6 L662.4 585.4 L652.1 597.6 L639.6 610.1 L627.4 620.4 L611.9 631.1 L593.6 641.1 L577.6 647.9 L561.1 653.1 L540.9 657.4 L520.9 659.4 L503.4 659.4 L486.9 657.9 L469.1 654.6 L454.6 650.6 L436.1 643.6 L419.1 635.1 L405.1 626.4 L393.4 617.6 L380.6 606.4 L368.4 593.4 L358.9 581.4 L348.1 564.9 L341.4 552.1 L334.4 535.6 L328.9 518.1 L325.6 503.4 L322.6 482.4 L319.9 476.1 L315.4 472.1 L310.6 470.4 L304.9 469.6 L216.4 469.9 L211.1 471.1 L207.1 473.4 L203.9 477.4 Z';
/** 받침(재료 자리 없음) — 둥글지 않은 재료 모양은 마스크로 자리를 판다 */
const BOWL_FULL_PATH =
  'M202.1 484.1 L202.6 498.1 L205.9 522.9 L210.1 543.4 L215.6 563.1 L222.4 582.4 L230.1 600.6 L238.4 617.1 L249.6 636.4 L262.1 654.6 L275.6 671.6 L286.6 683.9 L306.9 703.4 L324.6 717.9 L339.4 727.9 L347.4 731.1 L358.4 732.6 L665.9 732.6 L675.9 731.4 L684.9 727.9 L696.6 720.1 L711.9 708.1 L726.1 695.4 L737.6 683.9 L748.6 671.6 L759.1 658.6 L768.4 645.9 L780.1 627.4 L788.1 612.9 L797.4 593.4 L803.1 579.1 L808.6 563.1 L812.9 548.4 L817.4 528.4 L820.1 511.4 L822.1 491.9 L821.9 482.4 L820.4 477.4 L818.9 475.1 L814.4 471.6 L810.6 470.4 L805.1 469.6 L219.1 469.6 L212.6 470.6 L207.1 473.4 L203.9 477.4 Z';
/** 큰 잎·작은 잎(둥근 렌즈) */
export const LEAF_BIG_PATH =
  'M682.6 95.9 L679.6 94.4 L676.6 93.9 L667.6 93.9 L652.1 95.6 L634.1 99.6 L613.9 106.9 L596.4 115.9 L583.6 124.4 L571.4 134.4 L556.1 150.1 L547.9 161.1 L538.1 177.1 L530.6 193.4 L524.1 214.1 L521.6 226.9 L520.4 237.1 L519.9 256.9 L521.9 276.1 L522.9 279.6 L525.4 283.4 L527.4 284.9 L531.9 286.1 L540.9 286.1 L551.9 285.1 L571.1 281.4 L590.9 274.9 L607.6 266.9 L623.1 257.1 L636.9 246.1 L651.6 231.1 L663.6 214.9 L673.1 198.1 L679.9 182.1 L685.4 163.1 L688.6 141.6 L688.9 119.9 L687.9 109.1 L686.4 101.4 L684.6 97.9 Z';
export const LEAF_SMALL_PATH =
  'M404.4 172.1 L402.4 174.1 L400.9 177.1 L399.4 185.4 L399.4 198.4 L401.4 212.6 L404.9 224.4 L407.6 231.1 L412.9 240.9 L420.1 251.1 L429.4 260.9 L435.4 265.9 L446.4 273.1 L457.9 278.6 L471.9 282.9 L485.6 284.9 L496.4 284.6 L499.4 283.9 L501.9 282.4 L505.1 277.6 L506.6 268.6 L506.6 256.4 L505.1 244.6 L502.6 234.6 L498.9 224.6 L493.4 214.1 L486.6 204.4 L478.9 195.9 L467.4 186.4 L459.4 181.4 L445.6 175.1 L433.1 171.6 L421.1 169.9 L410.6 169.9 L407.9 170.4 Z';

let uid = 0;

export const BrandMark: React.FC<BrandMarkProps> = ({
  ingredient = 'ball', size = 48, tone = 'color', motion = 'none', leaves = 2, rolledOut = false, onIteration, title, className, style,
}) => {
  const id = React.useMemo(() => `bm${++uid}`, []);
  const mono = tone === 'mono';
  const bowlFill = mono ? 'currentColor' : tone === 'reverse' ? 'var(--brand, #FFD600)' : 'var(--ink-900, #1A1A1E)';
  const leafFill = mono ? 'currentColor' : tone === 'reverse' ? 'var(--brand-leaf-on-dark, #3CBE6E)' : 'var(--brand-leaf, #1E9252)';
  const a11y = title ? { role: 'img' as const, 'aria-label': title } : { 'aria-hidden': true as const };
  const box = rolledOut ? BOX_ROLLED : BOX;
  const unit = size / BOX.w;
  const cls = ['brand-mark', motion !== 'none' ? `brand-mark--${motion}` : '', className].filter(Boolean).join(' ');

  const shape = ingredient === 'slot' ? null : SHAPES[ingredient];
  const ingFill = !shape ? 'none' : mono ? 'currentColor' : shape.color[tone];
  const useMask = !!shape && !shape.round;
  // 굴러 나간 재료: 받침에서 한 뼘 떨어진 오른쪽 바닥에 놓이고 살짝 기울어진다 — 「맞지 않음」
  const rolled = rolledOut ? 'translate(504 92) rotate(18 512 470)' : undefined;

  return (
    <svg
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      width={unit * box.w}
      height={unit * box.h}
      className={cls}
      style={style}
      onAnimationIteration={onIteration ? () => onIteration() : undefined}
      {...a11y}
    >
      {useMask && (
        <defs>
          <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="1100" height="1024">
            <rect width="1100" height="1024" fill="#fff" />
            {shape!.draw('#000', GAP)}
          </mask>
        </defs>
      )}
      <path
        className="brand-mark__bowl"
        d={useMask ? BOWL_FULL_PATH : BOWL_CUT_PATH}
        fill={bowlFill}
        mask={useMask ? `url(#${id})` : undefined}
      />
      {ingredient === 'slot' && (
        <circle
          className="brand-mark__slot"
          cx={512} cy={470} r={172}
          fill="none"
          stroke={mono ? 'currentColor' : 'var(--ink-300, #B8B8C0)'}
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray="2 36"
        />
      )}
      {shape && (
        <g transform={rolled}>
          <g className="brand-mark__ingredient">
            {shape.draw(ingFill, 0)}
            <g className="brand-mark__leaves">
              <path d={LEAF_BIG_PATH} fill={leafFill} />
              {leaves === 2 && ingredient !== 'melon' && <path d={LEAF_SMALL_PATH} fill={leafFill} />}
            </g>
          </g>
        </g>
      )}
    </svg>
  );
};

export default BrandMark;
