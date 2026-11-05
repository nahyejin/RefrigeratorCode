import React from 'react';
import { Recipe, RecipeActionState } from '../types/recipe';
import { getProxiedImageUrl } from '../utils/imageUtils';
import { calculateMatchRate, loadIngredientSynonymDict, ingredientSynonymDictCache } from '../utils/recipeUtils';
import { parseUsedIngredientsForPills } from '../utils/ingredientPillNoise';
import { openCookMode } from '../utils/cookMode';
import { requestShare } from '../utils/recipeShare';
import { track } from '../utils/track';
import { scheduleSavePrompt } from '../utils/loginGate';
import KebabMenu, { KebabItem } from './ui/KebabMenu';

/**
 * 레시피 **한 줄짜리 세로 행** — 요즘인기 목록용(2026-11-06 당근식 개편).
 *
 * 가로 카드(`RecipeCard`)는 사진이 커서 한 화면에 1.3장밖에 안 보였다. 훑어보는 자리에서는 같은 정보를
 * 88px 사진 + 제목 두 줄 + 한 줄 요약으로 줄여 한 화면에 5~6개가 보이게 한다.
 * 자주 안 쓰는 완료·기록·공유는 `⋯` 뒤로, 즐겨찾기(☆)만 바로 보인다.
 *
 * 재료 계산은 `RecipeCard` 와 같은 규칙(대체 가능한 재료는 「가진 것」으로 세지 않고 「대체 N」으로 따로 적는다)이다.
 */
interface RecipeRowProps {
  recipe: Recipe;
  /** 1부터 시작하는 순위. 안 넘기면 순위 칸을 그리지 않는다. */
  rank?: number;
  recipeActionState?: RecipeActionState;
  onRecipeAction: (recipe: Recipe & { action: 'done' | 'share' | 'write' | 'favorite' }) => void;
  myIngredients?: string[];
  substituteTable?: { [key: string]: { ingredient_b: string; similarity_score?: number }[] };
  onThumbnailError?: (recipeId: number) => void;
}

const normalize = (s: string) => (s || '').trim().toLowerCase();

const sourceOf = (platform?: string): 'naver' | 'youtube' | null => {
  const p = (platform || '').toLowerCase();
  if (p.includes('naver') || (platform || '').includes('네이버')) return 'naver';
  if (p.includes('youtube') || (platform || '').includes('유튜브')) return 'youtube';
  return null;
};

const RecipeRow: React.FC<RecipeRowProps> = ({
  recipe, rank, recipeActionState, onRecipeAction,
  myIngredients = [], substituteTable = {}, onThumbnailError,
}) => {
  const [broken, setBroken] = React.useState(false);
  const [synonymDict, setSynonymDict] = React.useState<{ [key: string]: string } | null>(ingredientSynonymDictCache);

  React.useEffect(() => {
    if (!recipe.thumbnail || !recipe.thumbnail.trim()) {
      onThumbnailError?.(recipe.id);
      setBroken(true);
    }
  }, [recipe.thumbnail, recipe.id, onThumbnailError]);

  React.useEffect(() => {
    if (ingredientSynonymDictCache) { setSynonymDict(ingredientSynonymDictCache); return; }
    loadIngredientSynonymDict().then(setSynonymDict);
  }, []);

  if (broken) return null;

  const used = parseUsedIngredientsForPills(recipe.used_ingredients);
  const match = calculateMatchRate(
    myIngredients,
    Array.isArray(recipe.used_ingredients) ? recipe.used_ingredients.join(',') : recipe.used_ingredients || '',
    synonymDict || undefined,
  );

  // 없는 재료 중 냉장고의 다른 재료로 대신할 수 있는 것은 「부족」에서 뺀다(RecipeCard 와 같은 규칙).
  const mySet = new Set(myIngredients.map(normalize));
  const lacking = (match.need_ingredients || []).filter(ing => {
    const key = Object.keys(substituteTable).find(k => normalize(k) === normalize(ing));
    const subs = key ? substituteTable[key] : undefined;
    return !(subs && subs.some(s => mySet.has(normalize(s.ingredient_b))));
  });
  const substituted = Math.max(0, (match.need_ingredients?.length || 0) - lacking.length);
  const have = Math.max(0, used.length - lacking.length - substituted);

  const src = sourceOf(recipe.platform);

  const open = () => {
    try { track('recipe_open', String(recipe.id)); } catch { /* 기록 실패가 화면을 막지 않는다 */ }
    try { scheduleSavePrompt(); } catch { /* 제안이 안 떠도 레시피는 열린다 */ }
    openCookMode({ id: recipe.id, title: recipe.title, link: recipe.link, myIngredients });
  };

  const act = (action: 'done' | 'write' | 'share' | 'favorite') => onRecipeAction({ ...recipe, action });

  const menu: KebabItem[] = [
    { label: recipeActionState?.done ? '완료 취소' : '완료했어요', onClick: () => act('done'), danger: !!recipeActionState?.done },
    { label: recipeActionState?.write ? '기록 취소' : '기록하기', onClick: () => act('write'), danger: !!recipeActionState?.write },
    {
      label: '공유하기',
      onClick: () => {
        // 식구가 있으면 「링크 복사 / 가족에게 보내기」를 고르게 한다(없으면 바로 링크 복사).
        void requestShare({
          id: Number(recipe.id), title: recipe.title, link: recipe.link,
          copyLink: () => act('share'),
        });
      },
    },
  ];

  const fav = !!recipeActionState?.favorite;
  const tag = substituted > 0 ? { text: `대체 ${substituted}`, soft: true } : used.length > 0 ? { text: `재료 ${used.length}개`, soft: false } : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}
      style={{
        display: 'flex', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--line-200)',
        cursor: 'pointer', alignItems: 'stretch',
      }}
    >
      {rank !== undefined && (
        <span style={{
          flex: 'none', width: 22, paddingTop: 2, textAlign: 'center', fontSize: 17, fontWeight: 800,
          fontVariantNumeric: 'tabular-nums', color: rank <= 3 ? 'var(--ink-900)' : 'var(--ink-500)',
        }}>
          {rank}
        </span>
      )}
      <span style={{ position: 'relative', flex: 'none', width: 88, height: 88, borderRadius: 12, background: 'var(--surface-sub)', overflow: 'hidden' }}>
        <img
          src={getProxiedImageUrl(recipe.thumbnail || '')}
          alt=""
          loading="lazy"
          onError={() => { onThumbnailError?.(recipe.id); setBroken(true); }}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        {src && (
          <i style={{
            position: 'absolute', left: 5, bottom: 5, fontStyle: 'normal', fontSize: 10.5, fontWeight: 800,
            color: '#FFFFFF', borderRadius: 4, padding: '1px 5px', lineHeight: 1.4,
            background: src === 'naver' ? '#03C75A' : '#E52D27',
          }}>
            {src === 'naver' ? 'N' : 'YT'}
          </i>
        )}
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span style={{
          fontSize: 14.5, fontWeight: 700, lineHeight: 1.4, color: 'var(--ink-900)',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'keep-all',
        }}>
          {recipe.title}
        </span>
        <span style={{ marginTop: 4, fontSize: 12.5, color: 'var(--ink-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {used.length > 0 && (
            <b style={{ fontWeight: 700, color: match.rate >= 70 ? '#2C6BD6' : 'var(--ink-900)' }}>
              내 재료 {have}/{used.length}
            </b>
          )}
          {recipe.comments ? `${used.length > 0 ? ' · ' : ''}댓글 ${recipe.comments}` : ''}
        </span>
        <span style={{ marginTop: 'auto', paddingTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 30 }}>
          {tag ? (
            <span style={{
              fontSize: 11.5, fontWeight: 700, borderRadius: 6, padding: '2px 7px',
              background: tag.soft ? '#FFF1A8' : 'var(--surface-sub)', color: tag.soft ? '#6B5200' : 'var(--ink-700)',
            }}>
              {tag.text}
            </span>
          ) : <span />}
          <button
            type="button"
            aria-label={fav ? '즐겨찾기 해제' : '즐겨찾기'}
            aria-pressed={fav}
            onClick={e => { e.stopPropagation(); act('favorite'); }}
            style={{
              width: 30, height: 30, margin: '-4px -4px -4px 0', padding: 0, border: 'none', background: 'transparent',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <span aria-hidden style={{
              width: 26, height: 26, borderRadius: 9999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: fav ? '#FFD600' : 'transparent', transition: 'background .15s ease',
            }}>
              <svg width={17} height={17} viewBox="0 0 24 24">
                <path
                  d="M12 2.75l2.72 5.51 6.08.88-4.4 4.29 1.04 6.05L12 16.62 6.56 19.48l1.04-6.05-4.4-4.29 6.08-.88L12 2.75z"
                  fill={fav ? '#1A1A1E' : 'none'} stroke={fav ? '#1A1A1E' : '#9A9AA3'} strokeWidth="2" strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>
        </span>
      </span>
      <span
        onClick={e => e.stopPropagation()}
        style={{ flex: 'none', alignSelf: 'flex-start', margin: '-6px -8px 0 -4px' }}
      >
        <KebabMenu items={menu} ariaLabel={`${recipe.title} 더보기`} />
      </span>
    </div>
  );
};

export default RecipeRow;
