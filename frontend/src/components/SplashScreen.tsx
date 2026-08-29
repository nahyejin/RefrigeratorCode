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
  iconWrap: {
    width: 'clamp(140px, 42vw, 200px)',
    height: 'clamp(140px, 42vw, 200px)',
    borderRadius: '26%',
    overflow: 'hidden' as const,
    boxShadow: '0 12px 32px rgba(0,0,0,0.14)',
    marginBottom: 28,
  },
  icon: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    display: 'block' as const,
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
  numberDisplay: {
    color: '#1A1A1E',
    fontWeight: 800,
    fontSize: 'clamp(40px, 10.5vw, 64px)',
    textAlign: 'center' as const,
    fontFamily: 'inherit',
    letterSpacing: '-0.01em',
    whiteSpace: 'nowrap' as const,
    lineHeight: '1.2',
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
        <div style={STYLES.iconWrap}>
          <img src={cookmatchIcon} alt="CookMatch" style={STYLES.icon} draggable={false} />
        </div>
        <img src={cookmatchWordmark} alt="CookMatch" style={STYLES.wordmark} draggable={false} />
      </div>
      <div style={STYLES.statGroup}>
        <div style={STYLES.label}>누적 레시피 수</div>
        <div style={STYLES.numberDisplay}>{formatted}</div>
        <div style={STYLES.descriptionText}>
          리뷰수·조회수·구독자수 등을 고려하여<br />
          검증된 레시피를 매일 수집하고 있어요
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
