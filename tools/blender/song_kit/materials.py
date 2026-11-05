"""营地小试：材质板合成组件贴图（ASSET-SPEC 10.6，2026-11-04）。
材质板（design/concepts/song_kit/materials/<名>.jpg，可平铺）+ 每件组件的布局（从旧的三视图贴图里找分区，或按几何尺寸画）
→ 768 像素/米的组件贴图 + 高度图（推法线用）。由 prep_textures.py 调用：compose(raw, out) 原地替换 out 里的件，返回 {件: 高度图}。"""
import os
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, binary_opening, binary_dilation, label, distance_transform_edt

HI = 768                                   # 每米像素（目标 ≥ 500）
MAT = os.path.join(os.path.dirname(__file__), "../../../design/concepts/song_kit/materials")
TILE_M = {"thatch": 1.0, "wattle": 0.8, "planks": 1.0, "plaster": 1.0, "rammed": 1.0, "tiles": 1.0}
VALUE = {"plaster": (111, 0.9), "wattle": (82, 0.85), "planks": (62, 1.0), "thatch": (112, 0.75)}
TINT = {"planks": (1.08, 1.0, 0.86)}          # 木板原图偏冷灰，按 ART-BIBLE 近处暖木加一点暖
rng = np.random.default_rng(11)
LUMA = np.float32([0.299, 0.587, 0.114])


def P(m):
    return int(round(m * HI))


def arr(img):
    return np.asarray(img).astype(np.float32)


def img(a):
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


# ---------- 无缝与调色 ----------
def _seam_x(a, ov):
    H, W, _ = a.shape; A, B = a[:, :ov], a[:, W - ov:]
    err = ((A - B) ** 2).sum(2); err[:, :4] = err[:, -4:] = 1e9; cost = err.copy()
    for y in range(1, H):
        p = cost[y - 1]; cost[y] += np.minimum(np.minimum(np.r_[1e12, p[:-1]], p), np.r_[p[1:], 1e12])
    path = np.zeros(H, int); path[-1] = cost[-1].argmin()
    for y in range(H - 2, -1, -1):
        c = path[y + 1]; lo = max(0, c - 1); path[y] = lo + cost[y, lo:min(ov, c + 2)].argmin()
    m = np.clip((np.arange(ov)[None, :] - path[:, None]) / 3.0 + 0.5, 0, 1)[..., None]
    return np.concatenate([B * (1 - m) + A * m, a[:, ov:W - ov]], 1)


def seamless_xy(im, ov=80):
    """两向无缝：先左右、再上下，各用重叠带里逐行（列）差最小的切缝，再拉回原尺寸。"""
    a = arr(im)[4:-4, 4:-4]
    a = _seam_x(a, ov); a = _seam_x(a.transpose(1, 0, 2), ov).transpose(1, 0, 2)
    return img(a).resize(im.size, Image.LANCZOS)


def grade_to(im, target, sat):
    a = arr(im); g = (a @ LUMA)[..., None]; k = target / max(float(np.median(g)), 1)
    return img((g + (a - g) * sat) * k)


def load(name):
    t = Image.open(os.path.join(MAT, name + ".jpg")).convert("RGB")
    t = seamless_xy(t)
    if name in TINT:
        t = img(arr(t) * np.float32(TINT[name]))
    if name in VALUE:
        t = grade_to(t, *VALUE[name])
    return t


def tile(t, w_m, h_m, tile_m, off=(0, 0), rot=False):
    """把材质铺成 w_m × h_m 米（每块 tile_m 米），off 为像素偏移；rot 转 90 度（纹理方向竖横互换）。"""
    if rot:
        t = t.transpose(Image.ROTATE_90)
    n = P(tile_m); a = arr(t.resize((n, n), Image.LANCZOS))
    W, H = P(w_m), P(h_m); ry, rx = H // n + 2, W // n + 2
    big = np.tile(a, (ry, rx, 1)); oy, ox = off[1] % n, off[0] % n
    return big[oy:oy + H, ox:ox + W]


def height_of(a, lo, hi, blur=1.0):
    L = gaussian_filter(a @ LUMA, blur); L = (L - L.mean()) / (L.std() + 1e-6)
    return lo + (hi - lo) * (0.5 + 0.18 * L)


def up(mask, W, H):
    return np.asarray(Image.fromarray((np.clip(mask, 0, 1) * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR)).astype(np.float32) / 255


# ---------- 墙 ----------
def wattle_mask(old, ratio):
    """旧墙图里露编竹的地方：局部纹理强度高（2026-11-04 在 wall_plain 上标定阈值 13.5），只看木板线以上。"""
    a = arr(old); L = a @ LUMA; H, W = L.shape
    t = gaussian_filter(np.abs(L - gaussian_filter(L, 2.5)), 7)
    m = np.zeros((H, W), bool); top = int(H * ratio); m[70:top - 6, 75:W - 75] = t[70:top - 6, 75:W - 75] > 13.5   # 立框边、顶边不算
    m &= L[:, :] > 25                                     # 门洞黑区不算
    m = binary_opening(m, iterations=4); lab, n = label(m); sz = np.bincount(lab.ravel()); keep = np.zeros_like(m)
    for i in range(1, n + 1):
        if sz[i] > 2500:
            keep |= lab == i
    return binary_dilation(keep, iterations=3)


def plaster_life(pl, H, W, seed):
    """泥皮加"活气"：提中频细节（裂纹、草筋）、大片斑驳 ±8%、檐下雨水冲刷的竖向痕。"""
    g = np.random.default_rng(seed)
    b = gaussian_filter(pl, (6, 6, 0)); pl = b + (pl - b) * 1.8
    mot = gaussian_filter(g.random((H, W)), 140) + 0.35 * gaussian_filter(g.random((H, W)), 30); mot = (mot - mot.mean()) / (mot.std() + 1e-6)
    st = gaussian_filter(g.random((H, W)), (60, 4)); st = (st - st.mean()) / (st.std() + 1e-6)
    top = np.exp(-np.arange(H)[:, None] / (0.6 * HI))            # 冲刷痕集中在上部
    return pl * (1 + 0.05 * mot - 0.07 * np.clip(st, 0, None) * top)[..., None]


def wall(old, ratio, mats, seed, frames=()):
    """墙段正面 2.0 × 2.2 米：泥皮 + 露出的编竹 + 下段横木板 + 两侧竖木框（+ frames：门窗框，(x0,x1,z0,z1) 米，竖木）。"""
    W, H = P(2.0), P(2.2); o = rng.integers(0, 4000, 8)
    pl = plaster_life(tile(mats["plaster"], 2.0, 2.2, 1.0, (o[0], o[1])), H, W, seed); wa = tile(mats["wattle"], 2.0, 2.2, 0.8, (o[2], o[3]))
    pk = tile(mats["planks"], 2.0, 2.2, 1.0, (o[4], 0)); wv = tile(mats["planks"], 2.0, 2.2, 1.0, (o[5], o[6]), rot=True)
    mw = up(wattle_mask(old, ratio).astype(np.float32), W, H) > 0.5
    for x0, x1, z0, z1 in frames:                        # 门窗框外 8 厘米内不露编竹（旧图的框会被误当编竹）
        mw[max(H - P(z1 + 0.08), 0):H - P(max(z0 - 0.08, 0)), max(P(x0 - 0.08), 0):P(x1 + 0.08)] = False
    # 泥皮厚度：编竹区靠泥皮边 4 厘米内压暗（上沿更深，光从上来），泥皮边缘一圈略亮
    d_in = distance_transform_edt(mw) / HI; d_out = distance_transform_edt(~mw) / HI
    shade = 1 - 0.5 * np.exp(-d_in / 0.02) * mw
    rim = 1 + 0.08 * np.exp(-d_out / 0.006) * (~mw)
    soft = gaussian_filter(mw.astype(np.float32), 1.2)[..., None]
    c = pl * rim[..., None] * (1 - soft) + wa * shade[..., None] * soft
    h = height_of(pl, 0.67, 0.73) * (1 - soft[..., 0]) + height_of(wa, 0.15, 0.45) * soft[..., 0]
    # 下段木板与两侧立框
    z = (H - 1 - np.arange(H)) / HI                      # 每行离地高（米）
    plank = np.zeros((H, W), np.float32); plank[z < 2.2 * (1 - ratio)] = 1
    edge = np.zeros((H, W), np.float32); e = P(0.078); edge[:, :e] = 1; edge[:, W - e:] = 1
    for x0, x1, z0, z1 in frames:
        r0, r1 = H - P(z1), H - P(z0); edge[max(r0, 0):r1, P(x0):P(x1)] = 1
    ptop = plank * 0; ptop[np.abs(z - 2.2 * (1 - ratio)) < 0.012] = 1   # 泥皮压在木板上沿的一道暗缝
    c = c * (1 - plank[..., None]) + pk * plank[..., None]
    h = h * (1 - plank) + height_of(pk, 0.4, 0.55) * plank
    c = c * (1 - 0.45 * gaussian_filter(ptop, 2)[..., None])
    c = c * (1 - edge[..., None]) + wv * edge[..., None]
    h = h * (1 - edge) + height_of(wv, 0.7, 0.85) * edge
    return img(c), h


# ---------- 茅草屋面（布局同旧图：870 行里的压条行，等比放大） ----------
RODS = [92, 284, 480, 686, 856]; TEX_H = 870


def bamboo_rows(w, h, base, period_m=0.31):
    """竹压条：横向竹竿，行向做圆柱明暗，按 period 打竹节和绑扎。左右 2 米一周期。"""
    yy = np.linspace(-1, 1, h)[:, None]; shade = 0.55 + 0.55 * np.sqrt(np.clip(1 - yy ** 2, 0, 1)) + 0.15 * (yy < 0)
    x = np.arange(w)[None, :] / HI; ph = (x % period_m) / period_m
    node = 1 - 0.22 * np.exp(-((ph - 0.5) / 0.02) ** 2)
    tie = (np.abs(ph - 0.1) < 0.05) * (0.75 + 0.25 * np.sin(x * 900 + yy * 6) ** 2)
    a = base[None, None, :] * (shade * node)[..., None]
    a = a * (1 - tie[..., None]) + base[None, None, :] * 0.6 * shade[..., None] * tie[..., None]
    return a + rng.normal(0, 4, a.shape)


def thatch_roof(mats, k=1.5):
    W, H = P(2.0), int(TEX_H * k); th = mats["thatch"]; c = np.zeros((H, W, 3), np.float32); h = np.zeros((H, W), np.float32)
    rows = [0] + [int(r * k) for r in RODS] + [H]
    bam = arr(mats["wattle"]).reshape(-1, 3).mean(0) * 1.25
    for i in range(len(rows) - 1):
        r0, r1 = rows[i], rows[i + 1]
        if r1 <= r0:
            continue
        t = tile(th, 2.0, (r1 - r0) / HI + 0.01, 1.0, (int(rng.integers(0, 3000)), int(rng.integers(0, 3000))))[: r1 - r0]
        n = r1 - r0; f = np.ones(n, np.float32)
        tip = int(14 * k)                                  # 层底草尖（台阶面）压暗
        f[-tip:] = np.linspace(0.85, 0.5, tip)
        f[: int(0.15 * n)] *= np.linspace(0.82, 1.0, int(0.15 * n))   # 层顶被上一层压着
        c[r0:r1] = t * f[:, None, None]; h[r0:r1] = height_of(t, 0.3, 0.7)
    for r in RODS[:4]:                                       # 压条行（几何竹竿取这几行）
        r0, r1 = int(r * k), int((r + 16) * k)
        c[r0:r1] = bamboo_rows(W, r1 - r0, bam); h[r0:r1] = 0.9
    return img(c), h


def ridge(mats):
    """屋脊：草沿脊横向，上下两根竹竿，每 0.5 米一道绳箍；v 方向约 0.9 米（半椭圆周长）。"""
    W, H = P(2.0), P(0.9); c = tile(mats["thatch"], 2.0, 0.9, 1.0, (700, 300), rot=True)
    v = np.linspace(0, 1, H)[:, None]; c = c * (0.6 + 0.4 * np.sin(np.pi * v) ** 0.5)[..., None]
    h = height_of(c, 0.4, 0.7)
    bam = arr(mats["wattle"]).reshape(-1, 3).mean(0) * 1.2
    for vc in (0.17, 0.83):
        r0, r1 = int((vc - 0.03) * H), int((vc + 0.03) * H); c[r0:r1] = bamboo_rows(W, r1 - r0, bam, 0.45); h[r0:r1] = 0.95
    x = np.arange(W)[None, :] / HI; ph = (x % 0.5) / 0.5
    rw = 0.06; dx = (ph - 0.25) * 0.5                       # 离绳中心（米）
    rope = (np.abs(dx) < rw / 2).astype(np.float32) * np.ones((H, 1))
    vm = v * 0.9; strand = 0.5 + 0.5 * np.sin(2 * np.pi * (dx * 0.6 + vm) / 0.014)   # 斜股，周期 1.4 厘米
    across = np.sqrt(np.clip(1 - (dx / (rw / 2)) ** 2, 0, 1))
    twist = (0.45 + 0.55 * strand) * (0.55 + 0.45 * across)
    rc = np.float32([112, 92, 62])
    c = c * (1 - rope[..., None]) + rc * twist[..., None] * rope[..., None]
    h = h * (1 - rope) + (0.9 + 0.1 * twist) * rope
    edge = np.exp(-np.minimum(v, 1 - v) / 0.04)              # 两边贴屋面处压暗
    return img(c * (1 - 0.5 * edge)[..., None]), h


# ---------- 木件 ----------
def plank_strip(mats, length_m, width_m, vertical, seed):
    """从木板材质里裁一条完整木板（避开板缝）铺成 length × width。"""
    t = mats["planks"]; a = arr(t.resize((P(1.0), P(1.0)), Image.LANCZOS)); rowm = (a @ LUMA).mean(1)
    seams = np.where(rowm < np.percentile(rowm, 6))[0]
    gaps = np.split(np.arange(P(1.0)), seams); gaps = [g for g in gaps if len(g) > P(width_m) + 4] or [np.arange(P(1.0))]
    g = gaps[seed % len(gaps)]; y0 = g[0] + (len(g) - P(width_m)) // 2
    strip = a[y0:y0 + P(width_m)]                            # 横纹一条
    n = int(np.ceil(length_m)) + 1; strip = np.concatenate([np.roll(strip, -seed * 97, 1)] * n, 1)[:, :P(length_m)]
    return strip.transpose(1, 0, 2)[::-1] if vertical else strip


def post(mats, seed):
    c = plank_strip(mats, 2.4, 0.16, True, seed); c = c * (72 / max(np.median(c @ LUMA), 1))
    return img(c), height_of(c, 0.5, 0.7)


def beam(mats, seed):
    c = plank_strip(mats, 2.0, 0.16, False, seed); c = c * (72 / max(np.median(c @ LUMA), 1))
    return img(c), height_of(c, 0.5, 0.7)


def door(mats, old):
    """门扇 0.9 × 1.95：竖板 + 两侧边框 + 上下横带两道（落影）+ 门闩（从旧图放大搬来）。"""
    W, H = P(0.9), P(1.95)
    c = tile(mats["planks"], 0.9, 1.95, 1.0, (130, 50), rot=True) * 0.95; h = height_of(c, 0.4, 0.55)
    def rail(z0, z1):
        r0, r1 = H - P(z1), H - P(z0); s = plank_strip(mats, 0.92, (r1 - r0 + 2) / HI, False, int(z0 * 10))
        c[r0:r1] = s[: r1 - r0, :W] * 1.05; h[r0:r1] = 0.8
        sh = min(P(0.02), H - r1)
        if sh > 0:
            c[r1:r1 + sh] *= np.linspace(0.55, 1, sh)[:, None, None]
    for z0, z1 in ((0.0, 0.07), (0.49, 0.6), (1.42, 1.53), (1.88, 1.95)):
        rail(z0, z1)
    for x0, x1 in ((0, 0.06), (0.84, 0.9)):
        s = plank_strip(mats, 1.97, (P(x1) - P(x0) + 2) / HI, True, int(x0 * 7) + 3); c[:, P(x0):P(x1)] = s[:H, : P(x1) - P(x0)]; h[:, P(x0):P(x1)] = 0.75
    o = arr(old); oh, ow, _ = o.shape                        # 门闩：旧图 x 0.66 到 1.0、y 0.44 到 0.57
    box = (int(ow * 0.66), int(oh * 0.44), ow, int(oh * 0.57)); patch = img(o[box[1]:box[3], box[0]:box[2]])
    pw, ph = int((box[2] - box[0]) * W / ow), int((box[3] - box[1]) * H / oh)
    pa = arr(patch.resize((pw, ph), Image.LANCZOS)); y0, x0 = int(H * 0.44), int(W * 0.66)
    m = (np.abs(pa @ LUMA - np.median(pa @ LUMA)) > 6).astype(np.float32); m = gaussian_filter(m, 2)[..., None]
    c[y0:y0 + ph, x0:x0 + pw] = c[y0:y0 + ph, x0:x0 + pw] * (1 - m) + pa * m
    c = c * (62 / max(np.median(c @ LUMA), 1))
    return img(c), h


def gable(mats):
    """山花 2.0 × 1.0：三角内泥皮，两斜边与底边一道木框（宽 0.1 米），三角外不用（黑）。"""
    W, H = P(2.0), P(1.0); c = tile(mats["plaster"], 2.0, 1.0, 1.0, (900, 200)); h = height_of(c, 0.6, 0.75)
    x = (np.arange(W) + 0.5) / HI - 1.0; z = (H - 1 - np.arange(H) + 0.5)[:, None] / HI
    inside = z <= 1.0 - np.abs(x)[None, :]
    dist = np.minimum((1.0 - np.abs(x)[None, :] - z) / np.sqrt(2), z)
    frame = inside & (dist < 0.1)
    wv = tile(mats["planks"], 2.0, 1.0, 1.0, (40, 333)) * 1.0
    c = np.where(frame[..., None], wv, c); h = np.where(frame, height_of(wv, 0.75, 0.9), h)
    c[~inside] = 0
    return img(c), h


def compose(raw, out):
    """raw：未调色的旧组件贴图（找分区用）；out：prep 里的输出表，原地替换。返回 {件: 高度图}。"""
    if not os.path.isdir(MAT):
        print("[materials] 没有材质板目录，跳过"); return {}
    mats = {k: load(k) for k in ("thatch", "wattle", "planks", "plaster")}
    H = {}
    door_fr = ((0.49, 0.55, 0.0, 2.01), (1.45, 1.51, 0.0, 2.01), (0.49, 1.51, 1.95, 2.01))
    win_fr = ((0.55, 0.6, 0.95, 1.65), (1.4, 1.45, 0.95, 1.65), (0.55, 1.45, 0.95, 1.0), (0.55, 1.45, 1.6, 1.65))
    for k, old, ratio, fr, seed in (("wall_plain_f", raw["wall_plain_f"], 0.695, (), 1),
                                    ("wall_plain_mir_f", raw["wall_plain_mir_f"], 0.695, (), 2),
                                    ("wall_plain_full_f", raw["wall_plain_full_f"], 0.695, (), 3),
                                    ("wall_door_f", raw["wall_door_f"], 0.68, door_fr, 4),
                                    ("wall_window_f", raw["wall_window_f"], 0.672, win_fr, 5)):
        out[k], H[k] = wall(old, ratio, mats, seed, fr)
    out["roof_thatch_f"], H["roof_thatch_f"] = thatch_roof(mats)
    out["ridge_f"], H["ridge_f"] = ridge(mats)
    out["post_f"], H["post_f"] = post(mats, 1); out["post_s"], H["post_s"] = post(mats, 2)
    out["beam_f"], H["beam_f"] = beam(mats, 3)
    out["door_leaf_f"], H["door_leaf_f"] = door(mats, raw["door_leaf_f"])
    out["gable_f"], H["gable_f"] = gable(mats)
    out["_mat_thatch"] = mats["thatch"]
    return H


def normal_from_height(h, strength=3.5):   # 6.0 时泥皮像拉毛水泥、柱子像树皮（2026-11-04 细节镜头看过）
    """高度图（0 到 1）→ 法线（OpenGL，绿 = 上）。"""
    from scipy.ndimage import sobel
    dx, dy = sobel(h, 1, mode="nearest"), sobel(h, 0, mode="nearest")
    n = np.dstack([-dx * strength, dy * strength, np.ones_like(h)]); n /= np.linalg.norm(n, axis=2, keepdims=True)
    return Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8))
