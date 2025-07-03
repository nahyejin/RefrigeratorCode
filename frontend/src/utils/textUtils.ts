/**
 * 유니코드 이스케이프 시퀀스를 한글로 디코딩하는 함수
 */
export function decodeUnicode(text: string): string {
  if (!text || typeof text !== 'string') return text;
  
  // 유니코드 이스케이프 시퀀스가 있는지 확인
  if (text.includes('\\u')) {
    try {
      return text.replace(/\\u[\dA-F]{4}/gi, (match) => {
        return String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16));
      });
    } catch (error) {
      console.warn('유니코드 디코딩 실패:', error);
      return text;
    }
  }
  
  return text;
}

/**
 * 레시피 객체의 모든 텍스트 필드를 디코딩하는 함수
 */
export function decodeRecipeText(recipe: any): any {
  if (!recipe) return recipe;
  
  const decodedRecipe = { ...recipe };
  
  // 텍스트 필드들 디코딩
  const textFields = ['title', 'content', 'author', 'platform', 'used_ingredients', 'used_ingredients_block'];
  
  textFields.forEach(field => {
    if (decodedRecipe[field]) {
      decodedRecipe[field] = decodeUnicode(decodedRecipe[field]);
    }
  });
  
  return decodedRecipe;
}

/**
 * 레시피 배열의 모든 텍스트를 디코딩하는 함수
 */
export function decodeRecipesText(recipes: any[]): any[] {
  if (!Array.isArray(recipes)) return recipes;
  
  return recipes.map(recipe => decodeRecipeText(recipe));
} 