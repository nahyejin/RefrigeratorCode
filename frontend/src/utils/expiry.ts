import { estimateExpiry, type CategoryMap, type StorageKind } from './shelfLife';

/**
 * 냉장고 재료가 **얼마나 남았는지** 한 곳에서 센다.
 *
 * 유통기한은 두 군데서 온다:
 *   1. 사용자가 적었거나 포장지에서 읽힌 값 (`expiry`) — 정확하다
 *   2. 구매일 + 재료 종류로 짐작한 값 (`estimatedExpiry`) — 대략이다
 *
 * 1번이 있으면 무조건 1번을 쓴다. 짐작값으로 정확한 값을 덮으면
 * **멀쩡한 재료를 버리게 만든다.**
 */

export interface FridgeItem {
  id?: string;
  name: string;
  expiry?: string;          // 'yyyy.mm.dd'
  estimatedExpiry?: string; // 'yyyy.mm.dd'
  purchase?: string;
}

export interface ExpiringItem {
  name: string;
  /** 남은 날. 0이면 오늘까지, 음수면 이미 지났다. */
  days: number;
  /** 짐작한 날짜인가. 화면에 "약" 을 붙여 정직하게 말하기 위해. */
  estimated: boolean;
  storage: StorageKind;
  date: string;
}

const parse = (text?: string): Date | null => {
  if (!text) return null;
  const m = String(text).replace(/-/g, '.').match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
};

const daysUntil = (date: Date): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
};

/**
 * 보관함별 재료에서 **곧 상하는 것**을 골라 남은 날 순으로 돌려준다.
 *
 * `within` 일 이내(그리고 이미 지난 것)만 담는다. 전부 돌려주면 정작 급한 게
 * 묻힌다 — 목록이 길면 아무도 안 본다.
 */
export function findExpiring(
  boxes: Partial<Record<StorageKind, FridgeItem[]>>,
  categoryMap: CategoryMap,
  within = 3,
): ExpiringItem[] {
  const out: ExpiringItem[] = [];

  (Object.keys(boxes) as StorageKind[]).forEach(storage => {
    (boxes[storage] || []).forEach(item => {
      // 적힌 값이 우선. 없으면 짐작한다.
      let date = parse(item.expiry);
      let estimated = false;
      if (!date) {
        date = parse(item.estimatedExpiry);
        estimated = !!date;
      }
      if (!date && item.purchase) {
        const guess = estimateExpiry(item.name, storage, item.purchase, categoryMap);
        date = parse(guess || undefined);
        estimated = !!date;
      }
      if (!date) return;

      const days = daysUntil(date);
      if (days > within) return;
      out.push({
        name: item.name,
        days,
        estimated,
        storage,
        date: `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`,
      });
    });
  });

  return out.sort((a, b) => a.days - b.days);
}

/** "지났어요" / "오늘까지" / "2일 남음" — 숫자만 던지지 않고 말로. */
export function daysLabel(days: number, estimated = false): string {
  const about = estimated ? '약 ' : '';
  if (days < 0) return `${-days}일 지났어요`;
  if (days === 0) return `${about}오늘까지`;
  return `${about}${days}일 남음`;
}

// ── 알림 ──────────────────────────────────────────────────────────
//
// 웹 알림은 **앱이 켜져 있을 때만** 확실하다. 진짜 예약 알림(앱을 안 켜도 오는
// 것)은 설치형 앱에서 로컬 알림으로 붙이는 게 맞고, 그건 앱 배포 뒤의 일이다.
// 여기서는 지금 확실히 되는 것만 한다 — 앱을 열었을 때 한 번 알려 주기.

const NOTIFY_KEY = 'cookmatch_expiry_notified_on';

export function canNotify(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notifyPermission(): NotificationPermission | 'unsupported' {
  return canNotify() ? Notification.permission : 'unsupported';
}

export async function askNotifyPermission(): Promise<boolean> {
  if (!canNotify()) return false;
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch {
    return false;
  }
}

/**
 * 하루에 한 번만 알린다.
 *
 * 앱을 열 때마다 알리면 금방 꺼 버린다. 알림은 **한 번 성가시면 영영 꺼진다** —
 * 그러면 정작 필요할 때 못 알린다.
 */
export function notifyExpiring(items: ExpiringItem[]): boolean {
  if (!canNotify() || Notification.permission !== 'granted' || items.length === 0) return false;

  const today = new Date().toISOString().slice(0, 10);
  try {
    if (localStorage.getItem(NOTIFY_KEY) === today) return false;
    localStorage.setItem(NOTIFY_KEY, today);
  } catch {
    /* 저장이 막혀 있으면 그냥 알린다 — 안 알리는 것보다 낫다 */
  }

  const urgent = items.slice(0, 3).map(i => `${i.name}(${daysLabel(i.days, i.estimated)})`);
  const more = items.length > 3 ? ` 외 ${items.length - 3}개` : '';
  try {
    new Notification('곧 상하는 재료가 있어요', {
      body: urgent.join(', ') + more,
      icon: '/cookmatch_icon.png',
      tag: 'cookmatch-expiry',   // 같은 알림이 쌓이지 않게
    });
    return true;
  } catch {
    return false;
  }
}
