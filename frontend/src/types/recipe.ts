export interface Recipe {
  id: number;
  title: string;
  content?: string;
  author: string;
  date: string;
  body: string;
  thumbnail: string;
  used_ingredients: string;
  used_ingredients_block?: string;
  block_reason?: string;
  link: string;
  platform?: string;
  likes?: number;
  comments?: number;
  substitutes?: string[];
  match_rate?: number;
  my_ingredients?: string[];
  need_ingredients?: string[];
  created_at: string;
  like_count: number;
  comment_count: number;
  post_time?: string;
  collected_at?: string;
}

export interface SubstituteInfo {
  ingredient_a: string;
  ingredient_b: string;
  substitution_direction: string;
  similarity_score: number;
  substitution_reason: string;
}

export interface RecipeActionState {
  done: boolean;
  share: boolean;
  write: boolean;
}

export interface FilterState {
  효능: string[];
  영양분: string[];
  대상: string[];
  TPO: string[];
  스타일: string[];
}

export interface RecipeMatchResult {
  rate: number;
  my_ingredients: string[];
  need_ingredients: string[];
} 