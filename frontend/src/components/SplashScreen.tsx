import React, { useEffect, useRef, useState } from 'react';
import splashImg from '../assets/open_loading_page.png';

interface SplashScreenProps {
  recipeCount: number;
}

// 상수 정의
const CONSTANTS = {
  ROULETTE_DURATION: 400,
  DIGIT_LENGTH: 4,
  // 반응형 글자 크기: 화면 너비의 8% (최소 32px, 최대 64px)
  FONT_SIZE_MIN: 32,
  FONT_SIZE_MAX: 64,
  FONT_SIZE_VW: 8, // 화면 너비의 8%
  // 반응형 위치: 화면 높이의 74%에서 고정
  TOP_POSITION_VH: 74,
  LETTER_SPACING_VW: 0.2, // 화면 너비의 0.2%
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
  // 중앙 컨테이너 (모든 요소를 세로로 배치, 아래쪽으로 위치)
  contentContainer: {
    position: 'absolute' as const,
    left: '50%',
    top: '80%', // 훨씬 더 아래로 이동
    transform: 'translate(-50%, -50%)',
    display: 'flex' as const,
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    gap: 'clamp(6px, 1vh, 10px)', // 줄간격을 더 좁게 조정
    zIndex: 2,
    width: '90%',
    maxWidth: '600px'
  },
  // "누적 레시피 수" 노란색 pill 스타일
  labelPill: {
    display: 'inline-block' as const,
    backgroundColor: '#FFD600',
    color: '#222222',
    fontSize: 'clamp(16px, 3vw, 22px)', // 글자 크기 증가
    fontWeight: 600,
    padding: 'clamp(6px, 1vh, 10px) clamp(16px, 4vw, 24px)',
    borderRadius: '50px',
    textAlign: 'center' as const,
    whiteSpace: 'nowrap' as const,
    boxShadow: '0 2px 8px rgba(255, 214, 0, 0.3)'
  },
  // 숫자 표시 스타일 (검은색)
  numberDisplay: {
    color: '#222222',
    fontWeight: 700,
    fontSize: `clamp(${CONSTANTS.FONT_SIZE_MIN}px, ${CONSTANTS.FONT_SIZE_VW}vw, ${CONSTANTS.FONT_SIZE_MAX}px)`,
    textAlign: 'center' as const,
    fontFamily: 'inherit',
    letterSpacing: `${CONSTANTS.LETTER_SPACING_VW}vw`,
    whiteSpace: 'nowrap' as const,
    lineHeight: '1.2'
  },
  // 하단 설명 텍스트 스타일 (회색)
  descriptionText: {
    color: '#666666',
    fontSize: 'clamp(11px, 1.8vw, 14px)',
    fontWeight: 400,
    textAlign: 'center' as const,
    lineHeight: '1.6',
    width: '100%'
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
    if (num === 0 && digits.length === 4) return '0,000';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },

  // 랜덤 숫자 배열 생성
  generateRandomDigits: (length: number): string[] => {
    return Array.from({ length }, () => Math.floor(Math.random() * 10).toString());
  }
};

const SplashScreen: React.FC<SplashScreenProps> = ({ recipeCount }) => {
  const [stage, setStage] = useState<'roulette' | 'final'>('roulette');
  const [displayDigits, setDisplayDigits] = useState<string[]>(['0', '0', '0', '0']);
  const animationRef = useRef<number | undefined>(undefined);
  const rouletteStartTime = useRef<number>(0);

  useEffect(() => {
    if (recipeCount === 0) {
      setDisplayDigits(['0', '0', '0', '0']);
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

  // 쉼표 추가된 포맷팅
  const formatted = stage === 'final' 
    ? recipeCount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') 
    : Utils.formatNumberWithComma(displayDigits);

  return (
    <div style={STYLES.container}>
      <img
        src={splashImg}
        alt="CookMatch Splash"
        style={STYLES.backgroundImage}
        draggable={false}
      />
      {/* 중앙 컨테이너: 세로로 배치 */}
      <div style={STYLES.contentContainer}>
        {/* 노란색 pill: "누적 레시피 수" */}
        <div style={STYLES.labelPill}>
          누적 레시피 수
        </div>
        {/* 검은색 숫자 */}
        <div style={STYLES.numberDisplay}>
          {formatted}
        </div>
        {/* 회색 안내문구 */}
        <div style={STYLES.descriptionText}>
          리뷰수·조회수·구독자수 등을 고려하여<br />
          검증된 레시피를 매일 수집하고 있어요
        </div>
      </div>
    </div>
  );
};

export default SplashScreen; 