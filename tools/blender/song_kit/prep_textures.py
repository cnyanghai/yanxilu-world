#!/usr/bin/env python3
"""营地小试：把 concepts/song_kit/ 的三视图拆成单视图贴图，按真尺寸拉伸，写到 Blender 读的贴图目录。
用法：python3 tools/blender/song_kit/prep_textures.py [输出目录=/mnt/c/Users/cnyan/blender_mcp/tex]
视图框是 2026-11-04 用亮度分列量出来的（黑底 > 30 的列成段）；重出图后要重量。"""
import sys, os
from PIL import Image
import numpy as np
SRC = os.path.join(os.path.dirname(__file__), "../../../design/concepts/song_kit")
OUT = sys.argv[1] if len(sys.argv) > 1 else "/mnt/c/Users/cnyan/blender_mcp/tex"
PX = 512  # 每米像素
os.makedirs(OUT, exist_ok=True)
V = {  # 件: [(x0,y0,x1,y1) 各视图]
 "post": [(396,69,506,961),(727,68,804,960)],
 "beam": [(33,453,673,569),(726,453,852,569)],
 "wall_plain": [(361,107,1153,885),(136,104,240,889)],
 "wall_window": [(361,107,1179,885),(136,105,239,889)],
 "gable": [(54,294,975,753),(1103,295,1181,753)],
 "roof_thatch": [(59,264,696,750),(741,263,834,749),(882,263,1464,748)],
 "ridge": [(30,385,753,644),(797,381,1115,645)],
 "door_leaf": [(147,43,616,976),(771,35,848,979)],
}
SIZE = {  # 件: [(宽米, 高米) 各视图]
 "post": [(0.16,2.4),(0.16,2.4)], "beam": [(2.0,0.16),(0.16,0.16)],
 "wall_plain": [(2.0,2.2),(0.12,2.2)], "wall_window": [(2.0,2.2),(0.12,2.2)],
 "gable": [(2.0,1.0),(0.12,1.0)], "roof_thatch": [(2.0,1.7),(0.25,1.7),(2.0,1.7)],
 "ridge": [(2.0,0.3),(0.45,0.3)], "door_leaf": [(0.9,1.95),(0.05,1.95)],
}
def px(m): return max(16, round(m * PX))
def save(img, name): img.convert("RGB").save(os.path.join(OUT, name), quality=92)
def warp_window(im, box):
    """窗洞墙：图里窗内口（目测网格量，2026-11-04）分段拉到 宽 0.8、x 0.6 到 1.4、下沿 1.0、上沿 1.6。"""
    f = im.crop(box); w, h = f.size
    wx0, wx1, wy0, wy1 = 250, 548, 220, 452          # 窗内口在正视图里的像素框
    W, H = 2.0, 2.2; tx0, tx1, tz_top, tz_bot = 0.6, 1.4, H - 1.6, H - 1.0
    cols = [(0, wx0, 0, tx0), (wx0, wx1, tx0, tx1), (wx1, w, tx1, W)]
    rows = [(0, wy0, 0, tz_top), (wy0, wy1, tz_top, tz_bot), (wy1, h, tz_bot, H)]
    out = Image.new("RGB", (px(W), px(H)))
    for c0, c1, u0, u1 in cols:
        for r0, r1, v0, v1 in rows:
            out.paste(f.crop((c0, r0, c1, r1)).resize((px(u1) - px(u0), px(v1) - px(v0)), Image.LANCZOS), (px(u0), px(v0)))
    return out
for k, boxes in V.items():
    im = Image.open(os.path.join(SRC, k + ".jpg")).convert("RGB")
    for n, (box, (wm, hm)) in enumerate(zip(boxes, SIZE[k])):
        img = warp_window(im, box) if (k == "wall_window" and n == 0) else im.crop(box).resize((px(wm), px(hm)), Image.LANCZOS)
        save(img, f"{k}_{'fsb'[n]}.jpg")
print("ok", OUT)
