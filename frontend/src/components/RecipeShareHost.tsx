import React from 'react';
import { createPortal } from 'react-dom';
import Dialog from './ui/Dialog';
import { closeShare, getHouseholdOthers, sendRecipeToFamily, subscribeShare, type HouseholdMember, type ShareTarget } from '../utils/recipeShare';
import { track } from '../utils/track';

/**
 * 레시피 「공유」를 눌렀을 때, 가족 그룹이 있으면 뜨는 고르는 창(앱에 하나).
 *   ① 링크 복사하기 — 예전 그대로
 *   ② 가족에게 보내기 — 고른 식구에게 「OOO님이 레시피를 보냈어요 / "제목"」 푸시
 * 알림을 누른 식구는 냉장고요리에서 그 레시피 패널이 열리고, 닫을 때 「언제 해먹을까요?」를 묻는다.
 */
const RecipeShareHost: React.FC = () => {
  const [target, setTarget] = React.useState<ShareTarget | null>(null);
  const [others, setOthers] = React.useState<HouseholdMember[]>([]);
  const [picked, setPicked] = React.useState<number[]>([]);
  const [sending, setSending] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => subscribeShare(t => {
    setTarget(t);
    if (t) {
      getHouseholdOthers().then(({ others: o }) => { setOthers(o); setPicked(o.map(m => m.id)); });
    }
  }), []);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const toggle = (id: number) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));

  const send = async () => {
    if (!target || picked.length === 0 || sending) return;
    setSending(true);
    try {
      const { recipients } = await sendRecipeToFamily(target.id, picked);
      track('recipe_action', 'share_family');
      const names = recipients.map(r => r.nickname).join(', ');
      const missed = recipients.filter(r => !r.delivered).map(r => r.nickname);
      setToast(missed.length === 0
        ? `${names}님에게 보냈어요`
        : missed.length === recipients.length
          ? `${names}님은 알림을 받을 기기가 없어요 (앱에서 알림을 켜야 받아요)`
          : `보냈어요 · ${missed.join(', ')}님은 알림이 꺼져 있어요`);
      closeShare();
    } catch (e: any) {
      setToast(e?.message || '보내지 못했어요');
    } finally {
      setSending(false);
    }
  };

  const pill = (on: boolean): React.CSSProperties => ({
    minHeight: 36, padding: '8px 14px', borderRadius: 9999, cursor: 'pointer',
    border: on ? '1px solid #1A1A1E' : '1px solid var(--line-200)',
    background: on ? '#FFD600' : 'var(--surface)',
    fontSize: 13.5, fontWeight: on ? 700 : 500, color: '#1A1A1E',
  });

  return (
    <>
      <Dialog
        open={!!target}
        onClose={closeShare}
        title="레시피 공유"
        width={340}
        showClose={false}
        nested
        dismissLabel="닫기"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {target?.title && (
            <div style={{ fontSize: 13, color: 'var(--ink-700)', lineHeight: 1.5, wordBreak: 'keep-all' }}>
              “{target.title}”
            </div>
          )}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1E', marginBottom: 8 }}>가족에게 알림으로 보내기</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {others.map(m => (
                <button key={m.id} type="button" aria-pressed={picked.includes(m.id)} onClick={() => toggle(m.id)} style={pill(picked.includes(m.id))}>
                  {picked.includes(m.id) ? '✓ ' : ''}{m.nickname}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={send}
              disabled={picked.length === 0 || sending}
              style={{
                width: '100%', minHeight: 46, marginTop: 10, borderRadius: 10, border: 'none',
                background: picked.length ? '#FFD600' : 'var(--line-200)',
                color: picked.length ? '#1A1A1E' : 'var(--ink-500)', fontSize: 14, fontWeight: 700,
                cursor: picked.length ? 'pointer' : 'default',
              }}
            >
              {sending ? '보내는 중…' : `${picked.length}명에게 보내기`}
            </button>
          </div>
          <button
            type="button"
            onClick={() => { const t = target; closeShare(); t?.copyLink(); }}
            style={{
              width: '100%', minHeight: 46, borderRadius: 10, background: 'var(--surface)',
              border: '1px solid var(--line-200)', color: '#1A1A1E', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            링크만 복사하기
          </button>
        </div>
      </Dialog>
      {toast && createPortal(
        <div className="plan-toast" role="status"><span>{toast}</span></div>,
        document.body,
      )}
    </>
  );
};

export default RecipeShareHost;
