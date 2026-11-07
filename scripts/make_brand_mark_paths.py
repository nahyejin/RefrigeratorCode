# -*- coding: utf-8 -*-
"""P1 확정 마크(받침·잎)의 윤곽을 SVG 경로로 뽑는다 — frontend/src/components/brand/BrandMark.tsx 의 상수 출처.

확정 시안(store/logo_proposals/e9_final/p1_final)은 Pillow 마스크(블러→문턱값으로 모서리를 둥글림)로 그려진
래스터라, 같은 모양을 SVG 로 옮기려면 그 마스크의 윤곽을 따라가야 한다(손으로 그린 근사 경로는 모서리가 어긋난다).
좌표는 확정 시안의 기준 좌표(1024 캔버스, 배율 1.0 — 앱 아이콘은 여기에 ×1.32·y중심 420 을 적용한 것).

    PYTHONIOENCODING=utf-8 python scripts/make_brand_mark_paths.py   # 경로 문자열을 출력(+검증용 PNG 는 만들지 않음)
"""
import os
import sys

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "store", "logo_proposals", "e9_final", "p1_final"))
import make_p1_final as MP  # noqa: E402

FIN, M, D, L = MP.FIN, MP.M, MP.D, MP.L
SS = L.SS
EPS = 1.6  # approxPolyDP 허용 오차(4096 px 기준 = 1024 기준 0.4)


def trace(mask, eps=EPS):
    a = cv2.GaussianBlur(np.array(mask.convert("L")), (0, 0), 2.0)  # 계단 제거
    _, b = cv2.threshold(a, 127, 255, cv2.THRESH_BINARY)
    cs, _ = cv2.findContours(b, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)
    c = cv2.approxPolyDP(c, eps, True)[:, 0, :].astype(float) / SS + 0.5 / SS
    d = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in c) + " Z"
    return d.replace(".0 ", " ").replace(".0 Z", " Z").replace(".0 L", " L")


def main():
    p = dict(FIN.E9G)
    bowl_cut, ball, _, leaves = M.parts(p)
    outer = L.round_mask(D.bowl_mask(p["R"], p["rim"], p["trunc"]), p["rr"] * SS)
    print("BOWL_CUT =", trace(bowl_cut))
    print("BOWL_FULL =", trace(outer))
    for i, lm in enumerate(leaves):
        print(f"LEAF_{i} =", trace(lm))


if __name__ == "__main__":
    main()
