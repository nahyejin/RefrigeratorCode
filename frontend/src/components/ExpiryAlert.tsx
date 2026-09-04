import React from 'react';
import {
  splitExpiring, daysLabel, notifyExpiring, askNotifyPermission,
  notifyPermission, SOON_DAYS, STALE_AFTER_DAYS,
  type FridgeItem, type ExpiringItem,
} from '../utils/expiry';
import type { CategoryMap, StorageKind } from '../utils/shelfLife';

/**
 * 곧 상하는 재료를 **앱을 열자마자** 알려 준다.
 *
 * 왜 필요한가:
 *   유통기한은 이미 재료마다 들고 있었지만, 사용자가 재료를 하나씩 눌러 봐야
 *   보였다. 그래서 아무도 안 봤다. **찾아 들어가야 보이는 정보는 없는 것과 같다.**
 *
 * 왜 이게 중요한가:
 *   이 앱이 매일 열릴 이유가 된다. 재료 매칭은 필요할 때 꺼내 쓰는 기능이라
 *   일주일에 두세 번이지만, "양파 2일 남았어요" 는 앱이 먼저 말을 거는 쪽이다.
 */

const BOX_LABEL: Record<string, string> = {
  frozen: '냉동', fridge: '냉장', room: '실온',
};

interface Props {
  boxes: Partial<Record<StorageKind, FridgeItem[]>>;
  categoryMap: CategoryMap;
  /** 며칠 이내를 "곧" 으로 볼지 */
  within?: number;
  /** 재료 이름을 누르면 (그 재료로 만들 수 있는 요리 보기 등) */
  onPick?: (name: string) => void;
}

const ExpiryAlert: React.FC<Props> = ({ boxes, categoryMap, within = SOON_DAYS, onPick }) => {
  const [dismissed, setDismissed] = React.useState(false);
  const [perm, setPerm] = React.useState(notifyPermission());

  // 너무 오래 지난 것은 여기서도 뺀다 — 알림은 **오늘 할 일**을 말하는 자리다.
  // 152일 지난 재료를 매일 알리면 알림 자체를 꺼 버린다.
  const { soon, stale } = React.useMemo(
    () => splitExpiring(boxes, categoryMap, within),
    [boxes, categoryMap, within],
  );
  const items: ExpiringItem[] = soon;

  // 알림 권한이 있으면 하루 한 번 알린다 (함수 안에서 중복을 막는다).
  React.useEffect(() => {
    if (items.length > 0) notifyExpiring(items);
  }, [items]);

  if (dismissed || items.length === 0) return null;

  const past = items.filter(i => i.days < 0);
  const worst = items[0];

  return (
    <div
      style={{
        border: '1px solid var(--line-200)',
        borderLeft: `4px solid ${past.length ? '#D14343' : '#FFD600'}`,
        borderRadius: 12,
        background: 'var(--surface)',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1E' }}>
          {past.length > 0
            ? `유통기한이 지난 재료 ${past.length}개`
            : `${worst.name} ${daysLabel(worst.days, worst.estimated)}`}
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="닫기"
          style={{
            border: 'none', background: 'transparent', color: 'var(--ink-500)',
            fontSize: 18, lineHeight: 1, cursor: 'pointer', padding: 4,
          }}
        >
          ×
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.slice(0, 8).map(item => (
          <button
            key={item.storage + item.name}
            type="button"
            onClick={() => onPick?.(item.name)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 12, padding: '5px 10px', borderRadius: 9999,
              border: '1px solid var(--line-200)',
              background: item.days < 0 ? '#FBE3E0' : '#FFF8CC',
              color: item.days < 0 ? '#B03A28' : '#7A5C00',
              cursor: onPick ? 'pointer' : 'default',
            }}
          >
            <b>{item.name}</b>
            <span style={{ fontWeight: 400 }}>
              {daysLabel(item.days, item.estimated)}
            </span>
            <span style={{ fontSize: 10, opacity: 0.7 }}>{BOX_LABEL[item.storage]}</span>
          </button>
        ))}
        {items.length > 8 && (
          <span style={{ fontSize: 12, color: 'var(--ink-500)', alignSelf: 'center' }}>
            외 {items.length - 8}개
          </span>
        )}
      </div>

      {/* "약" 이 붙은 건 짐작값이다. 정직하게 말해 두지 않으면 멀쩡한 재료를
          버리게 만든다. */}
      {stale.length > 0 && (
        <div style={{ fontSize: 11.5, color: 'var(--ink-500)', lineHeight: 1.6 }}>
          {STALE_AFTER_DAYS}일 넘게 지난 재료 <b>{stale.length}개</b>는 여기에 안 띄워요.
          이미 버리셨다면 목록에서 지워 주세요.
        </div>
      )}

      {items.some(i => i.estimated) && (
        <div style={{ fontSize: 11, color: 'var(--ink-500)', lineHeight: 1.5 }}>
          <b>약</b>은 짐작한 날짜예요. 포장지 날짜를 넣으면 정확해져요.
        </div>
      )}

      {perm === 'default' && (
        <button
          type="button"
          onClick={async () => {
            const ok = await askNotifyPermission();
            setPerm(notifyPermission());
            if (ok) notifyExpiring(items);
          }}
          style={{
            alignSelf: 'flex-start',
            height: 32, padding: '0 12px', borderRadius: 8,
            border: '1px solid var(--line-200)', background: 'var(--surface)',
            fontSize: 12.5, fontWeight: 700, color: 'var(--ink-900)', cursor: 'pointer',
          }}
        >
          알림 받기
        </button>
      )}
    </div>
  );
};

export default ExpiryAlert;
