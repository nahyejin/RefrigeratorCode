import * as React from 'react';
import characterImg from '../assets/냉털이 캐릭터.png';
import logoImg from '../assets/냉털이 로고.png';
import googleLogo from '../assets/구글로그인로고.png';
import kakaoLogo from '../assets/카카오로그인로고.png';
import naverLogo from '../assets/네이버로그인로고.png';
import NeangteolButton from '../components/NeangteolButton';
import NeangteolInput from '../components/NeangteolInput';

const Login: React.FC = () => {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f4f0e6]">
      <div className="w-full max-w-[390px] flex flex-col items-center justify-center mx-auto py-8">
        {/* 상단 로고/캐릭터/서브텍스트 */}
        <div className="flex flex-col items-center mb-10 mt-8">
          <img src={characterImg} alt="냉털이 캐릭터" className="w-12 h-12 mb-3" />
          <img src={logoImg} alt="냉털이 로고" className="w-[220px] mb-1" />
          <div className="text-[12px] tracking-[0.25em] text-[#3c3c3c] font-mono mb-2">JUST DO EAT</div>
        </div>
        {/* 로그인 입력+버튼 가로배치 */}
        <div className="flex flex-row w-full max-w-[320px] gap-2 mb-2">
          <div className="flex flex-col gap-2 flex-1">
            <NeangteolInput placeholder="아이디 또는 이메일" />
            <NeangteolInput type="password" placeholder="비밀번호" />
          </div>
          <NeangteolButton color="bg-[#3c3c3c]" textColor="text-white" className="w-[60px] h-[92px] ml-1">로그인</NeangteolButton>
        </div>
        {/* 체크박스 */}
        <div className="flex flex-row items-center gap-4 w-full max-w-[320px] mb-2 px-1">
          <label className="flex items-center text-[12px] text-[#444]">
            <input type="checkbox" className="w-3 h-3 mr-1 accent-[#222]" /> 아이디 저장
          </label>
          <label className="flex items-center text-[12px] text-[#444]">
            <input type="checkbox" className="w-3 h-3 mr-1 accent-[#222]" /> 자동 로그인
          </label>
        </div>
        {/* 하단 링크 */}
        <div className="w-full max-w-[320px] text-center text-[13px] text-[#333] mb-1">
          아직 회원이 아니신가요? <span className="underline font-bold cursor-pointer">3초 회원가입</span>
        </div>
        <div className="w-full max-w-[320px] flex justify-center gap-2 text-[13px] text-[#333] mb-6">
          <span className="underline cursor-pointer">아이디 찾기</span>
          <span>|</span>
          <span className="underline cursor-pointer">비밀번호 찾기</span>
        </div>
        {/* SSO/비회원 버튼 세로배치 */}
        <div className="flex flex-col gap-3 w-full max-w-[320px] mt-2">
          <NeangteolButton icon={<img src={googleLogo} alt="Google" className="w-5 h-5" />} color="bg-white" textColor="text-black">Google로 시작하기</NeangteolButton>
          <NeangteolButton icon={<img src={kakaoLogo} alt="Kakao" className="w-5 h-5" />} color="bg-[#ffe812]" textColor="text-black">kakao로 시작하기</NeangteolButton>
          <NeangteolButton icon={<img src={naverLogo} alt="Naver" className="w-5 h-5" />} color="bg-[#1ec800]" textColor="text-white">Naver로 시작하기</NeangteolButton>
          <NeangteolButton border color="bg-white" textColor="text-black">비회원으로 계속하기</NeangteolButton>
        </div>
      </div>
    </div>
  );
};

export default Login; 