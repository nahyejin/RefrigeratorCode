/**
 * BrandMark — 쿡매치 마크(재료가 받침에 「딱」 앉는다) 초안.
 *
 * ⚠ 문서용 초안이다. 앱(frontend/src)에 연결하지 않았고 번들에 들어가지 않는다.
 *   (store/logo_proposals/e9_final/finalists/component_draft/ — frontend tsconfig 의 include 밖)
 *
 * 구성: 받침(bowl) + 재료(ingredient) + 잎(leaves). 받침은 항상 같고 재료 모양/색만 바뀐다(패밀리).
 * 받침과 재료 사이 틈(18)은 마스크로 만든다 — 재료를 18 만큼 부풀려(stroke) 받침에서 뺀다.
 * 그래서 어떤 재료 모양이든 같은 폭의 틈이 생긴다(「딱 맞는다」).
 *
 * 색은 CSS 변수에 기댄다(없으면 폴백):
 *   --brand #FFD600  --ink-900 #1A1A1E  --surface #FFFFFF
 *   --brand-bowl(제안, 없으면 #E8AC00)  --brand-leaf(제안, 없으면 #1E9252)
 */
import * as React from 'react';

export type BrandIngredient =
  | 'ball' | 'tomato' | 'mandarin' | 'egg' | 'tofu' | 'persimmon' | 'strawberry' | 'potato' | 'zucchini' | 'eggplant' | 'melon';
/** color = 밝은 배경 위(받침 검정·재료 노랑·잎 초록), reverse = 어두운 배경 위(받침 앰버·재료 흰색·잎 노랑), mono = 한 색 실루엣(currentColor) */
export type BrandTone = 'color' | 'reverse' | 'mono';

export interface BrandMarkProps {
  ingredient?: BrandIngredient;
  /** 한 변 px (정사각). 최소 16, 알림은 24 단색 */
  size?: number;
  tone?: BrandTone;
  /** true 이면 마운트 시 재료가 위에서 내려와 받침에 앉는다(0.4초). prefers-reduced-motion 에서는 움직이지 않는다. */
  seated?: boolean;
  /** 잎 한 장(작은 크기·알림) 또는 두 장(기본) */
  leaves?: 1 | 2;
  /** 접근성 이름. 장식이면 생략(aria-hidden) */
  title?: string;
  className?: string;
  style?: React.CSSProperties;
}

const GAP = 18;

interface Shape {
  /** 재료 도형을 그리는 함수 — extra>0 이면 받침에서 파낼 자리(스트로크로 부풀림)로 쓴다 */
  draw: (fill: string, extra: number) => React.ReactNode;
  color: { color: string; reverse: string };
}

const shapeProps = (fill: string, extra: number) =>
  extra > 0
    ? { fill, stroke: fill, strokeWidth: extra * 2, strokeLinejoin: 'round' as const }
    : { fill };

const EGG_D =
  'M666,476 L659,442 L648,409 L634,378 L617,351 L598,326 L577,307 L556,293 L534,284 L512,281 L490,284 L468,293 L447,307 L426,326 L407,351 L390,378 L376,409 L365,442 L358,476 L356,510 L359,543 L368,574 L381,601 L400,626 L424,645 L451,659 L481,668 L512,671 L543,668 L573,659 L600,645 L624,626 L643,601 L656,574 L665,543 L668,510 Z';
const STRAWBERRY_D =
  'M666,460 L668,426 L665,393 L656,362 L643,335 L624,310 L600,291 L573,277 L543,268 L512,265 L481,268 L451,277 L424,291 L400,310 L381,335 L368,362 L359,393 L356,426 L358,460 L365,494 L376,527 L390,558 L407,585 L426,610 L447,629 L468,643 L490,652 L512,655 L534,652 L556,643 L577,629 L598,610 L617,585 L634,558 L648,527 L659,494 Z';

const SHAPES: Record<BrandIngredient, Shape> = {
  ball: { draw: (f, e) => <circle cx={512} cy={470} r={172} {...shapeProps(f, e)} />, color: { color: 'var(--brand, #FFD600)', reverse: 'var(--surface, #FFFFFF)' } },
  tomato: { draw: (f, e) => <circle cx={512} cy={470} r={172} {...shapeProps(f, e)} />, color: { color: '#EE403A', reverse: '#EE403A' } },
  mandarin: { draw: (f, e) => <circle cx={512} cy={470} r={172} {...shapeProps(f, e)} />, color: { color: '#FF961E', reverse: '#FF961E' } },
  egg: { draw: (f, e) => <path d={EGG_D} {...shapeProps(f, e)} />, color: { color: '#FAECCE', reverse: '#FAECCE' } },
  tofu: { draw: (f, e) => <rect x={360} y={332} width={304} height={304} rx={76} {...shapeProps(f, e)} />, color: { color: '#FFFFFF', reverse: '#FFFFFF' } },
  persimmon: { draw: (f, e) => <ellipse cx={512} cy={466} rx={190} ry={160} {...shapeProps(f, e)} />, color: { color: '#EC7028', reverse: '#EC7028' } },
  strawberry: { draw: (f, e) => <path d={STRAWBERRY_D} {...shapeProps(f, e)} />, color: { color: '#EC3C5A', reverse: '#EC3C5A' } },
  potato: { draw: (f, e) => <ellipse cx={512} cy={464} rx={196} ry={150} {...shapeProps(f, e)} />, color: { color: '#C49660', reverse: '#C49660' } },
  zucchini: { draw: (f, e) => <rect x={304} y={374} width={416} height={192} rx={96} {...shapeProps(f, e)} />, color: { color: '#8CC43E', reverse: '#8CC43E' } },
  eggplant: { draw: (f, e) => <rect x={408} y={252} width={208} height={338} rx={104} {...shapeProps(f, e)} />, color: { color: '#8C64BE', reverse: '#8C64BE' } },
  melon: { draw: (f, e) => <path d="M298 432 A214 214 0 0 0 726 432 Z" {...shapeProps(f, e)} />, color: { color: '#F0505A', reverse: '#F0505A' } },
};

/** 받침: 반원(R 310)을 평평하게 자른 U — 위쪽 가운데는 재료 자리로 마스크로 파인다 */
const BOWL_PATH = 'M202 470 H822 A310 310 0 0 1 677.7 732 H346.3 A310 310 0 0 1 202 470 Z';
/** 잎(렌즈): 큰 잎(50°)·작은 잎(132°) — 두 원호 */
const LEAF_BIG = 'M524 286 A157 157 0 0 1 684.7 94.5 A157 157 0 0 1 524 286 Z';
const LEAF_SMALL = 'M504 284 A92 92 0 0 1 402.3 171 A92 92 0 0 1 504 284 Z';

let uid = 0;

export const BrandMark: React.FC<BrandMarkProps> = ({
  ingredient = 'ball', size = 48, tone = 'color', seated = false, leaves = 2, title, className, style,
}) => {
  const id = React.useMemo(() => `bm${++uid}`, []);
  const shape = SHAPES[ingredient];
  const mono = tone === 'mono';
  const bowlFill = mono ? 'currentColor' : tone === 'reverse' ? 'var(--brand-bowl, #E8AC00)' : 'var(--ink-900, #1A1A1E)';
  const leafFill = mono ? 'currentColor' : tone === 'reverse' ? 'var(--brand, #FFD600)' : 'var(--brand-leaf, #1E9252)';
  const ingFill = mono ? 'currentColor' : tone === 'reverse' ? shape.color.reverse : shape.color.color;
  const a11y = title ? { role: 'img' as const, 'aria-label': title } : { 'aria-hidden': true as const };
  return (
    <svg
      viewBox="0 0 1024 1024"
      width={size}
      height={size}
      className={['brand-mark', seated ? 'brand-mark--seat' : '', className].filter(Boolean).join(' ')}
      style={style}
      {...a11y}
    >
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
          <rect width="1024" height="1024" fill="#fff" />
          {shape.draw('#000', GAP)}
        </mask>
      </defs>
      <path d={BOWL_PATH} fill={bowlFill} mask={`url(#${id})`} />
      <g className="brand-mark__ingredient">{shape.draw(ingFill, 0)}</g>
      <g className="brand-mark__leaves">
        <path d={LEAF_BIG} fill={leafFill} />
        {leaves === 2 && ingredient !== 'melon' && <path d={LEAF_SMALL} fill={leafFill} />}
      </g>
    </svg>
  );
};

/**
 * CSS 키프레임 초안 — 앱에 넣을 때는 index.css 로 옮긴다(지금은 문서용 문자열).
 * 「딱」 모션 0.4초: 위에서 내려와(0~60%) 앉고 → 한 번 눌렸다(78%) → 올라온다.
 * prefers-reduced-motion 에서는 움직이지 않고 0.12초 페이드만.
 */
export const BRAND_MARK_CSS = `
.brand-mark--seat .brand-mark__ingredient,
.brand-mark--seat .brand-mark__leaves { transform-box: fill-box; transform-origin: 50% 100%; animation: brand-seat .4s cubic-bezier(.2,.9,.3,1) both; }
@keyframes brand-seat {
  0% { transform: translateY(-9%); opacity: 0; }
  60% { transform: translateY(0); opacity: 1; }
  78% { transform: translateY(0) scale(1.04, .94); }
  100% { transform: translateY(0) scale(1, 1); }
}
@media (prefers-reduced-motion: reduce) {
  .brand-mark--seat .brand-mark__ingredient,
  .brand-mark--seat .brand-mark__leaves { animation: brand-fade .12s linear both; }
  @keyframes brand-fade { from { opacity: 0 } to { opacity: 1 } }
}
`;

export default BrandMark;
