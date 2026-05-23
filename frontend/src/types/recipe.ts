// =====================
// 상수
// =====================

export const PLATFORMS = {
  YOUTUBE: 'youtube',
  NAVER: 'naver',
} as const;

export const ACTIONS = {
  DONE: 'done',
  SHARE: 'share',
  WRITE: 'write',
} as const;

// =====================
// 기본 타입
// =====================

export type Platform = typeof PLATFORMS[keyof typeof PLATFORMS];
export type Action = typeof ACTIONS[keyof typeof ACTIONS];

// =====================
// 레시피 관련 타입
// =====================

/**
 * 레시피 기본 정보
 */
export interface Recipe {
  id: number;
  title: string;
  body: string;
  content?: string;
  description?: string;
  author: string;
  date: string;
  thumbnail: string;
  link: string;
  
  // 플랫폼 정보
  platform: Platform;
  channel: Platform;
  
  // 재료 정보
  used_ingredients: string | string[];
  used_ingredients_block?: string;
  block_reason?: string;
  substitutes?: string[];
  
  // 통계 정보
  likes: number;
  comments: number;
  like_count: number;
  comment_count: number;
  hits?: number;  // Optional for Naver recipes
  
  // 매칭 정보
  match_rate?: number;
  my_ingredients?: string[];
  need_ingredients?: string[];
  
  // 시간 정보
  created_at: string;
  updated_at: string;
  post_time?: string;
  collected_at?: string;
  user_saved_at?: string;
  saved_at?: string;
  recorded_at?: string;
  completed_at?: string;
  
  // 액션 정보
  action?: Action;
}

/**
 * 대체재료 정보
 */
export interface SubstituteInfo {
  ingredient_a: string;
  ingredient_b: string;
  substitution_direction: string;
  similarity_score: number;
  substitution_reason: string;
}

/**
 * 레시피 액션 상태
 */
export interface RecipeActionState {
  done: boolean;
  share: boolean;
  write: boolean;
}

/**
 * 레시피 매칭 결과
 */
export interface RecipeMatchResult {
  rate: number;
  my_ingredients: string[];
  need_ingredients: string[];
}

// =====================
// 필터 관련 타입
// =====================

/**
 * 필터 상태
 */
export interface FilterState {
  효능: string[];
  영양분: string[];
  대상: string[];
  TPO: string[];
  스타일: string[];
  [key: string]: string[];
} 