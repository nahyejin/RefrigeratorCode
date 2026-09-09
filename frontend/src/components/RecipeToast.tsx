import React from 'react';
import Toast from './Toast';

interface RecipeToastProps {
  message: string;
  /**
   * 토스트에서 바로 누를 수 있는 한 가지 행동.
   *
   * "설정이 없어서 못 한다" 고 알리기만 하면, 사용자는 토스트가 사라진 뒤
   * 그 설정이 어디 있었는지 스스로 찾아가야 한다. 알림과 해결을 한 자리에 둔다.
   */
  action?: { label: string; onClick: () => void };
}

/**
 * 레시피 동작 안내용 토스트.
 * 예전엔 Toast.tsx 와 거의 같은 스타일 정의를 각자 들고 있었음 → Toast 로 위임한다.
 *
 * 여기서 쓰는 문구("레시피를 즐겨찾기에 추가했습니다!" 등)는 대개 줄바꿈 없는 한 문장인데,
 * multiline(줄바꿈 허용) + maxWidth 260px 조합 때문에 짧은 문장도 폭에 걸려 줄바꿈돼
 * 두 줄로 쪼개져 보였다. 그래서 한 줄로 고정했는데, 이번에는 반대 문제가 났다 —
 * **줄바꿈을 넣은 안내가 한 줄로 이어 붙은 뒤 잘렸다.**
 * 그래서 문구에 줄바꿈이 실제로 들어 있을 때만 여러 줄로 푼다.
 */
const RecipeToast: React.FC<RecipeToastProps> = ({ message, action }) => (
  <Toast
    message={message}
    // **잘릴 만한 때는 줄을 푼다.**
    //
    // 여기는 늘 한 줄로 고정돼 있었다(`nowrap` + 말줄임). 짧은 안내는 그게
    // 낫지만, 두 경우에는 그대로 잘렸다:
    //   · 줄바꿈을 넣은 안내가 한 줄로 이어 붙어서
    //   · 버튼이 폭을 나눠 가져서 ("임박 재료를 아직 고르지 않…")
    multiline={message.includes('\n') || !!action}
    // `keep-all` 이 없으면 낱말 한가운데서 끊긴다 ("…않았어 / 요.").
    // 이 속성은 상속되므로 바깥 상자에만 두면 글자에도 적용된다.
    style={{ maxWidth: 340, textAlign: 'left', wordBreak: 'keep-all' }}
  >
    {action && (
      <button
        type="button"
        onClick={action.onClick}
        style={{
          flexShrink: 0,
          height: 30,
          padding: '0 12px',
          borderRadius: 9999,
          border: 'none',
          cursor: 'pointer',
          background: '#FFFFFF',
          color: 'var(--ink-900)',
          fontSize: 13,
          fontWeight: 700,
          whiteSpace: 'nowrap',
        }}
      >
        {action.label}
      </button>
    )}
  </Toast>
);

export default RecipeToast;
