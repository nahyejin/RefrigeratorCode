"""
CSV 파일 인코딩 수정 스크립트

Excel에서 한글이 깨지지 않도록 UTF-8-BOM으로 변환합니다.
"""

import pandas as pd
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_FILE = os.path.join(BASE_DIR, 'frontend', 'public', 'ingredient_substitute_table.csv')

def fix_encoding():
    """CSV 파일을 UTF-8-BOM으로 변환"""
    print(f"[INFO] 파일 읽기: {CSV_FILE}")
    
    if not os.path.exists(CSV_FILE):
        print(f"[ERROR] 파일이 존재하지 않습니다: {CSV_FILE}")
        return
    
    try:
        # UTF-8 또는 UTF-8-BOM으로 읽기 시도
        try:
            df = pd.read_csv(CSV_FILE, encoding='utf-8-sig')
            print("[OK] UTF-8-BOM으로 읽기 성공")
        except:
            try:
                df = pd.read_csv(CSV_FILE, encoding='utf-8')
                print("[OK] UTF-8로 읽기 성공")
            except:
                df = pd.read_csv(CSV_FILE, encoding='cp949')
                print("[OK] CP949로 읽기 성공")
        
        # UTF-8-BOM으로 저장 (Excel에서 한글이 깨지지 않음)
        df.to_csv(CSV_FILE, index=False, encoding='utf-8-sig')
        print(f"[OK] UTF-8-BOM으로 저장 완료: {CSV_FILE}")
        print("[INFO] 이제 Excel에서 파일을 열면 한글이 정상적으로 표시됩니다.")
        
    except PermissionError:
        print("[ERROR] 파일이 다른 프로그램(Excel 등)에서 열려있습니다.")
        print("[INFO] 파일을 닫고 다시 실행해주세요.")
    except Exception as e:
        print(f"[ERROR] 오류 발생: {e}")

if __name__ == '__main__':
    print("=" * 60)
    print("[START] CSV 인코딩 수정 시작")
    print("=" * 60)
    fix_encoding()
    print("=" * 60)

