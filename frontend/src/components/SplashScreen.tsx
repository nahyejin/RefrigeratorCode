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

// 유튜브 앱처럼 단순하게(2026-10-18): 흰 바탕 가운데 로고 하나, 아래에 누적 레시피 수 한 줄.
// 그 전엔 큰 아이콘 + 큰 숫자 + 설명 두 줄이었고(「촌스럽다」), 노란 배경 시안은 「너무 노랗다」.
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
    top: '46%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex' as const,
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    gap: 14,
  },
  icon: {
    width: 'clamp(72px, 20vw, 92px)',
    height: 'clamp(72px, 20vw, 92px)',
    borderRadius: '24%',
    display: 'block' as const,
  },
  wordmark: {
    height: 'clamp(20px, 5vw, 24px)',
    width: 'auto',
    display: 'block' as const,
  },
  // 아래 한 줄 — 홈 인디케이터 위
  statLine: {
    position: 'absolute' as const,
    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 56px)',
    left: 0,
    right: 0,
    display: 'flex' as const,
    justifyContent: 'center' as const,
    alignItems: 'baseline' as const,
    gap: 6,
    color: '#8A8A93',
    fontSize: 13,
    fontWeight: 500,
    letterSpacing: '-0.01em',
  },
  // 글꼴은 `splash-number` 클래스(Manrope)가 정한다(main.tsx·index.css).
  number: {
    color: '#1A1A1E',
    fontWeight: 700,
    fontSize: 15,
    whiteSpace: 'nowrap' as const,
  },
  // 숫자 한 칸 폭 고정 — 굴러가는 동안 좌우로 흔들리지 않게
  digitCell: { display: 'inline-block', width: '0.62em', textAlign: 'center' as const },
  commaCell: { display: 'inline-block', width: '0.3em', textAlign: 'center' as const },
};

const Utils = {
  formatNumberWithComma: (digits: string[]): string => {
    const numberStr = digits.join('');
    const num = parseInt(numberStr, 10);
    if (isNaN(num)) return numberStr;
    if (num === 0 && digits.length === 4) return '0,000';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },
  generateRandomDigits: (length: number): string[] =>
    Array.from({ length }, () => Math.floor(Math.random() * 10).toString()),
};

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
        setDisplayDigits(Utils.generateRandomDigits(CONSTANTS.DIGIT_LENGTH));
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setStage('final');
        setDisplayDigits(recipeCount.toString().split(''));
      }
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [recipeCount]);

  const formatted = stage === 'final'
    ? recipeCount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    : Utils.formatNumberWithComma(displayDigits);

  return (
    <div style={STYLES.container}>
      <div style={STYLES.brandGroup}>
        <img src={cookmatchIcon} alt="" style={STYLES.icon} draggable={false} />
        <img src={cookmatchWordmark} alt="CookMatch" style={STYLES.wordmark} draggable={false} />
      </div>
      {recipeCount > 0 && (
        <div style={STYLES.statLine}>
          <span>검증된 레시피</span>
          <span className="splash-number" style={STYLES.number}>
            {formatted.split('').map((ch, i) => (
              <span key={i} style={ch === ',' ? STYLES.commaCell : STYLES.digitCell}>{ch}</span>
            ))}
          </span>
          <span>개</span>
        </div>
      )}
    </div>
  );
};

export default SplashScreen;
