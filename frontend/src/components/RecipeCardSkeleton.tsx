import * as React from 'react';
import LoadingIndicator from './LoadingIndicator';

interface RecipeCardSkeletonProps {
  count?: number;
  /**
   * 위쪽 점 3개(`LoadingIndicator`)를 숨긴다.
   *
   * 냉장고요리는 화면 가운데에 떠 있는 로딩 표시를 따로 쓴다. 거기서 점까지
   * 같이 돌면 **기다림을 알리는 것이 두 개**가 되어 산만하다.
   */
  hideIndicator?: boolean;
}

const Line: React.FC<{ w: string; h?: number; r?: number }> = ({ w, h = 12, r = 6 }) => (
  <div className="skeleton-block" style={{ width: w, height: h, borderRadius: r }} />
);

/**
 * 카드 **한 장**짜리 뼈대.
 *
 * 어디에 쓰나 — 목록 전체를 기다릴 때뿐 아니라 **카드 하나가 아직 안 그려질
 * 때**도 쓴다. `RecipeCard` 는 썸네일이 실제로 열리는지 미리 확인하는 동안
 * 아무것도 그리지 않았는데, 가로 캐러셀은 칸 크기가 고정이라 그 자리가
 * **통째로 하얗게** 남았다 (실측: 스크롤 직후 300px 칸 4개가 비어 있다가
 * 2.5초에 걸쳐 채워졌다). 빈 자리보다 뼈대가 낫다 — 무언가 오고 있다는 것을
 * 알리고, 채워질 때 자리가 흔들리지 않는다.
 */
export const RecipeCardSkeletonItem: React.FC<{
  /** 가로 캐러셀처럼 칸 높이가 정해진 곳에서 그 높이를 채운다. */
  height?: number;
  style?: React.CSSProperties;
}> = ({ height, style }) => (
  <div
    aria-hidden
    style={{
      maxWidth: height ? undefined : 400,
      width: '100%',
      height,
      boxSizing: 'border-box',
      margin: height ? 0 : '0 auto 16px',
      overflow: 'hidden',
      ...style,
    }}
  >
    {/* 썸네일. 가로 카드는 칸 높이의 절반쯤이 사진 자리다. */}
    <div
      className="skeleton-block"
      style={{
        width: '100%',
        height: height ? Math.round(height * 0.52) : 120,
        borderRadius: 12,
        marginBottom: 12,
      }}
    />
    {/* 제목 */}
    <Line w="82%" h={16} />
    <div style={{ height: 8 }} />
    {/* 좋아요/댓글 */}
    <Line w="40%" h={12} />
    <div style={{ height: 10 }} />
    {/* 재료 pill */}
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      {[54, 46, 62, 50, 44].map((w, j) => (
        <div key={j} className="skeleton-block" style={{ width: w, height: 26, borderRadius: 9999 }} />
      ))}
    </div>
  </div>
);

/**
 * 목록 로딩 중 보여주는 뼈대.
 *
 * 예전에는 화면 한가운데 점 3개 스피너만 떠서, 무엇이 로딩 중인지 알 수 없고
 * 로딩이 끝나는 순간 화면이 통째로 바뀌어 이동이 크게 느껴졌다.
 * 실제 카드와 같은 모양으로 자리를 미리 잡아두면 체감 대기시간이 줄고
 * 내용이 채워질 때 레이아웃이 흔들리지 않는다.
 */
const RecipeCardSkeleton: React.FC<RecipeCardSkeletonProps> = ({ count = 4, hideIndicator }) => (
  <div className="flex flex-col gap-2">
    {!hideIndicator && <LoadingIndicator />}
    {Array.from({ length: count }).map((_, i) => (
      <RecipeCardSkeletonItem key={i} />
    ))}
  </div>
);

export default RecipeCardSkeleton;
