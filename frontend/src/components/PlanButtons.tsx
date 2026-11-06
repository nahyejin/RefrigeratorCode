import * as React from 'react';
import { useNavigate } from 'react-router-dom';

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
      {/* 사용 가이드 13단계가 이 버튼을 가리킨다. */}
      <button
        type="button"
        data-guide-target="weekly-ai-plan-button"
        onClick={() => { onBeforeGo?.(); navigate('/plan'); }}
        style={{
          // height 가 아니라 minHeight — 글자 크기를 키운 폰에서 글자가 잘리지 않게(2026-10-09).
          width: '100%', minHeight: 52, borderRadius: 12, cursor: 'pointer', border: 'none',
          background: '#FFD600', color: '#1A1A1E',
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
          // `<button>` 은 기본이 가운데 정렬 — 두 줄이 서로 가운데로 맞춰져 들여쓴 것처럼 보이던 문제.
          textAlign: 'left', justifyContent: 'center', gap: 2, padding: '6px 14px',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>식단 짜기</span>
        <span style={{ fontSize: 11, color: 'rgba(26,26,30,0.7)', wordBreak: 'keep-all' }}>
          장보기가 가장 적은 일주일 · 조건을 말하면 AI가 맞춰요
        </span>
      </button>
    </div>
  );
};

export default PlanButtons;
