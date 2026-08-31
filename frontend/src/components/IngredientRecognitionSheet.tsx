import React, { useEffect, useMemo, useRef, useState } from 'react';
import Sheet from './ui/Sheet';
import IngredientDateModal from './IngredientDateModal';

/** MyFridge 의 보관함 구분. 저기서 import 하면 순환 참조가 되어 여기 다시 적는다. */
export type StorageBox = 'frozen' | 'fridge' | 'room';

export interface RecognizedIngredient {
  /** 재료 사전의 대표어 — 이 이름 그대로 냉장고에 담기고 레시피 매칭에 쓰인다 */
  name: string;
  /** 사진에서 읽힌 원래 표기 (예: "CJ 백설 물엿 700g" -> raw "물엿") */
  raw: string;
  /** 포장지에서 읽은 유통기한 (YYYY-MM-DD). 없으면 null */
  expiry?: string | null;
  /** 모델이 짐작한 보관함. 재료마다 다르므로 항목별로 받는다 */
  storage?: StorageBox | null;
}

/** 사진에선 읽혔지만 사전에 없어 그대로는 담을 수 없는 항목 */
export interface UnmatchedIngredient {
  raw: string;
  expiry?: string | null;
  storage?: StorageBox | null;
}

export interface ConfirmedIngredient {
  name: string;
  expiry?: string | null;
  storage: StorageBox;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  ingredients: RecognizedIngredient[];
  unmatched: UnmatchedIngredient[];
  /** 영수증에서 읽은 구매일자 (YYYY-MM-DD). 없으면 null */
  purchaseDate: string | null;
  errorText: string | null;
  /** 재료 사전 { 동의어 또는 대표어: 대표어 } — 고쳐 담을 때 검색에 쓴다 */
  ingredientDict: { [key: string]: string };
  onConfirm: (items: ConfirmedIngredient[], purchaseDate: string) => void;
}

const BOXES: { key: StorageBox; label: string }[] = [
  { key: 'fridge', label: '냉장' },
  { key: 'frozen', label: '냉동' },
  { key: 'room', label: '실온' },
];

const todayStr = () => new Date().toISOString().slice(0, 10);

const isStorage = (v: unknown): v is StorageBox =>
  v === 'fridge' || v === 'frozen' || v === 'room';

/** 화면에 보여줄 짧은 날짜 (2026-09-05 -> 09.05) */
const shortDate = (iso: string) => iso.slice(5).replace('-', '.');

/**
 * 재료 사전에서 검색해 고르는 입력.
 *
 * 내 냉장고의 재료 추가 입력과 같은 방식이다 — 사전(동의어 포함)에서 찾아
 * 대표어만 후보로 보여주고, 고르면 그 대표어가 확정된다. 사전에 없는 말을
 * 그대로 담게 두면 레시피 매칭에서 빠지므로 직접 입력은 받지 않는다.
 */
const DictPicker: React.FC<{
  dict: { [key: string]: string };
  initial?: string;
  onPick: (name: string) => void;
  onCancel: () => void;
}> = ({ dict, initial = '', onPick, onCancel }) => {
  const [text, setText] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const options = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return [];
    const hit: string[] = [];
    Object.entries(dict).forEach(([alias, canonical]) => {
      if (alias.toLowerCase().includes(q) || canonical.toLowerCase().includes(q)) {
        if (!hit.includes(canonical)) hit.push(canonical);
      }
    });
    return hit
      .sort((a, b) => {
        const ax = a.toLowerCase() === q ? 0 : a.toLowerCase().startsWith(q) ? 1 : 2;
        const bx = b.toLowerCase() === q ? 0 : b.toLowerCase().startsWith(q) ? 1 : 2;
        return ax !== bx ? ax - bx : a.length - b.length;
      })
      .slice(0, 30);
  }, [text, dict]);

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <input
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && options.length > 0) onPick(options[0]);
            if (e.key === 'Escape') onCancel();
          }}
          placeholder="재료명을 검색하세요"
          style={{
            flex: 1, height: 40, borderRadius: 8, padding: '0 12px',
            border: '1px solid var(--line-200)', fontSize: 14,
          }}
        />
        <button
          type="button"
          onClick={onCancel}
          style={{
            height: 40, padding: '0 12px', borderRadius: 8,
            border: '1px solid var(--line-200)', background: '#FFFFFF',
            fontSize: 13, color: 'var(--ink-500)', cursor: 'pointer',
          }}
        >
          취소
        </button>
      </div>
      {options.length > 0 && (
        <div
          style={{
            maxHeight: 168, overflowY: 'auto', border: '1px solid var(--line-200)',
            borderRadius: 8, background: '#FFFFFF',
          }}
        >
          {options.map(name => (
            <button
              key={name}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => onPick(name)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 12px', border: 'none', background: 'transparent',
                fontSize: 14, color: '#1A1A1E', cursor: 'pointer',
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      {text.trim() && options.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--ink-500)', padding: '8px 2px' }}>
          사전에 없는 재료예요. 다른 이름으로 찾아보세요.
        </div>
      )}
    </div>
  );
};

interface Row {
  /** 담을 대표어. 사전에 없어서 아직 못 정했으면 null */
  name: string | null;
  /** 사진에서 읽은 표기 */
  raw: string;
  expiry?: string | null;
  /** 이 재료를 어디에 담을지. 모델 짐작값으로 시작하고 사용자가 바꿀 수 있다 */
  storage: StorageBox;
  checked: boolean;
}

/**
 * 사진에서 인식한 재료를 사용자가 검토하고 담는 시트.
 *
 * 왜 바로 담지 않나: OCR 은 반드시 틀린다. 영수증의 할인 항목을 재료로 읽거나,
 * 흐릿한 글자를 엉뚱한 재료로 읽을 수 있다. 사용자가 모르는 사이에 없는 재료가
 * 들어가면 추천 레시피 품질이 통째로 어긋나므로, 무엇을 담을지 눈으로 확인받는다.
 *
 * 틀린 항목은 눌러서 사전에서 다시 고를 수 있고, 사전에 없어 못 담는 항목도
 * 사용자가 직접 맞는 재료를 지정하면 담을 수 있다. 고칠 게 없으면 바로 반영하면 된다.
 */
const IngredientRecognitionSheet: React.FC<Props> = ({
  isOpen, onClose, loading, ingredients, unmatched, purchaseDate, errorText, ingredientDict, onConfirm,
}) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [purchase, setPurchase] = useState<string>(todayStr());
  const [dateModalOpen, setDateModalOpen] = useState(false);

  // 새로 인식할 때마다 초기화한다. 사전에 잡힌 것은 켜진 상태, 못 잡은 것은 꺼진 상태로
  // 둔다 (사용자가 재료를 지정해야 담을 수 있으므로).
  useEffect(() => {
    setRows([
      ...ingredients.map(i => ({
        name: i.name,
        raw: i.raw,
        expiry: i.expiry ?? null,
        storage: (isStorage(i.storage) ? i.storage : 'fridge') as StorageBox,
        checked: true,
      })),
      ...unmatched.map(u => ({
        name: null,
        raw: u.raw,
        expiry: u.expiry ?? null,
        storage: (isStorage(u.storage) ? u.storage : 'fridge') as StorageBox,
        checked: false,
      })),
    ]);
    setEditing(null);
    setPurchase(purchaseDate || todayStr());
  }, [ingredients, unmatched, purchaseDate]);

  const selected = rows.filter(r => r.checked && r.name);
  const readCount = ingredients.length + unmatched.length;

  const update = (idx: number, patch: Partial<Row>) => {
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
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
    if (rows.length === 0) {
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
        <div style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 12 }}>
          {readCount}개를 읽었어요. 틀린 항목은 눌러서 고칠 수 있어요.
        </div>

        {/* 구매일자 — 영수증에서 읽었으면 그 날짜, 아니면 오늘. 직접 고칠 수도 있다. */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1E', marginBottom: 6 }}>구매일자</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* 날짜 고르기는 앱의 기존 모달을 그대로 쓴다. 예전엔 <input type="date">
                였는데 OS 기본 달력이 떠서 닫기 버튼도 없고 버튼 양식도 앱과 달랐다. */}
            <button
              type="button"
              onClick={() => setDateModalOpen(true)}
              style={{
                height: 40, minWidth: 140, borderRadius: 8, padding: '0 12px',
                border: '1px solid var(--line-200)', background: '#FFFFFF',
                fontSize: 14, fontWeight: 600, color: '#1A1A1E', cursor: 'pointer',
              }}
            >
              {purchase.replace(/-/g, '.')}
            </button>
            <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>
              {purchaseDate ? '영수증에서 읽었어요' : '오늘 날짜로 넣었어요'}
            </span>
          </div>
        </div>

        <div style={{ border: '1px solid var(--line-200)', borderRadius: 12, overflow: 'hidden', marginBottom: 18 }}>
          {rows.map((row, idx) => {
            const isEditing = editing === idx;
            return (
              <div
                key={row.raw + '-' + idx}
                style={{
                  padding: '10px 12px',
                  borderBottom: idx === rows.length - 1 ? 'none' : '1px solid var(--line-200)',
                  background: row.name ? '#FFFFFF' : 'var(--surface-sub)',
                }}
              >
                {isEditing ? (
                  <DictPicker
                    dict={ingredientDict}
                    initial={row.name || row.raw}
                    onPick={name => { update(idx, { name, checked: true }); setEditing(null); }}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => row.name && update(idx, { checked: !row.checked })}
                      disabled={!row.name}
                      aria-label={row.checked ? '빼기' : '담기'}
                      style={{
                        width: 22, height: 22, flexShrink: 0, borderRadius: 6,
                        border: row.checked ? 'none' : '1px solid var(--line-200)',
                        background: row.checked ? '#FFD600' : '#FFFFFF',
                        color: '#1A1A1E', fontSize: 13, fontWeight: 700, lineHeight: '22px',
                        padding: 0, cursor: row.name ? 'pointer' : 'default',
                      }}
                    >
                      {row.checked ? '✓' : ''}
                    </button>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: row.name ? '#1A1A1E' : 'var(--ink-500)' }}>
                        {row.name || row.raw}
                      </div>
                      {(!row.name || row.raw !== row.name) && (
                        <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 2 }}>
                          {row.name ? '사진에서 읽은 표기: ' + row.raw : '사전에 없어요 · 눌러서 고르기'}
                        </div>
                      )}
                    </div>

                    {row.expiry && (
                      <span style={{
                        flexShrink: 0, fontSize: 11, fontWeight: 700, color: '#1A1A1E',
                        background: '#FFF3B0', borderRadius: 6, padding: '3px 7px',
                      }}>
                        ~{shortDate(row.expiry)}
                      </span>
                    )}

                    {/* 보관함은 재료마다 다르다. 모델이 짐작한 값으로 시작하고,
                        틀리면 여기서 바로 바꿀 수 있다. */}
                    <select
                      value={row.storage}
                      onChange={e => update(idx, { storage: e.target.value as StorageBox })}
                      aria-label="보관함"
                      style={{
                        flexShrink: 0, height: 30, borderRadius: 8, padding: '0 6px',
                        border: '1px solid var(--line-200)', background: '#FFFFFF',
                        fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', cursor: 'pointer',
                      }}
                    >
                      {BOXES.map(({ key, label }) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => setEditing(idx)}
                      style={{
                        flexShrink: 0, height: 30, padding: '0 10px', borderRadius: 8,
                        border: '1px solid var(--line-200)', background: '#FFFFFF',
                        fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', cursor: 'pointer',
                      }}
                    >
                      {row.name ? '고치기' : '고르기'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          disabled={selected.length === 0}
          onClick={() =>
            onConfirm(
              selected.map(r => ({
                name: r.name as string,
                expiry: r.expiry ?? null,
                storage: r.storage,
              })),
              purchase
            )
          }
          style={{
            width: '100%', height: 48, borderRadius: 12, border: 'none',
            background: selected.length === 0 ? 'var(--line-200)' : '#FFD600',
            color: selected.length === 0 ? 'var(--ink-500)' : '#1A1A1E',
            fontSize: 15, fontWeight: 700,
            cursor: selected.length === 0 ? 'default' : 'pointer',
          }}
        >
          {selected.length === 0 ? '담을 재료를 골라 주세요' : selected.length + '개 반영하기'}
        </button>
      </>
    );
  };

  return (
    <>
      <Sheet open={isOpen} onClose={onClose} title="사진에서 찾은 재료" maxHeight="86dvh" hideFooter>
        {body()}
      </Sheet>
      <IngredientDateModal
        type="purchase"
        isOpen={dateModalOpen}
        onClose={() => setDateModalOpen(false)}
        initialDate={purchase}
        onComplete={date => {
          if (date) setPurchase(date);
          setDateModalOpen(false);
        }}
      />
    </>
  );
};

export default IngredientRecognitionSheet;
