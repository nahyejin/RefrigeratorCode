import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import googleLogo from '../assets/구글로고.png';
import kakaoLogo from '../assets/카카오톡로고.png';
import naverLogo from '../assets/네이버로고.png';
import NeangteolButton from '../components/NeangteolButton';
import NeangteolInput from '../components/NeangteolInput';
import { useAuth } from '../context/AuthContext';

// =====================
// 상수
// =====================

const BUTTON_HEIGHT = 'h-[44px]';
const SSO_BUTTON_HEIGHT = 'h-[36px]';
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
    text: 'Google로 시작하기',
    border: true
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
  const { loginWithToken } = useAuth();
  
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [rememberMe, setRememberMe] = React.useState(true);

  /**
   * 일반 로그인 처리
   */
  const handleLogin = async () => {
    if (!email || !password) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const apiUrl = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '로그인에 실패했습니다.');
        setLoading(false);
        return;
      }

      // 로그인 처리
      if (data.token) {
        await loginWithToken(data.token, rememberMe);
        navigate('/my-fridge');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('로그인 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  /**
   * 비회원으로 계속하기 클릭 처리
   */
  const handleGuestLogin = () => {
    navigate('/my-fridge');
  };

  /**
   * 소셜 로그인 시작
   */
  const handleSocialLogin = (provider: 'google' | 'kakao' | 'naver') => {
    const apiUrl = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';
    window.location.href = `${apiUrl}/api/auth/${provider}`;
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white">
      <div className="w-full max-w-[390px] flex flex-col items-center mx-auto py-6" style={{ minHeight: '100vh' }}>
        {/* 상단 여백 - 더 줄임 */}
        <div style={{ flex: '0.3', minHeight: '80px' }}></div>
        
        {/* 유도 메시지 */}
        <div className={`w-full ${MAX_CONTAINER_WIDTH} text-center text-[13px] text-gray-500 mb-6 mx-auto font-normal`}>
          로그인하여 내냉장고를 더 똑똑하게 관리하세요
        </div>
        
        {/* 로그인 입력+버튼 세로배치 */}
        <div className={`flex flex-col ${CONTAINER_WIDTH} items-center gap-2 mb-3 mx-auto`}>
          <NeangteolInput 
            placeholder="이메일 입력" 
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`w-full ${INPUT_HEIGHT} px-4`} 
          />
          <NeangteolInput 
            type="password" 
            placeholder="비밀번호 입력" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleLogin();
              }
            }}
            showPasswordToggle={true}
            className={`w-full ${INPUT_HEIGHT} px-4`} 
          />
          
          {/* 에러 메시지 */}
          {error && (
            <div className="w-full text-[12px] text-red-500 text-center mt-1">
              {error}
            </div>
          )}
          
          <NeangteolButton 
            color="bg-[#3c3c3c]" 
            textColor="text-white" 
            className={`w-full ${BUTTON_HEIGHT} rounded-xl text-[15px] mt-1 px-4`}
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? '로그인 중...' : '로그인'}
          </NeangteolButton>
        </div>
        
        {/* 체크박스 */}
        <div className={`flex flex-row items-center justify-center gap-2 w-full ${MAX_CONTAINER_WIDTH} mb-2 px-1 mx-auto`}>
          <label className="flex items-center gap-1 text-[12px] text-[#444] font-normal cursor-pointer">
            <input 
              type="checkbox" 
              className="w-4 h-4 accent-[#222] cursor-pointer" 
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            /> 
            로그인 항상 유지
          </label>
        </div>
        
        {/* 하단 링크 */}
        <div className={`w-full ${MAX_CONTAINER_WIDTH} text-center text-[12px] text-[#333] mb-1 leading-tight mx-auto`}>
          아직 회원이 아니신가요? <span className="underline font-bold cursor-pointer" onClick={() => navigate('/signup')}>3초 회원가입</span>
        </div>
        <div className={`w-full ${MAX_CONTAINER_WIDTH} text-center text-[12px] text-[#333] mb-4 leading-tight mx-auto`}>
          <span className="underline cursor-pointer" onClick={() => navigate('/reset-password')}>비밀번호 찾기</span>
        </div>
        
        {/* 하단 여백 - 더 줄임 */}
        <div style={{ flex: '0.2', minHeight: '20px' }}></div>
        
        {/* 간편 로그인 구분선 */}
        <div className="relative w-full max-w-[320px] my-2 mx-auto">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-3 text-gray-500 text-[11px]">간편 로그인</span>
        </div>
        </div>
        
        {/* SSO 버튼 세로배치 */}
        <div className={`flex flex-col gap-3 ${CONTAINER_WIDTH} mt-2 items-center mx-auto`}>
          {SSO_BUTTONS.map((button, index) => {
            const provider = button.alt.toLowerCase() as 'google' | 'kakao' | 'naver';
            return (
            <NeangteolButton
              key={index}
                icon={<img src={button.icon} alt={button.alt} className="w-4 h-4" />}
              color={button.color}
              textColor={button.textColor}
                className={`w-full ${SSO_BUTTON_HEIGHT} px-4 text-[13px]`}
                border={button.border || false}
                onClick={() => handleSocialLogin(provider)}
            >
              {button.text}
            </NeangteolButton>
            );
          })}
        </div>
        
        {/* 비회원으로 계속하기 버튼 (하단 분리) */}
        <div className={`flex flex-col gap-3 ${CONTAINER_WIDTH} mt-8 mb-8 items-center`}>
          <NeangteolButton 
            border 
            color="bg-gray-100" 
            textColor="text-gray-400" 
            className={`w-full ${SSO_BUTTON_HEIGHT} px-4 text-[13px]`} 
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