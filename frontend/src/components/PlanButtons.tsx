import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUsage } from './UsageMeter';

/**
 * 이번 주 식단 추천 버튼 두 개(AI / 무료).
 *
 * 처음엔 마이캘린더 맨 위에 임박 재료 카드와 함께 있었다. 마이캘린더에 얹힌 게
 * 너무 많다는 지적(2026-10-08)으로 **내냉장고의 "곧 상해요" 시트**(`ExpiryBand`)
 * 안으로 옮겼다 — "이게 곧 상해요 → 그럼 이걸로 식단을 짜요" 가 한 이야기라
 * 임박 재료와 한 묶음으로 둔다. 식단을 짜면 결과는 어차피 마이캘린더에 담긴다.
 */
const PlanButtons: React.FC<{ onBeforeGo?: () => void }> = ({ onBeforeGo }) => {
  const navigate = useNavigate();
  // 값을 손으로 적어 두면 반드시 낡는다 — 실제로 식단이 3 이 된 뒤에도
  // 여기만 `크레딧 2` 로 남아 있었다. 서버가 정한 값을 그대로 쓴다.
  const usageNow = useUsage();
  const planCost = (usageNow?.credits as any)?.plan ?? 3;
  const onGo = (withAi?: boolean) => {
    onBeforeGo?.();
    navigate(withAi ? '/plan?ai=1' : '/plan');
  };

  return (
  <div style={{ display: 'flex', gap: 8 }}>
    {/* 여기만 노란색·AI 배지·반짝임. 누르는 순간 크레딧이 나가지는 않고,
        조건을 적는 칸으로 데려간다 — 냉장고를 보기도 전에 돈이 나가면
        결과가 마음에 안 들 때 그대로 손해다. */}
    <span style={{ flex: 1, minWidth: 0, display: 'flex', position: 'relative' }}>
      <button
        type="button"
        onClick={() => onGo(true)}
        className="ai-action"
        style={{
          width: '100%', height: 74, borderRadius: 12, cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
          // `<button>` 은 기본이 가운데 정렬이다. 칸 자체는 flex-start 라
          // 왼쪽에 붙지만, 그 **안에서 두 줄이 서로 가운데로** 맞춰져
          // 짧은 줄이 들여쓴 것처럼 보였다.
          textAlign: 'left',
          justifyContent: 'center', gap: 3, padding: '0 12px',
        }}
      >
        <span style={{ fontSize: 13.5, fontWeight: 700, color: '#1A1A1E' }}>
          이번 주 AI 식단 추천
        </span>
        {/* 두 줄을 **직접 나눠** 적는다.

            전에는 한 문장을 넣고 줄바꿈을 브라우저에 맡겼다. 그러면 폭에
            따라 1줄이 됐다 2줄이 됐다 하고, 옆의 무료 버튼은 늘 1줄이라
            둘의 글자 아랫단이 어긋나 보였다. 이제 두 버튼 모두
            `무엇을 보고 / 무엇을 해 주고 얼마` 두 줄로 같은 자리에서
            끊긴다. `nowrap` 이라 폭이 좁아져도 줄 수가 안 변한다.

            내용은 그대로다 — 이 버튼과 무료 버튼의 차이는 셋이고
            (냉장고 재료는 둘 다, 내가 적은 요청과 장보기 최소화는 AI만),
            그 둘을 첫 줄과 둘째 줄에 하나씩 놓았다. */}
        <span style={{ fontSize: 11, color: 'rgba(26,26,30,0.65)', lineHeight: 1.35, whiteSpace: 'nowrap' }}>
          냉장고 재료 + 내 요청
          <br />
          장보기 최소화 · 크레딧 {planCost}
        </span>
      </button>
      <span className="ai-fab-badge">AI</span>
    </span>

    <button
      type="button"
      onClick={() => onGo(false)}
      style={{
        flex: 1, minWidth: 0, height: 74, borderRadius: 12, cursor: 'pointer',
        border: '1px solid var(--line-200)', background: 'var(--surface)',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        textAlign: 'left',   // 위 AI 버튼과 같은 이유
        justifyContent: 'center', gap: 3, padding: '0 12px',
      }}
    >
      <span style={{ fontSize: 13.5, fontWeight: 700, color: '#1A1A1E' }}>
        이번 주 식단 추천
      </span>
      {/* AI 쪽과 **같은 두 줄 구조**. 글자 크기도 11 로 맞춘다
          (전에는 11.5 라 나란히 놓으면 미묘하게 어긋나 보였다). */}
      <span style={{ fontSize: 11, color: 'var(--ink-500)', lineHeight: 1.35, whiteSpace: 'nowrap' }}>
        냉장고 재료만 보고
        <br />
        일주일 식단 · 무료
      </span>
    </button>
  </div>
  );
};

export default PlanButtons;
