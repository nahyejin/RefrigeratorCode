import React from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../components/ui/BackButton';
import BottomNavBar from '../components/BottomNavBar';
import { openCookMode } from '../utils/cookMode';
import { getProxiedImageUrl } from '../utils/imageUtils';
import {
  getRecentRecipes, RECENT_CHANGED_EVENT, RECENT_DAYS, RecentRecipe,
} from '../utils/recentRecipes';

/**
 * 최근 본 레시피 **화면**(마이페이지 「최근 본」 · 2026-11-05 요청, 2026-11-06 시트 → 화면).
 *
 * 최근 2개월 동안 레시피 패널을 열어 본 것을 **날짜별로 묶어** 최근 순으로 보여 준다. 누르면 그 레시피 패널이 이 목록 위로 열리고,
 * 닫으면 목록으로 돌아온다.
 *
 * 처음에는 시트(아래서 올라오는 패널)로 만들었는데, 같은 줄의 즐겨찾기·기록·완료는 전부 화면 전환이라 **한 칸만 다르게 움직였다**
 * (2026-11-06 지적). 같은 줄의 입구는 같게 움직여야 한다 — 그래서 `/mypage/recent` 화면으로 옮겼다. 뒤로가기·제목 줄·바닥 메뉴는
 * 다른 목록 화면(`IngredientDetail`)과 같은 모양이다.
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

const RecentRecipesPage: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = React.useState<RecentRecipe[]>(() => getRecentRecipes());

  React.useEffect(() => {
    const load = () => setItems(getRecentRecipes());
    load();
    // 목록 위에서 레시피를 열면 그 레시피가 맨 앞으로 올라온다 — 닫고 돌아왔을 때 순서가 맞게 다시 읽는다.
    window.addEventListener(RECENT_CHANGED_EVENT, load);
    return () => window.removeEventListener(RECENT_CHANGED_EVENT, load);
  }, []);

  // 날짜 머리글 아래로 묶는다(이미 최근 순이라 순서대로 훑으면 된다).
  const groups: Array<{ label: string; rows: RecentRecipe[] }> = [];
  for (const r of items) {
    const label = dayLabel(r.at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.rows.push(r);
    else groups.push({ label, rows: [r] });
  }

  return (
    <>
      <div
        className="mx-auto pb-20 bg-white"
        style={{
          maxWidth: 400, minHeight: '100vh', boxSizing: 'border-box',
          paddingLeft: 14, paddingRight: 14,
          paddingTop: 56, // 공통 GNB(56px)
        }}
      >
        <div style={{
          position: 'sticky', top: 56, zIndex: 'var(--z-sticky)', background: '#FFFFFF',
          marginLeft: -14, marginRight: -14, paddingLeft: 14, paddingRight: 14, paddingTop: 16, paddingBottom: 10,
        }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 36 }}>
            <BackButton onClick={() => navigate(-1)} style={{ left: 0, top: 0 }} />
            <div style={{ fontWeight: 700, fontSize: 18, textAlign: 'center', padding: '0 44px' }}>최근 본 레시피</div>
          </div>
        </div>

        {items.length === 0 ? (
          <div style={{ padding: '48px 8px 28px', textAlign: 'center', color: 'var(--ink-500)', fontSize: 14, lineHeight: 1.7, wordBreak: 'keep-all' }}>
            아직 본 레시피가 없어요.<br />
            레시피를 열어 보면 여기에 쌓여요.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 4 }}>
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
      </div>
      <BottomNavBar activeTab="mypage" />
    </>
  );
};

export default RecentRecipesPage;
