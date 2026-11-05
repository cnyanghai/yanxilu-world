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
out = {}
for k, boxes in V.items():
    im = Image.open(os.path.join(SRC, k + ".jpg")).convert("RGB")
    for n, (box, (wm, hm)) in enumerate(zip(boxes, SIZE[k])):
        img = warp_window(im, box) if (k == "wall_window" and n == 0) else im.crop(box).resize((px(wm), px(hm)), Image.LANCZOS)
        out[f"{k}_{'fsb'[n]}"] = img


# ---------- 2026-11-04 补弱项：无缝、程序件、变体、地面、法线 ----------
from scipy.ndimage import gaussian_filter, sobel, binary_dilation, binary_opening, label, center_of_mass
rng = np.random.default_rng(7)


def seamless_x(img, ov=96, trim=6):
    """左右无缝：右边一条与左边一条重叠，逐行找差最小的竖向切缝拼起来（不叠影），再拉回原宽。
    屋面和屋脊按 2 米一铺，相邻两件接缝处纹理连续。"""
    a = np.asarray(img).astype(np.float32)[:, trim:-trim]; H, W, _ = a.shape
    A, B = a[:, :ov], a[:, W - ov:]
    err = ((A - B) ** 2).sum(2); err[:, :4] = err[:, -4:] = 1e9
    cost = err.copy()
    for y in range(1, H):
        p = cost[y - 1]; cost[y] += np.minimum(np.minimum(np.r_[1e12, p[:-1]], p), np.r_[p[1:], 1e12])
    path = np.zeros(H, int); path[-1] = cost[-1].argmin()
    for y in range(H - 2, -1, -1):
        c = path[y + 1]; lo = max(0, c - 1); path[y] = lo + cost[y, lo:min(ov, c + 2)].argmin()
    m = np.clip((np.arange(ov)[None, :] - path[:, None]) / 3.0 + 0.5, 0, 1)[..., None]
    o = np.concatenate([B * (1 - m) + A * m, a[:, ov:W - ov]], 1)
    return Image.fromarray(o.clip(0, 255).astype(np.uint8)).resize(img.size, Image.LANCZOS)


def strands(w, h, palette, n, lmin, lmax, wmax, slant, fringe):
    """程序散草：在 2 倍画布上画草茎再缩小（抗锯齿），左右按 w 回绕。fringe=True 为檐口垂草（RGBA），否则截面（RGB 暗底）。"""
    from PIL import ImageDraw
    S = 2; W2, H2 = w * S, h * S
    im = Image.new("RGBA", (W2, H2), (0, 0, 0, 0) if fringe else (52, 38, 22, 255)); d = ImageDraw.Draw(im)
    for _ in range(n):
        x = rng.uniform(0, W2); y0 = 0 if fringe else rng.uniform(-lmax * S, H2)
        ln = rng.uniform(lmin, lmax) * S; ang = rng.normal(0, slant)
        x1, y1 = x + ln * np.sin(ang), y0 + ln * np.cos(ang)
        c = palette[rng.integers(len(palette))] * (rng.uniform(0.55, 1.0) if fringe else rng.uniform(0.35, 0.9) * (0.6 + 0.4 * (y0 / H2)))
        col = tuple(int(v) for v in np.clip(c, 0, 255)) + (255,)
        wd = int(rng.integers(1, wmax + 1)) * S
        for dx in (-W2, 0, W2):
            d.line([(x + dx, y0), (x1 + dx, y1)], fill=col, width=wd)
    if fringe:  # 顶端一条压实，接檐口
        top = Image.new("RGBA", (W2, 6 * S), tuple(int(v) for v in palette.mean(0) * 0.6) + (255,)); im.alpha_composite(top)
    return im.resize((w, h), Image.LANCZOS)


def wall_full(img):
    """平墙变体：整面抹泥，只留左下一块小缺口。编条区按局部纹理强度找出来，用平移的泥面补（不镜像，避免对称花纹）。"""
    a = np.asarray(img).astype(np.float32); H, W, _ = a.shape; L = a.mean(2)
    t = gaussian_filter(np.abs(L - gaussian_filter(L, 2.5)), 7)
    pz = int(H * 0.695)                                   # 泥面与木板分界
    m = np.zeros((H, W), bool); m[20:pz, 40:988] = t[20:pz, 40:988] > 13.5
    m = binary_opening(m, iterations=4); lab, n = label(m); sz = np.bincount(lab.ravel()); keep = np.zeros_like(m)
    for i in range(1, n + 1):
        if sz[i] > 3000 and center_of_mass(lab == i)[1] > 400: keep |= lab == i
    m = binary_dilation(keep, iterations=24); m[pz + 5:] = False; m[:22] = False; m[:, :45] = False; m[:, 984:] = False
    M = gaussian_filter(m.astype(np.float32), 5); M[:, 984:] = 0; M[pz + 5:] = 0; M[:18] = 0; M = M[..., None]
    d1 = np.roll(a, 420, 1); d2 = np.roll(np.roll(a, 200, 0), 400, 1)
    xx = np.arange(W)[None, :]; seam = H * 0.42 + 25 * np.sin(xx / 37.0) + 12 * np.sin(xx / 11.0)
    w2 = np.clip((np.arange(H)[:, None] - seam) / 30 + 0.5, 0, 1)[..., None]
    o = a * (1 - M) + (d1 * (1 - w2) + d2 * w2) * M
    return Image.fromarray(o.clip(0, 255).astype(np.uint8))


def normal(img, strength=2.0):
    """由明度推高度再求法线（OpenGL 约定，绿 = 上）：细、粗两个尺度相加，左右回绕。"""
    g = np.asarray(img.convert("L")).astype(np.float32) / 255.0
    h = gaussian_filter(g, 1.0, mode="wrap") + 0.6 * gaussian_filter(g, 5.0, mode="wrap")
    dx, dy = sobel(h, 1, mode="wrap"), sobel(h, 0, mode="wrap")
    n = np.dstack([-dx * strength, dy * strength, np.ones_like(h)]); n /= np.linalg.norm(n, axis=2, keepdims=True)
    return Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8))


for k in ("roof_thatch_f", "roof_thatch_b", "ridge_f"):
    out[k] = seamless_x(out[k])
pal = np.asarray(out["roof_thatch_f"]).reshape(-1, 3).astype(np.float32); pal = pal[pal.mean(1) > 110][::97]
out["thatch_end"] = strands(px(2.0), px(0.3), pal, 9000, 4, 18, 2, 0.5, False).convert("RGB")
fringe = strands(px(2.0), px(0.19), pal, 2600, 25, 95, 2, 0.12, True)
out["wall_plain_mir_f"] = out["wall_plain_f"].transpose(Image.FLIP_LEFT_RIGHT)
out["wall_plain_full_f"] = wall_full(out["wall_plain_f"])
# 地面：原图偏亮（中位 129）且橙，压到中位约 67、降饱和，让房子从地上跳出来；草地是第二层
from PIL import ImageEnhance
for g, k, sat in (("ground_dirt", 0.52, 0.72), ("ground_grass", 0.6, 0.8)):
    im = Image.open(os.path.join(SRC, g + ".jpg")).convert("RGB")
    out[g] = ImageEnhance.Color(ImageEnhance.Brightness(im).enhance(k)).enhance(sat)
# 法线强度：由明度推的高度会把暗处当凹处，开太猛有浮雕味（2026-11-04 近景看过，2.0 偏猛）
STRENGTH = {"roof_thatch_f": 1.6, "thatch_end": 2.0, "ridge_f": 1.6, "ground_dirt": 1.0, "ground_grass": 1.0}
for k, img in out.items():
    save(img, k + ".jpg")
    normal(img, STRENGTH.get(k, 0.9)).save(os.path.join(OUT, k + "_n.png"))
fringe.save(os.path.join(OUT, "thatch_fringe.png"))
print("ok", OUT, len(out), "张 + 法线")
