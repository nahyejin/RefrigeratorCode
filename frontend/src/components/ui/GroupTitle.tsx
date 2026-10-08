import * as React from 'react';

/**
 * 화면 안 **묶음 제목** — `크레딧 사용 현황`, `이번 달 목표` 처럼.
 *
 * 왜 필요한가(2026-10-08):
 *   한 화면에 성격이 다른 카드가 여러 장 놓이면, 전부 같은 모양의 흰 박스라
 *   어디서 무엇이 끝나고 시작되는지 읽히지 않는다. 카드를 줄이는 대신 **이름을
 *   붙인다** — 찾는 사람이 작은 글자 몇 개만 보고 바로 내려갈 수 있으면 그만큼
 *   단순해진다. 회색 구분 밴드보다 세로도 덜 먹는다.
 *
 * 작고 흐린 글자인 이유: 제목이 본문보다 눈에 띄면 내용이 아니라 목차를 읽게
 * 된다. 이 줄은 **찾을 때만 보이면** 되는 안내다.
 *
 * ⚠️ 제목만 남는 일을 만들지 말 것. 아래 내용이 조건에 따라 아예 안 그려질 수
 *    있으면(예: 알림을 지원하지 않는 기기) 제목도 같은 조건을 타야 한다 —
 *    실제로 마이페이지에서 `알림 설정` 제목만 떠 있던 일이 있었다.
 */
const GroupTitle: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({
  children, style,
}) => (
  <h2 style={{
    margin: '18px 14px 8px', fontSize: 12.5, fontWeight: 700,
    color: 'var(--ink-500)', letterSpacing: '0.02em',
    ...style,
  }}>
    {children}
  </h2>
);

export default GroupTitle;
