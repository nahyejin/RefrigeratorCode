import React, { useEffect, useRef, useState } from 'react';
import cookmatchIcon from '../assets/cookmatch_icon.png';
import cookmatchWordmark from '../assets/냉털이 로고 white.png';

interface SplashScreenProps {
  recipeCount: number;
}

// 상수 정의
const CONSTANTS = {
  ROULETTE_DURATION: 400,
  DIGIT_LENGTH: 4,
} as const;

// 스타일 상수 (앱 본편과 동일한 화이트/블랙/옐로우 톤)
const STYLES = {
  container: {
    width: '100vw',
    height: '100vh',
    position: 'relative' as const,
    background: '#ffffff',
    overflow: 'hidden',
  },
  brandGroup: {
    position: 'absolute' as const,
    top: '42%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex' as const,
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    width: '90%',
  },
  // 아이콘 = 진짜 앱 아이콘 + 그릇 위 김 애니메이션(SplashLogo, 2026-10-18)
  icon: {
    width: 'clamp(124px, 36vw, 168px)',
    height: 'clamp(124px, 36vw, 168px)',
    display: 'block' as const,
    marginBottom: 26,
    position: 'relative' as const,
  },
  wordmark: {
    height: 'clamp(28px, 7vw, 38px)',
    width: 'auto',
    display: 'block' as const,
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
    color: '#9A9AA2',
    fontSize: 'clamp(14px, 3.2vw, 17px)',
    fontWeight: 600,
    letterSpacing: '0.02em',
    marginBottom: 8,
  },
  // 글꼴은 `splash-number` 클래스(Manrope)가 정한다 — 전역 규칙이 글꼴을 Pretendard 로
  // 강제해서 인라인 fontFamily 로는 못 바꾼다. 번들한 굵기는 700 하나다(main.tsx).
  numberDisplay: {
    color: '#1A1A1E',
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
    color: '#B8B8C0',
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

/**
 * 진짜 앱 아이콘은 그대로 두고, 집 안 그릇 위로 김이 모락모락 올라오는 애니메이션만 얹는다
 * (2026-10-18, 사용자: 로고가 다른 그림으로 바뀌면 로고 자체가 바뀐 것 같다).
 * 김 SVG 는 아이콘과 같은 0~100 좌표계로 위에 겹친다. 애니메이션이 안 돌면 김만 안 보이고 로고는 그대로.
 */
const SplashLogo: React.FC<{ style: React.CSSProperties }> = ({ style }) => (
  <div className="sl-wrap" style={style}>
    <img src={cookmatchIcon} alt="CookMatch" style={{ width: '100%', height: '100%', display: 'block' }} draggable={false} />
    <svg viewBox="0 0 100 100" className="sl-steam" aria-hidden="true">
      <path className="sl-wisp sl-w1" d="M41 51 C38 47 44 44 41 40 C38 36 43 34 41 31" />
      <path className="sl-wisp sl-w2" d="M50.5 51 C47.5 46 53.5 42 50.5 37 C47.5 32 53 29 50.5 25" />
      <path className="sl-wisp sl-w3" d="M60 51 C57 47 63 44 60 40 C57 36 62 34 60 31" />
    </svg>
  </div>
);

const SplashScreen: React.FC<SplashScreenProps> = ({ recipeCount }) => {
  const [stage, setStage] = useState<'roulette' | 'final'>('roulette');
  const [displayDigits, setDisplayDigits] = useState<string[]>(['0']);
  const animationRef = useRef<number | undefined>(undefined);
  const rouletteStartTime = useRef<number>(0);

  useEffect(() => {
    if (recipeCount === 0) {
      setDisplayDigits(['0']);
      setStage('roulette');
      return;
    }

    setStage('roulette');
    rouletteStartTime.current = Date.now();

    const animate = () => {
      const elapsed = Date.now() - rouletteStartTime.current;

      if (elapsed < CONSTANTS.ROULETTE_DURATION) {
        const randomDigits = Utils.generateRandomDigits(CONSTANTS.DIGIT_LENGTH);
        setDisplayDigits(randomDigits);
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
        <SplashLogo style={STYLES.icon} />
        <img src={cookmatchWordmark} alt="CookMatch" style={STYLES.wordmark} draggable={false} />
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
