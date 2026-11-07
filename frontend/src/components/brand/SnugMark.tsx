/**
 * SnugMark — 「딱 맞는다」 순간에 한 번 앉는 작은 마크(0.4초). 마이크로 인터랙션 전용.
 *
 * 쓰는 곳(COMPONENT_GUIDE 2순위): 레시피 카드·행의 「내 재료 N/M」 에서 N=M 이 되는 순간, 사진 인식 완료,
 * 식단 짜기 완성. **쓰지 말 곳**: AI 대기 화면, 쿡 픽/쿡 코치 아바타, 일반 버튼·카드.
 *
 * 과하게 움직이지 않게 세 가지로 막는다.
 *   1) 화면에 **처음 보일 때**(IntersectionObserver) 재생 — 목록을 스크롤해 가려졌다 다시 나타나도, 가상화 목록이
 *      칸을 다시 만들어도 같은 `playKey` 는 이 세션에서 다시 움직이지 않는다(그 뒤에는 앉은 모양으로 가만히 둔다).
 *   2) **동시에 둘까지만**(MAX_CONCURRENT) — 한 화면에서 마크 여러 개가 한꺼번에 들썩이지 않게. 넘치면 움직임 없이 앉은 모양.
 *   3) `prefers-reduced-motion` 에서는 CSS 가 0.12초 페이드만 한다(BrandMark 의 키프레임).
 */
import * as React from 'react';
import BrandMark, { BrandIngredient, BrandTone } from './BrandMark';

const MAX_CONCURRENT = 2;
const PLAY_MS = 700;
/** 이 세션에서 이미 앉아 본 것들 */
const played = new Set<string>();
let running = 0;

export interface SnugMarkProps {
  /** 같은 값이면 이 세션에서 한 번만 움직인다 (예: `match-<레시피 id>`) */
  playKey: string;
  size?: number;
  ingredient?: BrandIngredient;
  tone?: BrandTone;
  /** 접근성 이름(없으면 장식으로 숨김) */
  title?: string;
  style?: React.CSSProperties;
}

type Phase = 'idle' | 'play' | 'still';

const SnugMark: React.FC<SnugMarkProps> = ({ playKey, size = 16, ingredient = 'ball', tone = 'color', title, style }) => {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [phase, setPhase] = React.useState<Phase>(() => (played.has(playKey) ? 'still' : 'idle'));

  React.useEffect(() => {
    if (phase !== 'idle') return;
    const el = ref.current;
    const start = () => {
      if (played.has(playKey) || running >= MAX_CONCURRENT) {
        played.add(playKey);
        setPhase('still');
        return;
      }
      played.add(playKey);
      running += 1;
      setPhase('play');
      window.setTimeout(() => {
        running -= 1;
        setPhase('still');
      }, PLAY_MS);
    };
    if (!el || typeof IntersectionObserver === 'undefined') {
      start();
      return;
    }
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        io.disconnect();
        start();
      }
    }, { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, [phase, playKey]);

  return (
    <span
      ref={ref}
      style={{
        display: 'inline-flex', flex: 'none', verticalAlign: 'middle', lineHeight: 0,
        // 처음 보이기 전에는 숨겨 둔다 — 보이는 순간 위에서 내려와야 앉는 모습이 읽힌다
        opacity: phase === 'idle' ? 0 : 1,
        ...style,
      }}
    >
      <BrandMark
        ingredient={ingredient}
        tone={tone}
        size={size}
        motion={phase === 'play' ? 'seat' : 'none'}
        title={title}
      />
    </span>
  );
};

export default SnugMark;
