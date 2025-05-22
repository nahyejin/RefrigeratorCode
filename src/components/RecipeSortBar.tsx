import React, { useState, useEffect } from 'react';
import Picker from 'react-mobile-picker';

interface RecipeSortBarProps {
  sortType: string;
  setSortType: (v: string) => void;
  matchRange: [number, number];
  setMatchRange: (v: [number, number]) => void;
  maxLack: number | 'unlimited';
  setMaxLack: (v: number | 'unlimited') => void;
  appliedExpiryIngredients: string[];
  setAppliedExpiryIngredients: (v: string[]) => void;
  expirySortType: 'expiry' | 'purchase';
  setExpirySortType: (v: 'expiry' | 'purchase') => void;
}

const RecipeSortBar: React.FC<RecipeSortBarProps> = ({
  sortType,
  setSortType,
  matchRange,
  setMatchRange,
  maxLack,
  setMaxLack,
  appliedExpiryIngredients,
  setAppliedExpiryIngredients,
  expirySortType,
  setExpirySortType,
}) => {
  // 숫자 피커 모달 상태
  const [showPicker, setShowPicker] = useState(false);
  const [pickerValue, setPickerValue] = useState({
    min: matchRange[0].toString(),
    max: matchRange[1].toString(),
  });

  useEffect(() => {
    setPickerValue({ min: matchRange[0].toString(), max: matchRange[1].toString() });
  }, [matchRange]);

  const numberOptions = Array.from({ length: 101 }, (_, i) => i.toString());

  return (
    <div style={{ padding: 16, border: '1px solid #eee', borderRadius: 8, marginBottom: 16 }}>
      <div>
        <label>정렬 기준: </label>
        <select value={sortType} onChange={e => setSortType(e.target.value)}>
          <option value="latest">최신순</option>
          <option value="like">좋아요순</option>
          <option value="comment">댓글순</option>
          <option value="match">재료매칭률순</option>
          <option value="expiry">임박재료활용순</option>
        </select>
      </div>
      <div style={{ marginTop: 8 }}>
        <label>매칭률: </label>
        <input
          readOnly
          value={`${pickerValue.min} ~ ${pickerValue.max}`}
          onClick={() => setShowPicker(true)}
          style={{ width: 80, textAlign: 'center', cursor: 'pointer' }}
        />
        {showPicker && (
          <div style={{ position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.3)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: 24, minWidth: 220 }}>
              <div>모달이 뜸</div>
              <button onClick={() => setShowPicker(false)}>닫기</button>
            </div>
          </div>
        )}
        %
      </div>
      <div style={{ marginTop: 8 }}>
        <label>최대 부족 재료: </label>
        <input type="number" value={maxLack === 'unlimited' ? '' : maxLack} min={0} onChange={e => setMaxLack(e.target.value === '' ? 'unlimited' : Number(e.target.value))} style={{ width: 40 }} />
        (비우면 무제한)
      </div>
      <div style={{ marginTop: 8 }}>
        <label>임박 재료: </label>
        <input type="text" value={appliedExpiryIngredients.join(',')} onChange={e => setAppliedExpiryIngredients(e.target.value.split(',').map(s => s.trim()).filter(Boolean))} style={{ width: 120 }} />
      </div>
      <div style={{ marginTop: 8 }}>
        <label>임박/구매 정렬: </label>
        <select value={expirySortType} onChange={e => setExpirySortType(e.target.value as 'expiry' | 'purchase')}>
          <option value="expiry">유통기한순</option>
          <option value="purchase">구매일순</option>
        </select>
      </div>
    </div>
  );
};

export default RecipeSortBar; 