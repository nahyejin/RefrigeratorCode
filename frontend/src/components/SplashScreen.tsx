import React, { useEffect, useRef, useState } from 'react';
import BrandMark from './brand/BrandMark';
import BrandWordmark from './brand/BrandWordmark';

interface SplashScreenProps {
  recipeCount: number;
}

// 상수 정의
const CONSTANTS = {
  COUNT_UP_DURATION: 1700,
  DIGIT_LENGTH: 4,
} as const;

// 노랑 #FFD600 바탕에 마크(재료가 받침에 딱 앉는다) — 앱 아이콘·네이티브 스플래시와 같은 얼굴.
// 글자색은 검정 계열(노랑 위 회색은 안 읽힌다).
const INK = '#1A1A1E';
const STYLES = {
  container: {
    width: '100vw',
    height: '100vh',
    position: 'relative' as const,
    background: '#FFD600',
    overflow: 'hidden',
  },
  brandGroup: {
    position: 'absolute' as const,
    top: '40%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex' as const,
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    width: '90%',
  },
  // 마크 크기 — 짧은 화면에서는 아래 숫자 영역과 겹치지 않게 높이로도 제한한다
  mark: {
    width: 'min(46vw, 26vh, 210px)',
    minWidth: 128,
    display: 'block' as const,
  },
  wordmarkBox: {
    marginTop: 14,
    animation: 'brand-wordmark-in .35s ease-out 1.25s both',
  },
  statGroup: {
    position: 'absolute' as const,
    top: '73%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex' as const,
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    width: '90%',
  },
  label: {
    color: 'rgba(26, 26, 30, 0.68)',
    fontSize: 'clamp(14px, 3.2vw, 17px)',
    fontWeight: 600,
    letterSpacing: '0.02em',
    marginBottom: 8,
  },
  // 글꼴은 `splash-number` 클래스(Manrope)가 정한다 — 전역 규칙이 글꼴을 Pretendard 로
  // 강제해서 인라인 fontFamily 로는 못 바꾼다. 번들한 굵기는 700 하나다(main.tsx).
  numberDisplay: {
    color: INK,
    fontWeight: 700,
    fontSize: 'clamp(38px, 10.5vw, 54px)',
    letterSpacing: '-0.01em',
    textAlign: 'center' as const,
    whiteSpace: 'nowrap' as const,
    lineHeight: '1.2',
  },
  // 숫자 한 칸의 폭을 고정한다. 굴러가는 동안 숫자가 바뀔 때마다 글자 폭이 달라
  // (1은 좁고 0은 넓다) 전체가 좌우로 흔들려 보이던 것을 막는다.
  digitCell: {
    display: 'inline-block',
    width: '0.6em',
    textAlign: 'center' as const,
  },
  commaCell: {
    display: 'inline-block',
    width: '0.3em',
    textAlign: 'center' as const,
  },
  descriptionText: {
    color: 'rgba(26, 26, 30, 0.62)',
    fontSize: 'clamp(14px, 3vw, 17px)',
    fontWeight: 400,
    textAlign: 'center' as const,
    lineHeight: '1.6',
    marginTop: 10,
  },
};

// 유틸리티 함수들
const Utils = {
  formatNumberWithComma: (digits: string[]): string => {
    const numberStr = digits.join('');
    const num = parseInt(numberStr, 10);
    if (isNaN(num)) return numberStr;
    if (num === 0 && digits.length === 4) return '0,000';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },
  generateRandomDigits: (length: number): string[] => {
    return Array.from({ length }, () => Math.floor(Math.random() * 10).toString());
  },
};

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// iOS 는 네이티브 정지 스플래시(완성된 마크)가 먼저 보이다가 이 화면으로 넘어온다 — 같은 모양에서 시작해
// 한 번 떴다 앉는다(hop). 웹·안드로이드는 받침부터 차례로 쌓는다(intro).
// iOS 도 intro(받침 → 재료 낙하 → 앉음 → 잎)로 통일 — hop 은 완성된 마크에서 살짝 뜨기만 해 정지 화면처럼 보였다(2026-11-08 폰 녹화)
const markMotion = (): 'hop' | 'intro' => 'intro';

const SplashScreen: React.FC<SplashScreenProps> = ({ recipeCount }) => {
  const [stage, setStage] = useState<'roulette' | 'final'>('roulette');
  const [displayDigits, setDisplayDigits] = useState<string[]>(['0']);
  const animationRef = useRef<number | undefined>(undefined);
  const rouletteStartTime = useRef<number>(0);
  // 마운트 때 한 번만 정한다 — 숫자가 도착해 다시 그려져도 앉는 모션이 한 번 더 돌지 않게
  const motionRef = useRef<'hop' | 'intro'>(markMotion());
  // 앱 화면(WebView)이 실제로 보이기 시작한 뒤에 모션을 시작한다 — 마운트 직후부터 돌면 네이티브 스플래시가 덮고 있는 동안 끝나 버린다
  const [markReady, setMarkReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMarkReady(true), 300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (recipeCount === 0) {
      setDisplayDigits(['0']);
      setStage('roulette');
      return;
    }

    // 움직임 줄이기: 숫자를 굴리지 않고 바로 최종 숫자를 보인다
    if (prefersReducedMotion()) {
      setStage('final');
      setDisplayDigits(recipeCount.toString().split(''));
      return;
    }

    // 0 에서 최종 숫자까지 **천천히 올라간다**(처음에 빠르고 끝에 느려지는 ease-out, 1.7초) — 2026-11-08 「숫자가 천천히 올라가던 효과가 없어졌다」
    setStage('roulette');
    rouletteStartTime.current = Date.now();

    const animate = () => {
      const elapsed = Date.now() - rouletteStartTime.current;
      const t = Math.min(1, elapsed / CONSTANTS.COUNT_UP_DURATION);
      if (t < 1) {
        const eased = 1 - Math.pow(1 - t, 3);
        setDisplayDigits(String(Math.floor(recipeCount * eased)).split(''));
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setStage('final');
        setDisplayDigits(recipeCount.toString().split(''));
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [recipeCount]);

  const formatted = stage === 'final'
    ? recipeCount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    : Utils.formatNumberWithComma(displayDigits);

  return (
    <div style={STYLES.container}>
      <div style={STYLES.brandGroup}>
        {markReady
          ? <BrandMark ingredient="ball" tone="onYellow" size={210} motion={motionRef.current} title="쿡매치" style={{ ...STYLES.mark, height: 'auto' }} />
          : <div aria-hidden style={{ ...STYLES.mark, aspectRatio: '1 / 1' }} />}
        <div className="brand-wordmark-in" style={STYLES.wordmarkBox}>
          <BrandWordmark size={26} color={INK} subColor="rgba(26, 26, 30, 0.62)" />
        </div>
      </div>
      <div style={STYLES.statGroup}>
        <div style={STYLES.label}>누적 레시피 수</div>
        <div className="splash-number" style={STYLES.numberDisplay}>
          {formatted.split('').map((ch, i) => (
            <span key={i} style={ch === ',' ? STYLES.commaCell : STYLES.digitCell}>{ch}</span>
          ))}
        </div>
        <div style={STYLES.descriptionText}>
          리뷰수·조회수·구독자수 등을 고려하여<br />
          검증된 레시피를 매일 수집하고 있어요
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
