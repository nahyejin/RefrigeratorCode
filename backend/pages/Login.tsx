import React from 'react';

const Login = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f4f0e6]">
      {/* Logo */}
      <div className="flex flex-col items-center mb-10">
        {/* 냉장고 이모지/임시 아이콘 */}
        <div className="text-4xl mb-2">🧊</div>
        <div className="text-6xl font-extrabold tracking-tight">냉털이</div>
        <div className="text-lg tracking-widest mt-2 text-gray-600">JUST DO EAT</div>
      </div>

      {/* Login Form */}
      <form className="flex flex-col items-center w-full max-w-xs">
        <input
          type="text"
          placeholder="아이디 또는 이메일"
          className="mb-2 w-80 h-12 rounded-lg px-4 bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#3c3c3c]"
        />
        <input
          type="password"
          placeholder="비밀번호"
          className="mb-2 w-80 h-12 rounded-lg px-4 bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#3c3c3c]"
        />
        <button
          type="submit"
          className="w-80 h-12 rounded-lg bg-[#3c3c3c] text-white font-bold text-lg mb-2 mt-1 hover:bg-[#222] transition"
        >
          로그인
        </button>
        {/* 체크박스 */}
        <div className="flex w-80 justify-start gap-6 mb-2 text-sm text-gray-700">
          <label className="flex items-center gap-1">
            <input type="checkbox" className="accent-[#3c3c3c]" /> 아이디 저장
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" className="accent-[#3c3c3c]" /> 자동 로그인
          </label>
        </div>
        {/* 하단 링크 */}
        <div className="w-80 text-center text-sm text-gray-700 mb-6">
          아직 회원이 아니신가요? <span className="underline cursor-pointer font-semibold">3초 회원가입하기</span><br />
          <span className="underline cursor-pointer">아이디 찾기</span>  |  <span className="underline cursor-pointer">비밀번호 찾기</span>
        </div>
      </form>

      {/* Divider */}
      <div className="flex items-center w-80 mb-4">
        <div className="flex-1 h-px bg-gray-300" />
        <span className="mx-2 text-gray-400 text-sm">또는</span>
        <div className="flex-1 h-px bg-gray-300" />
      </div>

      {/* Social Login Buttons */}
      <div className="flex flex-col gap-3 w-80 mb-4">
        <button className="flex items-center justify-center w-full h-12 rounded-lg bg-white border border-gray-300 text-gray-800 font-semibold text-base gap-2 hover:bg-gray-50 transition">
          <span className="text-xl">🌐</span> Google로 시작하기
        </button>
        <button className="flex items-center justify-center w-full h-12 rounded-lg bg-[#ffe812] text-gray-900 font-semibold text-base gap-2 hover:bg-yellow-200 transition">
          <span className="text-xl">💬</span> Kakao로 시작하기
        </button>
        <button className="flex items-center justify-center w-full h-12 rounded-lg bg-[#1ec800] text-white font-semibold text-base gap-2 hover:bg-green-500 transition">
          <span className="text-xl">🟢</span> Naver로 시작하기
        </button>
      </div>

      {/* Guest Login */}
      <button className="w-80 h-12 rounded-lg border border-gray-300 bg-white text-gray-800 font-semibold text-base hover:bg-gray-50 transition">
        비회원으로 계속하기
      </button>
    </div>
  );
};

export default Login; 