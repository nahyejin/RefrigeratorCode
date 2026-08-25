import * as React from 'react';

interface RecipeCardSkeletonProps {
  count?: number;
}

const Line: React.FC<{ w: string; h?: number; r?: number }> = ({ w, h = 12, r = 6 }) => (
  <div className="skeleton-block" style={{ width: w, height: h, borderRadius: r }} />
);

/**
 * 목록 로딩 중 보여주는 뼈대.
 *
 * 예전에는 화면 한가운데 점 3개 스피너만 떠서, 무엇이 로딩 중인지 알 수 없고
 * 로딩이 끝나는 순간 화면이 통째로 바뀌어 이동이 크게 느껴졌다.
 * 실제 카드와 같은 모양으로 자리를 미리 잡아두면 체감 대기시간이 줄고
 * 내용이 채워질 때 레이아웃이 흔들리지 않는다.
 */
const RecipeCardSkeleton: React.FC<RecipeCardSkeletonProps> = ({ count = 4 }) => (
  <div className="flex flex-col gap-2" aria-hidden>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        style={{
          maxWidth: 400,
          width: '100%',
          margin: '0 auto 16px',
        }}
      >
        {/* 썸네일 */}
        <div className="skeleton-block" style={{ width: '100%', height: 120, borderRadius: 12, marginBottom: 12 }} />
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
    ))}
  </div>
);

export default RecipeCardSkeleton;
