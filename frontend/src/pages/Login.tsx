import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import logoWithCharacter from '../assets/냉털이로고및캐릭터.png';
import googleLogo from '../assets/구글로고.png';
import kakaoLogo from '../assets/카카오톡로고.png';
import naverLogo from '../assets/네이버로고.png';
import NeangteolButton from '../components/NeangteolButton';
import NeangteolInput from '../components/NeangteolInput';

// =====================
// 상수
// =====================

const LOGO_SIZE = { width: '170px', height: 'auto', maxWidth: '100%' };
const BUTTON_HEIGHT = 'h-[44px]';
const INPUT_HEIGHT = 'h-[44px]';
const CONTAINER_WIDTH = 'w-[260px]';
const MAX_CONTAINER_WIDTH = 'max-w-[320px]';

// =====================
// SSO 버튼 설정
// =====================

const SSO_BUTTONS = [
  {
    icon: googleLogo,
    alt: 'Google',
    color: 'bg-white',
    textColor: 'text-black',
    text: 'Google로 시작하기'
  },
  {
    icon: kakaoLogo,
    alt: 'Kakao',
    color: 'bg-[#ffe812]',
    textColor: 'text-black',
    text: 'kakao로 시작하기'
  },
  {
    icon: naverLogo,
    alt: 'Naver',
    color: 'bg-[#1ec800]',
    textColor: 'text-white',
    text: 'Naver로 시작하기'
  }
];

// =====================
// 메인 컴포넌트
// =====================

const Login: React.FC = () => {
  const navigate = useNavigate();

  /**
   * 비회원으로 계속하기 클릭 처리
   */
  const handleGuestLogin = () => {
    navigate('/my-fridge');
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f4f0e6]">
      <div className="w-full max-w-[390px] flex flex-col items-center justify-center mx-auto py-6">
        {/* 상단 로고/캐릭터 */}
        <div className="flex flex-col items-center mb-8 mt-2">
          <img
            src={logoWithCharacter}
            alt="냉털이 로고 및 캐릭터"
            className="mb-4"
            style={LOGO_SIZE}
            draggable={false}
          />
        </div>
        
        {/* 로그인 입력+버튼 세로배치 */}
        <div className={`flex flex-col ${CONTAINER_WIDTH} items-center gap-2 mb-3 mx-auto`}>
          <NeangteolInput 
            placeholder="아이디 또는 이메일" 
            className={`w-full ${INPUT_HEIGHT} px-4`} 
          />
          <NeangteolInput 
            type="password" 
            placeholder="비밀번호" 
            className={`w-full ${INPUT_HEIGHT} px-4`} 
          />
          <NeangteolButton 
            color="bg-[#3c3c3c]" 
            textColor="text-white" 
            className={`w-full ${BUTTON_HEIGHT} rounded-xl text-[15px] mt-1 px-4`}
          >
            로그인
          </NeangteolButton>
        </div>
        
        {/* 체크박스 */}
        <div className={`flex flex-row items-center justify-center gap-2 w-full ${MAX_CONTAINER_WIDTH} mb-2 px-1`}>
          <label className="flex items-center gap-1 text-[12px] text-[#444] font-normal">
            <input type="checkbox" className="w-4 h-4 accent-[#222]" /> 
            아이디 저장
          </label>
          <label className="flex items-center gap-1 text-[12px] text-[#444] font-normal">
            <input type="checkbox" className="w-4 h-4 accent-[#222]" /> 
            자동 로그인
          </label>
        </div>
        
        {/* 하단 링크 */}
        <div className={`w-full ${MAX_CONTAINER_WIDTH} text-center text-[12px] text-[#333] mb-1 leading-tight`}>
          아직 회원이 아니신가요? 
          <span className="underline font-bold cursor-pointer">3초 회원가입</span>
        </div>
        <div className={`w-full ${MAX_CONTAINER_WIDTH} flex justify-center gap-2 text-[12px] text-[#333] mb-4 leading-tight`}>
          <span className="underline cursor-pointer">아이디 찾기</span>
          <span>|</span>
          <span className="underline cursor-pointer">비밀번호 찾기</span>
        </div>
        
        {/* SSO/비회원 버튼 세로배치 */}
        <div className={`flex flex-col gap-3 ${CONTAINER_WIDTH} mt-2 items-center`}>
          {SSO_BUTTONS.map((button, index) => (
            <NeangteolButton
              key={index}
              icon={<img src={button.icon} alt={button.alt} className="w-6 h-6" />}
              color={button.color}
              textColor={button.textColor}
              className={`w-full ${BUTTON_HEIGHT} px-4`}
            >
              {button.text}
            </NeangteolButton>
          ))}
          <NeangteolButton 
            border 
            color="bg-white" 
            textColor="text-black" 
            className={`w-full ${BUTTON_HEIGHT} px-4`} 
            onClick={handleGuestLogin}
          >
            비회원으로 계속하기
          </NeangteolButton>
        </div>
      </div>
    </div>
  );
};

export default Login; 