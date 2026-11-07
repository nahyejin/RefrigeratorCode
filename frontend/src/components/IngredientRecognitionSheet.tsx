import React, { useEffect, useMemo, useRef, useState } from 'react';
import Sheet from './ui/Sheet';
import StepLoading from './StepLoading';
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
  /** 이 재료의 구매일자 (yyyy.mm.dd). 영수증이면 전부 같은 값이다 */
  purchase: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  /** 지금 읽고 있는 사진 장수. 여러 장이면 더 오래 걸린다고 말해 주기 위한 것. */
  photoCount?: number;
  ingredients: RecognizedIngredient[];
  unmatched: UnmatchedIngredient[];
  /** 영수증에서 읽은 구매일자 (YYYY-MM-DD). 없으면 null */
  purchaseDate: string | null;
  /**
   * 구매일자를 재료마다 따로 정할지.
   *
   * 영수증은 한 장에 찍힌 것을 한 번에 산 것이므로 위에서 한 번만 정해 전부에
   * 적용한다. 반면 음식 사진 여러 장은 서로 다른 날 산 재료가 섞여 있을 수 있어
   * 한 값으로 묶으면 유통기한 추정이 통째로 어긋난다 — 그래서 행마다 둔다.
   */
  datePerItem: boolean;
  errorText: string | null;
  /** 재료 사전 { 동의어 또는 대표어: 대표어 } — 고쳐 담을 때 검색에 쓴다 */
  ingredientDict: { [key: string]: string };
  onConfirm: (items: ConfirmedIngredient[]) => void;
}

const BOXES: { key: StorageBox; label: string }[] = [
  { key: 'fridge', label: '냉장' },
  { key: 'frozen', label: '냉동' },
  { key: 'room', label: '실온' },
];

/** 앱 전체가 쓰는 날짜 표기는 yyyy.mm.dd 다 (IngredientDateModal 도 이걸 돌려준다) */
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};

/** 서버는 ISO(2026-09-05)로 준다. 앱 표기(2026.09.05)로 맞춘다 */
const toDots = (v: string) => v.replace(/-/g, '.');

const isStorage = (v: unknown): v is StorageBox =>
  v === 'fridge' || v === 'frozen' || v === 'room';

/** 화면에 보여줄 짧은 날짜 (2026-09-05 또는 2026.09.05 -> 09.05) */
const shortDate = (value: string) => toDots(value).slice(5);

/**
 * 사진에서 읽은 유통기한을 그대로 믿을지 판단한다.
 *
 * 영수증에는 유통기한이 없는데, 모델이 영수증에 큼직하게 찍힌 **거래일시를 각
 * 재료의 유통기한으로** 적어 보내는 일이 있었다. 그러면 방금 담은 재료가 곧바로
 * "D-day" 나 "지남" 으로 빨갛게 뜬다(실제로 그렇게 보고됐다).
 *
 * 산 날과 같은 날 상하는 식품은 사실상 없으니, 구매일자와 같거나 그보다 이른
 * 값은 유통기한이 아니라 날짜를 잘못 읽은 것으로 본다. 버려도 손해가 없다 —
 * 구매일 + 재료 특성으로 짐작한 값으로 돌아갈 뿐이고, 사용자가 실제 기한을
 * 알면 `기한 +` 로 직접 넣으면 된다.
 *
 * 날짜 표기가 ISO(2026-09-05)와 점(2026.09.05)으로 섞여 들어오므로 비교 전에
 * 하나로 맞춘다. 두 표기 모두 자리수가 고정이라 문자열 비교로 대소가 맞는다.
 *
 * ⚠️ 이 검사는 **사진에서 읽은 값에만** 건다. 사용자가 직접 고른 날짜는
 *    (마감 임박 식품처럼 오늘이 기한인 경우가 있으므로) 그대로 존중한다.
 */
const usableExpiry = (expiry: string | null | undefined, purchase: string): string | null => {
  if (!expiry) return null;
  return toDots(expiry) > toDots(purchase) ? expiry : null;
};

/**
 * 재료 사전에서 검색해 고르는 입력 (행을 펼쳤을 때 안에 들어간다).
 *
 * 내 냉장고의 재료 추가 입력과 같은 방식이다 — 사전(동의어 포함)에서 찾아
 * 대표어만 후보로 보여주고, 고르면 그 대표어가 확정된다. 사전에 없는 말을
 * 그대로 담게 두면 레시피 매칭에서 빠지므로 직접 입력은 받지 않는다.
 *
 * 이미 사전에 잡힌 재료는 이름만 채워 두고, 글자를 고치기 시작하면 그때부터 후보를
 * 보여준다(펼치자마자 후보 목록이 깔리면 나머지 설정이 아래로 밀려난다).
 * 사전에 없어 아직 이름이 없는 재료는 처음부터 후보를 보여주고 키보드를 올린다.
 */
const DictPicker: React.FC<{
  dict: { [key: string]: string };
  /** 지금 정해진 대표어. 아직 없으면 null */
  name: string | null;
  /** 사진에서 읽은 표기 — 이름이 없을 때 검색어의 시작점이 된다 */
  raw: string;
  onPick: (name: string) => void;
}> = ({ dict, name, raw, onPick }) => {
  const [text, setText] = useState(name || raw);
  const [dirty, setDirty] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const needsPick = !name;

  // 이름 없는 행은 열리자마자 키보드를 올리고 글자를 전부 선택해 둔다 — 바로 쳐서 덮어쓰게
  useEffect(() => {
    if (!needsPick) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [needsPick]);

  // 후보 목록이 시트 아래쪽에 가려지지 않게 보이는 자리로 끌어온다
  const listRef = useRef<HTMLDivElement>(null);

  const options = useMemo(() => {
    if (!dirty && !needsPick) return [];
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
  }, [text, dict, dirty, needsPick]);

  useEffect(() => {
    if (options.length > 0) listRef.current?.scrollIntoView({ block: 'nearest' });
  }, [options]);

  const pick = (n: string) => { setText(n); setDirty(false); onPick(n); };

  return (
    <div>
      <input
        ref={inputRef}
        value={text}
        onChange={e => { setText(e.target.value); setDirty(true); }}
        onKeyDown={e => { if (e.key === 'Enter' && options.length > 0) pick(options[0]); }}
        placeholder="재료명을 검색하세요"
        aria-label="재료명 검색"
        style={{
          width: '100%', minHeight: 44, borderRadius: 10, padding: '10px 12px',
          border: '1px solid var(--line-300)', background: '#FFFFFF', fontSize: 15,
          boxSizing: 'border-box',
        }}
      />
      {options.length > 0 && (
        <div
          ref={listRef}
          style={{
            maxHeight: 176, overflowY: 'auto', border: '1px solid var(--line-200)',
            borderRadius: 10, background: '#FFFFFF', marginTop: 6,
          }}
        >
          {options.map(n => (
            <button
              key={n}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => pick(n)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', minHeight: 44,
                padding: '10px 12px', border: 'none', background: 'transparent',
                fontSize: 15, color: '#1A1A1E', cursor: 'pointer',
              }}
            >
              {n}
            </button>
          ))}
        </div>
      )}
      {(dirty || needsPick) && text.trim() && options.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--ink-500)', padding: '8px 2px 0' }}>
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
  /** 이 재료의 구매일자 (yyyy.mm.dd) */
  purchase: string;
  checked: boolean;
}

/**
 * 사진을 읽는 동안 보여 주는 화면.
 *
 * 기다림의 생김새는 `StepLoading` 한 곳에 모아 뒀다 — 같은 앱 안에서 기다림은
 * 항상 같은 모양이어야 하고, 두 벌로 두면 한쪽만 고쳐져 서로 달라진다.
 * 여기서는 **무엇을 기다리는지**(문구와 시간)만 정한다.
 */
const RecognitionLoading: React.FC<{ photoCount?: number }> = ({ photoCount }) => (
  <StepLoading
    steps={[
      '사진을 보내는 중이에요',
      '글자와 재료를 훑어보는 중이에요',
      '재료 이름을 골라내는 중이에요',
      '재료 사전과 맞춰 보는 중이에요',
    ]}
    note={
      photoCount && photoCount > 1
        ? `사진 ${photoCount}장을 함께 읽고 있어요. 보통 10초쯤 걸려요.`
        : '보통 5~10초쯤 걸려요.'
    }
    lastNote="사진이 여러 장이면 조금 더 걸려요. 그대로 두시면 됩니다."
  />
);

/** 보관 위치 칩을 누를 때마다 도는 순서 */
const BOX_CYCLE: StorageBox[] = ['fridge', 'frozen', 'room'];
const boxLabel = (k: StorageBox) => BOXES.find(b => b.key === k)?.label ?? '';

/**
 * 키보드가 화면을 얼마나 가리는지(px).
 *
 * 폰에서 키보드가 뜨면 보이는 화면(visualViewport)만 줄고 시트가 붙어 있는 바닥은 그대로라,
 * 하단의 「N개 담기」 가 키보드 뒤로 숨는다. 가려진 만큼 시트를 위로 올려 항상 보이게 한다.
 */
const useKeyboardInset = (active: boolean): number => {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!active || !vv) { setInset(0); return; }
    const update = () => {
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      setInset(covered > 80 ? Math.round(covered) : 0);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      setInset(0);
    };
  }, [active]);
  return inset;
};

/** 펼친 영역 안의 「라벨 — 값」 한 줄 */
const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 44 }}>
    <div style={{ width: 52, flexShrink: 0, fontSize: 13, color: 'var(--ink-500)' }}>{label}</div>
    <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
  </div>
);

/** 펼친 영역 안의 값 버튼 (날짜 고르기용) */
const valueButtonStyle: React.CSSProperties = {
  minHeight: 36, padding: '6px 12px', borderRadius: 8,
  border: '1px solid var(--line-300)', background: '#FFFFFF',
  fontSize: 14, fontWeight: 600, color: '#1A1A1E', cursor: 'pointer',
};

/**
 * 사진에서 인식한 재료를 사용자가 검토하고 담는 시트.
 *
 * 왜 바로 담지 않나: OCR 은 반드시 틀린다. 영수증의 할인 항목을 재료로 읽거나,
 * 흐릿한 글자를 엉뚱한 재료로 읽을 수 있다. 사용자가 모르는 사이에 없는 재료가
 * 들어가면 추천 레시피 품질이 통째로 어긋나므로, 무엇을 담을지 눈으로 확인받는다.
 *
 * 화면 구성 (2026-11-07 단순화 — 「당근 디자이너라면 어떻게 짰을까」):
 *  - 기본 화면은 **한 줄 = 체크 + 재료 이름 + 보관 위치 칩** 뿐이다. 대부분은 고칠 게 없고,
 *    이 화면의 일은 「틀린 것만 빼고 담기」 이기 때문이다.
 *  - 드물게 필요한 조작(이름 고치기·소비기한 지정·보관 위치 고르기·행별 구매일)은 행을
 *    누르면 펼쳐지는 영역 안에 둔다. 한 번에 한 행만 펼쳐진다.
 *  - 구매일자는 한 줄 요약, 긴 안내문은 「?」 를 눌렀을 때만.
 *  - 「N개 담기」 는 시트 바닥에 고정해 목록이 길어도 항상 보인다.
 *
 * 영수증 / 음식 사진 / 앨범 모두 이 한 컴포넌트를 쓴다(MyFridge 의 유일한 입구).
 */
const IngredientRecognitionSheet: React.FC<Props> = ({
  isOpen, onClose, loading, photoCount, ingredients, unmatched, purchaseDate, datePerItem,
  errorText, ingredientDict, onConfirm,
}) => {
  const [rows, setRows] = useState<Row[]>([]);
  /** 지금 펼쳐진 행 (한 번에 하나) */
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  /** 위쪽 일괄 구매일자 (영수증 등). 행별 모드에서는 쓰이지 않는다 */
  const [purchase, setPurchase] = useState<string>(todayStr());
  const [showHelp, setShowHelp] = useState(false);
  /**
   * 지금 날짜를 고치는 대상. 모달은 하나만 두고 대상만 바꿔 끼운다.
   *  - kind: 구매일자냐 유통기한이냐 (모달의 안내 문구와 빠른 선택지가 다르다)
   *  - idx: 'all' = 위쪽 일괄, 숫자 = 그 행
   */
  const [dateTarget, setDateTarget] =
    useState<{ kind: 'purchase' | 'expiry'; idx: number | 'all' } | null>(null);

  const hasRows = !loading && !errorText && rows.length > 0;
  const keyboardInset = useKeyboardInset(isOpen && hasRows);

  // 새로 인식할 때마다 초기화한다. 사전에 잡힌 것은 켜진 상태, 못 잡은 것은 꺼진 상태로
  // 둔다 (사용자가 재료를 지정해야 담을 수 있으므로).
  useEffect(() => {
    const base = purchaseDate ? toDots(purchaseDate) : todayStr();
    setRows([
      ...ingredients.map(i => ({
        name: i.name,
        raw: i.raw,
        expiry: usableExpiry(i.expiry, base),
        storage: (isStorage(i.storage) ? i.storage : 'fridge') as StorageBox,
        purchase: base,
        checked: true,
      })),
      ...unmatched.map(u => ({
        name: null,
        raw: u.raw,
        expiry: usableExpiry(u.expiry, base),
        storage: (isStorage(u.storage) ? u.storage : 'fridge') as StorageBox,
        purchase: base,
        checked: false,
      })),
    ]);
    setOpenIdx(null);
    setDateTarget(null);
    setShowHelp(false);
    setPurchase(base);
  }, [ingredients, unmatched, purchaseDate]);

  // 펼친 행이 키보드나 아래쪽에 가려지지 않게 보이는 자리로 끌어온다
  useEffect(() => {
    if (openIdx === null) return;
    const el = document.getElementById('recog-row-' + openIdx);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [openIdx, keyboardInset]);

  const selected = rows.filter(r => r.checked && r.name);
  const selectable = rows.filter(r => r.name);
  const allChecked = selectable.length > 0 && selectable.every(r => r.checked);
  const readCount = ingredients.length + unmatched.length;

  const update = (idx: number, patch: Partial<Row>) => {
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const toggleAll = () => {
    setRows(prev => prev.map(r => (r.name ? { ...r, checked: !allChecked } : r)));
  };

  /**
   * 날짜 모달에서 고른 값을 대상에 적는다. 구매일자 일괄이면 모든 행에 함께 적용한다.
   *
   * `date` 가 null 이면 "잘 모르겠어요" 다.
   *  - 유통기한: 지운다. 그러면 구매일 + 카테고리로 짐작하는 값(약 D-21)으로 돌아간다.
   *  - 구매일자: 비울 수 없다(유통기한 짐작의 근거라 하나는 있어야 한다). 그냥 둔다.
   */
  const applyDate = (date: string | null) => {
    if (!dateTarget) return;
    const { kind, idx } = dateTarget;

    if (kind === 'expiry') {
      if (typeof idx === 'number') update(idx, { expiry: date });
      return;
    }
    if (!date) return;
    if (idx === 'all') {
      setPurchase(date);
      setRows(prev => prev.map(r => ({ ...r, purchase: date })));
    } else {
      update(idx, { purchase: date });
    }
  };

  const dateTargetValue = (() => {
    if (!dateTarget) return purchase;
    const { kind, idx } = dateTarget;
    if (typeof idx !== 'number') return purchase;
    return (kind === 'expiry' ? rows[idx]?.expiry : rows[idx]?.purchase) || null;
  })();

  const body = () => {
    if (loading) {
      return <RecognitionLoading photoCount={photoCount} />;
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

    const smallLink: React.CSSProperties = {
      minHeight: 32, padding: '0 2px', border: 'none', background: 'transparent',
      fontSize: 13, color: 'var(--ink-500)', cursor: 'pointer',
    };

    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1E' }}>
            {readCount}개를 찾았어요
          </div>
          <button type="button" onClick={toggleAll} style={{ ...smallLink, flexShrink: 0 }}>
            {allChecked ? '전체 해제' : '전체 선택'}
          </button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: -2 }}>
          틀리면 눌러서 고치세요
        </div>

        {/* 구매일 한 줄 요약. 구매일자(일괄)는 영수증처럼 한 번에 산 것에만 나온다.
            음식 사진처럼 서로 다른 날 산 것이 섞일 수 있으면 행마다 따로 둔다(펼친 영역 안). */}
        {!datePerItem && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => setDateTarget({ kind: 'purchase', idx: 'all' })}
              aria-label={'구매일 ' + purchase + ', 눌러서 바꾸기'}
              style={{ ...smallLink, color: 'var(--ink-700)', padding: 0 }}
            >
              구매일 {purchase} · <span style={{ textDecoration: 'underline' }}>바꾸기</span>
            </button>
            <button
              type="button"
              onClick={() => setShowHelp(v => !v)}
              aria-label="구매일 설명"
              aria-expanded={showHelp}
              style={{
                width: 20, height: 20, padding: 0, borderRadius: '50%', flexShrink: 0,
                border: '1px solid var(--line-300)', background: '#FFFFFF',
                fontSize: 11, fontWeight: 700, color: 'var(--ink-500)', cursor: 'pointer',
              }}
            >
              ?
            </button>
          </div>
        )}
        {showHelp && !datePerItem && (
          <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 6 }}>
            구매일로 소비기한을 짐작해요. 제품에 적힌 날짜는 재료를 눌러 직접 넣으세요.
          </div>
        )}

        <div style={{ marginTop: 8, marginBottom: 8 }}>
          {rows.map((row, idx) => {
            const isOpen = openIdx === idx;
            const name = row.name;
            const next = BOX_CYCLE[(BOX_CYCLE.indexOf(row.storage) + 1) % BOX_CYCLE.length];
            // 이름 밑 작은 글씨 — 평소엔 비어 있고, 알아둘 때만 한 줄: 사진 표기가 이름과 다를 때, 직접 정한 기한이 있을 때
            const hints: string[] = [];
            if (!name) hints.push('사전에 없어요 · 눌러서 고르기');
            else if (row.raw !== name) hints.push('읽은 글자 ' + row.raw);
            if (name && row.expiry) hints.push('기한 ~' + shortDate(row.expiry));
            return (
              <div
                key={row.raw + '-' + idx}
                id={'recog-row-' + idx}
                style={{ borderBottom: '1px solid var(--line-200)', scrollMarginBottom: 12 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', minHeight: 52 }}>
                  {/* 체크 — 누를 자리는 40px, 눈에 보이는 상자는 22px */}
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={row.checked}
                    aria-label={(name || row.raw) + (row.checked ? ' 빼기' : ' 담기')}
                    onClick={() => name && update(idx, { checked: !row.checked })}
                    disabled={!name}
                    style={{
                      width: 40, height: 52, flexShrink: 0, padding: 0, border: 'none',
                      background: 'transparent', display: 'flex', alignItems: 'center',
                      cursor: name ? 'pointer' : 'default',
                    }}
                  >
                    <span
                      style={{
                        width: 22, height: 22, borderRadius: 6, boxSizing: 'border-box',
                        border: row.checked ? 'none' : '1.5px solid var(--line-300)',
                        background: row.checked ? '#FFD600' : '#FFFFFF',
                        color: '#1A1A1E', fontSize: 13, fontWeight: 700, lineHeight: '22px',
                        textAlign: 'center', opacity: name ? 1 : 0.4,
                      }}
                    >
                      {row.checked ? '✓' : ''}
                    </span>
                  </button>

                  {/* 이름 — 누르면 펼쳐진다 (이름 고치기·기한·보관 위치) */}
                  <button
                    type="button"
                    onClick={() => setOpenIdx(isOpen ? null : idx)}
                    aria-expanded={isOpen}
                    aria-label={(name || row.raw) + ' 자세히 고치기'}
                    style={{
                      flex: 1, minWidth: 0, minHeight: 52, padding: '6px 0', border: 'none',
                      background: 'transparent', textAlign: 'left', cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 16, fontWeight: 600,
                        color: !name ? 'var(--ink-500)' : row.checked ? '#1A1A1E' : 'var(--ink-400)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >
                      {name || row.raw}
                    </div>
                    {hints.length > 0 && (
                      <div
                        style={{
                          fontSize: 11, color: 'var(--ink-400)', marginTop: 1,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                      >
                        {hints.join(' · ')}
                      </div>
                    )}
                  </button>

                  {/* 보관 위치 — 누를 때마다 냉장 → 냉동 → 실온. 이름 없는 행은 먼저 이름부터 */}
                  {name ? (
                    <button
                      type="button"
                      onClick={() => update(idx, { storage: next })}
                      aria-label={`보관 위치 ${boxLabel(row.storage)}, 누르면 ${boxLabel(next)}`}
                      style={{
                        flexShrink: 0, minWidth: 48, minHeight: 32, padding: '0 10px', marginLeft: 8,
                        borderRadius: 16, border: 'none', background: 'var(--surface-sub)',
                        fontSize: 13, fontWeight: 600, color: 'var(--ink-700)', cursor: 'pointer',
                      }}
                    >
                      {boxLabel(row.storage)}
                    </button>
                  ) : (
                    <span
                      aria-hidden="true"
                      style={{ flexShrink: 0, marginLeft: 8, fontSize: 13, fontWeight: 600, color: 'var(--ink-500)' }}
                    >
                      고르기
                    </span>
                  )}
                </div>

                {/* 펼친 영역 */}
                {isOpen && (
                  <div style={{ background: 'var(--surface-sub)', borderRadius: 12, padding: '10px 12px 12px', margin: '0 0 10px' }}>
                    {(!name || row.raw !== name) && (
                      <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 6 }}>
                        사진에는 「{row.raw}」 로 읽혔어요
                      </div>
                    )}
                    <DictPicker
                      key={name || 'none'}
                      dict={ingredientDict}
                      name={name}
                      raw={row.raw}
                      onPick={n => update(idx, { name: n, checked: true })}
                    />
                    {name && (
                      <div style={{ marginTop: 6 }}>
                        <DetailRow label="소비기한">
                          <button
                            type="button"
                            onClick={() => setDateTarget({ kind: 'expiry', idx })}
                            aria-label="소비기한 정하기"
                            style={valueButtonStyle}
                          >
                            {row.expiry ? toDots(row.expiry) : '자동으로 짐작 · 정하기'}
                          </button>
                        </DetailRow>
                        <DetailRow label="보관">
                          <div role="radiogroup" aria-label="보관 위치" style={{ display: 'flex', gap: 6 }}>
                            {BOXES.map(({ key, label }) => {
                              const on = row.storage === key;
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  role="radio"
                                  aria-checked={on}
                                  onClick={() => update(idx, { storage: key })}
                                  style={{
                                    flex: 1, minHeight: 36, borderRadius: 8, fontSize: 14, fontWeight: 600,
                                    border: on ? '1.5px solid #1A1A1E' : '1px solid var(--line-300)',
                                    background: '#FFFFFF', color: on ? '#1A1A1E' : 'var(--ink-500)',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </DetailRow>
                        {/* 구매일자(행별) — 재료마다 산 날이 다를 수 있는 경우(음식 사진)에만 나온다 */}
                        {datePerItem && (
                          <DetailRow label="구매일">
                            <button
                              type="button"
                              onClick={() => setDateTarget({ kind: 'purchase', idx })}
                              aria-label="구매일자 정하기"
                              style={valueButtonStyle}
                            >
                              {row.purchase}
                            </button>
                          </DetailRow>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </>
    );
  };

  const confirmButton = (
    <button
      type="button"
      disabled={selected.length === 0}
      onClick={() =>
        onConfirm(
          selected.map(r => ({
            name: r.name as string,
            expiry: r.expiry ?? null,
            storage: r.storage,
            purchase: r.purchase,
          }))
        )
      }
      style={{
        width: '100%', minHeight: 52, borderRadius: 12, border: 'none',
        background: selected.length === 0 ? 'var(--line-200)' : '#FFD600',
        color: selected.length === 0 ? 'var(--ink-500)' : '#1A1A1E',
        fontSize: 16, fontWeight: 700,
        cursor: selected.length === 0 ? 'default' : 'pointer',
      }}
    >
      {selected.length === 0 ? '담을 재료를 골라 주세요' : selected.length + '개 담기'}
    </button>
  );

  return (
    <>
      <Sheet
        open={isOpen}
        onClose={onClose}
        title="사진에서 찾은 재료"
        maxHeight="86dvh"
        hideFooter={!hasRows}
        footer={hasRows ? confirmButton : undefined}
        bottomOffset={keyboardInset}
      >
        {body()}
      </Sheet>
      {/* nested — 시트 위에 떠야 한다. 같은 층위면 Portal 로 나중에 그려지는 시트가
          위로 올라가, 날짜 버튼을 눌러도 아무 일도 안 일어나는 것처럼 보인다. */}
      <IngredientDateModal
        type={dateTarget?.kind === 'expiry' ? 'expiry' : 'purchase'}
        nested
        isOpen={dateTarget !== null}
        onClose={() => setDateTarget(null)}
        initialDate={dateTargetValue}
        onComplete={date => {
          applyDate(date);
          setDateTarget(null);
        }}
      />
    </>
  );
};

export default IngredientRecognitionSheet;
