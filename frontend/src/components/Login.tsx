import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement login logic
    console.log('Login attempt with:', { email, password });
  };

  const handleGuestLogin = () => {
    // TODO: Implement guest login logic
    console.log('Guest login');
    navigate('/main'); // 메인 페이지로 이동
  };

  return (
    <div className="app-container">
      {/* 상단 로고 영역 */}
      <div className="logo-section">
        <div className="logo">🧊</div>
        <h1 className="app-title">냉털이</h1>
        <p className="app-subtitle">JUST DO EAT</p>
      </div>

      {/* 로그인 폼 */}
      <form onSubmit={handleSubmit} className="login-form">
        <input
          type="text"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="아이디 또는 이메일"
          className="app-input"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          className="app-input"
        />
        <button type="submit" className="app-button">
          로그인
        </button>
      </form>

      {/* 체크박스 영역 */}
      <div className="checkbox-section">
        <label className="checkbox-label">
          <input type="checkbox" className="app-checkbox" /> 아이디 저장
        </label>
        <label className="checkbox-label">
          <input type="checkbox" className="app-checkbox" /> 자동 로그인
        </label>
      </div>

      {/* 하단 링크 */}
      <div className="bottom-links">
        <p>아직 회원이 아니신가요? <span className="link">3초 회원가입하기</span></p>
        <div className="find-links">
          <span className="link">아이디 찾기</span> | <span className="link">비밀번호 찾기</span>
        </div>
      </div>

      {/* 소셜 로그인 */}
      <div className="social-login">
        <div className="divider">
          <span>또는</span>
        </div>
        <button className="social-button google">
          <span className="icon">🌐</span> Google로 시작하기
        </button>
        <button className="social-button kakao">
          <span className="icon">💬</span> Kakao로 시작하기
        </button>
        <button className="social-button naver">
          <span className="icon">🟢</span> Naver로 시작하기
        </button>
      </div>

      {/* 비회원 로그인 */}
      <button className="guest-button" onClick={handleGuestLogin}>
        비회원으로 계속하기
      </button>
    </div>
  );
};

export default Login; 