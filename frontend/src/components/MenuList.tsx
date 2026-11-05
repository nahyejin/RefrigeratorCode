import * as React from 'react';
import { Link } from 'react-router-dom';
import GroupTitle from './ui/GroupTitle';

/**
 * 마이페이지의 **메뉴 묶음** — 제목 + 흰 박스 안에 `아이콘 · 글자 · ›` 줄이 쌓인다.
 *
 * 왜 만들었나(2026-11-06, 당근마켓 「나의 당근」 참고):
 *   사용 가이드·문의·방침·약관·정보 수정·탈퇴가 화면 곳곳에 모양이 다른 버튼·링크로
 *   흩어져 있었다(회색 칸 속 작은 글자 링크, 정보 수정 팝업 안쪽 탈퇴 버튼…).
 *   같은 종류(눌러서 다른 곳으로 가는 줄)는 같은 모양이어야 찾기 쉽다.
 *
 * 줄 사이 선은 테두리가 아니라 `gap: 1` + 바탕색이다 — 줄마다 `border-top` 을 주면 첫
 * 줄이 박스 테두리와 겹쳐 두 겹이 된다.
 */
export const MenuGroup: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <>
    <GroupTitle style={{ margin: '18px 14px 6px' }}>{title}</GroupTitle>
    <div
      style={{
        margin: '0 14px', display: 'flex', flexDirection: 'column', gap: 1,
        background: 'var(--line-200)', border: '1px solid var(--line-200)',
        borderRadius: 14, overflow: 'hidden',
      }}
    >
      {children}
    </div>
  </>
);

type RowProps = {
  icon: React.ReactNode;
  label: string;
  /** 조심스러운 줄(회원 탈퇴) — 글자를 흐리게. */
  muted?: boolean;
  /** 앱 안 경로 */
  to?: string;
  /** 바깥 주소(새 창) */
  href?: string;
  onClick?: () => void;
};

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, width: '100%', boxSizing: 'border-box',
  minHeight: 52, padding: '0 16px', background: 'var(--surface)', border: 'none',
  // 전역 `button { border-radius: 8px }` 가 줄 모서리를 둥글게 만들지 않게.
  borderRadius: 0, fontFamily: 'inherit', fontSize: 15, textAlign: 'left',
  textDecoration: 'none', cursor: 'pointer',
};

export const MenuRow: React.FC<RowProps> = ({ icon, label, muted, to, href, onClick }) => {
  const style: React.CSSProperties = { ...rowStyle, color: muted ? 'var(--ink-500)' : 'var(--ink-900)' };
  const inner = (
    <>
      <span aria-hidden style={{ flexShrink: 0, display: 'inline-flex', color: 'var(--ink-700)' }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
      <svg aria-hidden width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--line-300)"
           strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M9 6l6 6-6 6" />
      </svg>
    </>
  );
  if (to) return <Link to={to} style={style}>{inner}</Link>;
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" style={style}>{inner}</a>;
  return <button type="button" onClick={onClick} style={style}>{inner}</button>;
};

const Ico: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
       strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

/** 줄 아이콘 모음 — 선 모양 하나로 통일. */
export const MenuIcons = {
  guide: <Ico><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 115 0c0 1.7-2.5 2-2.5 3.5" /><path d="M12 17h.01" /></Ico>,
  instagram: <Ico><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="0.6" /></Ico>,
  file: <Ico><path d="M7 3.5h7l4 4V20.5H7z" /><path d="M14 3.5v4h4" /></Ico>,
  admin: <Ico><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" /></Ico>,
};
