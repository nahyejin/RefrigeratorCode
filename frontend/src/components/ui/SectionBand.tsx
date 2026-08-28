import * as React from 'react';

interface SectionBandProps {
  /** 좌우 여백을 뚫고 화면 끝까지 늘일 값(px). 부모의 좌우 padding 과 같게 준다 */
  bleed?: number;
  /** 위/아래 간격(px) */
  gap?: number;
  /**
   * true면 굵은 면 대신 얇은 1px 선으로 그린다.
   * 완전히 다른 주제로 넘어갈 때(예: 계정/그룹 설정 → 레시피 목록)는 기본값
   * (굵은 면)을 쓰고, 같은 주제 안에서 하위 목록만 나뉠 때(예: 즐겨찾기 →
   * 기록 → 완료, 셋 다 "내 레시피 활용 내역"이라는 하나의 이야기)는 subtle을
   * 써서 서로 무관한 영역처럼 보이지 않게 한다 — 굵은 면을 셋 사이에 반복해서
   * 쓰다 보니 "완전히 별개의 영역"처럼 읽힌다는 지적을 받았다.
   */
  subtle?: boolean;
}

/**
 * 섹션과 섹션 사이의 구분 밴드.
 *
 * 왜 선이 아니라 면인가:
 *   섹션을 여백 32px 로만 띄워 놨더니 "어디서 한 덩어리가 끝나고 다음이 시작되는지"
 *   가 읽히지 않았다. 화면이 전부 흰색이라 여백이 그저 빈 공간으로 보이고,
 *   가로 스크롤 목록이 이어지면 앞 섹션의 일부인지 다음 섹션인지 헷갈린다.
 *   1px 선도 시도해 볼 수 있지만, 선은 "제목과 내용 사이" 에도 쓰이던 표현이라
 *   층위가 겹친다. 옅은 회색 면을 화면 끝까지 깔면 경계가 한눈에 잡힌다.
 *   (다만 정말 같은 이야기 안의 하위 구분이면 `subtle`로 얇은 선을 쓴다 — 위 설명 참고)
 *
 * 좌우로 뚫는 이유:
 *   본문 여백 안에서만 그려지면 카드와 폭이 같아져 또 하나의 콘텐츠처럼 보인다.
 *   화면 끝까지 닿아야 "구획" 으로 읽힌다.
 */
const SectionBand: React.FC<SectionBandProps> = ({ bleed = 20, gap = 28, subtle = false }) =>
  subtle ? (
    <div
      aria-hidden
      style={{
        height: 1,
        marginLeft: -bleed,
        marginRight: -bleed,
        marginTop: gap,
        marginBottom: gap,
        background: 'var(--line-200)',
      }}
    />
  ) : (
    <div
      aria-hidden
      style={{
        height: 8,
        marginLeft: -bleed,
        marginRight: -bleed,
        marginTop: gap,
        marginBottom: gap,
        background: 'var(--surface-sub)',
        borderTop: '1px solid var(--line-200)',
        borderBottom: '1px solid var(--line-200)',
      }}
    />
  );

export default SectionBand;
