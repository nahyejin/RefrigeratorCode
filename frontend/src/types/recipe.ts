export interface Recipe {
  id: number;
  title: string;
  author: string;
  date: string;
  body: string;
  thumbnail: string;
  used_ingredients: string;
  substitutes?: string[];
  match_rate?: number;
  my_ingredients?: string[];
  need_ingredients?: string[];
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