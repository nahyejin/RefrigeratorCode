import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../components/ui/BackButton';
import googleLogo from '../assets/구글로고.png';
import kakaoLogo from '../assets/카카오톡로고.png';
import naverLogo from '../assets/네이버로고.png';
import NeangteolButton from '../components/NeangteolButton';
import NeangteolInput from '../components/NeangteolInput';
import { useAuth } from '../context/AuthContext';
import { getPostLoginRedirectPath } from '../utils/householdInvite';
import { isNativeApp, isIosApp, startNativeSocialLogin, signInWithAppleNative } from '../utils/nativeAuth';

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

// Sign in with Apple — 구글·카카오·네이버 로그인을 제공하는 iOS 앱은 심사 때 필수(가이드라인 4.8).
// Apple 규정상 검정 바탕에 흰 로고·글자, 다른 로그인 버튼보다 눈에 띄지 않게 하면 안 돼서 맨 위에 둔다.
const APPLE_LOGO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#fff"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>';

const APPLE_BUTTON = {
  icon: `data:image/svg+xml;utf8,${encodeURIComponent(APPLE_LOGO_SVG)}`,
  alt: 'Apple',
  color: 'bg-black',
  textColor: 'text-white',
  text: 'Apple로 계속하기',
  border: false
};

type SocialLoginProvider = 'google' | 'kakao' | 'naver' | 'apple';

// =====================
// 메인 컴포넌트
// =====================

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  // 소셜 로그인이 실패하면 콜백 쪽이 /login?error=... 로 돌려보낸다(웹 AuthSuccess, 앱 NativeAuthBridge)
  const [error, setError] = React.useState(() => {
    const code = new URLSearchParams(window.location.search).get('error');
    return code ? '소셜 로그인에 실패했어요. 다시 시도해주세요.' : '';
  });
  const [loading, setLoading] = React.useState(false);
  const [rememberMe, setRememberMe] = React.useState(true);

  // 이 기기에서 마지막으로 로그인한 방법 — 카카오/구글/네이버가 나란히 있으면
  // 다음에 뭘 눌러야 하는지 헷갈리기 쉬워서, 해당 버튼에 배지로 표시해 준다.
  const lastLoginMethod = React.useMemo(() => {
    try {
      return localStorage.getItem('cookmatch_last_login_method');
    } catch {
      return null;
    }
  }, []);
  /**
   * 이메일로 마지막에 들어왔나.
   *
   * 서버는 이메일 로그인 토큰에 `provider: 'local'` 을 넣는다. 프론트는
   * 그 값이 없을 때만 `'email'` 로 적으므로 **둘 다 나올 수 있다.** 한쪽만
   * 보면 배지가 안 뜬다.
   */
  const isLastEmail = lastLoginMethod === 'local' || lastLoginMethod === 'email';

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
        navigate(getPostLoginRedirectPath('/my-fridge'));
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
  const handleSocialLogin = (provider: SocialLoginProvider) => {
    if (provider === 'apple') {
      setError('');
      signInWithAppleNative()
        .then(async token => {
          if (!token) return; // 사용자가 Apple 로그인 창을 닫음
          await loginWithToken(token, true);
          navigate(getPostLoginRedirectPath('/my-fridge'));
        })
        .catch(() => setError('Apple 로그인에 실패했어요. 다시 시도해주세요.'));
      return;
    }
    // 앱은 웹처럼 "로그인 뒤 우리 사이트로 리다이렉트"가 안 돼서 시스템 브라우저로 열고 앱으로 돌아온다
    if (isNativeApp()) {
      startNativeSocialLogin(provider).catch(() => setError('로그인 창을 열지 못했어요. 다시 시도해주세요.'));
      return;
    }
    const apiUrl = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';
    window.location.href = `${apiUrl}/api/auth/${provider}`;
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white">
      {/* 공통 GNB(고정 헤더, z-index 200) 바로 아래 고정. 콘텐츠가 세로 중앙
          정렬이라 화면 높이에 따라 위치가 들쭉날쭉해지는 것을 피하려고
          문서 흐름이 아닌 고정 위치로 둔다 */}
      <BackButton onClick={() => navigate(-1)} style={{ position: 'fixed', top: 64, left: 12, zIndex: 201 }} />
      <div className="w-full max-w-[390px] flex flex-col items-center mx-auto py-6" style={{ minHeight: '100vh' }}>
        {/* 상단 여백 - 더 줄임 */}
        <div style={{ flex: '0.3', minHeight: '80px' }}></div>
        
        {/* 유도 메시지 */}
        <div className={`w-full ${MAX_CONTAINER_WIDTH} text-center text-[15px] text-gray-500 mb-6 mx-auto font-normal`}>
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
            <div className="w-full text-[13px] text-red-500 text-center mt-1">
              {error}
            </div>
          )}
          
          {/* **이메일로 들어온 사람에게도 배지를 달아 준다.**

              배지는 원래 카카오/구글/네이버 버튼에만 붙였다. 그런데 이메일로
              로그인하면 서버가 토큰에 `provider: 'local'` 을 넣고, 그 값이
              그대로 저장된다 — 셋 중 어느 것과도 안 맞아 **배지가 아무 데도
              안 떴다.** "이 기기에서 마지막으로 이걸로 들어왔다" 는 말은
              이메일에도 똑같이 필요하다. */}
          <div className="relative w-full">
            {isLastEmail && (
              <span
                className="absolute -top-2 right-2 bg-[#1A1A1E] text-white text-[11px] font-semibold px-2 py-[2px] rounded-full whitespace-nowrap"
                style={{ zIndex: 1 }}
              >
                최근 로그인
              </span>
            )}
            <NeangteolButton
              color="bg-[#3A3A42]"
              textColor="text-white"
              className={`w-full ${BUTTON_HEIGHT} rounded-xl text-[16px] mt-1 px-4`}
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? '로그인 중...' : '로그인'}
            </NeangteolButton>
          </div>
        </div>
        
        {/* 체크박스 */}
        <div className={`flex flex-row items-center justify-center gap-2 w-full ${MAX_CONTAINER_WIDTH} mb-2 px-1 mx-auto`}>
          <label className="flex items-center gap-1 text-[13px] text-[#3A3A42] font-normal cursor-pointer">
            <input 
              type="checkbox" 
              className="w-4 h-4 accent-[#1A1A1E] cursor-pointer" 
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            /> 
            로그인 항상 유지
          </label>
        </div>
        
        {/* 하단 링크 */}
        <div className={`w-full ${MAX_CONTAINER_WIDTH} text-center text-[13px] text-[#3A3A42] mb-1 leading-tight mx-auto`}>
          아직 회원이 아니신가요? <span className="underline font-bold cursor-pointer" onClick={() => navigate('/signup')}>3초 회원가입</span>
        </div>
        <div className={`w-full ${MAX_CONTAINER_WIDTH} text-center text-[13px] text-[#3A3A42] mb-4 leading-tight mx-auto`}>
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
            <span className="bg-white px-3 text-gray-500 text-[13px]">간편 로그인</span>
        </div>
        </div>
        
        {/* SSO 버튼 세로배치 */}
        <div className={`flex flex-col gap-3 ${CONTAINER_WIDTH} mt-2 items-center mx-auto`}>
          {(isIosApp() ? [APPLE_BUTTON, ...SSO_BUTTONS] : SSO_BUTTONS).map((button, index) => {
            const provider = button.alt.toLowerCase() as SocialLoginProvider;
            const isLastUsed = lastLoginMethod === provider;
            return (
            <div key={index} className="relative w-full">
              {isLastUsed && (
                <span
                  className="absolute -top-2 right-2 bg-[#1A1A1E] text-white text-[11px] font-semibold px-2 py-[2px] rounded-full whitespace-nowrap"
                  style={{ zIndex: 1 }}
                >
                  최근 로그인
                </span>
              )}
              <NeangteolButton
                icon={<img src={button.icon} alt={button.alt} className="w-4 h-4" />}
                color={button.color}
                textColor={button.textColor}
                className={`w-full ${SSO_BUTTON_HEIGHT} px-4 text-[15px]`}
                border={button.border || false}
                onClick={() => handleSocialLogin(provider)}
              >
                {button.text}
              </NeangteolButton>
            </div>
            );
          })}
        </div>

        {/* 비회원으로 계속하기 버튼 (하단 분리) */}
        <div className={`flex flex-col gap-3 ${CONTAINER_WIDTH} mt-8 mb-8 items-center`}>
          <NeangteolButton 
            border 
            color="bg-gray-100" 
            textColor="text-gray-400" 
            className={`w-full ${SSO_BUTTON_HEIGHT} px-4 text-[15px]`} 
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