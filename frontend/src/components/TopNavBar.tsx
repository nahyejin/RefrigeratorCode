import * as React from 'react';
import logoImg from '../assets/냉털이 로고 white.png';

const TopNavBar: React.FC = () => (
  <header 
    className="w-full h-[56px] flex items-center justify-between px-5 bg-white"
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      maxWidth: '100%',
      margin: '0 auto',
      willChange: 'transform',
      transform: 'translateZ(0)',
      WebkitTransform: 'translateZ(0)',
      backfaceVisibility: 'hidden',
      WebkitBackfaceVisibility: 'hidden'
    }}
  >
    <img src={logoImg} alt="냉털이 로고" className="h-4 w-auto min-w-[16px]" />
  </header>
);

export default TopNavBar; 