import React, { useEffect, useState } from 'react';
import Sheet from './ui/Sheet';

/** MyFridge 의 보관함 구분. 저기서 import 하면 순환 참조가 되어 여기 다시 적는다. */
export type StorageBox = 'frozen' | 'fridge' | 'room';

export interface RecognizedIngredient {
  /** 재료 사전의 대표어 — 이 이름 그대로 냉장고에 담기고 레시피 매칭에 쓰인다 */
  name: string;
  /** 사진에서 읽힌 원래 표기 (예: "CJ 백설 물엿 700g" -> raw "물엿") */
  raw: string;
}

interface IngredientRecognitionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  ingredients: RecognizedIngredient[];
  /** 사진에선 읽혔지만 재료 사전에 없어 담을 수 없는 이름들 */
  unmatched: string[];
  errorText: string | null;
  onConfirm: (names: string[], storage: StorageBox) => void;
}

const BOXES: { key: StorageBox; label: string }[] = [
  { key: 'fridge', label: '냉장' },
  { key: 'frozen', label: '냉동' },
  { key: 'room', label: '실온' },
];

/**
 * 사진에서 인식한 재료를 사용자가 확인하고 담는 시트.
 *
 * 왜 바로 담지 않나: OCR 은 반드시 틀린다. 영수증의 할인 항목을 재료로 읽거나,
 * 흐릿한 글자를 엉뚱한 재료로 읽을 수 있다. 사용자가 모르는 사이에 냉장고에
 * 없는 재료가 들어가면 추천 레시피 품질이 통째로 어긋나므로, 무엇을 담을지
 * 반드시 눈으로 확인받는다. 기본값은 "전부 선택"이라 확인이 한 번의 탭으로 끝난다.
 */
const IngredientRecognitionSheet: React.FC<IngredientRecognitionSheetProps> = ({
  isOpen, onClose, loading, ingredients, unmatched, errorText, onConfirm,
}) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [storage, setStorage] = useState<StorageBox>('fridge');

  // 새로 인식할 때마다 전부 선택된 상태로 시작한다.
  useEffect(() => {
    setSelected(new Set(ingredients.map(i => i.name)));
  }, [ingredients]);

  const toggle = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const body = () => {
    if (loading) {
      return (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-500)', fontSize: 14 }}>
          사진에서 재료를 찾고 있어요...
        </div>
      );
    }
    if (errorText) {
      return (
        <div style={{ padding: '28px 8px', textAlign: 'center', color: 'var(--ink-700)', fontSize: 14, lineHeight: 1.6 }}>
          {errorText}
        </div>
      );
    }
    if (ingredients.length === 0) {
      return (
        <div style={{ padding: '28px 8px', textAlign: 'center', color: 'var(--ink-700)', fontSize: 14, lineHeight: 1.6 }}>
          사진에서 재료를 찾지 못했어요.
          <br />
          글자가 잘 보이게 다시 찍어 주세요.
        </div>
      );
    }
    return (
      <>
        <div style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 10 }}>
          담을 재료를 확인해 주세요. 눌러서 뺄 수 있어요.
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
          {ingredients.map(item => {
            const on = selected.has(item.name);
            return (
              <button
                key={item.name}
                type="button"
                onClick={() => toggle(item.name)}
                title={item.raw !== item.name ? `사진에서 읽은 표기: ${item.raw}` : undefined}
                style={{
                  padding: '8px 14px',
                  borderRadius: 9999,
                  border: on ? '1px solid #1A1A1E' : '1px solid var(--line-200)',
                  background: on ? '#FFD600' : '#FFFFFF',
                  color: on ? '#1A1A1E' : 'var(--ink-500)',
                  fontSize: 14,
                  fontWeight: on ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                {item.name}
              </button>
            );
          })}
        </div>

        {unmatched.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 6 }}>
              아직 사전에 없어 담을 수 없어요
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {unmatched.map(name => (
                <span
                  key={name}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 9999,
                    background: 'var(--surface-sub)',
                    color: 'var(--ink-500)',
                    fontSize: 13,
                    textDecoration: 'line-through',
                  }}
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1E', marginBottom: 8 }}>어디에 담을까요?</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 18 }}>
          {BOXES.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setStorage(key)}
              style={{
                height: 42,
                borderRadius: 10,
                border: storage === key ? '1px solid #1A1A1E' : '1px solid var(--line-200)',
                background: storage === key ? '#1A1A1E' : '#FFFFFF',
                color: storage === key ? '#FFFFFF' : 'var(--ink-700)',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={selected.size === 0}
          onClick={() => onConfirm(ingredients.filter(i => selected.has(i.name)).map(i => i.name), storage)}
          style={{
            width: '100%',
            height: 48,
            borderRadius: 12,
            border: 'none',
            background: selected.size === 0 ? 'var(--line-200)' : '#FFD600',
            color: selected.size === 0 ? 'var(--ink-500)' : '#1A1A1E',
            fontSize: 15,
            fontWeight: 700,
            cursor: selected.size === 0 ? 'default' : 'pointer',
          }}
        >
          {selected.size === 0 ? '담을 재료를 골라 주세요' : `${selected.size}개 담기`}
        </button>
      </>
    );
  };

  return (
    <Sheet open={isOpen} onClose={onClose} title="사진에서 찾은 재료" maxHeight="80dvh" hideFooter>
      {body()}
    </Sheet>
  );
};

export default IngredientRecognitionSheet;
