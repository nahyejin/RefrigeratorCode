import React from 'react';

const Login = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">
      <h1 className="text-3xl font-bold mb-8">냉털이</h1>
      <div className="bg-white p-8 rounded-lg shadow-md w-80">
        <button className="w-full bg-blue-500 text-white py-2 px-4 rounded mb-4">
          카카오로 로그인
        </button>
        <button className="w-full bg-green-500 text-white py-2 px-4 rounded mb-4">
          네이버로 로그인
        </button>
        <button className="w-full bg-gray-500 text-white py-2 px-4 rounded">
          비회원으로 시작하기
        </button>
      </div>
    </div>
  );
};

export default Login; 