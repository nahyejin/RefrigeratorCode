import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NeangteolInput from '../components/NeangteolInput';
import NeangteolButton from '../components/NeangteolButton';

const INPUT_HEIGHT = 'h-[44px]';
const BUTTON_HEIGHT = 'h-[44px]';
const CONTAINER_WIDTH = 'w-[260px]';
const MAX_CONTAINER_WIDTH = 'max-w-[320px]';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'email' | 'verify' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [devVerificationCode, setDevVerificationCode] = useState('');

  // 이메일로 인증 코드 발송
  const handleSendVerificationCode = async () => {
    if (!email || !email.includes('@')) {
      setError('올바른 이메일을 입력해주세요.');
      return;
    }

    setError('');
    setSendingCode(true);

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

      // 개발 모드에서 코드 표시
      if (data.dev_code) {
        setDevVerificationCode(data.dev_code);
      }

      setStep('verify');
      setSendingCode(false);
    } catch (err) {
      console.error('Send verification code error:', err);
      setError('인증 코드 발송 중 오류가 발생했습니다.');
      setSendingCode(false);
    }
  };

  // 인증 코드 확인
  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('인증 코드 6자리를 입력해주세요.');
      return;
    }

    setError('');
    setVerifyingCode(true);

    try {
      const apiUrl = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';
      const response = await fetch(`${apiUrl}/api/auth/verify-email-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, code: verificationCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '인증 코드가 올바르지 않습니다.');
        setVerifyingCode(false);
        return;
      }

      setEmailVerified(true);
      setStep('reset');
      setVerifyingCode(false);
    } catch (err) {
      console.error('Verify code error:', err);
      setError('인증 코드 확인 중 오류가 발생했습니다.');
      setVerifyingCode(false);
    }
  };

  // 비밀번호 재설정
  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 4) {
      setError('비밀번호는 최소 4자 이상이어야 합니다.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const apiUrl = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';
      const response = await fetch(`${apiUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          code: verificationCode,
          new_password: newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '비밀번호 재설정에 실패했습니다.');
        setLoading(false);
        return;
      }

      // 성공 시 로그인 페이지로 이동
      navigate('/login', { state: { message: '비밀번호가 성공적으로 변경되었습니다.' } });
    } catch (err) {
      console.error('Reset password error:', err);
      setError('비밀번호 재설정 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white">
      <div className="w-full max-w-[390px] flex flex-col items-center mx-auto py-6" style={{ minHeight: '100vh' }}>
        {/* 상단 여백 */}
        <div style={{ flex: '0.3', minHeight: '80px' }}></div>
        
        {/* 제목 */}
        <div className={`w-full ${MAX_CONTAINER_WIDTH} text-center mb-6 mx-auto`}>
          <h1 className="text-[24px] font-bold text-[#1A1A1E] mb-2">비밀번호 찾기</h1>
          <p className="text-[13px] text-gray-500">
            {step === 'email' && '가입 시 사용한 이메일을 입력해주세요'}
            {step === 'verify' && '이메일로 발송된 인증 코드를 입력해주세요'}
            {step === 'reset' && '새로운 비밀번호를 입력해주세요'}
          </p>
        </div>
        
        {/* 입력 폼 */}
        <div className={`flex flex-col ${CONTAINER_WIDTH} items-center gap-2 mb-3 mx-auto`}>
          {/* Step 1: 이메일 입력 */}
          {step === 'email' && (
            <>
              <NeangteolInput 
                placeholder="이메일 입력" 
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSendVerificationCode();
                  }
                }}
                className={`w-full ${INPUT_HEIGHT} px-4`} 
              />
              
              {error && (
                <div className="w-full text-[12px] text-red-500 text-center mt-1">
                  {error}
                </div>
              )}
              
              <NeangteolButton 
                color="bg-[#3A3A42]" 
                textColor="text-white" 
                className={`w-full ${BUTTON_HEIGHT} rounded-xl text-[15px] mt-1 px-4`}
                onClick={handleSendVerificationCode}
                disabled={sendingCode || !email || !email.includes('@')}
              >
                {sendingCode ? '발송 중...' : '인증 코드 발송'}
              </NeangteolButton>
            </>
          )}

          {/* Step 2: 인증 코드 입력 */}
          {step === 'verify' && (
            <>
              <div className="w-full">
                <div className="text-[12px] text-gray-600 mb-2 text-center">
                  {email}로 인증 코드를 발송했습니다.
                </div>
                <div className="flex items-center gap-2 mb-1 w-full">
                  <div className="flex-1 min-w-0">
                    <NeangteolInput 
                      placeholder="인증 코드 6자리 입력" 
                      type="text"
                      value={verificationCode}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setVerificationCode(value);
                        setError('');
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && verificationCode.length === 6) {
                          handleVerifyCode();
                        }
                      }}
                      className={`w-full ${INPUT_HEIGHT} px-4`} 
                    />
                  </div>
                  <button
                    onClick={handleVerifyCode}
                    disabled={verifyingCode || verificationCode.length !== 6}
                    className="h-[44px] px-2 bg-[#FFD600] text-[#1A1A1E] rounded-lg text-[12px] font-semibold whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    style={{ minWidth: '65px' }}
                  >
                    {verifyingCode ? '확인 중...' : '인증하기'}
                  </button>
                </div>
              </div>

              {/* 개발 모드에서 인증 코드 표시 */}
              {devVerificationCode && (
                <div className="w-full bg-yellow-50 border border-yellow-200 text-yellow-800 text-[12px] px-3 py-2 rounded-lg mt-2">
                  <p className="font-bold">개발 모드 - 인증 코드: {devVerificationCode}</p>
                  <p className="text-gray-600">(실제 이메일 발송을 원하면 SMTP 설정이 필요합니다)</p>
                </div>
              )}

              {error && (
                <div className="w-full text-[12px] text-red-500 text-center mt-1">
                  {error}
                </div>
              )}

              {emailVerified && (
                <div className="w-full text-[12px] text-green-600 text-center mt-1 bg-green-50 px-3 py-2 rounded">
                  인증이 완료되었습니다.
                </div>
              )}

              <div className="w-full flex gap-2 mt-2">
                <NeangteolButton 
                  color="bg-gray-100" 
                  textColor="text-gray-600" 
                  className={`flex-1 ${BUTTON_HEIGHT} rounded-xl text-[14px] px-4`}
                  onClick={() => {
                    setStep('email');
                    setVerificationCode('');
                    setError('');
                    setEmailVerified(false);
                  }}
                >
                  이전
                </NeangteolButton>
                <NeangteolButton 
                  color="bg-[#3A3A42]" 
                  textColor="text-white" 
                  className={`flex-1 ${BUTTON_HEIGHT} rounded-xl text-[15px] px-4`}
                  onClick={() => handleSendVerificationCode()}
                  disabled={sendingCode}
                >
                  {sendingCode ? '재발송 중...' : '코드 재발송'}
                </NeangteolButton>
              </div>
            </>
          )}

          {/* Step 3: 비밀번호 재설정 */}
          {step === 'reset' && (
            <>
              <NeangteolInput 
                type="password" 
                placeholder="새 비밀번호 입력 (최소 4자)" 
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setError('');
                }}
                showPasswordToggle={true}
                className={`w-full ${INPUT_HEIGHT} px-4`} 
              />
              <NeangteolInput 
                type="password" 
                placeholder="새 비밀번호 확인" 
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError('');
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleResetPassword();
                  }
                }}
                showPasswordToggle={true}
                className={`w-full ${INPUT_HEIGHT} px-4`} 
              />
              
              {error && (
                <div className="w-full text-[12px] text-red-500 text-center mt-1">
                  {error}
                </div>
              )}
              
              <div className="w-full flex gap-2 mt-2">
                <NeangteolButton 
                  color="bg-gray-100" 
                  textColor="text-gray-600" 
                  className={`flex-1 ${BUTTON_HEIGHT} rounded-xl text-[14px] px-4`}
                  onClick={() => {
                    setStep('verify');
                    setNewPassword('');
                    setConfirmPassword('');
                    setError('');
                  }}
                >
                  이전
                </NeangteolButton>
                <NeangteolButton 
                  color="bg-[#3A3A42]" 
                  textColor="text-white" 
                  className={`flex-1 ${BUTTON_HEIGHT} rounded-xl text-[15px] px-4`}
                  onClick={handleResetPassword}
                  disabled={loading || !newPassword || !confirmPassword}
                >
                  {loading ? '처리 중...' : '비밀번호 변경'}
                </NeangteolButton>
              </div>
            </>
          )}
        </div>
        
        {/* 하단 링크 */}
        <div className={`w-full ${MAX_CONTAINER_WIDTH} text-center text-[12px] text-[#3A3A42] mb-4 leading-tight mx-auto mt-4`}>
          <span className="underline cursor-pointer" onClick={() => navigate('/login')}>로그인으로 돌아가기</span>
        </div>
        
        {/* 하단 여백 */}
        <div style={{ flex: '0.2', minHeight: '20px' }}></div>
      </div>
    </div>
  );
};

export default ResetPassword;

