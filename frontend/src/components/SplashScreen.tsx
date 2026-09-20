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
  // 글꼴은 `memo-handwrite` 클래스(장보기 메모와 같은 손글씨체 Gamja Flower)가 정한다 —
  // 전역 규칙이 글꼴을 Pretendard 로 강제해서 인라인 fontFamily 로는 못 바꾼다.
  // 이 글꼴은 굵기가 400 하나뿐이라 fontWeight 를 주면 가짜 굵기가 돼 오히려 못생겨진다.
  numberDisplay: {
    color: '#1A1A1E',
    fontWeight: 400,
    // 이 글꼴은 글자가 작고 가늘어서 기본 글꼴보다 크게 + 획을 살짝 덧그려(text-stroke) 또렷하게 한다.
    fontSize: 'clamp(64px, 16vw, 96px)',
    WebkitTextStroke: '1.6px #1A1A1E',
    textAlign: 'center' as const,
    whiteSpace: 'nowrap' as const,
    lineHeight: '1.2',
  },
  // 숫자 한 칸의 폭을 고정한다. 굴러가는 동안 숫자가 바뀔 때마다 글자 폭이 달라
  // (1은 좁고 0은 넓다) 전체가 좌우로 흔들려 보이던 것을 막는다.
  digitCell: {
    display: 'inline-block',
    width: '0.56em',
    textAlign: 'center' as const,
  },
  commaCell: {
    display: 'inline-block',
    width: '0.28em',
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
        <div className="memo-handwrite" style={STYLES.numberDisplay}>
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
