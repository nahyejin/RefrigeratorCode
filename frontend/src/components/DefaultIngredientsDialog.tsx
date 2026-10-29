import React from 'react';
import Dialog from './ui/Dialog';

/**
 * 처음 들어왔을 때 보이는 「기본 재료 정리」 팝업(2026-10-22 사용자 확정 시안 ①).
 *
 * 예전 WelcomeModal 은 「미리 넣어 뒀어요 / 로그인하면 안전하게 보관돼요」 한 줄과 [닫기][로그인하기]뿐이라
 * 사용자는 샘플 재료가 내 것인지 아닌지 모르는 채 나갔다. 이제 기본 재료를 종류별 칩으로 한 번에 보여 주고,
 * **집에 없는 것만 눌러서 뺀 뒤** 시작하게 한다. 재료마다 배지를 다는 안은 폐기(너무 길어짐).
 *
 * 기본 재료가 왜 있나: 빈 화면에서 「냉장고요리가 뭐 하는 건지」 모르게 되는 것을 막는 **예시**다. 예시를 본 뒤
 * 실제 사용(내 재료를 3개 넘게 담기 등)은 로그인으로 이어지게 한다.
 */
export interface SeedItem { id: string; name: string }

const GROUPS: { name: string; names: string[] }[] = [
  { name: '양념·기름', names: ['소금', '설탕', '간장', '식용유', '참기름', '후추', '올리고당', '물엿', '식초', '알룰로스', '된장', '고추장', '고춧가루', '맛술', '미림'] },
  { name: '채소', names: ['마늘', '대파', '양파', '감자', '당근'] },
  { name: '달걀·유제품·두부', names: ['달걀', '두부', '우유'] },
  { name: '고기·냉동', names: ['돼지고기', '닭고기', '만두'] },
  { name: '가루·면·반찬', names: ['밀가루', '전분', '라면', '김치', '멸치'] },
];

interface Props {
  open: boolean;
  items: SeedItem[];
  isLoggedIn: boolean;
  /** X 로 닫기 — 재료는 그대로 */
  onClose: () => void;
  /** [이 재료로 요리 보기] — 빼기로 한 재료 id 를 넘긴다 */
  onStart: (removedIds: string[]) => void;
}

const DefaultIngredientsDialog: React.FC<Props> = ({ open, items, isLoggedIn, onClose, onStart }) => {
  const [off, setOff] = React.useState<Record<string, boolean>>({});

  // 열릴 때마다 처음 상태(전부 선택)로
  React.useEffect(() => {
    if (open) setOff({});
  }, [open]);

  const grouped = React.useMemo(() => {
    const placed = new Set<string>();
    const out = GROUPS.map(g => {
      const list = items.filter(it => g.names.includes(it.name));
      list.forEach(it => placed.add(it.id));
      return { name: g.name, list };
    }).filter(g => g.list.length > 0);
    const rest = items.filter(it => !placed.has(it.id));
    if (rest.length) out.push({ name: '기타', list: rest });
    return out;
  }, [items]);

  const removedIds = Object.keys(off).filter(id => off[id]);
  const count = items.length - removedIds.length;

  // 2026-10-29: 「3개까지만·사라질 수 있어요」 경고와 [로그인하고 시작]을 뺐다. 처음 보는 사람에게 제한부터 말하면
  // 가치를 보기 전에 벽이 된다 → 재료를 고르면 **만들 수 있는 요리**부터 보여 주고, 가입은 레시피를 본 뒤에 권한다.
  const actions = [
    { label: isLoggedIn ? '이대로 시작' : '이 재료로 요리 보기', onClick: () => onStart(removedIds), variant: 'primary' as const },
  ];

  return (
    <Dialog open={open} onClose={onClose} title="자주 쓰는 재료를 담아 뒀어요" actions={actions}>
      <div style={{ fontSize: 14, marginBottom: 4 }}>없는 재료는 눌러서 빼 주세요 ({count}개 선택)</div>
      {!isLoggedIn && (
        <div style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>고른 재료로 만들 수 있는 요리를 바로 보여 드려요.</div>
      )}
      <div style={{ textAlign: 'left', margin: '10px 0 0' }}>
        {grouped.map(g => (
          <div key={g.name}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-500)', margin: '10px 0 6px' }}>{g.name}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {g.list.map(it => {
                const isOff = !!off[it.id];
                return (
                  <button
                    key={it.id}
                    type="button"
                    aria-pressed={!isOff}
                    onClick={() => setOff(prev => ({ ...prev, [it.id]: !prev[it.id] }))}
                    style={{
                      fontFamily: 'inherit', fontSize: 13, lineHeight: 1, padding: '7px 10px', borderRadius: 999, cursor: 'pointer',
                      background: isOff ? '#FFFFFF' : '#F4F4F6',
                      border: isOff ? '1px dashed #D2D2D8' : '1px solid #E4E4E8',
                      color: isOff ? '#6A6A73' : '#1A1A1E',
                      textDecoration: isOff ? 'line-through' : 'none',
                    }}
                  >
                    {it.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {removedIds.length > 0 && (
        <div style={{
          marginTop: 14, padding: '10px 12px', borderRadius: 10, background: '#FFF8CC', border: '1px solid #FFE766',
          fontSize: 12.5, lineHeight: 1.55, color: '#1A1A1E',
        }}>
          <b>지금 {removedIds.length}개를 뺐어요</b>
        </div>
      )}
    </Dialog>
  );
};

export default DefaultIngredientsDialog;
