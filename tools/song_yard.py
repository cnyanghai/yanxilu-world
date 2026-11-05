#!/usr/bin/env python3
"""院子的地面分层图与散布表（2026-11-05，宋代院落）。按 rooms.yard 与 presets/yard.json 的布局生成，改了布局重跑一次即可。
营地小试的分层图与散布是 Blender 里按营地布局做的（tools/blender/song_kit/scatter.py），院子布局不同，这里用同样的规则直接算：
- 分层图 world/packs/song/ground/yard_mask.jpg（384 × 384 覆盖 12 × 12 米，北在上）：R = 草（靠墙一圈、树下、东北角、院外），
  G = 潮暗（踏出来的路、篝火的灰、菜畦的土、偏屋檐下的滴水线、墙根）；院心是夯土，夹几块稀草。
- 散布表 world/packs/song/ground/yard_scatter.json（three 轴向，米）：草丛长在草多的地方、避开房子路火畦；石块沿墙根、偏屋墙角、树下；
  踏步石从院门铺到书房门，再岔一条到偏屋门。
用法：python3 tools/song_yard.py   （固定种子，重跑结果不变）"""
import json, math, os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "world", "data")
OUT = os.path.join(ROOT, "world", "packs", "song", "ground")
rooms = {r["id"]: r for r in json.load(open(os.path.join(D, "rooms.json"), encoding="utf-8"))["rooms"]}
preset = json.load(open(os.path.join(D, "presets", "yard.json"), encoding="utf-8"))
Y = rooms["yard"]; S = Y["size"]["w"] / 100; HALF = S / 2
E = {e["id"]: e["components"] for e in preset["entities"]}
st = Y["rooms"][0]; study = rooms[st["id"]]
SX, SZ = st["x"] / 100, st["z"] / 100
SW, SD = study["size"]["w"] / 200 + study.get("wall", 24) / 100, study["size"]["d"] / 200 + study.get("wall", 24) / 100   # 书房连墙半宽、半深
DOOR = (SX + study["door"]["x"] / 100, SZ + study["size"]["d"] / 200 + 0.24)                                                # 书房门外沿
sh = E["shed"]["Transform"]; HX, HZ, HR = sh["x"] / 100, sh["z"] / 100, math.radians(sh.get("rotY", 0))
BODY, EAVE = (2.08, 1.08), (2.30, 1.52)        # 偏屋主体、屋檐半宽半深（米，本地坐标；walk_check 量的包围盒：柱外 2.08 × 1.08，檐 2.30 × 1.52）
def shed_local(x, z):                            # 场地坐标 → 偏屋本地坐标（three 绕 y 转 HR 的逆）
    dx, dz = x - HX, z - HZ; c, s = math.cos(HR), math.sin(HR)
    return dx * c - dz * s, dx * s + dz * c
def shed_world(lx, lz):
    c, s = math.cos(HR), math.sin(HR); return HX + lx * c + lz * s, HZ - lx * s + lz * c
SHED_DOOR = shed_world(-1.0, -1.08 - 0.25)       # 偏屋门外 25 厘米（门洞在本地 x -2..0 的中间，正面 z = -1.08）
fz = E["campfire"]["Transform"]; FIRE = (fz["x"] / 100, fz["z"] / 100); FIRE_R = 0.55
GATE = (0.0, HALF)
slots = {s["name"]: s for s in Y["slots"]}
def rect(s, pad=0.0):
    return (s["x"] / 100 - s["w"] / 200 - pad, s["x"] / 100 + s["w"] / 200 + pad, s["z"] / 100 - s["d"] / 200 - pad, s["z"] / 100 + s["d"] / 200 + pad)
BEDS = [rect(s) for n, s in slots.items() if n.startswith("bed_")]
BED = (min(b[0] for b in BEDS), max(b[1] for b in BEDS), min(b[2] for b in BEDS), max(b[3] for b in BEDS))
TREE = (slots["tree"]["x"] / 100, slots["tree"]["z"] / 100)
rng = np.random.default_rng(20261105)

# ---------- 分层图 ----------
N = 384; px = S / N
xs = -HALF + (np.arange(N) + 0.5) * px; X, Z = np.meshgrid(xs, xs)          # 行 = z（上北 -z），列 = x
def noise(scale_px, seed):
    r = np.random.default_rng(seed).random((N, N)).astype(np.float32)
    im = Image.fromarray((r * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(scale_px))
    a = np.asarray(im).astype(np.float32); return (a - a.mean()) / (a.std() + 1e-6)
n1, n2, n3 = noise(10, 1), noise(4, 2), noise(22, 3)
sm = lambda e0, e1, x: np.clip((x - e0) / (e1 - e0), 0, 1) ** 2 * (3 - 2 * np.clip((x - e0) / (e1 - e0), 0, 1))
def seg_dist(ax, az, bx, bz):
    vx, vz = bx - ax, bz - az; t = np.clip(((X - ax) * vx + (Z - az) * vz) / (vx * vx + vz * vz), 0, 1)
    return np.hypot(X - (ax + t * vx), Z - (az + t * vz))
d_wall = np.minimum.reduce([HALF - np.abs(X), HALF - np.abs(Z)])            # 到院墙内侧（院外为负）
path_main = seg_dist(GATE[0], GATE[1], DOOR[0], DOOR[1])
path_shed = np.minimum(seg_dist(0.0, 0.5, *SHED_DOOR), seg_dist(*SHED_DOOR, *shed_world(-1.0, 0.0)))
d_fire = np.hypot(X - FIRE[0], Z - FIRE[1]); d_tree = np.hypot(X - TREE[0], Z - TREE[1])
c, s = math.cos(HR), math.sin(HR); LX = (X - HX) * c - (Z - HZ) * s; LZ = (X - HX) * s + (Z - HZ) * c
in_bed = (X > BED[0]) & (X < BED[1]) & (Z > BED[2]) & (Z < BED[3])
# 草：靠墙一圈（宽约 1 米，边缘带噪声）+ 院外 + 树下 + 东北角 + 偏屋背后 + 院心几块稀草；踩出来的地方（路、门前、火边、畦）压掉
grass = sm(1.15, 0.35, d_wall + 0.22 * n1 + 0.08 * n2)
grass = np.maximum(grass, sm(1.9, 0.9, d_tree + 0.25 * n1))
grass = np.maximum(grass, 0.85 * sm(2.2, 3.2, X + 0.3 * n1) * sm(-2.6, -3.4, Z + 0.3 * n2))        # 东北角（书房东、偏屋北）
grass = np.maximum(grass, sm(0.4, 1.2, LZ + 0.15 * n2) * (np.abs(LX) < BODY[0] + 0.6))               # 偏屋背后
grass = np.maximum(grass, np.clip(0.55 * (n3 - 0.45), 0, 0.5))                                        # 院心稀草
worn = np.minimum.reduce([path_main - 0.45, path_shed - 0.35, d_fire - 1.6, np.hypot(X - DOOR[0], (Z - DOOR[1]) * 1.6) - 1.1])
grass *= sm(-0.1, 0.6, worn + 0.12 * n2)
d_bed = np.maximum.reduce([BED[0] - X, X - BED[1], BED[2] - Z, Z - BED[3]])                            # 到菜畦边（外正内负）
grass = np.maximum(grass, 0.7 * sm(0.22, 0.04, d_bed + 0.03 * n2) * (d_bed > 0))                     # 畦边一圈草
grass[in_bed] = 0
# 潮暗：路、篝火的灰（中心深）、菜畦（垄沟起伏）、偏屋檐下滴水线、墙根一线
damp = 0.32 * sm(0.45, 0.1, np.minimum(path_main, path_shed) + 0.05 * n2)
damp = np.maximum(damp, 0.75 * sm(1.05, 0.35, d_fire + 0.08 * n2))
furrow = 0.5 + 0.5 * np.cos((Z - BED[2]) / 0.25 * math.pi + 0.15 * n2)
damp = np.where(in_bed, 0.22 + 0.5 * furrow ** 1.5, damp)                                            # 垄背浅、垄沟深（垄距 50 厘米）
drip = np.exp(-((np.abs(LZ) - EAVE[1]) / 0.09) ** 2) * (np.abs(LX) < EAVE[0])
damp = np.maximum(damp, 0.35 * drip * (d_wall > 0))
damp = np.maximum(damp, 0.18 * sm(0.35, 0.0, d_wall) * (d_wall > -0.05))
img = np.stack([grass, damp, np.zeros_like(grass)], -1)
Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).save(os.path.join(OUT, "yard_mask.jpg"), quality=92)

# ---------- 散布 ----------
def free(x, z, pad=0.0):
    """这点能不能放东西：不在书房、偏屋主体、篝火、菜畦、路上、固定槽上"""
    if abs(x - SX) < SW + pad and abs(z - SZ) < SD + pad: return False
    lx, lz = shed_local(x, z)
    if abs(lx) < BODY[0] + pad and abs(lz) < BODY[1] + pad: return False
    if math.hypot(x - FIRE[0], z - FIRE[1]) < 1.0 + pad: return False
    if BED[0] - pad < x < BED[1] + pad and BED[2] - pad < z < BED[3] + pad: return False
    for n in ("bench", "mailbox"):
        x0, x1, z0, z1 = rect(slots[n], pad)
        if x0 < x < x1 and z0 < z < z1: return False
    if math.hypot(x - TREE[0], z - TREE[1]) < 0.3 + pad: return False
    return True
def g_at(x, z):
    i = int(np.clip((x + HALF) / px, 0, N - 1)); j = int(np.clip((z + HALF) / px, 0, N - 1)); return grass[j, i], damp[j, i]
def path_d(x, z):
    def sd(ax, az, bx, bz):
        vx, vz = bx - ax, bz - az; t = max(0, min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)))
        return math.hypot(x - (ax + t * vx), z - (az + t * vz))
    return min(sd(GATE[0], GATE[1], *DOOR), sd(0.0, 0.5, *SHED_DOOR))
tufts = []
tries = 0
while len(tufts) < 330 and tries < 60000:
    tries += 1
    x, z = rng.uniform(-HALF - 1.6, HALF + 1.6, 2)
    inside = abs(x) < HALF and abs(z) < HALF
    if inside:
        if not free(x, z, 0.08) or path_d(x, z) < 0.5: continue
        gw = g_at(x, z)[0]
        if rng.random() > gw ** 1.6: continue
    else:
        if abs(x) < HALF + 0.45 and abs(z) < HALF + 0.45: continue          # 院墙本身
        if rng.random() > 0.35: continue
    tufts.append([round(float(x), 3), round(float(z), 3), round(float(rng.uniform(0, 360)), 1), round(float(rng.uniform(0.85, 1.3)), 2)])
stones = []
def stone(x, z, s0=0.07, s1=0.125):
    stones.append([round(float(x), 3), round(float(z), 3), round(float(rng.uniform(0, 360)), 1), round(float(rng.uniform(s0, s1)), 3), int(rng.integers(0, 4))])
k = 0
while len(stones) < 22 and k < 4000:                                       # 墙根
    k += 1; side = rng.integers(0, 4); u = rng.uniform(-HALF + 0.3, HALF - 0.3); d = rng.uniform(0.12, 0.4)
    x, z = [(u, -HALF + d), (u, HALF - d), (-HALF + d, u), (HALF - d, u)][side]
    if abs(x - GATE[0]) < 1.4 and z > HALF - 1: continue
    if free(x, z, 0.05) and path_d(x, z) > 0.6: stone(x, z)
for lx, lz in ((-BODY[0] - 0.15, -BODY[1] - 0.12), (BODY[0] + 0.12, -BODY[1] - 0.15), (-BODY[0] - 0.18, BODY[1] + 0.1), (BODY[0] + 0.1, BODY[1] + 0.14)):
    x, z = shed_world(lx, lz)
    if abs(x) < HALF - 0.1 and abs(z) < HALF - 0.1 and path_d(x, z) > 0.5: stone(x, z, 0.08, 0.13)   # 偏屋墙角
for a in (0.3, 2.2, 4.0):
    stone(TREE[0] + 0.45 * math.cos(a), TREE[1] + 0.45 * math.sin(a), 0.06, 0.1)                      # 树根旁
steps = []   # 踏步石：模型原长 2.1 × 1.5 米，缩到约 0.6 × 0.42 米；长边横过路走向（±15 度），间距 62 厘米、石间留约 20 厘米土缝
def lay(a, b, gap, s0, s1, var0):
    L = math.hypot(b[0] - a[0], b[1] - a[1]); n = max(1, round(L / gap)); ang = math.degrees(math.atan2(b[0] - a[0], b[1] - a[1]))   # 路走向（从 +z 起算）；绕 y 转 ang 后模型的长边（本地 x）正好横过路
    for i in range(n):
        t = (i + 0.5) / n; side = (0.05 if i % 2 else -0.05) + rng.uniform(-0.025, 0.025)
        nx, nz = (b[1] - a[1]) / L, -(b[0] - a[0]) / L                                                        # 路的横向
        x = a[0] + (b[0] - a[0]) * t + nx * side; z = a[1] + (b[1] - a[1]) * t + nz * side
        steps.append([round(float(x), 3), round(float(z), 3), round(float((ang + rng.uniform(-15, 15)) % 360), 1), round(float(rng.uniform(s0, s1)), 3), (i + var0) % 3])
lay((GATE[0], GATE[1] - 0.15), (DOOR[0], DOOR[1] + 0.1), 0.62, 0.26, 0.30, 0)        # 院门 → 书房门
lay((0.45, 0.48), (SHED_DOOR[0] + 0.05, SHED_DOOR[1]), 0.63, 0.24, 0.28, 1)          # 岔到偏屋门
json.dump({"format": 1, "axes": "three", "units": "m", "note": "tools/song_yard.py 生成（院子布局）：[x, z, 绕 y 度数, 缩放, 变体]，three 轴向、米、院子坐标",
           "tufts": tufts, "stones": stones, "steps": steps}, open(os.path.join(OUT, "yard_scatter.json"), "w"), separators=(",", ":"))
print(f"分层图 {N}×{N}（{S:.0f} 米）：草覆盖 {grass[(np.abs(X) < HALF) & (np.abs(Z) < HALF)].mean():.2f}；散布 草丛 {len(tufts)}、石块 {len(stones)}、踏步石 {len(steps)}")
print(f"书房门 {DOOR}，偏屋门外 {tuple(round(v, 2) for v in SHED_DOOR)}，篝火 {FIRE}")
