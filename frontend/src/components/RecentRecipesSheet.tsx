import React from 'react';
import Sheet from './ui/Sheet';
import { openCookMode } from '../utils/cookMode';
import { getProxiedImageUrl } from '../utils/imageUtils';
import {
  getRecentRecipes, RECENT_CHANGED_EVENT, RECENT_DAYS, RecentRecipe,
} from '../utils/recentRecipes';

/**
 * 최근 본 레시피 목록(마이페이지 「최근 본」 · 2026-11-05 요청).
 *
 * 최근 2개월 동안 레시피 패널을 열어 본 것을 **날짜별로 묶어** 최근 순으로 보여 준다. 누르면 그 레시피 패널이 이 목록 위로 열리고,
 * 닫으면 목록으로 돌아온다. 페이지로 두지 않고 시트로 둔 건, 목록 ↔ 레시피를 오가는 일이 잦아서 화면 이동 없이 겹쳐 열리는 쪽이 가볍기 때문이다.
 */

const DAY = 24 * 60 * 60 * 1000;

/** 그날 0시(로컬) */
const startOfDay = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };

function dayLabel(at: number): string {
  const diff = Math.round((startOfDay(Date.now()) - startOfDay(at)) / DAY);
  if (diff <= 0) return '오늘';
  if (diff === 1) return '어제';
  const d = new Date(at);
  const week = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${week})`;
}

function timeLabel(at: number): string {
  const d = new Date(at);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${m}`;
}

const Thumb: React.FC<{ src?: string }> = ({ src }) => {
  const [failed, setFailed] = React.useState(false);
  const box: React.CSSProperties = {
    flexShrink: 0, width: 64, height: 64, borderRadius: 10, background: 'var(--surface-sub)', display: 'block',
  };
  if (!src || failed) return <span aria-hidden style={box} />;
  return (
    <img
      src={getProxiedImageUrl(src)}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      style={{ ...box, objectFit: 'cover' }}
    />
  );
};

interface Props {
  open: boolean;
  onClose: () => void;
}

const RecentRecipesSheet: React.FC<Props> = ({ open, onClose }) => {
  const [items, setItems] = React.useState<RecentRecipe[]>([]);

  React.useEffect(() => {
    if (!open) return;
    const load = () => setItems(getRecentRecipes());
    load();
    // 목록 위에서 레시피를 열면 그 레시피가 맨 앞으로 올라온다 — 닫고 돌아왔을 때 순서가 맞게 다시 읽는다.
    window.addEventListener(RECENT_CHANGED_EVENT, load);
    return () => window.removeEventListener(RECENT_CHANGED_EVENT, load);
  }, [open]);

  // 날짜 머리글 아래로 묶는다(이미 최근 순이라 순서대로 훑으면 된다).
  const groups: Array<{ label: string; rows: RecentRecipe[] }> = [];
  for (const r of items) {
    const label = dayLabel(r.at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.rows.push(r);
    else groups.push({ label, rows: [r] });
  }

  return (
    <Sheet open={open} onClose={onClose} title="최근 본 레시피" maxHeight="88dvh" hideFooter>
      {items.length === 0 ? (
        <div style={{ padding: '36px 8px 28px', textAlign: 'center', color: 'var(--ink-500)', fontSize: 14, lineHeight: 1.7, wordBreak: 'keep-all' }}>
          아직 본 레시피가 없어요.<br />
          레시피를 열어 보면 여기에 쌓여요.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>
            최근 {RECENT_DAYS === 60 ? '2개월' : `${RECENT_DAYS}일`} 동안 본 레시피 {items.length}개
          </div>
          {groups.map(g => (
            <section key={g.label}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-900)', margin: '0 0 8px' }}>{g.label}</h3>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {g.rows.map(r => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => openCookMode({ id: r.id, title: r.title, link: r.link })}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, width: '100%', boxSizing: 'border-box',
                        padding: 6, border: 'none', borderRadius: 12, background: 'transparent',
                        fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', color: 'var(--ink-900)',
                      }}
                    >
                      <Thumb src={r.thumbnail} />
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                          fontSize: 14, fontWeight: 600, lineHeight: 1.45, wordBreak: 'keep-all',
                        }}>{r.title || '레시피'}</span>
                        <span style={{ display: 'block', marginTop: 3, fontSize: 12, color: 'var(--ink-500)' }}>{timeLabel(r.at)}</span>
                      </span>
                      <span aria-hidden style={{ flexShrink: 0, fontSize: 14, color: 'var(--line-300)' }}>›</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Sheet>
  );
};

export default RecentRecipesSheet;
