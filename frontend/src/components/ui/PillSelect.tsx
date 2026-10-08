import * as React from 'react';

/**
 * 알약(배지) 버튼 한 줄 — 마이캘린더의 `일 / 주 / 월`, `완료 / 기록 / 즐겨찾기`,
 * 요즘인기의 `기간` 이 모두 이 모양이다.
 *
 * 왜 공용으로 뺐나(2026-10-09):
 *   같은 화면 안에서도 어떤 줄은 높이 30 짜리 회색 알약, 어떤 줄은 미끄러지는
 *   판이라 **같은 일을 하는 줄끼리 모양이 달랐다.** "형식을 동일하게 맞춰 달라"
 *   는 지적을 받고 한 부품으로 모았다.
 *
 * 규격:
 *  - 높이 26. 30 은 커서 투박해 보인다는 지적(2026-10-08)으로 낮춘 값이다.
 *  - 안 고른 것은 **흰 면 + 얇은 테두리**, 고른 것은 **검은 면 + 흰 글자.**
 *    회색 면끼리 붙어 있으면 뭐가 켜진 건지 한 번 더 봐야 한다.
 *  - 숫자는 라벨 옆 **작은 배지**로. 글자에 그냥 붙이면(`완료 3`) 숫자가 길어질 때
 *    버튼 폭이 흔들리고, 무엇이 라벨이고 무엇이 수인지 구분이 안 된다.
 */
export interface PillOption<T extends string> {
  value: T;
  label: string;
  /** 라벨 옆 작은 숫자. `undefined` 면 배지를 안 그린다(0 은 그린다). */
  badge?: number;
  disabled?: boolean;
}

function PillSelect<T extends string>({
  value, options, onChange, height = 26, style,
}: {
  value: T;
  options: PillOption<T>[];
  onChange: (value: T) => void;
  height?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', ...style }}>
      {options.map(({ value: key, label, badge, disabled }) => {
        const on = key === value;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(key)}
            style={{
              height, padding: '0 12px', boxSizing: 'border-box',
              display: 'inline-flex', alignItems: 'center', gap: 5,
              borderRadius: 9999, fontSize: 12.5, fontWeight: on ? 700 : 600,
              background: on ? 'var(--ink-900)' : 'var(--surface)',
              color: on ? '#FFFFFF' : (disabled ? 'var(--line-300)' : 'var(--ink-700)'),
              border: on ? 'none' : '1px solid var(--line-300)',
              cursor: disabled ? 'default' : 'pointer',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            {label}
            {badge !== undefined && (
              <span style={{
                minWidth: 16, height: 16, padding: '0 4px', boxSizing: 'border-box',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 9999, fontSize: 10.5, fontWeight: 700, lineHeight: 1,
                background: on ? 'rgba(255,255,255,0.24)' : 'var(--surface-sub)',
                color: on ? '#FFFFFF' : 'var(--ink-500)',
              }}>{badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default PillSelect;
