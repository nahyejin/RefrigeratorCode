import React, { useEffect, useRef, useState } from 'react';
import splashImg from '../assets/open_loading_page.png';

interface SplashScreenProps {
  recipeCount: number;
}

// 상수 정의
const CONSTANTS = {
  ROULETTE_DURATION: 400, // 룰렛 애니메이션 지속 시간 (ms)
  DIGIT_LENGTH: 4, // 표시할 숫자 자릿수
  FONT_SIZE: 48,
  LETTER_SPACING: '2px',
  TEXT_SHADOW: '0 2px 8px #fff9e5, 0 0px 2px #fff9e5'
} as const;

// 스타일 상수
const STYLES = {
  container: {
    width: '100vw',
    height: '100vh',
    position: 'relative' as const,
    background: '#f4f0e6',
    overflow: 'hidden'
  },
  backgroundImage: {
    position: 'absolute' as const,
    left: 0,
    top: 0,
    width: '100vw',
    height: '100vh',
    objectFit: 'contain' as const,
    zIndex: 1,
    pointerEvents: 'none' as const,
    userSelect: 'none' as const
  },
  numberDisplay: {
    position: 'absolute' as const,
    left: '50%',
    top: '75%',
    transform: 'translate(-50%, 0)',
    color: '#FFA800',
    fontWeight: 700,
    fontSize: CONSTANTS.FONT_SIZE,
    textAlign: 'center' as const,
    fontFamily: 'inherit',
    letterSpacing: CONSTANTS.LETTER_SPACING,
    textShadow: CONSTANTS.TEXT_SHADOW,
    width: '100%',
    zIndex: 2,
    pointerEvents: 'none' as const
  }
};

// 유틸리티 함수들
const Utils = {
  // 숫자를 지정된 자릿수로 패딩
  padNumber: (num: number, length: number): string => {
    return num.toString().padStart(length, '0');
  },

  // 4자리 숫자에 쉼표 추가
  formatNumberWithComma: (digits: string[]): string => {
    if (digits.length !== CONSTANTS.DIGIT_LENGTH) {
      return digits.join('');
    }
    return `${digits[0]},${digits[1]}${digits[2]}${digits[3]}`;
  },

  // 랜덤 숫자 배열 생성
  generateRandomDigits: (length: number): string[] => {
    return Array.from({ length }, () => Math.floor(Math.random() * 10).toString());
  }
};

const SplashScreen: React.FC<SplashScreenProps> = ({ recipeCount }) => {
  // 단계: roulette(룰렛) → final(실제값)
  const [stage, setStage] = useState<'roulette' | 'final'>('roulette');
  const [displayDigits, setDisplayDigits] = useState<string[]>(['0', '0', '0', '0']);
  const animationRef = useRef<number>();
  const rouletteStartTime = useRef<number>(0);

  useEffect(() => {
    // recipeCount가 0이면 아직 데이터가 로드되지 않은 상태이므로 룰렛을 시작하지 않음
    if (recipeCount === 0) {
      setDisplayDigits(['0', '0', '0', '0']);
      return;
    }

    // 처음부터 바로 룰렛 애니메이션 시작
    setStage('roulette');
    rouletteStartTime.current = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - rouletteStartTime.current;
      
      if (elapsed < CONSTANTS.ROULETTE_DURATION) {
        const randomDigits = Utils.generateRandomDigits(CONSTANTS.DIGIT_LENGTH);
        setDisplayDigits(randomDigits);
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // 룰렛 종료 시 바로 실제값으로 설정하고 더 이상 변경하지 않음
        setStage('final');
        setDisplayDigits(Utils.padNumber(recipeCount, CONSTANTS.DIGIT_LENGTH).split(''));
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [recipeCount]);

  // 쉼표 추가된 포맷팅
  const formatted = Utils.formatNumberWithComma(displayDigits);

  return (
    <div style={STYLES.container}>
      {/* 배경 이미지 */}
      <img
        src={splashImg}
        alt="CookMatch Splash"
        style={STYLES.backgroundImage}
        draggable={false}
      />
      {/* 숫자만 이미지 위에 겹쳐서 표시 (이미지 내에서 원하는 위치로 조정) */}
      <div style={STYLES.numberDisplay}>
        {formatted}
      </div>
    </div>
  );
};

export default SplashScreen; 