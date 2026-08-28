import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import myfridgeBlack from '../assets/navigator_myfridge_black.png';
import myfridgeWhite from '../assets/navigator_myfridge_white.png';
import recipeWhite from '../assets/navigator_myfridgerecipe_white.png';
import recipeBlack from '../assets/navigator_myfridgerecipe_black.png';
import popularityWhite from '../assets/navigator_popularity_white.png';
import popularityBlack from '../assets/navigator_popularity_black.png';
import mypageWhite from '../assets/navigator_mypage_white.png';
import mypageBlack from '../assets/navigator_mypage_black.png';

// 요리 캘린더는 PNG 아이콘 세트가 없어 인라인 SVG로 그린다. 다른 탭들은
// 활성/비활성이 "같은 모양, 채움이냐 선이냐"만 다른데, 처음 만든 버전은
// 활성 쪽에 격자 눈금까지 그려 넣어 모양 자체가 달라 보였다 — 같은 모양(둥근
// 사각 + 위쪽 손잡이 2개)을 그대로 두고 채움/선만 바꾸도록 정리.
const CalendarNavIcon: React.FC<{ active: boolean }> = ({ active }) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill={active ? '#1A1A1E' : 'none'}
    stroke={active ? 'none' : '#9A9AA2'}
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <rect x="3.5" y="5" width="17" height="15" rx="2.2" />
    <path d="M8 3v3.4M16 3v3.4" />
  </svg>
);

// 네비게이션 데이터
const NAVIGATION_ITEMS = [
  {
    key: 'myfridge',
    label: '내냉장고',
    icon: myfridgeBlack,
    iconInactive: myfridgeWhite,
    path: '/my-fridge'
  },
  {
    key: 'recipe',
    label: '냉장고요리',
    icon: recipeBlack,
    iconInactive: recipeWhite,
    path: '/recipe-list'
  },
  {
    key: 'popularity',
    label: '요즘인기',
    icon: popularityBlack,
    iconInactive: popularityWhite,
    path: '/popular'
  },
  {
    key: 'cooking-calendar',
    label: '요리 캘린더',
    renderIcon: (active: boolean) => <CalendarNavIcon active={active} />,
    path: '/cooking-calendar'
  },
  {
    key: 'mypage',
    label: '마이페이지',
    icon: mypageBlack,
    iconInactive: mypageWhite,
    path: '/my-page'
  },
] as const;

interface BottomNavBarProps {
  activeTab: string;
}

/**
 * 하단 네비게이션.
 *
 * 정리 전 상태:
 *  - 실제로 쓰이지 않는 `STYLES` 상수 객체와 `CONSTANTS`(rem 단위 오해: NAV_HEIGHT 16rem)가
 *    남아 있어 값을 고치려 할 때 어디를 봐야 하는지 알 수 없었음
 *  - 상단 구분선을 nav 에 붙이지 않고 별도 `<div>` 를 절대배치해 그렸는데,
 *    그 div 만 z-index 30 이라 다른 요소에 가려질 수 있었음
 *  - iPhone 홈 인디케이터 영역(safe-area) 대응이 없어 하단이 가려졌음
 */
const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeTab }) => {
  const navigate = useNavigate();

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 64,
        paddingBottom: 'env(safe-area-inset-bottom)',
        boxSizing: 'content-box',
        background: 'var(--surface)',
        borderTop: '1px solid var(--line-200)',
        display: 'flex',
        alignItems: 'stretch',
        zIndex: 'var(--z-nav)',
      }}
    >
      {NAVIGATION_ITEMS.map((nav) => {
        const isActive = activeTab === nav.key;
        return (
          <button
            key={nav.key}
            onClick={() => navigate(nav.path)}
            onMouseDown={(e) => e.preventDefault()}
            aria-current={isActive ? 'page' : undefined}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {'renderIcon' in nav ? (
              nav.renderIcon(isActive)
            ) : (
              <img
                src={isActive ? nav.icon : nav.iconInactive}
                alt=""
                aria-hidden
                style={{ height: 22, width: 'auto', display: 'block' }}
              />
            )}
            <span
              style={{
                fontSize: 12,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--ink-900)' : 'var(--ink-400)',
                letterSpacing: '-0.2px',
                lineHeight: 1,
              }}
            >
              {nav.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNavBar;
