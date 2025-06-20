import React, { useEffect, useRef, useState } from 'react';
import splashImg from '../assets/open_loading_page.png';

interface SplashScreenProps {
  recipeCount: number;
}

function padNumber(num: number, length: number) {
  return num.toString().padStart(length, '0');
}

const SplashScreen: React.FC<SplashScreenProps> = ({ recipeCount }) => {
  // 단계: roulette(룰렛) → final(실제값)
  const [stage, setStage] = useState<'roulette' | 'final'>('roulette');
  const [displayDigits, setDisplayDigits] = useState<string[]>(['0', '0', '0', '0']);
  const animationRef = useRef<number>();
  const timeoutRefs = useRef<number[]>([]);
  const rouletteStartTime = useRef<number>(0);

  useEffect(() => {
    // 처음부터 바로 룰렛 애니메이션 시작
    setStage('roulette');
    rouletteStartTime.current = Date.now();
    startRouletteAnimation();
    
    // 0.8초간 룰렛 애니메이션 후 실제값 표시
    timeoutRefs.current.push(
      window.setTimeout(() => {
        setStage('final');
        setDisplayDigits(padNumber(recipeCount, 4).split(''));
      }, 800)
    );

    return () => {
      timeoutRefs.current.forEach(clearTimeout);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [recipeCount]);

  const startRouletteAnimation = () => {
    const animate = () => {
      const elapsed = Date.now() - rouletteStartTime.current;
      
      if (elapsed < 800 && stage === 'roulette') { // 0.8초 동안 룰렛
        const randomDigits = Array.from({ length: 4 }, () => Math.floor(Math.random() * 10).toString());
        setDisplayDigits(randomDigits);
        animationRef.current = requestAnimationFrame(animate);
      } else if (stage === 'roulette') {
        // 룰렛 종료 시 실제값으로 설정
        setStage('final');
        setDisplayDigits(padNumber(recipeCount, 4).split(''));
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
  };

  // 쉼표 추가 (4자리 기준)
  const formatted = `${displayDigits[0]},${displayDigits[1]}${displayDigits[2]}${displayDigits[3]}`;

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        position: 'relative',
        background: '#f4f0e6',
        overflow: 'hidden',
      }}
    >
      {/* 배경 이미지 */}
      <img
        src={splashImg}
        alt="CookMatch Splash"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100vw',
          height: '100vh',
          objectFit: 'contain',
          zIndex: 1,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
        draggable={false}
      />
      {/* 숫자만 이미지 위에 겹쳐서 표시 (이미지 내에서 원하는 위치로 조정) */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '75%',
          transform: 'translate(-50%, 0)',
          color: '#FFA800',
          fontWeight: 700,
          fontSize: 48,
          textAlign: 'center',
          fontFamily: 'inherit',
          letterSpacing: '2px',
          textShadow: '0 2px 8px #fff9e5, 0 0px 2px #fff9e5',
          width: '100%',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      >
        {formatted}
      </div>
    </div>
  );
};

export default SplashScreen; 