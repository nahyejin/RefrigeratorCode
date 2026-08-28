import * as React from 'react';

interface PullToRefreshProps {
  /** 당겨서 새로고침 시 호출. 끝날 때까지 스피너를 계속 보여준다. */
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
}

const PULL_THRESHOLD = 64; // 이 이상 당기면 손을 떼는 순간 새로고침
const MAX_PULL = 88;
const RESISTANCE = 0.5; // 당긴 거리보다 실제로는 덜 움직이게(고무줄 느낌)

/**
 * 인스타그램류 앱처럼 "화면을 아래로 당기면 새로고침"하는 제스처.
 *
 * 브라우저 기본 당겨서 새로고침(overscroll-behavior)은 index.css에서 앱
 * 전체에 꺼 뒀다 — 그건 페이지를 통째로 하드 리로드시켜서 SPA 상태(로그인,
 * 스크롤 위치, 입력 중이던 값)가 다 날아가기 때문이다. 대신 이 컴포넌트는
 * 터치 제스처만 감지해서 지정된 콜백(데이터 재조회)만 다시 실행한다 —
 * 페이지 자체는 그대로 유지된다.
 *
 * 다른 그룹원의 행동으로 화면 내용이 바뀔 수 있는 화면(요리 캘린더,
 * 마이페이지)에만 적용한다 — 내 냉장고/냉장고요리처럼 내가 직접 바꾼
 * 것만 반영되면 되는 화면은 이미 즉시 반영되고 있어 필요성이 낮다.
 */
const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children }) => {
  const [pullDistance, setPullDistance] = React.useState(0);
  const [refreshing, setRefreshing] = React.useState(false);
  const startYRef = React.useRef<number | null>(null);
  const pullingRef = React.useRef(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  // touchend 시점에 "지금 얼마나 당겨져 있었는지" 읽어야 하는데, setState의
  // 함수형 업데이터(setPullDistance(current => ...)) 안에서 곧바로
  // setRefreshing을 또 호출했더니 "Cannot update a component while
  // rendering a different component" 경고가 났다 — 실제 기기 테스트로
  // 재현해서 잡은 문제. state 두 개를 이렇게 체이닝하는 대신, 최신 값을
  // ref에도 미러링해 두고 touchend에서는 ref만 읽어 판단한다.
  const pullDistanceRef = React.useRef(0);

  const updatePullDistance = React.useCallback((value: number) => {
    pullDistanceRef.current = value;
    setPullDistance(value);
  }, []);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (refreshing) return;
      // 페이지가 맨 위로 스크롤돼 있을 때만 당기기 시작 — 그 외엔 평범한
      // 스크롤로 취급해야, 목록 중간을 스크롤할 때 이 제스처와 충돌하지 않는다.
      if (window.scrollY <= 0) {
        startYRef.current = e.touches[0].clientY;
        pullingRef.current = false;
      } else {
        startYRef.current = null;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null || refreshing) return;
      const diff = e.touches[0].clientY - startYRef.current;
      if (diff <= 0) {
        // 위로 움직이면(당기기 취소) 그냥 평범한 스크롤로 넘긴다
        updatePullDistance(0);
        pullingRef.current = false;
        return;
      }
      if (window.scrollY > 0) return;
      pullingRef.current = true;
      // 브라우저의 기본 바운스 스크롤이 같이 일어나면 화면이 덜컹거리므로 막는다
      e.preventDefault();
      updatePullDistance(Math.min(diff * RESISTANCE, MAX_PULL));
    };

    const handleTouchEnd = () => {
      if (!pullingRef.current) {
        startYRef.current = null;
        return;
      }
      pullingRef.current = false;
      startYRef.current = null;
      if (pullDistanceRef.current >= PULL_THRESHOLD) {
        updatePullDistance(PULL_THRESHOLD);
        setRefreshing(true);
        Promise.resolve(onRefresh()).finally(() => {
          setRefreshing(false);
          updatePullDistance(0);
        });
      } else {
        updatePullDistance(0);
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshing]);

  const indicatorOpacity = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const shouldSpin = refreshing || pullDistance >= PULL_THRESHOLD;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -44,
          left: 0,
          right: 0,
          height: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `translateY(${pullDistance}px)`,
          opacity: indicatorOpacity,
          pointerEvents: 'none',
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--ink-500)"
          strokeWidth="2.2"
          strokeLinecap="round"
          style={{
            transform: shouldSpin ? undefined : `rotate(${pullDistance * 2.5}deg)`,
            animation: shouldSpin ? 'pull-refresh-spin 0.7s linear infinite' : undefined,
          }}
        >
          <path d="M20 12a8 8 0 1 1-2.34-5.66" />
          <path d="M20 4v5h-5" />
        </svg>
      </div>
      <style>{`
        @keyframes pull-refresh-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: pullingRef.current ? 'none' : 'transform 0.25s ease',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
