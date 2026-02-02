"""
재료 대체제 자동 생성 스크립트

ingredient_profile_dict_with_substitutes.csv의 분류와 Feature를 기반으로
대체 가능한 재료 쌍을 자동으로 생성합니다.
"""

import pandas as pd
import os
from collections import defaultdict
from typing import List, Dict, Tuple
import re

# 경로 설정
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INGREDIENT_CSV = os.path.join(BASE_DIR, 'frontend', 'public', 'ingredient_profile_dict_with_substitutes.csv')
OUTPUT_CSV = os.path.join(BASE_DIR, 'frontend', 'public', 'ingredient_substitute_table.csv')


def parse_features(feature_str: str) -> list:
    """Feature 문자열을 파싱하여 특징 리스트 반환 (순서 보존)"""
    if pd.isna(feature_str) or not feature_str:
        return []
    
    # 쉼표로 분리하고 공백 제거
    features = [f.strip() for f in str(feature_str).split(',')]
    return [f for f in features if f]


def calculate_feature_similarity(features1: list, features2: list) -> float:
    """두 재료의 Feature 유사도 계산 (0~1) - 순서 가중치 적용
    
    앞에 있는 Feature일수록 더 높은 가중치를 부여합니다.
    특히 앞 3개는 맛과 관련된 중요한 특성이므로 더 높은 가중치를 줍니다.
    """
    if not features1 or not features2:
        return 0.0
    
    # 중복 제거하면서 순서 유지
    features1_set = set(features1)
    features2_set = set(features2)
    
    if not features1_set or not features2_set:
        return 0.0
    
    intersection = features1_set & features2_set
    union = features1_set | features2_set
    
    if not union:
        return 0.0
    
    # 기본 Jaccard 유사도
    base_similarity = len(intersection) / len(union)
    
    # 순서 가중치 적용
    weighted_score = 0.0
    total_weight = 0.0
    
    # features1의 각 Feature에 대해 가중치 계산
    for idx, feature in enumerate(features1):
        # 앞에 있을수록 높은 가중치 (앞 3개는 더 높게)
        if idx < 3:
            weight = 1.0 - (idx * 0.15)  # 첫 번째: 1.0, 두 번째: 0.85, 세 번째: 0.7
        else:
            weight = max(0.3, 0.7 - ((idx - 3) * 0.1))  # 네 번째부터 점진적으로 감소
        
        total_weight += weight
        
        # 공통 Feature인 경우 가중치 추가
        if feature in intersection:
            weighted_score += weight
    
    # features2의 각 Feature에 대해서도 동일하게 계산
    for idx, feature in enumerate(features2):
        if idx < 3:
            weight = 1.0 - (idx * 0.15)
        else:
            weight = max(0.3, 0.7 - ((idx - 3) * 0.1))
        
        total_weight += weight
        
        if feature in intersection:
            weighted_score += weight
    
    # 가중치가 적용된 유사도 (정규화)
    if total_weight > 0:
        weighted_similarity = weighted_score / total_weight
        # 기본 유사도와 가중치 유사도를 결합 (가중치 유사도에 더 높은 비중)
        return (base_similarity * 0.3) + (weighted_similarity * 0.7)
    
    return base_similarity


def calculate_category_similarity(info_a: dict, info_b: dict) -> Tuple[float, str, str]:
    """분류 유사도 계산 및 일치 수준 반환
    
    Returns:
        (similarity_score, match_level, match_details)
        - similarity_score: 0~1 점수
        - match_level: 일치한 최고 분류 수준 (중분류/소분류/세분류/세세분류)
        - match_details: 상세 일치 정보
    """
    match_level = "없음"
    match_details = []
    score = 0.0
    
    # 세세분류 일치 (가장 높은 점수)
    if info_a['세세분류'] and info_b['세세분류']:
        if info_a['세세분류'] == info_b['세세분류']:
            match_level = "세세분류"
            match_details.append(f"세세분류: {info_a['세세분류']}")
            score = 1.0
            return (score, match_level, ", ".join(match_details))
    
    # 세분류 일치
    if info_a['세분류'] and info_b['세분류']:
        if info_a['세분류'] == info_b['세분류']:
            match_level = "세분류"
            match_details.append(f"세분류: {info_a['세분류']}")
            score = 0.8
            # 세세분류가 다르면 약간 감점
            if info_a['세세분류'] != info_b['세세분류']:
                score = 0.75
            return (score, match_level, ", ".join(match_details))
    
    # 소분류 일치
    if info_a['소분류'] and info_b['소분류']:
        if info_a['소분류'] == info_b['소분류']:
            match_level = "소분류"
            match_details.append(f"소분류: {info_a['소분류']}")
            score = 0.6
            # 세분류가 다르면 감점
            if info_a['세분류'] != info_b['세분류']:
                score = 0.5
            return (score, match_level, ", ".join(match_details))
    
    # 중분류 일치
    if info_a['중분류'] and info_b['중분류']:
        if info_a['중분류'] == info_b['중분류']:
            match_level = "중분류"
            match_details.append(f"중분류: {info_a['중분류']}")
            score = 0.4
            # 소분류가 다르면 감점
            if info_a['소분류'] != info_b['소분류']:
                score = 0.3
            return (score, match_level, ", ".join(match_details))
    
    return (0.0, "없음", "분류 일치 없음")


def calculate_combined_similarity(feature_sim: float, category_sim: float, 
                                 feature_weight: float = 0.4, 
                                 category_weight: float = 0.6) -> float:
    """Feature 유사도와 분류 유사도를 결합한 최종 유사도
    
    분류 일치가 Feature보다 더 중요하므로 분류에 더 높은 가중치를 부여합니다.
    """
    return (feature_sim * feature_weight) + (category_sim * category_weight)


def get_substitution_reason(features_a: list, features_b: list, category_b: str) -> str:
    """대체 사유 생성"""
    reasons = []
    
    # Feature 차이점 분석 (리스트를 set으로 변환)
    features_a_set = set(features_a)
    features_b_set = set(features_b)
    only_b = features_b_set - features_a_set
    
    # 대체 관련 키워드 확인
    if any('대체' in f or '저당' in f or '저칼로리' in f or '비건' in f for f in only_b):
        if '저당' in str(only_b) or '대체당' in category_b:
            reasons.append('저당')
        if '저칼로리' in str(only_b):
            reasons.append('다이어트')
        if '비건' in str(only_b):
            reasons.append('비건')
    
    # 공통 Feature 기반
    common = features_a_set & features_b_set
    if '단맛' in common:
        reasons.append('단맛 유사')
    if '짠맛' in common or '감칠맛' in common:
        reasons.append('향 유사')
    if '아삭함' in common or '담백함' in common:
        reasons.append('식감 유사')
    
    # 세분류 기반
    if '대체당' in category_b:
        reasons.append('대체당')
    if '대체면' in category_b:
        reasons.append('대체면')
    
    return ', '.join(reasons) if reasons else '유사한 특성'


def is_substitute_direction_valid(ingredient_a: str, ingredient_b: str, 
                                   category_a: str, category_b: str,
                                   features_a: set, features_b: set) -> bool:
    """대체 방향이 유효한지 확인 (일반 재료 → 특수/대체 재료)"""
    
    # ingredient_b가 대체재 관련 키워드를 포함하는지 확인
    has_substitute_keyword = (
        '대체' in category_b or
        any('대체' in f or '저당' in f or '저칼로리' in f for f in features_b)
    )
    
    # ingredient_a가 일반 재료인지 확인
    is_general = (
        '대체' not in category_a and
        not any('대체' in f for f in features_a)
    )
    
    # 일반 재료 → 대체재 방향이면 True
    if is_general and has_substitute_keyword:
        return True
    
    # 둘 다 일반 재료이거나 둘 다 대체재인 경우, 같은 분류면 허용
    if category_a == category_b:
        return True
    
    # 특수 케이스: 간장 → 쯔유 같은 경우 (둘 다 일반 재료지만 유사)
    if not has_substitute_keyword and not is_general:
        return True
    
    return False


def generate_substitutes() -> List[Dict]:
    """대체제 쌍 생성"""
    print(f"[INFO] 재료 사전 로드: {INGREDIENT_CSV}")
    df = pd.read_csv(INGREDIENT_CSV, encoding='utf-8')
    
    # "재료" 대분류만 필터링
    df_ingredients = df[df['대분류'] == '재료'].copy()
    print(f"[OK] 재료 개수: {len(df_ingredients)}")
    
    # 재료별 정보 저장
    ingredients_info = {}
    for _, row in df_ingredients.iterrows():
        keyword = str(row['keyword']).strip()
        if not keyword or keyword == 'nan':
            continue
        
        ingredients_info[keyword] = {
            'keyword': keyword,
            '중분류': str(row['중분류']) if not pd.isna(row['중분류']) else '',
            '소분류': str(row['소분류']) if not pd.isna(row['소분류']) else '',
            '세분류': str(row['세분류']) if not pd.isna(row['세분류']) else '',
            '세세분류': str(row['세세분류']) if not pd.isna(row['세세분류']) else '',
            'features': parse_features(row['Feature']),
        }
    
    # 중분류별로 그룹화
    groups_by_mid = defaultdict(list)
    groups_by_sub = defaultdict(list)
    
    for keyword, info in ingredients_info.items():
        if info['중분류']:
            groups_by_mid[info['중분류']].append(keyword)
        if info['소분류']:
            groups_by_sub[info['소분류']].append(keyword)
    
    print(f"[INFO] 중분류 그룹: {len(groups_by_mid)}개")
    print(f"[INFO] 소분류 그룹: {len(groups_by_sub)}개")
    
    # 대체제 쌍 생성
    substitutes = []
    processed_pairs = set()
    
    # 1. 같은 중분류 내에서 매칭
    for mid_category, keywords in groups_by_mid.items():
        if len(keywords) < 2:
            continue
        
        for i, keyword_a in enumerate(keywords):
            for keyword_b in keywords[i+1:]:
                pair_key = tuple(sorted([keyword_a, keyword_b]))
                if pair_key in processed_pairs:
                    continue
                
                info_a = ingredients_info[keyword_a]
                info_b = ingredients_info[keyword_b]
                
                # Feature 유사도 계산
                feature_sim = calculate_feature_similarity(info_a['features'], info_b['features'])
                
                # 분류 유사도 계산
                category_sim, match_level, match_details = calculate_category_similarity(info_a, info_b)
                
                # 최종 유사도 계산 (Feature 60%, 분류 40%)
                similarity = calculate_combined_similarity(feature_sim, category_sim)
                
                # 최소 유사도 임계값 (0.3 이상)
                if similarity < 0.3:
                    continue
                
                # 대체 방향 결정
                if is_substitute_direction_valid(
                    keyword_a, keyword_b,
                    info_a['세분류'], info_b['세분류'],
                    info_a['features'], info_b['features']
                ):
                    ingredient_a, ingredient_b = keyword_a, keyword_b
                elif is_substitute_direction_valid(
                    keyword_b, keyword_a,
                    info_b['세분류'], info_a['세분류'],
                    info_b['features'], info_a['features']
                ):
                    ingredient_a, ingredient_b = keyword_b, keyword_a
                    info_a, info_b = info_b, info_a
                else:
                    # 양방향 모두 유효하지 않으면 스킵
                    continue
                
                # 대체 사유 생성
                reason = get_substitution_reason(
                    info_a['features'], 
                    info_b['features'],
                    info_b['세분류']
                )
                
                # 공통 Feature 추출 (리스트에서)
                features_a_set = set(info_a['features'])
                features_b_set = set(info_b['features'])
                common_features = features_a_set & features_b_set
                only_a_features = features_a_set - features_b_set
                only_b_features = features_b_set - features_a_set
                
                # 계산 상세 내역 생성
                calc_details = []
                calc_details.append(f"Feature유사도: {feature_sim:.2f}")
                calc_details.append(f"분류유사도: {category_sim:.2f} ({match_level})")
                calc_details.append(f"최종점수: {similarity:.2f}")
                if common_features:
                    calc_details.append(f"공통특성: {', '.join(sorted(common_features))}")
                if match_details:
                    calc_details.append(f"분류일치: {match_details}")
                
                substitutes.append({
                    'ingredient_a': ingredient_a,
                    'ingredient_b': ingredient_b,
                    'substitution_direction': f"{ingredient_a}→{ingredient_b}",
                    'similarity_score': round(similarity, 2),
                    'substitution_reason': reason,
                    'feature_similarity': round(feature_sim, 2),
                    'category_similarity': round(category_sim, 2),
                    'category_match_level': match_level,
                    'calculation_details': " | ".join(calc_details)
                })
                
                processed_pairs.add(pair_key)
    
    # 2. 같은 소분류 내에서 매칭 (중분류와 다른 경우)
    for sub_category, keywords in groups_by_sub.items():
        if len(keywords) < 2:
            continue
        
        for i, keyword_a in enumerate(keywords):
            for keyword_b in keywords[i+1:]:
                pair_key = tuple(sorted([keyword_a, keyword_b]))
                if pair_key in processed_pairs:
                    continue
                
                info_a = ingredients_info[keyword_a]
                info_b = ingredients_info[keyword_b]
                
                # 중분류가 다르면 스킵 (너무 다른 재료)
                if info_a['중분류'] != info_b['중분류']:
                    continue
                
                # Feature 유사도 계산
                feature_sim = calculate_feature_similarity(info_a['features'], info_b['features'])
                
                # 분류 유사도 계산
                category_sim, match_level, match_details = calculate_category_similarity(info_a, info_b)
                
                # 최종 유사도 계산 (Feature 60%, 분류 40%)
                similarity = calculate_combined_similarity(feature_sim, category_sim)
                
                if similarity < 0.3:
                    continue
                
                if is_substitute_direction_valid(
                    keyword_a, keyword_b,
                    info_a['세분류'], info_b['세분류'],
                    info_a['features'], info_b['features']
                ):
                    ingredient_a, ingredient_b = keyword_a, keyword_b
                elif is_substitute_direction_valid(
                    keyword_b, keyword_a,
                    info_b['세분류'], info_a['세분류'],
                    info_b['features'], info_a['features']
                ):
                    ingredient_a, ingredient_b = keyword_b, keyword_a
                    info_a, info_b = info_b, info_a
                else:
                    continue
                
                reason = get_substitution_reason(
                    info_a['features'], 
                    info_b['features'],
                    info_b['세분류']
                )
                
                # 공통 Feature 추출 (리스트에서)
                features_a_set = set(info_a['features'])
                features_b_set = set(info_b['features'])
                common_features = features_a_set & features_b_set
                only_a_features = features_a_set - features_b_set
                only_b_features = features_b_set - features_a_set
                
                # 계산 상세 내역 생성
                calc_details = []
                calc_details.append(f"Feature유사도: {feature_sim:.2f}")
                calc_details.append(f"분류유사도: {category_sim:.2f} ({match_level})")
                calc_details.append(f"최종점수: {similarity:.2f}")
                if common_features:
                    calc_details.append(f"공통특성: {', '.join(sorted(common_features))}")
                if match_details:
                    calc_details.append(f"분류일치: {match_details}")
                
                substitutes.append({
                    'ingredient_a': ingredient_a,
                    'ingredient_b': ingredient_b,
                    'substitution_direction': f"{ingredient_a}→{ingredient_b}",
                    'similarity_score': round(similarity, 2),
                    'substitution_reason': reason,
                    'feature_similarity': round(feature_sim, 2),
                    'category_similarity': round(category_sim, 2),
                    'category_match_level': match_level,
                    'calculation_details': " | ".join(calc_details)
                })
                
                processed_pairs.add(pair_key)
    
    # 유사도 순으로 정렬
    substitutes.sort(key=lambda x: x['similarity_score'], reverse=True)
    
    print(f"[OK] 생성된 대체제 쌍: {len(substitutes)}개")
    return substitutes


def save_substitutes(substitutes: List[Dict], overwrite: bool = False):
    """대체제를 CSV 파일로 저장"""
    print(f"[INFO] 대체제 저장: {OUTPUT_CSV}")
    
    # overwrite가 True이면 기존 데이터 무시하고 새로 생성
    if overwrite:
        print("[INFO] 기존 데이터 무시하고 새로 생성합니다.")
        all_substitutes = substitutes
    else:
        # 기존 데이터 읽기 (있는 경우)
        existing_data = []
        if os.path.exists(OUTPUT_CSV):
            try:
                # UTF-8 또는 UTF-8-BOM 모두 읽을 수 있도록 시도
                try:
                    existing_df = pd.read_csv(OUTPUT_CSV, encoding='utf-8-sig')
                except:
                    existing_df = pd.read_csv(OUTPUT_CSV, encoding='utf-8')
                # 기존에 데이터가 있는 행만 유지
                for _, row in existing_df.iterrows():
                    if pd.notna(row['ingredient_a']) and pd.notna(row['ingredient_b']):
                        existing_data.append({
                            'ingredient_a': str(row['ingredient_a']).strip(),
                            'ingredient_b': str(row['ingredient_b']).strip(),
                            'substitution_direction': str(row['substitution_direction']).strip() if pd.notna(row['substitution_direction']) else '',
                            'similarity_score': float(row['similarity_score']) if pd.notna(row['similarity_score']) else 0.0,
                            'substitution_reason': str(row['substitution_reason']).strip() if pd.notna(row['substitution_reason']) else '',
                        })
            except Exception as e:
                print(f"[WARN] 기존 파일 읽기 실패 (새로 생성): {e}")
        
        # 중복 제거 (기존 데이터 우선)
        existing_pairs = {(d['ingredient_a'], d['ingredient_b']) for d in existing_data}
        new_substitutes = [
            s for s in substitutes 
            if (s['ingredient_a'], s['ingredient_b']) not in existing_pairs
        ]
        
        # 기존 데이터 + 새 데이터 합치기
        all_substitutes = existing_data + new_substitutes
    
    # DataFrame 생성
    df_output = pd.DataFrame(all_substitutes)
    df_output.insert(0, 'index', range(1, len(df_output) + 1))
    
    # CSV 저장 (UTF-8-BOM으로 저장하여 Excel에서 한글이 깨지지 않도록)
    df_output.to_csv(OUTPUT_CSV, index=False, encoding='utf-8-sig')
    
    print(f"[OK] 저장 완료: 총 {len(all_substitutes)}개 대체제 쌍")
    if not overwrite:
        print(f"   - 기존: {len(existing_data)}개")
        print(f"   - 신규: {len(new_substitutes)}개")
    
    # 상위 10개 출력
    print("\n[INFO] 생성된 대체제 쌍 (상위 10개):")
    for i, sub in enumerate(all_substitutes[:10], 1):
        print(f"   {i}. {sub['ingredient_a']} → {sub['ingredient_b']} "
              f"(유사도: {sub['similarity_score']:.2f}, 이유: {sub['substitution_reason']})")


def main():
    """메인 함수"""
    print("=" * 60)
    print("[START] 재료 대체제 자동 생성 시작")
    print("=" * 60)
    
    try:
        # 대체제 생성
        substitutes = generate_substitutes()
        
        if not substitutes:
            print("[WARN] 생성된 대체제가 없습니다.")
            return
        
        # 저장 (기존 데이터 무시하고 새로 생성)
        save_substitutes(substitutes, overwrite=True)
        
        print("\n" + "=" * 60)
        print("[OK] 완료!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n[ERROR] 오류 발생: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()

