export interface Recipe {
  id: number;
  title: string;
  author: string;
  date: string;
  body: string;
  thumbnail: string;
  used_ingredients: string;
  link: string;
  substitutes?: string[];
  match_rate?: number;
  my_ingredients?: string[];
  need_ingredients?: string[];
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