import React from 'react';

interface SortOption {
  value: string;
  label: string;
}

interface RecipeSortBarProps {
  sortType: string;
  onSortChange: (value: string) => void;
  sortOptions: SortOption[];
  onFilterClick?: () => void;
  filterButton?: React.ReactNode;
  children?: React.ReactNode;
}

const buttonStyle: React.CSSProperties = {
  height: 28,
  border: '1px solid #D1D5DB',
  borderRadius: 6,
  fontSize: 12,
  padding: '0 8px',
  fontWeight: 600,
  background: '#fff',
  color: '#222',
  minWidth: 70,
  marginRight: 0,
  whiteSpace: 'nowrap',
  lineHeight: '28px',
  boxSizing: 'border-box',
  cursor: 'pointer',
};
const selectStyle: React.CSSProperties = {
  height: 28,
  border: '1px solid #D1D5DB',
  borderRadius: 6,
  fontSize: 12,
  padding: '0 22px 0 8px',
  fontWeight: 600,
  background: '#fff',
  color: '#222',
  minWidth: 80,
  marginRight: 0,
  appearance: 'none' as any,
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  outline: 'none',
  cursor: 'pointer',
  boxSizing: 'border-box',
};
const filterButtonStyle: React.CSSProperties = {
  height: 28,
  border: '1px solid #D1D5DB',
  borderRadius: 999,
  fontSize: 12,
  padding: '0 12px',
  fontWeight: 600,
  background: '#fff',
  color: '#222',
  minWidth: 50,
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  cursor: 'pointer',
};

const RecipeSortBar: React.FC<RecipeSortBarProps> = ({
  sortType,
  onSortChange,
  sortOptions,
  onFilterClick,
  filterButton,
  children,
}) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18, width: '100%', marginTop: 24, flexWrap: 'wrap' }}>
      {/* Render children with forced style */}
      {React.Children.map(children, child => {
        if (
          React.isValidElement(child) &&
          typeof child.type === 'string' &&
          child.type === 'button'
        ) {
          return React.cloneElement(
            child as React.ReactElement<any>,
            { style: { ...buttonStyle, ...(child.props.style || {}) } }
          );
        }
        return child;
      })}
      <div style={{ position: 'relative', minWidth: 80 }}>
        <select
          aria-label="정렬 기준 선택"
          value={sortType}
          onChange={e => onSortChange(e.target.value)}
          style={selectStyle}
        >
          {sortOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {/* Custom arrow */}
        <span
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            fontSize: 13,
            color: '#888',
          }}
        >▼</span>
      </div>
      {filterButton ? (
        filterButton
      ) : onFilterClick ? (
        <button
          style={filterButtonStyle}
          onClick={onFilterClick}
        >
          <span style={{ fontWeight: 700 }}>필터</span>
        </button>
      ) : null}
    </div>
  );
};

export default RecipeSortBar; 