import * as React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  hint?: React.ReactNode;
}

/**
 * 설정 On/Off 스위치.
 *
 * 그룹 생성/참여 시 고르는 항목들(재료 가져오기, 기록 공유 등)은 체크박스보다
 * "지금 켜져 있다/꺼져 있다"는 상태가 한눈에 보이는 스위치 쪽이 더 명확하다.
 */
const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label, hint }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-700)' }}>{label}</div>
      {hint && <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2, lineHeight: 1.45 }}>{hint}</div>}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        flexShrink: 0,
        width: 44,
        height: 26,
        borderRadius: 9999,
        border: 'none',
        padding: 2,
        background: checked ? 'var(--brand)' : 'var(--line-300)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: checked ? 'flex-end' : 'flex-start',
        transition: 'background 0.15s ease',
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: '#FFFFFF',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          transition: 'transform 0.15s ease',
        }}
      />
    </button>
  </div>
);

export default Toggle;
