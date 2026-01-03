/**
 * 프리미엄 재료 사전
 * 
 * 고가의 재료나 특별한 재료들을 정의합니다.
 * 이 재료들이 포함된 레시피는 '오늘의 프리미엄 요리' 섹션에 표시됩니다.
 */

export const PREMIUM_INGREDIENTS: string[] = [
  // 고급 육류
  '한우',
  '소고기',
  '갈비',
  '안심',
  '등심',
  '쇠고기',
  '와규',
  '스테이크',
  '삼겹살',
  '목살',
  '갈매기살',
  
  // 해산물
  '전복',
  '새우',
  '랍스터',
  '게',
  '대게',
  '킹크랩',
  '연어',
  '참치',
  '광어',
  '도미',
  '오징어',
  '문어',
  '멍게',
  '성게',
  '해삼',
  '바지락',
  '홍합',
  '관자',
  '가리비',
  
  // 고급 채소/버섯
  '송이버섯',
  '표고버섯',
  '새송이버섯',
  '느타리버섯',
  '아스파라거스',
  '로메인',
  '치커리',
  '루꼴라',
  
  // 고급 유제품
  '모짜렐라',
  '고르곤졸라',
  '파마산',
  '리코타',
  '크림치즈',
  '버터',
  '생크림',
  
  // 고급 조미료/양념
  '트러플',
  '캐비어',
  '올리브오일',
  '발사믹',
  '와인',
  '샴페인',
  '꿀',
  '메이플시럽',
  
  // 기타 고급 재료
  '푸아그라',
  '캐비어',
  '골뱅이',
  '전복',
  '해삼',
  '성게',
  '멍게',
  '관자',
  '가리비',
  '랍스터',
  '킹크랩',
  '대게',
  '게',
  '새우',
  '연어',
  '참치',
  '광어',
  '도미',
  '오징어',
  '문어',
  '바지락',
  '홍합',
  '한우',
  '소고기',
  '갈비',
  '안심',
  '등심',
  '쇠고기',
  '와규',
  '스테이크',
  '삼겹살',
  '목살',
  '갈매기살',
  '송이버섯',
  '표고버섯',
  '새송이버섯',
  '느타리버섯',
  '아스파라거스',
  '로메인',
  '치커리',
  '루꼴라',
  '모짜렐라',
  '고르곤졸라',
  '파마산',
  '리코타',
  '크림치즈',
  '버터',
  '생크림',
  '트러플',
  '캐비어',
  '올리브오일',
  '발사믹',
  '와인',
  '샴페인',
  '꿀',
  '메이플시럽',
  '푸아그라'
];

/**
 * 재료 목록에 프리미엄 재료가 포함되어 있는지 확인
 */
export function hasPremiumIngredient(ingredients: string[]): boolean {
  const normalizedIngredients = ingredients.map(ing => ing.trim().toLowerCase());
  return PREMIUM_INGREDIENTS.some(premium => 
    normalizedIngredients.some(ing => 
      ing.includes(premium.toLowerCase()) || premium.toLowerCase().includes(ing)
    )
  );
}

/**
 * 레시피에서 프리미엄 재료만 추출
 */
export function getPremiumIngredients(recipeIngredients: string[]): string[] {
  const normalizedIngredients = recipeIngredients.map(ing => ing.trim().toLowerCase());
  return PREMIUM_INGREDIENTS.filter(premium => 
    normalizedIngredients.some(ing => 
      ing.includes(premium.toLowerCase()) || premium.toLowerCase().includes(ing)
    )
  );
}



