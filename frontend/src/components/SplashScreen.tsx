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
    top: '74%',
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

  // 숫자에 쉼표 추가 (1000단위)
  formatNumberWithComma: (digits: string[]): string => {
    const numberStr = digits.join('');
    const num = parseInt(numberStr, 10);
    if (isNaN(num)) return numberStr;
    // 0인 경우에도 0,000으로 표시
    if (num === 0 && digits.length === 4) return '0,000';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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
    console.log('SplashScreen useEffect triggered, recipeCount:', recipeCount);
    
    // recipeCount가 0이면 아직 데이터가 로드되지 않은 상태이므로 룰렛을 시작하지 않음
    if (recipeCount === 0) {
      setDisplayDigits(['0', '0', '0', '0']);
      setStage('roulette');
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
        console.log('Setting final stage with recipeCount:', recipeCount);
        // 실제 숫자를 그대로 표시 (패딩하지 않음)
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

  // 쉼표 추가된 포맷팅
  const formatted = stage === 'final' 
    ? recipeCount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') 
    : Utils.formatNumberWithComma(displayDigits);
  
  // 디버깅용 로그
  console.log('Stage:', stage);
  console.log('Recipe Count:', recipeCount);
  console.log('Display Digits:', displayDigits);
  console.log('Formatted:', formatted);
  console.log('Stage === final:', stage === 'final');
  console.log('Using regex formatting:', stage === 'final' ? 'YES' : 'NO');

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