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
 "wall_door": [(318,138,1215,880),(126,134,215,882)],
 "gable": [(54,294,975,753),(1103,295,1181,753)],
 "roof_thatch": [(59,264,696,750),(741,263,834,749),(882,263,1464,748)],
 "ridge": [(30,385,753,644),(797,381,1115,645)],
 "door_leaf": [(147,43,616,976),(771,35,848,979)],
}
SIZE = {  # 件: [(宽米, 高米) 各视图]
 "post": [(0.16,2.4),(0.16,2.4)], "beam": [(2.0,0.16),(0.16,0.16)],
 "wall_plain": [(2.0,2.2),(0.12,2.2)], "wall_window": [(2.0,2.2),(0.12,2.2)], "wall_door": [(2.0,2.2),(0.12,2.2)],
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
def warp_door(im, box):
    """门洞墙：图里黑色门洞内口（2026-11-04 按暗区量：裁框内 x 325 到 572、上沿 133）分段拉到 0.9 × 1.95、居中。"""
    f = im.crop(box); w, h = f.size
    cols = [(0, 325, 0, 0.55), (325, 572, 0.55, 1.45), (572, w, 1.45, 2.0)]
    rows = [(0, 133, 0, 0.25), (133, h, 0.25, 2.2)]
    out = Image.new("RGB", (px(2.0), px(2.2)))
    for c0, c1, u0, u1 in cols:
        for r0, r1, v0, v1 in rows:
            out.paste(f.crop((c0, r0, c1, r1)).resize((px(u1) - px(u0), px(v1) - px(v0)), Image.LANCZOS), (px(u0), px(v0)))
    return out


for k, boxes in V.items():
    im = Image.open(os.path.join(SRC, k + ".jpg")).convert("RGB")
    for n, (box, (wm, hm)) in enumerate(zip(boxes, SIZE[k])):
        if n == 0 and k in ("wall_window", "wall_door"):
            img = (warp_window if k == "wall_window" else warp_door)(im, box)
        else:
            img = im.crop(box).resize((px(wm), px(hm)), Image.LANCZOS)
        out[f"{k}_{'fsb'[n]}"] = img
raw = dict(out)                     # 未调色的旧贴图：materials.py 找分区用


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


# ---------- 明度结构（ART-BIBLE 第 9 节第二条：材质明度拉开；2026-11-04 第二轮） ----------
def grade(img, k=1.0, sat=1.0, mask=None):
    """明度乘 k、饱和乘 sat（按亮度向灰拉）；mask（H×W，0 到 1）给了就只改这块。"""
    a = np.asarray(img).astype(np.float32); g = (a @ np.float32([0.299, 0.587, 0.114]))[..., None]
    b = (g + (a - g) * sat) * k
    if mask is not None:
        b = a * (1 - mask[..., None]) + b * mask[..., None]
    return Image.fromarray(b.clip(0, 255).astype(np.uint8))


def med(img, mask=None):
    L = np.asarray(img.convert("L")).astype(np.float32)
    return float(np.median(L[mask > 0.5] if mask is not None else L))


def wood_mask(img, ratio, edge=40):
    """墙图里的木头：下段木板（ratio 以下）+ 两侧画上的立框。"""
    w, h = img.size; m = np.zeros((h, w), np.float32); m[int(h * ratio):] = 1
    if edge:
        m[:, :edge] = 1; m[:, w - edge:] = 1
    return gaussian_filter(m, 3)


def grime(img, h_m, top=0.35):
    """墙脚 / 柱脚溅泥：底部 top 米内渐暗到 0.55，夹噪声成片。h_m 为图的实高（米）。"""
    a = np.asarray(img).astype(np.float32); H, W, _ = a.shape
    z = (H - 1 - np.arange(H)) / (H - 1) * h_m
    t = np.clip(z / top, 0, 1); f = 0.55 + 0.45 * (t * t * (3 - 2 * t))
    n = gaussian_filter(rng.random((H, W)).astype(np.float32), 6); n = (n - n.min()) / (n.max() - n.min() + 1e-6)
    F = 1 - (1 - f[:, None]) * (0.6 + 0.8 * n)
    return Image.fromarray((a * np.clip(F, 0.35, 1)[..., None]).clip(0, 255).astype(np.uint8))


VALUE = {"thatch": (105, 0.75), "wood": (72, 0.8), "plank": (62, 0.75), "door": (62, 0.75), "stone": (72, 0.6)}
kt = VALUE["thatch"][0] / med(out["roof_thatch_f"])
for k in ("roof_thatch_f", "roof_thatch_b", "roof_thatch_s", "ridge_f", "ridge_s"):
    out[k] = grade(out[k], kt, VALUE["thatch"][1])
kw = VALUE["wood"][0] / med(out["post_f"])
for k in ("post_f", "post_s", "beam_f", "beam_s"):
    out[k] = grade(out[k], kw, VALUE["wood"][1])
kd = VALUE["door"][0] / med(out["door_leaf_f"])
for k in ("door_leaf_f", "door_leaf_s"):
    out[k] = grade(out[k], kd, VALUE["door"][1])
for k, ratio in (("wall_plain", 0.695), ("wall_door", 0.68), ("wall_window", 0.672)):
    f = out[k + "_f"]; m = wood_mask(f, ratio)
    out[k + "_f"] = grime(grade(f, VALUE["plank"][0] / med(f, m), VALUE["plank"][1], m), 2.2)
    sd = out[k + "_s"]; out[k + "_s"] = grime(grade(sd, VALUE["plank"][0] / med(f, m), VALUE["plank"][1], wood_mask(sd, ratio, 0)), 2.2)
for k in ("post_f", "post_s"):
    out[k] = grime(out[k], 2.4)
pal = np.asarray(out["roof_thatch_f"]).reshape(-1, 3).astype(np.float32); pal = pal[pal.mean(1) > 110][::97]
out["thatch_end"] = strands(px(2.0), px(0.3), pal, 9000, 4, 18, 2, 0.5, False).convert("RGB")
fringe = strands(px(2.0), px(0.19), pal, 2600, 25, 95, 2, 0.12, True)
out["wall_plain_mir_f"] = out["wall_plain_f"].transpose(Image.FLIP_LEFT_RIGHT)
out["wall_plain_full_f"] = wall_full(out["wall_plain_f"])
raw["wall_plain_mir_f"] = raw["wall_plain_f"].transpose(Image.FLIP_LEFT_RIGHT); raw["wall_plain_full_f"] = wall_full(raw["wall_plain_f"])

# ---------- 材质板合成（ASSET-SPEC 10.6）：墙、茅草、屋脊、柱梁、门扇、山花换成 768 像素/米 ----------
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import materials
HEIGHTS = materials.compose(raw, out)
if HEIGHTS:
    for k in ("wall_plain_f", "wall_plain_mir_f", "wall_plain_full_f", "wall_door_f", "wall_window_f"):
        out[k] = grime(out[k], 2.2)
    for k in ("post_f", "post_s"):
        out[k] = grime(out[k], 2.4)
    pal = np.asarray(out.pop("_mat_thatch")).reshape(-1, 3).astype(np.float32); pal = pal[pal.mean(1) > np.percentile(pal.mean(1), 50)][::97]
    out["thatch_end"] = strands(px(2.0), px(0.3), pal, 9000, 4, 18, 2, 0.5, False).convert("RGB")
    fringe = strands(px(2.0), px(0.19), pal * 0.75, 2600, 25, 95, 2, 0.12, True)   # 引擎里阳光下发白（2026-11-05），压暗
# 地面：原图偏亮（中位 129）且橙，压到中位约 67、降饱和，让房子从地上跳出来；草地是第二层
from PIL import ImageEnhance
for g, k, sat in (("ground_dirt", 0.52, 0.72), ("ground_grass", 0.78, 0.95)):
    im = Image.open(os.path.join(SRC, g + ".jpg")).convert("RGB")
    out[g] = ImageEnhance.Color(ImageEnhance.Brightness(im).enhance(k)).enhance(sat)
st = Image.open(os.path.join(SRC, "ground_stone.jpg")).convert("RGB")
out["stone"] = grade(st, VALUE["stone"][0] / med(st), VALUE["stone"][1])   # 碎石铺地（以后做石板路印章）


def rock(size=512):
    """单块石头的石面（不带灰缝）：取铺地图里石头部分的颜色，多层噪声 + 细麻点 + 少量暗裂，四边回绕可平铺。冷灰，画面里的第二种色相。"""
    a = np.asarray(out["stone"]).astype(np.float32); L = a.mean(2); base = a[L > np.percentile(L, 55)].mean(0)
    n = sum(gaussian_filter(rng.random((size, size)), s_, mode="wrap") * w_ for s_, w_ in ((40, 3.0), (12, 1.5), (3, 0.8), (1, 0.4)))
    n = (n - n.mean()) / n.std()
    crack = gaussian_filter(rng.random((size, size)), 6, mode="wrap"); crack = np.abs(crack - crack.mean()) / crack.std() < 0.06
    v = 1 + 0.16 * n - 0.35 * gaussian_filter(crack.astype(np.float32), 1, mode="wrap")
    g = gaussian_filter(rng.random((size, size)), 50, mode="wrap"); g = (g - g.mean()) / g.std()
    tint = 1 + 0.05 * g[..., None] * np.float32([1.0, 0.3, -0.7])        # 大片里略偏暖或偏冷
    return Image.fromarray(np.clip(base * v[..., None] * tint, 0, 255).astype(np.uint8))


out["rock"] = rock()
# 劈柴的木茬：材质板旧木转成竖纹、偏暖、提到明度约 118（新劈开的木头比柱梁亮，篝火里要看得出木茬，2026-11-05）
_pl = Image.open(os.path.join(SRC, "materials", "planks.jpg")).convert("RGB").transpose(Image.ROTATE_90)
_pl = Image.fromarray(np.clip(np.asarray(_pl).astype(np.float32) * np.float32([1.12, 1.0, 0.8]), 0, 255).astype(np.uint8))
out["firewood"] = grade(_pl, 118 / med(_pl), 1.1).resize((512, 512), Image.LANCZOS)


def tuft(size=256):
    """草丛插片（RGBA）：草叶从底部中间散开向上，橄榄绿夹枯黄。"""
    from PIL import ImageDraw
    S = 2; W2 = size * S; im = Image.new("RGBA", (W2, W2), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    gp = np.asarray(out["ground_grass"]).reshape(-1, 3).astype(np.float32); gp = gp[::53]
    for _ in range(220):
        x0 = W2 / 2 + rng.normal(0, W2 * 0.12); ln = rng.uniform(0.35, 0.95) * W2; ang = rng.normal(0, 0.38)
        dry = rng.random() < 0.18
        c = gp[rng.integers(len(gp))] * rng.uniform(1.0, 1.4) * np.float32([0.85, 1.12, 0.8])
        if dry:
            c = np.float32([150, 128, 82]) * rng.uniform(0.7, 1.1)
        pts = [(x0 + ln * t * np.sin(ang) + 0.25 * ln * t * t * np.sin(ang * 2), W2 - ln * t) for t in np.linspace(0, 1, 6)]
        wd = int(rng.integers(2, 5)) * S
        for (xa, ya), (xb, yb) in zip(pts, pts[1:]):
            d.line([(xa, ya), (xb, yb)], fill=tuple(int(v) for v in np.clip(c, 0, 255)) + (255,), width=max(1, wd))
            wd = max(S, int(wd * 0.8))
    return im.resize((size, size), Image.LANCZOS)


tuft().save(os.path.join(OUT, "grass_tuft.png"))

rng = np.random.default_rng(2026)   # 地面与散布单独定种子：改贴图不牵动草石位置
# 地面分层图（12 × 12 米，32 像素/米；R 草、G 潮暗、B 路），以 Blender 物体坐标 (x+6)/12、(y+6)/12 取；散布位置同源写 scatter.json
import json
GN = 384; xs_ = -6 + (np.arange(GN) + 0.5) / 32; X, Y = np.meshgrid(xs_, xs_[::-1])
def smooth(e0, e1, v):
    t = np.clip((v - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)
nz = gaussian_filter(rng.random((GN, GN)), 38) ; nz = (nz - nz.min()) / (nz.max() - nz.min())
nz2 = gaussian_filter(rng.random((GN, GN)), 9); nz2 = (nz2 - nz2.min()) / (nz2.max() - nz2.min())
dshed = np.maximum(np.abs(X) - 2.3, np.abs(Y) - 1.45)
pathx = lambda y: -1 + 0.18 * np.sin((y - 1.5) * 0.9) + 0.05 * (y - 1.5)
path = (1 - smooth(0.32, 0.6, np.abs(X - pathx(Y)))) * smooth(1.2, 1.6, Y)
grass = smooth(0.36, 0.56, 0.75 * nz + 0.25 * nz2) * smooth(0.2, 0.9, dshed) * (1 - path)
damp = np.exp(-((dshed - 0.05) / 0.12) ** 2)
G = np.clip(0.6 * damp + 0.35 * path, 0, 1)
Image.fromarray((np.dstack([grass, G, path]) * 255).astype(np.uint8)).save(os.path.join(OUT, "ground_mask.png"))
def at(x, y, ch):
    j = int(np.clip((x + 6) * 32, 0, GN - 1)); i = int(np.clip((6 - y) * 32, 0, GN - 1)); return float(ch[i, j])
sc = {"tufts": [], "stones": [], "steps": []}
while len(sc["tufts"]) < 260:
    x, y = rng.uniform(-5.8, 5.8, 2)
    if rng.random() < at(x, y, grass) ** 1.5 * 0.9:
        sc["tufts"].append([round(x, 3), round(y, 3), round(float(rng.uniform(0, 360)), 1), round(float(rng.uniform(0.6, 1.3)), 2)])
for _ in range(14):   # 墙脚杂草：贴着墙外 5 到 25 厘米，偏向四角
    side = rng.integers(4); t = rng.uniform(-1, 1) ** 3
    x, y = [(t * 2.2, 1.55), (t * 2.2, -1.55), (2.4, t * 1.3), (-2.4, t * 1.3)][side]
    if side == 0 and abs(x + 1) < 0.6: continue    # 门前不长
    sc["tufts"].append([round(x, 3), round(y, 3), round(float(rng.uniform(0, 360)), 1), round(float(rng.uniform(0.45, 0.8)), 2)])
def stone(x, y, smin, smax):
    sc["stones"].append([round(x, 3), round(y, 3), round(float(rng.uniform(0, 360)), 1), round(float(rng.uniform(smin, smax)), 3), int(rng.integers(4))])
for _ in range(10):   # 墙脚：偏向四角、离墙远近不一，免得排成一条线
    side = rng.integers(4); t = np.sign(rng.uniform(-1, 1)) * rng.uniform(0.3, 1) ** 0.5
    x, y = [(t * 2.3, 1.6), (t * 2.3, -1.6), (2.45, t * 1.4), (-2.45, t * 1.4)][side]
    if side == 0 and abs(x + 1) < 0.55: continue
    stone(x + rng.normal(0, 0.18), y + rng.normal(0, 0.18), 0.05, 0.15)
for _ in range(12):   # 路边
    y = rng.uniform(1.8, 5.8); stone(pathx(y) + rng.choice([-1, 1]) * rng.uniform(0.45, 0.7), y, 0.05, 0.14)
n_ = 0
while n_ < 18:        # 散落，避开路
    x, y = rng.uniform(-5.6, 5.6, 2)
    if at(x, y, path) < 0.2 and abs(x) > 2.6 or abs(y) > 1.8:
        if at(x, y, path) < 0.2: stone(x, y, 0.06, 0.24); n_ += 1
for y in (1.78, 2.36, 2.95, 3.55, 4.17, 4.8, 5.45):   # 踏步石
    sc["steps"].append([round(float(pathx(y) + rng.normal(0, 0.05)), 3), round(float(y + rng.normal(0, 0.04)), 3),
                        round(float(rng.uniform(0, 360)), 1), round(float(rng.uniform(0.36, 0.48)), 3), int(rng.integers(3))])
json.dump(sc, open(os.path.join(OUT, "scatter.json"), "w"))

# 法线强度：由明度推的高度会把暗处当凹处，开太猛有浮雕味（2026-11-04 近景看过，2.0 偏猛）
STRENGTH = {"roof_thatch_f": 1.6, "thatch_end": 1.0, "ridge_f": 1.6, "ground_dirt": 1.0, "ground_grass": 1.0, "stone": 1.6, "rock": 2.2}
for k, img in out.items():
    save(img, k + ".jpg")
    n = materials.normal_from_height(HEIGHTS[k]) if k in HEIGHTS else normal(img, STRENGTH.get(k, 0.9))
    n.save(os.path.join(OUT, k + "_n.png"))
fringe.save(os.path.join(OUT, "thatch_fringe.png"))
print("ok", OUT, len(out), "张 + 法线")
