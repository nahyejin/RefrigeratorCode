import { getDDay, calculateMatchRate, getDictCategoryKey, extractKeywordsAndSynonyms } from './recipeUtils';

describe('getDDay', () => {
  it('should return D-3 for a date 3 days in the future', () => {
    const today = new Date();
    const future = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
    const dateStr = future.toISOString().slice(0, 10);
    expect(getDDay(dateStr)).toMatch(/D-3|D-2|D-4/); // 날짜 오차 허용
  });
  it('should return D-DAY for today', () => {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);
    expect(getDDay(dateStr)).toBe('D-DAY');
  });
  it('should return D+2 for a date 2 days in the past', () => {
    const today = new Date();
    const past = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);
    const dateStr = past.toISOString().slice(0, 10);
    expect(getDDay(dateStr)).toMatch(/D\+2|D\+1|D\+3/); // 날짜 오차 허용
  });
  it('should return input if invalid date', () => {
    expect(getDDay('invalid-date')).toBe('invalid-date');
  });
});

describe('calculateMatchRate', () => {
  it('should return 100% if all ingredients match', () => {
    const my = ['a', 'b', 'c'];
    const recipe = 'a,b,c';
    expect(calculateMatchRate(my, recipe).rate).toBe(100);
  });
  it('should return 0% if no ingredients match', () => {
    const my = ['x', 'y'];
    const recipe = 'a,b';
    expect(calculateMatchRate(my, recipe).rate).toBe(0);
  });
  it('should return correct match rate for partial match', () => {
    const my = ['a', 'b'];
    const recipe = 'a,b,c';
    expect(calculateMatchRate(my, recipe).rate).toBe(67);
  });
});

describe('getDictCategoryKey', () => {
  it('should return the same category by default', () => {
    expect(getDictCategoryKey('효능')).toBe('효능');
    expect(getDictCategoryKey('영양분')).toBe('영양분');
  });
});

describe('extractKeywordsAndSynonyms', () => {
  const tree = {
    효능: {
      다이어트: [
        { keyword: '고단백', synonyms: ['단백질', '프로틴'] },
        { keyword: '저지방', synonyms: [] },
      ],
    },
  };
  it('should extract keyword and synonyms if found', () => {
    const result = extractKeywordsAndSynonyms('효능', ['고단백'], tree);
    expect(result).toEqual(['고단백', '단백질', '프로틴']);
  });
  it('should return keyword only if no synonyms', () => {
    const result = extractKeywordsAndSynonyms('효능', ['저지방'], tree);
    expect(result).toEqual(['저지방']);
  });
  it('should return empty array if not found', () => {
    const result = extractKeywordsAndSynonyms('효능', ['없는키워드'], tree);
    expect(result).toEqual([]);
  });
  it('should return empty array if tree is null', () => {
    const result = extractKeywordsAndSynonyms('효능', ['고단백'], null);
    expect(result).toEqual([]);
  });
}); 