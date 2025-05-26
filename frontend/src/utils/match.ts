interface MatchResult {
  rate: number;
  matched: string[];
  unmatched: string[];
}

export const calculateMatchRate = (myIngredients: string[], recipeIngredients: string): MatchResult => {
  if (!recipeIngredients) {
    return { rate: 0, matched: [], unmatched: [] };
  }

  const recipeIngredientList = recipeIngredients.split(',').map(i => i.trim()).filter(Boolean);
  const myIngredientSet = new Set(myIngredients.map(i => i.trim()));

  const matched: string[] = [];
  const unmatched: string[] = [];

  recipeIngredientList.forEach(ingredient => {
    if (myIngredientSet.has(ingredient)) {
      matched.push(ingredient);
    } else {
      unmatched.push(ingredient);
    }
  });

  const rate = recipeIngredientList.length > 0
    ? Math.round((matched.length / recipeIngredientList.length) * 100)
    : 0;

  return { rate, matched, unmatched };
}; 