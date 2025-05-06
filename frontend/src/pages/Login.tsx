import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import characterImg from '../assets/냉털이 캐릭터.png';
import logoImg from '../assets/냉털이 로고.png';
import googleLogo from '../assets/구글로고.png';
import kakaoLogo from '../assets/카카오톡로고.png';
import naverLogo from '../assets/네이버로고.png';
import NeangteolButton from '../components/NeangteolButton';
import NeangteolInput from '../components/NeangteolInput';

const Login: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f4f0e6]">
      <div className="w-full max-w-[390px] flex flex-col items-center justify-center mx-auto py-6">
        {/* 상단 로고/캐릭터 */}
        <div className="flex flex-col items-center mb-8 mt-2">
          <img src={characterImg} alt="냉털이 캐릭터" className="w-10 h-10 mb-1" />
          <img src={logoImg} alt="냉털이 로고" className="w-[260px] mt-0" />
        </div>
        {/* 로그인 입력+버튼 세로배치 */}
        <div className="flex flex-col w-full max-w-[320px] items-center gap-2 mb-3 mx-auto">
          <NeangteolInput placeholder="아이디 또는 이메일" className="w-[240px] h-[44px]" />
          <NeangteolInput type="password" placeholder="비밀번호" className="w-[240px] h-[44px]" />
          <NeangteolButton color="bg-[#3c3c3c]" textColor="text-white" className="w-[240px] h-[44px] rounded-xl text-[15px] mt-1">로그인</NeangteolButton>
        </div>
        {/* 체크박스 */}
        <div className="flex flex-row items-center justify-center gap-2 w-full max-w-[320px] mb-2 px-1">
          <label className="flex items-center gap-1 text-[12px] text-[#444] font-normal">
            <input type="checkbox" className="w-4 h-4 accent-[#222]" /> 아이디 저장
          </label>
          <label className="flex items-center gap-1 text-[12px] text-[#444] font-normal">
            <input type="checkbox" className="w-4 h-4 accent-[#222]" /> 자동 로그인
          </label>
        </div>
        {/* 하단 링크 */}
        <div className="w-full max-w-[320px] text-center text-[12px] text-[#333] mb-1 leading-tight">
          아직 회원이 아니신가요? <span className="underline font-bold cursor-pointer">3초 회원가입</span>
        </div>
        <div className="w-full max-w-[320px] flex justify-center gap-2 text-[12px] text-[#333] mb-4 leading-tight">
          <span className="underline cursor-pointer">아이디 찾기</span>
          <span>|</span>
          <span className="underline cursor-pointer">비밀번호 찾기</span>
        </div>
        {/* SSO/비회원 버튼 세로배치 */}
        <div className="flex flex-col gap-3 w-full max-w-[320px] mt-2 items-center">
          <NeangteolButton icon={<img src={googleLogo} alt="Google" className="w-6 h-6" />} color="bg-white" textColor="text-black" className="w-[240px] h-[44px]">Google로 시작하기</NeangteolButton>
          <NeangteolButton icon={<img src={kakaoLogo} alt="Kakao" className="w-6 h-6" />} color="bg-[#ffe812]" textColor="text-black" className="w-[240px] h-[44px]">kakao로 시작하기</NeangteolButton>
          <NeangteolButton icon={<img src={naverLogo} alt="Naver" className="w-6 h-6" />} color="bg-[#1ec800]" textColor="text-white" className="w-[240px] h-[44px]">Naver로 시작하기</NeangteolButton>
          <NeangteolButton border color="bg-white" textColor="text-black" className="w-[240px] h-[44px]" onClick={() => navigate('/fridge-select')}>비회원으로 계속하기</NeangteolButton>
        </div>
      </div>
    </div>
  );
};

export default Login; 