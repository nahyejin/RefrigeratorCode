import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheckIcon } from './ui/Icons';

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
      <span style={{ display: 'block' }} data-guide-target="weekly-ai-plan-button">
        {/* 쿡 코치 입구(레시피 창 위쪽)와 **같은 디자인**(2026-11-07 「그 형식대로 식단 짜기도」): 검정 가로 알약 + 숨 쉬듯 커졌다 작아지는
            움직임 + 스쳐 가는 빛줄기(`ai-fab-pill k`) + 이름 옆 「✦AI」 + 한 줄 설명. 누른다고 크레딧이 나가는 건 아니다 — 조건을 적고
            짜기를 눌러야 나가므로 그 말은 아래 작은 글씨가 한다. */}
        <button
          type="button"
          className="ai-fab-pill k"
          onClick={() => { onBeforeGo?.(); navigate('/plan'); }}
          style={{ width: '100%', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}
        >
          <CalendarCheckIcon size={18} />
          <span>식단 짜기</span>
          <span className="ai-tag" style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '.04em', padding: '1.5px 6px', borderRadius: 6,
            background: 'rgba(255,255,255,0.16)', color: '#FFFFFF', flexShrink: 0,
          }}>AI</span>
          <span style={{ fontWeight: 500, fontSize: 13, color: 'rgba(255,255,255,0.78)' }}>장보기가 가장 적은 일주일</span>
        </button>
        <span style={{ display: 'block', marginTop: 6, textAlign: 'center', fontSize: 11.5, color: 'var(--ink-500)', wordBreak: 'keep-all' }}>
          무료예요 · 조건을 말하면 AI가 맞춰요
        </span>
      </span>
    </div>
  );
};

export default PlanButtons;
