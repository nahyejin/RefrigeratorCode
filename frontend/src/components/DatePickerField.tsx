import React from 'react';
import CustomCalendar from './CustomCalendar';

/**
 * 날짜를 고르는 **한 자리**.
 *
 * 왜 만드나:
 *   앱 곳곳에서 `<input type="date">` 를 그냥 썼다. 그러면 안드로이드·iOS·크롬이
 *   **각자 다른 달력**을 띄운다. 재료 유통기한은 우리 달력(`CustomCalendar`)으로
 *   고르는데 식단 기간은 시스템 달력이 뜨니, 같은 앱에서 날짜를 고르는 방법이
 *   두 가지가 됐다.
 *
 * 무엇을 맡나:
 *   버튼처럼 생긴 자리를 그리고, 누르면 우리 달력을 띄운다. 고른 값은
 *   `YYYY-MM-DD` 문자열로 주고받는다 — 저장하는 쪽이 전부 그 모양을 쓴다.
 */

const pad = (n: number) => String(n).padStart(2, '0');
export const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (s?: string): Date | null => {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

interface Props {
  /** `YYYY-MM-DD`. 비어 있으면 `placeholder` 를 보여 준다. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  /** 달력이 어떤 뜻으로 열리는지 (CustomCalendar 의 안내 문구가 달라진다) */
  type?: 'expiry' | 'purchase' | 'range-start' | 'range-end';
  style?: React.CSSProperties;
  disabled?: boolean;
}

const DatePickerField: React.FC<Props> = ({
  value, onChange, placeholder = '날짜 선택', minDate, maxDate, type, style, disabled,
}) => {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        style={{
          height: 34, borderRadius: 8, padding: '0 10px',
          border: '1px solid var(--line-200)', background: 'var(--surface)',
          fontSize: 12.5, color: value ? 'var(--ink-900)' : 'var(--ink-500)',
          fontWeight: value ? 600 : 400,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 6, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
          ...style,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value || placeholder}
        </span>
        <span aria-hidden style={{ flexShrink: 0, color: 'var(--ink-500)', fontSize: 11 }}>▾</span>
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 'var(--z-modal)' as any, padding: 16,
          }}
        >
          <div onClick={e => e.stopPropagation()}>
            <CustomCalendar
              selectedDate={fromKey(value)}
              onDateSelect={d => { onChange(toKey(d)); setOpen(false); }}
              onClose={() => setOpen(false)}
              minDate={minDate}
              maxDate={maxDate}
              type={type}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default DatePickerField;
