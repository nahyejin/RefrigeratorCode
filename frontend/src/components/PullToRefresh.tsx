import * as React from 'react';

interface PullToRefreshProps {
  /** 당겨서 새로고침 시 호출. 끝날 때까지 스피너를 계속 보여준다. */
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  /** 바깥 틀에 더할 스타일 — 마이페이지처럼 내용이 화면보다 짧을 때 남는 높이를 채우게 할 때 쓴다 */
  style?: React.CSSProperties;
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
const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children, style }) => {
  const [pullDistance, setPullDistance] = React.useState(0);
  const [refreshing, setRefreshing] = React.useState(false);
  /**
   * 새로고침이 **끝났다**는 것을 잠깐 보여 주는 상태.
   *
   * 없으면 다 되고 나서 표시가 그냥 사라진다. 요청이 빨라서 화살표가 한 바퀴
   * 돌기도 전에 끝나면 **아무 일도 안 일어난 것처럼 보인다** — 실제로
   * "새로고침이 되는 건지 아닌 건지 모르겠다" 는 말을 들었다.
   */
  const [justDone, setJustDone] = React.useState(false);
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
        const startedAt = Date.now();
        Promise.resolve(onRefresh()).finally(() => {
          // 최소 500ms 는 "새로고침 중" 을 보여 준다. 요청이 100ms 만에 끝나면
          // 사람 눈에는 아무 일도 안 일어난 것과 같다.
          const wait = Math.max(0, 500 - (Date.now() - startedAt));
          setTimeout(() => {
            setRefreshing(false);
            setJustDone(true);
            updatePullDistance(0);
            // 완료 표시는 잠깐만. 계속 남아 있으면 그것대로 거슬린다.
            setTimeout(() => setJustDone(false), 350);
          }, wait);
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

  /**
   * 표시와 내용이 **같이** 내려가 있어야 하는 거리.
   *
   * 전에는 표시는 `justDone ? PULL_THRESHOLD : pullDistance` 로, 내용은
   * `pullDistance` 로 따로 계산했다. 새로고침이 끝나는 순간 `pullDistance` 가
   * 0 이 되면서 **내용만 제자리로 올라오고** 표시는 64px 아래에 그대로 남아,
   * "새로고침 완료" 글자가 화면 위에 겹쳐 깔렸다. 하나로 묶으면 어긋날 수 없다.
   */
  const offset = justDone ? PULL_THRESHOLD : pullDistance;
  /**
   * 표시는 앱 공통 로딩과 같은 **노란 점 3개**(`.loading-dots`)다.
   *
   * 전에는 회전 화살표 + 「당겨서 새로고침 / 새로고침 중... / 새로고침 완료」 글자였는데,
   * 앱의 다른 로딩(점 3개)과 따로 놀고 안 예쁘다는 지적(2026-10-04)으로 바꿨다.
   *  - 당기는 중: 당긴 만큼 점이 왼쪽부터 하나씩 차오른다 → 다 차면 놓으면 된다는 뜻
   *  - 새로고침 중: 다른 화면 로딩과 똑같이 튄다
   *  - 끝: 점이 멈춘 채 흐려지며 내용이 제자리로 올라온다(끝났다는 신호는 이 움직임으로)
   */
  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const indicatorOpacity = justDone ? 0 : refreshing ? 1 : Math.min(progress * 1.6, 1);

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -48,
          left: 0,
          right: 0,
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `translateY(${offset}px)`,
          opacity: indicatorOpacity,
          transition: justDone ? 'opacity .25s ease' : undefined,
          pointerEvents: 'none',
        }}
      >
        <span className={refreshing ? 'loading-dots' : 'loading-dots is-static'}>
          {[0, 1, 2].map(i => {
            // 점 i 는 당긴 거리의 (i/3 ~ (i+1)/3) 구간에서 차오른다
            const fill = refreshing || justDone ? 1 : Math.max(0, Math.min(1, progress * 3 - i));
            return (
              <span
                key={i}
                style={refreshing ? undefined : { opacity: 0.25 + 0.75 * fill, transform: `scale(${0.6 + 0.4 * fill})` }}
              />
            );
          })}
        </span>
      </div>
      <div
        style={{
          transform: `translateY(${offset}px)`,
          transition: pullingRef.current ? 'none' : 'transform 0.25s ease',
          // 바깥 틀이 세로로 늘어나게(style 에 flex) 받았으면 안쪽도 같이 늘어나 자식이 남는 높이를 쓸 수 있게 한다
          ...(style?.display === 'flex' ? { flex: 1, display: 'flex', flexDirection: 'column' as const } : {}),
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
