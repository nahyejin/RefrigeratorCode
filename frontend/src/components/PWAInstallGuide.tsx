import React from 'react';

const PWAInstallGuide: React.FC = () => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  const isChrome = /Chrome/.test(navigator.userAgent);
  const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

  const getInstallInstructions = () => {
    if (isIOS) {
      return {
        title: 'iOS에서 설치하기',
        steps: [
          'Safari 브라우저에서 쿡매치를 열어주세요',
          '하단의 공유 버튼(□↑)을 탭하세요',
          '"홈 화면에 추가"를 선택하세요',
          '"추가"를 탭하여 설치를 완료하세요'
        ],
        icon: '📱'
      };
    } else if (isAndroid) {
      return {
        title: 'Android에서 설치하기',
        steps: [
          'Chrome 브라우저에서 쿡매치를 열어주세요',
          '주소창 옆의 설치 아이콘(⬇️)을 탭하세요',
          '"설치"를 선택하세요',
          '설치가 완료되면 홈화면에서 앱을 실행하세요'
        ],
        icon: '🤖'
      };
    } else if (isChrome) {
      return {
        title: 'Chrome에서 설치하기',
        steps: [
          'Chrome 브라우저에서 쿡매치를 열어주세요',
          '주소창 옆의 설치 아이콘(⬇️)을 클릭하세요',
          '"설치"를 클릭하세요',
          '설치가 완료되면 데스크톱에서 앱을 실행하세요'
        ],
        icon: '🖥️'
      };
    } else if (isSafari) {
      return {
        title: 'Safari에서 설치하기',
        steps: [
          'Safari 브라우저에서 쿡매치를 열어주세요',
          '메뉴바에서 "파일" → "홈 화면에 추가"를 선택하세요',
          '이름을 확인하고 "추가"를 클릭하세요',
          '설치가 완료되면 홈화면에서 앱을 실행하세요'
        ],
        icon: '🍎'
      };
    } else {
      return {
        title: '일반적인 설치 방법',
        steps: [
          '브라우저 메뉴에서 "홈 화면에 추가" 또는 "앱 설치"를 찾으세요',
          '설치 옵션을 선택하세요',
          '설치가 완료되면 홈화면에서 앱을 실행하세요'
        ],
        icon: '🌐'
      };
    }
  };

  const instructions = getInstallInstructions();

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 py-8 px-4">
      <div className="max-w-lg mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-yellow-400 to-orange-400 p-6 text-center">
          <div className="text-4xl mb-2">{instructions.icon}</div>
          <h1 className="text-2xl font-bold text-white mb-2">
            쿡매치 앱 설치하기
          </h1>
          <p className="text-yellow-100">
            홈화면에 추가하여 더 빠르게 접근하세요
          </p>
        </div>

        {/* 설치 단계 */}
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            {instructions.title}
          </h2>
          
          <div className="space-y-4">
            {instructions.steps.map((step, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-yellow-400 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  {index + 1}
                </div>
                <p className="text-gray-700 leading-relaxed">{step}</p>
              </div>
            ))}
          </div>

          {/* 혜택 설명 */}
          <div className="mt-8 p-4 bg-yellow-50 rounded-lg">
            <h3 className="font-semibold text-yellow-800 mb-3">
              🎉 앱 설치 후 혜택
            </h3>
            <ul className="text-sm text-yellow-700 space-y-2">
              <li>• 홈화면에서 바로 접근 가능</li>
              <li>• 브라우저 없이 독립적으로 실행</li>
              <li>• 오프라인에서도 기본 기능 사용</li>
              <li>• 더 빠른 로딩 속도</li>
              <li>• 푸시 알림으로 새로운 레시피 알림</li>
            </ul>
          </div>

          {/* 문제 해결 */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-3">
              🔧 설치가 안 되나요?
            </h3>
            <div className="text-sm text-gray-600 space-y-2">
              <p>• 브라우저를 최신 버전으로 업데이트해보세요</p>
              <p>• HTTPS 연결이 필요합니다</p>
              <p>• 브라우저 설정에서 팝업을 허용해주세요</p>
              <p>• 다른 브라우저로 시도해보세요</p>
            </div>
          </div>

          {/* 앱 정보 */}
          <div className="mt-6 flex items-center space-x-4 p-4 bg-white border border-gray-200 rounded-lg">
            <img 
              src="/src/assets/cookmatch_icon.png" 
              alt="쿡매치" 
              className="w-16 h-16 rounded-lg"
            />
            <div>
              <h4 className="font-semibold text-gray-800">쿡매치</h4>
              <p className="text-sm text-gray-600">냉장고 재료로 맛있는 요리</p>
              <p className="text-xs text-gray-500">버전 1.0.0</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallGuide; 