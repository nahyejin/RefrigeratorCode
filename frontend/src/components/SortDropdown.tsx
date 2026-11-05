import React from 'react';
import MenuSelect from './ui/MenuSelect';

// `short` 는 **닫혀 있을 때만** 쓴다.
// 보관함 머리줄에는 이 드롭다운 말고도 `모두삭제` 와 재료 수·임박 표시가 함께
// 서는데, `유통기한 임박순`(8자)이 그 줄에서 가장 넓은 칸을 차지해 나머지를
// 밀어냈다. 무엇으로 정렬 중인지는 짧은 말로도 통하고, 고를 때 펼치는 목록에는
// 긴 설명을 그대로 둔다 — 줄이는 건 **이미 고른 것을 다시 읽는 자리**뿐이다.
export type SortType = 'expiry' | 'purchase' | 'name';

// 타입을 붙여 둔다. 전에는 `value` 가 그냥 `string` 으로 추론돼
// `onChange(option.value)` 가 타입 오류였다.
const SORT_OPTIONS: { value: SortType; label: string; short: string }[] = [
  { value: 'expiry', label: '유통기한 임박순', short: '임박순' },
  { value: 'purchase', label: '구매일 오래된순', short: '구매일순' },
  { value: 'name', label: '가나다순', short: '가나다순' },
];

interface SortDropdownProps {
  value: SortType;
  onChange: (value: SortType) => void;
  className?: string;
}

/**
 * 보관함 정렬 — 앱 공통 `MenuSelect`(알약 · 선 화살표 · 회색 선택 표시)의 얇은 포장(2026-11-06 통일).
 * 직접 그리던 사각 버튼 + 글자 `∨` + 파란 선택 표시는 마이캘린더 드롭다운과 달라 보였다.
 */
const SortDropdown: React.FC<SortDropdownProps> = ({ value, onChange, className }) => (
  <div className={className} style={{ display: 'inline-flex' }}>
    <MenuSelect
      ariaLabel="정렬 기준"
      align="right"
      height={28}
      value={value}
      onChange={onChange}
      options={SORT_OPTIONS.map(o => ({ value: o.value, label: o.label, short: o.short }))}
    />
  </div>
);

export default SortDropdown;
