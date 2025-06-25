#!/usr/bin/env python3
"""
백엔드 운영 환경 실행 스크립트
"""
import os
import sys

# 환경변수 설정
os.environ['FLASK_ENV'] = 'production'

# 현재 디렉토리를 Python 경로에 추가
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app

if __name__ == '__main__':
    print("🚀 백엔드 운영 서버 시작...")
    print(f"📍 환경: {os.getenv('FLASK_ENV', 'production')}")
    print(f"🌐 URL: http://0.0.0.0:5000")
    print(f"🔧 Debug 모드: {os.getenv('FLASK_DEBUG', 'false')}")
    app.run(host='0.0.0.0', port=5000, debug=False) 