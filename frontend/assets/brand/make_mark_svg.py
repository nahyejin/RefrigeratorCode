# -*- coding: utf-8 -*-
"""P1 확정 마크의 벡터(SVG) 만들기 — 로고 시안 생성 코드(마스크)를 그대로 윤곽선으로 따서 쓴다.

    PYTHONIOENCODING=utf-8 python frontend/assets/brand/make_mark_svg.py

만드는 것(이 폴더):
    mark_p1.svg          노랑 바탕 #FFD600 + 마크 (앱 아이콘 정식과 같은 그림, viewBox 1024)
    mark_p1_symbol.svg   바탕 없는 마크만(투명) — 워드마크·락업·배너에 얹을 때

재료는 정확한 원(circle)으로, 받침·잎은 시안 마스크의 윤곽선(곡선을 촘촘한 꺾은선으로)으로 그린다.
받침과 재료 사이 틈(18)은 받침 윤곽에 이미 파여 있다. 색: 바탕 #FFD600 · 재료 #FFFFFF · 받침 #1A1A1E · 잎 #1E9252.
시안 코드: store/logo_proposals/e9_final/p1_final/make_p1_final.py (E9G 형태 + P1_PAL)
"""
import os
import sys

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
sys.path.insert(0, os.path.join(ROOT, "store", "logo_proposals", "e9_final", "p1_final"))
import make_p1_final as P  # noqa: E402

K = 1.32          # 캔버스 86% 채움 배율(시안 render 와 같은 값)
YC = 420          # 시안 render 의 ycenter
SS = P.L.SS


def hexc(c):
    return "#%02X%02X%02X" % tuple(c)


def to_canvas(x, y):
    """마스크(4096) 좌표 → 1024 캔버스 좌표(시안 place() 와 같은 변환)."""
    ux, uy = x / SS, y / SS
    return (512 + (ux - 512) * K, 512 + (uy - YC) * K)


def mask_path(mask, eps=1.0):
    arr = np.array(mask)
    cnts, _ = cv2.findContours((arr > 127).astype(np.uint8), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    d = []
    for c in cnts:
        c = cv2.approxPolyDP(c, eps, True)[:, 0, :]
        pts = [to_canvas(float(x) + 0.5, float(y) + 0.5) for x, y in c]
        d.append("M" + " L".join("%.2f %.2f" % p for p in pts) + " Z")
    return " ".join(d)


def build(with_bg):
    layers = P.FIN.layers(P.SHAPE, P.P1_PAL)
    out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">']
    out.append("<!-- 쿡매치 마크 P1 확정(재료·받침·잎). make_mark_svg.py 가 만든 파일 — 손으로 고치지 말 것. -->")
    if with_bg:
        out.append('<rect width="1024" height="1024" fill="%s"/>' % hexc(P.BRAND))
    for mask, col, tag in layers:
        if tag == "ball":
            cx, cy = to_canvas(512 * SS, P.E9G["rim"] * SS)
            out.append('<circle id="ingredient" cx="%.2f" cy="%.2f" r="%.2f" fill="%s"/>'
                       % (cx, cy, P.E9G["ball_r"] * K, hexc(col)))
        else:
            ident = "bowl" if tag == "bowl" else "leaf"
            out.append('<path id="%s" d="%s" fill="%s"/>' % (ident, mask_path(mask), hexc(col)))
    out.append("</svg>")
    return "\n".join(out) + "\n"


if __name__ == "__main__":
    for name, bg in (("mark_p1.svg", True), ("mark_p1_symbol.svg", False)):
        with open(os.path.join(HERE, name), "w", encoding="utf-8", newline="\n") as f:
            f.write(build(bg))
        print(name, os.path.getsize(os.path.join(HERE, name)), "bytes")
