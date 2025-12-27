import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * 소셜 로그인 콜백 처리 페이지
 * 백엔드에서 리다이렉트되어 토큰을 받아 처리합니다.
 */
const AuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const processedRef = useRef(false);

  // URL 파라미터에서 값 추출 (컴포넌트 렌더링 시 한 번만)
  const token = searchParams.get('token');
  const error = searchParams.get('error');

  useEffect(() => {
    // 이미 처리했으면 중복 실행 방지
    if (processedRef.current) {
      return;
    }

    // token이나 error가 없으면 아직 처리할 수 없음
    if (!token && !error) {
      return;
    }

    processedRef.current = true;

    if (error) {
      console.error('OAuth error:', error);
      navigate('/login?error=oauth_failed');
      return;
    }

    if (token) {
      // 토큰으로 로그인 처리
      loginWithToken(token)
        .then(() => {
          navigate('/my-fridge');
        })
        .catch((err) => {
          console.error('Login failed:', err);
          navigate('/login?error=login_failed');
        });
    } else {
      // 토큰이 없으면 로그인 페이지로
      navigate('/login');
    }
  }, [token, error, navigate, loginWithToken]); // token과 error 값이 변경될 때만 실행

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="text-lg font-medium text-gray-700 mb-2">로그인 처리 중...</div>
        <div className="text-sm text-gray-500">잠시만 기다려주세요.</div>
      </div>
    </div>
  );
};

export default AuthCallback;
