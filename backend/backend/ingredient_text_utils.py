import re

# 고유어 숫자 매핑
native_korean_numbers = {
    "한": 1, "두": 2, "세": 3, "네": 4,
    "다섯": 5, "여섯": 6, "일곱": 7, "여덟": 8, "아홉": 9,
    "열": 10, "열한": 11, "열두": 12, "열세": 13, "열네": 14, "열다섯": 15,
    "열여섯": 16, "열일곱": 17, "열여덟": 18, "열아홉": 19, "스무": 20,
    "서른": 30, "마흔": 40, "쉰": 50, "예순": 60, "일흔": 70, "여든": 80, "아흔": 90,
}

# 한자식 숫자 매핑
sino_korean_numbers = {
    "일": 1, "이": 2, "삼": 3, "사": 4, "오": 5, "육": 6,
    "칠": 7, "팔": 8, "구": 9, "십": 10, "백": 100, "천": 1000,
}

# 단위 키워드
unit_keywords = [
    '개', '큰술', '작은술', '숟가락', '수저', '티스푼', '스푼',
    'ml', 'mL', 'cc', 'g', '그램', 'kg', '킬로그램', '컵', '종이컵',
    '밥숟갈', 'T', 't', '약간', '조금', '한줌', '한스푼', '숟갈'
]


# ✅ 한자식 수 표현 파싱기 (예: 이십그램 → 20그램)
def parse_sino_korean_number(text):
    num = 0
    temp = 0
    units = {"천": 1000, "백": 100, "십": 10}
    digit_map = {k: v for k, v in sino_korean_numbers.items() if v < 10}
    pos = 0
    while pos < len(text):
        char = text[pos]
        if char in digit_map:
            temp = digit_map[char]
            pos += 1
            if pos < len(text) and text[pos] in units:
                num += temp * units[text[pos]]
                pos += 1
                temp = 0
            elif pos < len(text) and text[pos] not in units:
                num += temp
        elif char in units:
            num += units[char]
            pos += 1
        else:
            break
    return num if num > 0 else None


# ✅ 수량 표현 정규화 함수
def normalize_quantity_expression(text):
    # 고유어 숫자 → 아라비아 숫자
    for native, num in native_korean_numbers.items():
        for unit in unit_keywords:
            text = re.sub(rf"\b{native}{unit}", f"{num} {unit}", text)

    # 한자식 숫자 + 단위 → 숫자 변환
    for unit in unit_keywords:
        pattern = re.compile(rf"([일이삼사오육칠팔구십백천]+){unit}")
        for match in re.finditer(pattern, text):
            sino_num = match.group(1)
            arabic = parse_sino_korean_number(sino_num)
            if arabic:
                text = text.replace(sino_num + unit, f"{arabic} {unit}")

    # ✅ 분수 + 단위 표현 정규화 (예: 1/2스푼 → 0.5 스푼)
    def safe_eval_fraction(m):
        frac = m.group(1)
        unit = m.group(2)
        numerator, denominator = map(int, frac.split("/"))
        if denominator == 0:
            # 분모가 0이면 변환하지 않고 원문 그대로 남기기
            return f"{frac} {unit}"
        else:
            return f"{numerator / denominator} {unit}"

    text = re.sub(
        rf"(\d+/\d+)\s*({'|'.join(unit_keywords)})",
        safe_eval_fraction,
        text
    )

    # 숫자와 단위 붙은 것 띄우기 (예: 2큰술 → 2 큰술)
    text = re.sub(rf"(\d+)\s*({'|'.join(unit_keywords)})", r"\1 \2", text)
    text = re.sub(rf"([가-힣]+)(\d+)\s*({'|'.join(unit_keywords)})", r"\1 \2 \3", text)
    return text