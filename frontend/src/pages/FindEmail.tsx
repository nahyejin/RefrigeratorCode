import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NeangteolInput from '../components/NeangteolInput';
import NeangteolButton from '../components/NeangteolButton';

const INPUT_HEIGHT = 'h-[44px]';
const BUTTON_HEIGHT = 'h-[44px]';
const CONTAINER_WIDTH = 'w-[260px]';
const MAX_CONTAINER_WIDTH = 'max-w-[320px]';

const FindEmail: React.FC = () => {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [foundEmail, setFoundEmail] = useState('');

  const handleFindEmail = async () => {
    if (!nickname || nickname.trim() === '') {
      setError('닉네임을 입력해주세요.');
      return;
    }

    setError('');
    setLoading(true);
    setFoundEmail('');

    try {
      const apiUrl = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';
      const response = await fetch(`${apiUrl}/api/auth/find-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nickname }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '이메일 찾기에 실패했습니다.');
        setLoading(false);
        return;
      }

      setFoundEmail(data.email);
      setLoading(false);
    } catch (err) {
      console.error('Find email error:', err);
      setError('이메일 찾기 중 오류가 발생했습니다.');
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
          <h1 className="text-[24px] font-bold text-[#1A1A1E] mb-2">이메일 찾기</h1>
          <p className="text-[13px] text-gray-500">가입 시 사용한 닉네임을 입력해주세요</p>
        </div>
        
        {/* 입력 폼 */}
        <div className={`flex flex-col ${CONTAINER_WIDTH} items-center gap-2 mb-3 mx-auto`}>
          <NeangteolInput 
            placeholder="닉네임 입력" 
            type="text"
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              setError('');
              setFoundEmail('');
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleFindEmail();
              }
            }}
            className={`w-full ${INPUT_HEIGHT} px-4`} 
          />
          
          {/* 에러 메시지 */}
          {error && (
            <div className="w-full text-[12px] text-red-500 text-center mt-1">
              {error}
            </div>
          )}
          
          {/* 찾은 이메일 표시 */}
          {foundEmail && (
            <div className="w-full text-[14px] text-center mt-2 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-gray-700 mb-1">등록된 이메일</p>
              <p className="text-[16px] font-semibold text-green-700">{foundEmail}</p>
            </div>
          )}
          
          <NeangteolButton 
            color="bg-[#3A3A42]" 
            textColor="text-white" 
            className={`w-full ${BUTTON_HEIGHT} rounded-xl text-[15px] mt-1 px-4`}
            onClick={handleFindEmail}
            disabled={loading}
          >
            {loading ? '찾는 중...' : '이메일 찾기'}
          </NeangteolButton>
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

export default FindEmail;

