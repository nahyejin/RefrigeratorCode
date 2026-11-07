# -*- coding: utf-8 -*-
"""P1 확정 마크의 벡터(SVG)와 안드로이드용 레이어 만들기 — 로고 시안 생성 코드(마스크)를 그대로 쓴다.

    PYTHONIOENCODING=utf-8 python frontend/assets/brand/make_mark_svg.py

만드는 것(이 폴더):
    mark_p1.svg                  노랑 바탕 #FFD600 + 마크 (앱 아이콘 정식과 같은 그림, viewBox 1024)
    mark_p1_symbol.svg           바탕 없는 마크만(투명) — 워드마크·락업·배너에 얹을 때
    adaptive_foreground_1024.png 안드로이드 적응형 전경(투명). 원형 안전영역(지름 66/108)에 마크 전체가 들어가게
                                 배율 0.84 — 시안의 전경(배율 0.92)은 큰 잎 끝이 안전영역 밖(반지름 333 > 313)이라 다시 만들었다
    notification_silhouette_1024.png 알림 작은 아이콘용 흰 단색 실루엣(투명). 24dp 에서도 재료·받침·잎이 한 덩어리로
                                 뭉치지 않게 받침 틈(18→34)과 잎 틈(12→30)을 넓힌 별도 도면

재료는 정확한 원(circle)으로, 받침·잎은 시안 마스크의 윤곽선(곡선을 촘촘한 꺾은선으로)으로 그린다.
받침과 재료 사이 틈(18)은 받침 윤곽에 이미 파여 있다. 색: 바탕 #FFD600 · 재료 #FFFFFF · 받침 #1A1A1E · 잎 #1E9252.
시안 코드: store/logo_proposals/e9_final/p1_final/make_p1_final.py (E9G 형태 + P1_PAL)
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

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


def render_png(shape, pal, k, ycenter, name, white=False):
    """투명 배경 PNG. place() 는 투명 캔버스에 바로 합성해서 가장자리 색이 검정으로 어두워지므로(알파만 맞고 색이 눌림),
    같은 도면을 노랑 바탕에도 한 번 그려 거기서 원래 색을 되살린다(straight alpha)."""
    layers = P.FIN.layers(shape, pal)
    alpha = np.array(P.F.place(layers, k, bg=None, size=1024, ycenter=ycenter))[:, :, 3].astype(np.float64)
    alpha[alpha < 6] = 0  # 거의 투명한 먼지 제거
    if white:
        rgb = np.full((1024, 1024, 3), 255.0)
    else:
        on_y = np.array(P.F.place(layers, k, bg=P.BRAND, size=1024, ycenter=ycenter).convert("RGB")).astype(np.float64)
        a = np.maximum(alpha, 1.0)[:, :, None] / 255.0
        rgb = np.clip((on_y - (1 - a) * np.array(P.BRAND, dtype=np.float64)) / a, 0, 255)
    out = np.dstack([rgb, alpha]).astype(np.uint8)
    im = Image.fromarray(out, "RGBA")
    im.save(os.path.join(HERE, name), optimize=True)
    return im


def build_pngs():
    # 적응형 전경: 원래 색 그대로, 안전영역 안으로 축소
    fg = render_png(P.SHAPE, P.P1_PAL, 0.84, 410, "adaptive_foreground_1024.png")
    a = np.array(fg)[:, :, 3]
    ys, xs = np.where(a > 8)
    print("adaptive fg max radius %.1f (안전 반지름 %.1f)" % (np.sqrt((xs - 512.0) ** 2 + (ys - 512.0) ** 2).max(), 66 / 108 * 512))
    # 알림 실루엣: 전부 흰색, 틈 넓힘
    white = dict(P.P1_PAL, bowl=(255, 255, 255), ball=(255, 255, 255), leaf=(255, 255, 255))
    shape = dict(P.E9G, gap=34, leaves=[(50, 250, 124, 12, 30), (132, 152, 80, -8, 32)])
    render_png(shape, white, 1.34, 413, "notification_silhouette_1024.png", white=True)


if __name__ == "__main__":
    build_pngs()
    for name, bg in (("mark_p1.svg", True), ("mark_p1_symbol.svg", False)):
        with open(os.path.join(HERE, name), "w", encoding="utf-8", newline="\n") as f:
            f.write(build(bg))
        print(name, os.path.getsize(os.path.join(HERE, name)), "bytes")
