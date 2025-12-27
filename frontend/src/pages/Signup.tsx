import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import NeangteolButton from '../components/NeangteolButton';
import NeangteolInput from '../components/NeangteolInput';
import { useAuth } from '../context/AuthContext';

// =====================
// 상수
// =====================

const BUTTON_HEIGHT = 'h-[44px]';
const INPUT_HEIGHT = 'h-[44px]';
const CONTAINER_WIDTH = 'w-[260px]';
const MAX_CONTAINER_WIDTH = 'max-w-[320px]';

// =====================
// 메인 컴포넌트
// =====================

const Signup: React.FC = () => {
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [nickname, setNickname] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [passwordError, setPasswordError] = React.useState('');
  
  // 이메일 중복 체크
  const [emailCheckResult, setEmailCheckResult] = React.useState<{available: boolean, message: string} | null>(null);
  const [checkingEmail, setCheckingEmail] = React.useState(false);
  
  // 이메일 인증
  const [verificationCode, setVerificationCode] = React.useState('');
  const [emailVerified, setEmailVerified] = React.useState(false);
  const [sendingCode, setSendingCode] = React.useState(false);
  const [verifyingCode, setVerifyingCode] = React.useState(false);
  const [devCode, setDevCode] = React.useState(''); // 개발 모드용 인증 코드

  /**
   * 이메일 중복 체크
   */
  const handleCheckEmail = async () => {
    if (!email || !email.includes('@')) {
      setEmailCheckResult({ available: false, message: '올바른 이메일을 입력해주세요.' });
      return;
    }

    setCheckingEmail(true);
    setEmailCheckResult(null);

    try {
      const apiUrl = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';
      const response = await fetch(`${apiUrl}/api/auth/check-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      setEmailCheckResult(data);
    } catch (err) {
      console.error('Check email error:', err);
      setEmailCheckResult({ available: false, message: '이메일 확인 중 오류가 발생했습니다.' });
    } finally {
      setCheckingEmail(false);
    }
  };

  /**
   * 인증 코드 발송
   */
  const handleSendVerificationCode = async () => {
    if (!email || !email.includes('@')) {
      setError('올바른 이메일을 입력해주세요.');
      return;
    }

    if (emailCheckResult && !emailCheckResult.available) {
      setError('사용 가능한 이메일을 입력해주세요.');
      return;
    }

    setSendingCode(true);
    setError('');

    try {
      const apiUrl = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';
      const response = await fetch(`${apiUrl}/api/auth/send-verification-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '인증 코드 발송에 실패했습니다.');
        setSendingCode(false);
        return;
      }

      setError('');
      
      // 개발 모드에서 인증 코드가 응답에 포함된 경우
      if (data.dev_code) {
        setDevCode(data.dev_code);
        alert('개발 모드: 인증 코드가 화면에 표시됩니다.\n\n(실제 이메일 발송을 원하면 SMTP 설정이 필요합니다.)');
      } else {
        setDevCode('');
        alert('인증 코드가 발송되었습니다. 이메일을 확인해주세요.');
      }
    } catch (err) {
      console.error('Send verification code error:', err);
      setError('인증 코드 발송 중 오류가 발생했습니다.');
    } finally {
      setSendingCode(false);
    }
  };

  /**
   * 인증 코드 검증
   */
  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('6자리 인증 코드를 입력해주세요.');
      return;
    }

    setVerifyingCode(true);
    setError('');

    try {
      const apiUrl = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';
      const response = await fetch(`${apiUrl}/api/auth/verify-email-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          code: verificationCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '인증 코드가 올바르지 않습니다.');
        setVerifyingCode(false);
        return;
      }

      setEmailVerified(true);
      setError('');
      alert('이메일 인증이 완료되었습니다.');
    } catch (err) {
      console.error('Verify code error:', err);
      setError('인증 코드 확인 중 오류가 발생했습니다.');
    } finally {
      setVerifyingCode(false);
    }
  };

  /**
   * 회원가입 처리
   */
  const handleSignup = async () => {
    // 유효성 검사
    if (!email || !password || !confirmPassword) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    // 비밀번호 유효성 검사
    if (password.length < 4) {
      setError('비밀번호는 최소 4자 이상이어야 합니다.');
      return;
    }

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    // 이메일 중복 체크 확인
    if (!emailCheckResult || !emailCheckResult.available) {
      setError('이메일 중복 체크를 완료해주세요.');
      return;
    }

    // 이메일 인증 확인 (선택사항 - 개발 환경에서는 생략 가능)
    // 운영 환경에서는 이메일 인증을 필수로 할 수 있습니다
    // if (!emailVerified) {
    //   setError('이메일 인증을 완료해주세요.');
    //   return;
    // }

    setError('');
    setLoading(true);

    try {
      const apiUrl = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';
      const response = await fetch(`${apiUrl}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          nickname: nickname || email.split('@')[0], // 닉네임이 없으면 이메일 앞부분 사용
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '회원가입에 실패했습니다.');
        setLoading(false);
        return;
      }

      // 로그인 처리
      if (data.token) {
        await loginWithToken(data.token);
        navigate('/my-fridge');
      }
    } catch (err) {
      console.error('Signup error:', err);
      setError('회원가입 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white">
      <div className="w-full max-w-[390px] flex flex-col items-center mx-auto py-6" style={{ minHeight: '100vh' }}>
        {/* 상단 여백 */}
        <div style={{ flex: '0.2', minHeight: '60px' }}></div>
        
        {/* 제목 */}
        <div className={`w-full ${MAX_CONTAINER_WIDTH} text-center text-[20px] font-bold text-[#222] mb-6 mx-auto`}>
          회원가입
        </div>
        
        {/* 회원가입 입력 폼 */}
        <div className={`flex flex-col ${CONTAINER_WIDTH} items-center gap-3 mb-4 mx-auto`}>
          {/* 이메일 입력 + 중복 체크 */}
          <div className="w-full">
            <div className="flex items-center gap-2 mb-1 w-full">
              <div className="flex-1 min-w-0">
                <NeangteolInput 
                  placeholder="이메일 입력" 
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailCheckResult(null);
                    setEmailVerified(false);
                    setVerificationCode('');
                  }}
                  className={`w-full ${INPUT_HEIGHT} px-4`} 
                />
              </div>
              <button
                onClick={handleCheckEmail}
                disabled={checkingEmail || !email || !email.includes('@')}
                className="h-[44px] px-2 bg-[#FFD600] text-[#222] rounded-lg text-[12px] font-semibold whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                style={{ minWidth: '65px' }}
              >
                {checkingEmail ? '확인 중...' : '중복 체크'}
              </button>
            </div>
            {emailCheckResult && (
              <div className={`text-[12px] mt-1 px-2 py-1 rounded ${
                emailCheckResult.available 
                  ? 'text-green-600 bg-green-50' 
                  : 'text-red-600 bg-red-50'
              }`}>
                {emailCheckResult.message}
              </div>
            )}
          </div>

          {/* 이메일 인증 코드 발송 */}
          {emailCheckResult?.available && !emailVerified && (
            <div className="w-full">
              <button
                onClick={handleSendVerificationCode}
                disabled={sendingCode}
                className="w-full h-[36px] px-4 bg-blue-500 text-white rounded-lg text-[13px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingCode ? '발송 중...' : '인증 코드 발송'}
              </button>
              {/* 개발 모드: 인증 코드 표시 */}
              {devCode && (
                <div className="w-full mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="text-[12px] text-yellow-800 font-semibold mb-1">개발 모드 - 인증 코드:</div>
                  <div className="text-[20px] font-bold text-yellow-900 text-center tracking-wider">{devCode}</div>
                  <div className="text-[11px] text-yellow-700 mt-1 text-center">(실제 이메일 발송을 원하면 SMTP 설정이 필요합니다)</div>
                </div>
              )}
            </div>
          )}

          {/* 인증 코드 입력 */}
          {emailCheckResult?.available && !emailVerified && (
            <div className="w-full">
              <div className="flex items-center gap-2 mb-1 w-full">
                <div className="flex-1 min-w-0">
                  <NeangteolInput 
                    placeholder="인증 코드 6자리 입력" 
                    type="text"
                    value={verificationCode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setVerificationCode(value);
                    }}
                    className={`w-full ${INPUT_HEIGHT} px-4`} 
                  />
                </div>
                <button
                  onClick={handleVerifyCode}
                  disabled={verifyingCode || verificationCode.length !== 6}
                  className="h-[44px] px-2 bg-[#FFD600] text-[#222] rounded-lg text-[12px] font-semibold whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  style={{ minWidth: '65px' }}
                >
                  {verifyingCode ? '확인 중...' : '인증하기'}
                </button>
              </div>
            </div>
          )}

          {/* 인증 완료 표시 */}
          {emailVerified && (
            <div className="w-full text-[12px] text-green-600 bg-green-50 px-2 py-1 rounded">
              ✓ 이메일 인증이 완료되었습니다.
            </div>
          )}

          <NeangteolInput 
            placeholder="닉네임 입력 (선택사항)" 
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className={`w-full ${INPUT_HEIGHT} px-4`} 
          />
          
          {/* 비밀번호 입력 */}
          <div className="w-full">
            <NeangteolInput 
              type="password" 
              placeholder="비밀번호 입력 (최소 4자 이상)" 
              value={password}
              onChange={(e) => {
                const value = e.target.value;
                setPassword(value);
                if (value.length > 0 && value.length < 4) {
                  setPasswordError('비밀번호는 최소 4자 이상이어야 합니다.');
                } else {
                  setPasswordError('');
                }
              }}
              showPasswordToggle={true}
              className={`w-full ${INPUT_HEIGHT} px-4`} 
            />
            {passwordError && (
              <div className="text-[12px] text-red-500 mt-1 px-2">
                {passwordError}
              </div>
            )}
            {password.length >= 4 && !passwordError && (
              <div className="text-[12px] text-green-600 mt-1 px-2">
                ✓ 사용 가능한 비밀번호입니다.
              </div>
            )}
          </div>
          
          {/* 비밀번호 확인 */}
          <div className="w-full">
            <NeangteolInput 
              type="password" 
              placeholder="비밀번호 확인" 
              value={confirmPassword}
              onChange={(e) => {
                const value = e.target.value;
                setConfirmPassword(value);
                if (password && value && password !== value) {
                  setError('비밀번호가 일치하지 않습니다.');
                } else {
                  setError('');
                }
              }}
              showPasswordToggle={true}
              className={`w-full ${INPUT_HEIGHT} px-4`} 
            />
            {confirmPassword && password === confirmPassword && password.length >= 4 && (
              <div className="text-[12px] text-green-600 mt-1 px-2">
                ✓ 비밀번호가 일치합니다.
              </div>
            )}
          </div>
          
          {/* 에러 메시지 */}
          {error && (
            <div className="w-full text-[12px] text-red-500 text-center mt-1">
              {error}
            </div>
          )}
          
          <NeangteolButton 
            color="bg-[#3c3c3c]" 
            textColor="text-white" 
            className={`w-full ${BUTTON_HEIGHT} rounded-xl text-[15px] mt-2 px-4`}
            onClick={handleSignup}
            disabled={loading}
          >
            {loading ? '가입 중...' : '회원가입'}
          </NeangteolButton>
        </div>
        
        {/* 로그인 링크 */}
        <div className={`w-full ${MAX_CONTAINER_WIDTH} text-center text-[12px] text-[#333] mb-4 leading-tight mx-auto`}>
          이미 회원이신가요? <span className="underline font-bold cursor-pointer" onClick={() => navigate('/login')}>로그인</span>
        </div>
        
        {/* 하단 여백 */}
        <div style={{ flex: '0.3', minHeight: '40px' }}></div>
      </div>
    </div>
  );
};

export default Signup;

