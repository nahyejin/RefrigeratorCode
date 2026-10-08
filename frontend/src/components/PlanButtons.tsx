import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUsage } from './UsageMeter';

/**
 * 이번 주 식단 추천 버튼 두 개(AI / 무료).
 *
 * 마이캘린더 맨 위(식단은 결국 캘린더에 담기므로 이 화면이 제자리)와, 내냉장고
 * 「곧 상해요」 시트 안(임박 재료 → 식단 짜기가 한 이야기)에 둔다. 임박 재료
 * 카드와 함께 큼직하게(74px) 놓았더니 화면을 너무 차지한다는 지적(2026-10-08)으로
 * **52px 두 줄**로 줄였다 — 제목 한 줄, 설명 한 줄.
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

  const base: React.CSSProperties = {
    width: '100%', height: 52, borderRadius: 12, cursor: 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
    // `<button>` 은 기본이 가운데 정렬 — 두 줄이 서로 가운데로 맞춰져 들여쓴 것처럼 보이던 문제.
    textAlign: 'left', justifyContent: 'center', gap: 2, padding: '0 12px',
  };

  return (
    <div style={{ display: 'flex', gap: 8 }} data-guide-target="weekly-plan-buttons">
      {/* 여기만 노란색·AI 배지·반짝임. 누르는 순간 크레딧이 나가지는 않고, 조건을 적는
          칸으로 데려간다 — 냉장고를 보기도 전에 돈이 나가면 결과가 마음에 안 들 때
          그대로 손해다. */}
      <span style={{ flex: 1, minWidth: 0, display: 'flex', position: 'relative' }}>
        <button type="button" onClick={() => onGo(true)} className="ai-action" style={base}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1E', whiteSpace: 'nowrap' }}>
            이번 주 AI 식단 추천
          </span>
          <span style={{ fontSize: 10.5, color: 'rgba(26,26,30,0.65)', whiteSpace: 'nowrap' }}>
            장보기 최소화 · 크레딧 {planCost}
          </span>
        </button>
        <span className="ai-fab-badge">AI</span>
      </span>

      <button
        type="button"
        onClick={() => onGo(false)}
        style={{
          ...base, flex: 1, minWidth: 0,
          border: '1px solid var(--line-200)', background: 'var(--surface)',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1E', whiteSpace: 'nowrap' }}>
          이번 주 식단 추천
        </span>
        <span style={{ fontSize: 10.5, color: 'var(--ink-500)', whiteSpace: 'nowrap' }}>
          냉장고 재료만 · 무료
        </span>
      </button>
    </div>
  );
};

export default PlanButtons;
