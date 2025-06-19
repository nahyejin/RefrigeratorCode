import React, { useEffect, useRef, useState } from 'react';
import splashImg from '../assets/open_loading_page.png';

interface SplashScreenProps {
  recipeCount: number;
}

function padNumber(num: number, length: number) {
  return num.toString().padStart(length, '0');
}

const STOP_DELAYS = [200, 180, 160, 140]; // 천, 백, 십, 일의자리(ms) - 훨씬 짧게

const SplashScreen: React.FC<SplashScreenProps> = ({ recipeCount }) => {
  const [displayDigits, setDisplayDigits] = useState<string[] | undefined>(undefined);
  const digitsRef = useRef<string[]>(['0', '0', '0', '0']);
  const rafRef = useRef<number>();
  const stopFlags = useRef([false, false, false, false]);

  useEffect(() => {
    const countStr = padNumber(recipeCount, 4);
    stopFlags.current = [false, false, false, false];
    // 애니메이션 시작 직전에 랜덤값으로 초기화
    const initialDigits = [0, 1, 2, 3].map(() => Math.floor(Math.random() * 10).toString());
    digitsRef.current = initialDigits;
    setDisplayDigits(undefined); // 숫자 div를 아예 렌더하지 않음
    let started = false;
    const start = performance.now();
    function animate(now: number) {
      if (!started) {
        setDisplayDigits([...digitsRef.current]); // 애니메이션 시작 시 랜덤값으로 set
        started = true;
      }
      const elapsed = now - start;
      for (let i = 0; i < 4; i++) {
        if (!stopFlags.current[i]) {
          digitsRef.current[i] = Math.floor(Math.random() * 10).toString();
        }
        if (!stopFlags.current[i] && elapsed > STOP_DELAYS[i]) {
          digitsRef.current[i] = countStr[i];
          stopFlags.current[i] = true;
        }
      }
      setDisplayDigits([...digitsRef.current]); // 매 프레임마다 setState
      if (stopFlags.current.some(flag => !flag)) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayDigits(countStr.split(''));
      }
    }
    rafRef.current = requestAnimationFrame(animate);
    // SplashScreen은 5초 유지
    const splashTimeout = window.setTimeout(() => {}, 5000);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clearTimeout(splashTimeout);
    };
    // eslint-disable-next-line
  }, [recipeCount]);

  // 쉼표 추가 (4자리 기준)
  const formatted = displayDigits ? `${displayDigits[0]},${displayDigits[1]}${displayDigits[2]}${displayDigits[3]}` : '';

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        position: 'relative',
        background: '#f4f0e6', // 로그인 페이지와 동일한 배경색
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
      {displayDigits && (
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
      )}
    </div>
  );
};

export default SplashScreen; 