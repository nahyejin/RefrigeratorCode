import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarMark } from './ui/AiMarks';

/**
 * 「식단 짜기」 버튼 하나.
 *
 * 마이캘린더 맨 위(식단은 결국 캘린더에 담기므로 이 화면이 제자리)와, 내냉장고 「곧 상해요」 시트 안(임박 재료 →
 * 식단 짜기가 한 이야기)에 둔다.
 *
 * 2026-11-06: 전엔 「이번 주 AI 식단 추천」(노랑·크레딧)과 「이번 주 식단 추천」(무료) **두 버튼**이 나란히 있어
 * 「뭘 눌러야 하지?」가 됐다. 이제 하나다 — 누르면 식단 짜기 화면이 열리고, 거기서 **조건을 적으면 AI, 안 적으면 무료**로 갈린다.
 * 그래서 이 버튼 자체에는 크레딧이 안 나간다는 것과, 조건을 말하면 AI가 맞춰 준다는 것만 말한다.
 */
const PlanButtons: React.FC<{ onBeforeGo?: () => void }> = ({ onBeforeGo }) => {
  const navigate = useNavigate();

  return (
    <div data-guide-target="weekly-plan-buttons">
      {/* 사용 가이드 13단계가 이 버튼을 가리킨다.
          AI 가 들어 있는 입구라 **빛줄기 애니메이션(`ai-action`)과 「AI」 배지**를 단다(2026-11-06). 누르는 순간 크레딧이 나가는 건 아니고
          (조건을 적고 짜기를 눌러야 나간다) 그 말은 아래 작은 글씨가 한다. 배지는 버튼(`overflow: hidden`) 밖 형제로 둔다. */}
      <span style={{ position: 'relative', display: 'block' }} data-guide-target="weekly-ai-plan-button">
      <button
        type="button"
        className="ai-action"
        onClick={() => { onBeforeGo?.(); navigate('/plan'); }}
        style={{
          // height 가 아니라 minHeight — 글자 크기를 키운 폰에서 글자가 잘리지 않게(2026-10-09).
          width: '100%', minHeight: 52, borderRadius: 12, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 10,
          // `<button>` 은 기본이 가운데 정렬 — 두 줄이 서로 가운데로 맞춰져 들여쓴 것처럼 보이던 문제.
          textAlign: 'left', padding: '8px 14px',
        }}
      >
        {/* 달력 안의 반짝임(✦) — 「식단 짜기」의 AI 표식. 평평한 노랑 위의 검정 동그라미에 노랑으로(2026-11-06 시안 A). */}
        <span style={{
          width: 32, height: 32, borderRadius: '50%', background: '#1A1A1E', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <CalendarMark size={20} />
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>식단 짜기</span>
          <span style={{ fontSize: 11, color: 'rgba(26,26,30,0.7)', wordBreak: 'keep-all' }}>
            장보기가 가장 적은 일주일 · 무료, 조건을 말하면 AI가 맞춰요
          </span>
        </span>
      </button>
      <span className="ai-fab-badge">AI</span>
      </span>
    </div>
  );
};

export default PlanButtons;
