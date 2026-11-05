# 营地小试的组件库（Blender 端执行）。约定：单位米，原点底面中心（门扇例外：原点在门轴），正面朝 +Y（= three.js -Z）。
# 贴图由 prep_textures.py 写到 TEX；正面贴图按 u = x / 宽、v = z / 高 投到 ±Y 面（背面镜像），顶底面也用正面图，±X 面用侧视图。
# 有同名 _n.png 的贴图自动接法线（OpenGL 约定）。
import bpy, bmesh, math, os
from mathutils import Vector, noise as _noise

TEX = r"C:\Users\cnyan\blender_mcp\tex"
KIT = "song_kit"


def coll(name):
    c = bpy.data.collections.get(name)
    if not c:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
    return c


def clear_coll(name):
    c = coll(name)
    for o in list(c.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    return c


def _img(f, data=False):
    im = bpy.data.images.load(TEX + "\\" + f, check_existing=True)
    if data:
        im.colorspace_settings.name = "Non-Color"
    return im


def mat(img, rough=0.85, nstr=1.0, alpha=False, vcol=False):
    """vcol：底色乘顶点色 Col（旧化；导出 glTF 为 COLOR_0，three.js 开 vertexColors）。"""
    name = "m_" + img.split(".")[0]
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; bsdf = nt.nodes.get("Principled BSDF"); t = nt.nodes.new("ShaderNodeTexImage")
    t.image = _img(img)
    if vcol:
        vc = nt.nodes.new("ShaderNodeVertexColor"); vc.layer_name = "Col"
        mx = nt.nodes.new("ShaderNodeMix"); mx.data_type = "RGBA"; mx.blend_type = "MULTIPLY"; mx.inputs["Factor"].default_value = 1.0
        nt.links.new(t.outputs["Color"], mx.inputs[6]); nt.links.new(vc.outputs["Color"], mx.inputs[7])
        nt.links.new(mx.outputs[2], bsdf.inputs["Base Color"])
    else:
        nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    if alpha:  # 散草：透明裁切，双面
        nt.links.new(t.outputs["Alpha"], bsdf.inputs["Alpha"])
        m.surface_render_method = "DITHERED"; m.use_backface_culling = False
    nf = img.rsplit(".", 1)[0] + "_n.png"
    if nstr and os.path.exists(TEX + "\\" + nf):
        n = nt.nodes.new("ShaderNodeTexImage"); n.image = _img(nf, data=True)
        nm = nt.nodes.new("ShaderNodeNormalMap"); nm.inputs["Strength"].default_value = nstr
        nt.links.new(n.outputs["Color"], nm.inputs["Color"]); nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def box_mesh(name, boxes, W, T, H, mats, extra=None):
    """boxes: [(x0,x1,y0,y1,z0,z1,材质槽 或 None)]；None = 按朝向自动（0 正面图，1 侧视图）。
    UV：±Y 面 (x,z) 归一到 W、H；±X 面 (y,z) 归一到 T、H；±Z 面 (x,y) 归一到 W、T。"""
    bm = bmesh.new(); uv = bm.loops.layers.uv.new("UVMap")
    for x0, x1, y0, y1, z0, z1, slot in boxes:
        v = {}
        for i, x in enumerate((x0, x1)):
            for j, y in enumerate((y0, y1)):
                for k, z in enumerate((z0, z1)):
                    v[i, j, k] = bm.verts.new((x, y, z))
        quads = [((0,0,0),(1,0,0),(1,0,1),(0,0,1)), ((1,1,0),(0,1,0),(0,1,1),(1,1,1)),
                 ((0,1,0),(0,0,0),(0,0,1),(0,1,1)), ((1,0,0),(1,1,0),(1,1,1),(1,0,1)),
                 ((0,0,1),(1,0,1),(1,1,1),(0,1,1)), ((0,1,0),(1,1,0),(1,0,0),(0,0,0))]
        for q in quads:
            f = bm.faces.new([v[c] for c in q]); f.normal_update(); n = f.normal
            f.material_index = slot if slot is not None else (1 if abs(n.x) > 0.5 else 0)
            for l in f.loops:
                p = l.vert.co
                if abs(n.y) > 0.5:
                    u = (p.x + W / 2) / W; l[uv].uv = (u if n.y > 0 else 1 - u, p.z / H)
                elif abs(n.x) > 0.5:
                    l[uv].uv = ((p.y + T / 2) / T, p.z / H)
                else:
                    l[uv].uv = ((p.x + W / 2) / W, (p.y + T / 2) / T)
    if extra:
        extra(bm, uv)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for m in mats:
        me.materials.append(m)
    return me


def obj(name, me, c, loc=(0, 0, 0), rot=(0, 0, 0), bevel=0.008):
    o = bpy.data.objects.new(name, me); c.objects.link(o)
    o.location = loc; o.rotation_euler = [math.radians(a) for a in rot]
    if bevel:
        b = o.modifiers.new("bevel", "BEVEL"); b.width = bevel; b.segments = 2; b.harden_normals = True
        b.limit_method = "ANGLE"
    return o


def _quad(bm, uv, vs, uvs, slot, out=None):
    """建一个面并写 UV；out 给了就按它翻成朝外。"""
    f = bm.faces.new(vs); f.material_index = slot
    for l, t in zip(f.loops, uvs):
        l[uv].uv = t
    if out is not None:
        f.normal_update()
        if f.normal.dot(out) < 0:
            f.normal_flip()
    return f


# ---------- 组件 ----------

def m_post():
    W = T = 0.16; H = 2.4
    return box_mesh("post", [(-W/2, W/2, -T/2, T/2, 0, H, None)], W, T, H, [mat("post_f.jpg"), mat("post_s.jpg")])


def m_beam():
    W, T, H = 2.0, 0.16, 0.16
    return box_mesh("beam", [(-W/2, W/2, -T/2, T/2, 0, H, None)], W, T, H, [mat("beam_f.jpg"), mat("beam_s.jpg")])


def m_wall_plain(var=""):
    """平墙段。var：'' 原图（右侧掉泥露编条）、'mir' 左右镜像、'full' 整面抹泥只留左下小缺口。几何相同，只换正面图。"""
    W, T, H = 2.0, 0.12, 2.2; tag = f"_{var}" if var else ""
    return box_mesh("wall_plain" + tag, [(-W/2, W/2, -T/2, T/2, 0, H, None)], W, T, H,
                    [mat(f"wall_plain{tag}_f.jpg"), mat("wall_plain_s.jpg")])


def _trim(x0, x1, z0, z1, T, out=0.02):
    """洞口一圈凸出的木框（材质槽 2）。"""
    return (x0, x1, -T/2 - out, T/2 + out, z0, z1, 2)


def m_wall_door():
    W, T, H = 2.0, 0.12, 2.2; DW, DH = 0.9, 1.95; L = (W - DW) / 2; f = 0.06
    boxes = [(-W/2, -W/2 + L, -T/2, T/2, 0, H, None), (W/2 - L, W/2, -T/2, T/2, 0, H, None),
             (-DW/2, DW/2, -T/2, T/2, DH, H, None),
             _trim(-DW/2 - f, -DW/2, 0, DH + f, T), _trim(DW/2, DW/2 + f, 0, DH + f, T), _trim(-DW/2, DW/2, DH, DH + f, T)]
    return box_mesh("wall_door", boxes, W, T, H, [mat("wall_door_f.jpg"), mat("wall_door_s.jpg"), mat("post_f.jpg")])


def m_wall_window():
    W, T, H = 2.0, 0.12, 2.2; x0, x1, z0, z1 = -0.4, 0.4, 1.0, 1.6; f = 0.05
    boxes = [(-W/2, x0, -T/2, T/2, 0, H, None), (x1, W/2, -T/2, T/2, 0, H, None),
             (x0, x1, -T/2, T/2, 0, z0, None), (x0, x1, -T/2, T/2, z1, H, None),
             _trim(x0 - f, x0, z0 - f, z1 + f, T), _trim(x1, x1 + f, z0 - f, z1 + f, T),
             _trim(x0, x1, z0 - f, z0, T), _trim(x0, x1, z1, z1 + f, T)]
    n = 7; bw = 0.035
    for i in range(n):  # 直棂
        cx = x0 + (i + 1) * (x1 - x0) / (n + 1)
        boxes.append((cx - bw/2, cx + bw/2, -0.03, 0.03, z0, z1, 2))
    return box_mesh("wall_window", boxes, W, T, H, [mat("wall_window_f.jpg"), mat("wall_window_s.jpg"), mat("post_f.jpg")])


def m_door_leaf():
    W, T, H = 0.9, 0.05, 1.95
    # 原点在门轴（左下角），x 0 到 0.9
    me = box_mesh("door_leaf", [(-W/2, W/2, -T/2, T/2, 0, H, None)], W, T, H, [mat("door_leaf_f.jpg"), mat("door_leaf_s.jpg")])
    me.transform(__import__("mathutils").Matrix.Translation((W/2, 0, 0)))
    return me


def m_gable():
    W, T, H = 2.0, 0.12, 1.0
    bm = bmesh.new(); uv = bm.loops.layers.uv.new("UVMap")
    pts = [(-W/2, 0), (W/2, 0), (0, H)]
    fr = [bm.verts.new((x, T/2, z)) for x, z in pts]; bk = [bm.verts.new((x, -T/2, z)) for x, z in pts]
    faces = [(fr, 0), (list(reversed(bk)), 0)]
    for i in range(3):
        j = (i + 1) % 3; faces.append(([bk[i], bk[j], fr[j], fr[i]], 1))
    for vs, slot in faces:
        f = bm.faces.new(vs); f.material_index = slot; f.normal_update(); n = f.normal
        for l in f.loops:
            p = l.vert.co
            if slot == 0:
                u = (p.x + W/2) / W; l[uv].uv = (u if n.y > 0 else 1 - u, p.z / H)
            else:
                l[uv].uv = ((p.y + T/2) / T, (p.x + W/2) / W if abs(n.z) > 0.9 else p.z / H)
    bm.normal_update()
    me = bpy.data.meshes.new("gable"); bm.to_mesh(me); bm.free()
    me.materials.append(mat("gable_f.jpg")); me.materials.append(mat("gable_s.jpg"))
    return me


# ---------- 茅草屋面（2026-11-04 重做：五层台阶 + 压条 + 圆檐口 + 散草；中段 2 米 + 两端悬山收头 0.3 米） ----------
# 本地坐标：x 沿脊，y 0（脊）到檐，z 0（底面，贴着檐梁与山花）向外为厚度。贴图左右无缝，u = xw / 2（xw 以 2 米为一周期），相邻件纹理与起伏都连续。
NC, CL, T0, STEP = 5, 0.38, 0.20, 0.05     # 层数、每层坡长、层顶厚、每层抬起
L_ROOF = NC * CL                           # 坡长 1.9（出檐约 0.4）
RODS = [92, 284, 480, 686, 856]            # roof_thatch_f.jpg（870 行）里每道压条起始行；最后一个是底端可用行
TEX_H = 870
BANDS = [0, 1, 2, 0, 1]                    # 每层用贴图的哪一带
NOSE = [(0.03, T0 + STEP - 0.035), (0.05, 0.12), (0.058, 0.0)]   # 檐口鼻：相对 L_ROOF 的 y、z


def _vr(r):
    return 1 - r / TEX_H


def _nz(xw, y, amp=0.012):
    """沿 x 以 2 米为周期的起伏噪声（在圆柱面上取三维噪声）。"""
    th = 2 * math.pi * xw / 2.0
    p = Vector((0.9 * math.cos(th), 0.9 * math.sin(th), y * 1.7))
    return amp * _noise.noise(p) + 0.4 * amp * _noise.noise(p * 3.3 + Vector((5.2, 1.3, 7.7)))


def _thatch_profile():
    """截面闭合环：脊 → 各层顶面（含台阶）→ 檐口鼻 → 底面 → 回脊。返回 点 [(y, z, 类)]、段 [(i, j, vA, vB, 槽)]、每层压条 [(y, 带)]。"""
    P, S, rods = [], [], []
    add = lambda y, z, k: (P.append((y, z, k)), len(P) - 1)[1]
    cur = add(0.0, T0, "top")
    for k in range(NC):
        b = BANDS[k]; r0, r1 = RODS[b], RODS[b + 1] - 14
        y0 = P[cur][0]; y1 = (k + 1) * CL - 0.004
        if k:
            rods.append((y0 + 0.02, b))
        for i in range(1, 4):
            t = i / 3; nxt = add(y0 + (y1 - y0) * t, T0 + STEP * t, "top")
            S.append((cur, nxt, _vr(r0 + (r1 - r0) * (i - 1) / 3), _vr(r0 + (r1 - r0) * t), 0)); cur = nxt
        if k < NC - 1:   # 台阶面：草尖行 → 下一层的压条行
            nxt = add((k + 1) * CL + 0.012, T0 + 0.004, "top")
            S.append((cur, nxt, _vr(r1), _vr(RODS[b + 1]), 0)); cur = nxt
    for dy, z in NOSE:
        nxt = add(L_ROOF + dy, z, "nose"); S.append((cur, nxt, P[cur][1] / 0.3, z / 0.3, 1)); cur = nxt
    Lb = L_ROOF + NOSE[-1][0]
    ridge0 = add(0.0, 0.0, "bot"); S.append((cur, ridge0, Lb / Lb, 0.0, 2))
    S.append((ridge0, 0, 0.0, 1.0, 3))
    return P, S, rods


def _roll(d):
    """悬山收头：离接缝 d 米处截面的 (厚度系数, 下垂)。0.15 米以内不变，外缘厚度收到四分之一、整体下垂 7 厘米。"""
    if d <= 0.15:
        return 1.0, 0.0
    t = (d - 0.15) / 0.15
    return 1 - 0.75 * t * t, -0.07 * t ** 0.7


def m_roof_thatch(kind="mid"):
    """kind：'mid' 中段 x -1..1；'verge_r' 右收头 x 0..0.3（接在中段 +x 端）；'verge_l' 左收头 x -0.3..0。
    材质槽：0 顶面（roof_thatch_f）、1 檐口截面（thatch_end）、2 底面（roof_thatch_b）、3 端面（roof_thatch_s）、4 散草（透明）。"""
    P, S, rods = _thatch_profile()
    if kind == "mid":
        xs = [-1.0 + 0.2 * i for i in range(11)]; xw = [x + 1.0 for x in xs]; ds = [0.0] * 11
    else:
        dd = [0.0, 0.08, 0.15, 0.2, 0.24, 0.27, 0.29, 0.30]
        if kind == "verge_r":
            xs = dd[:]; ds = dd[:]
        else:
            xs = [-d for d in reversed(dd)]; ds = list(reversed(dd))
        xw = xs[:]
    bm = bmesh.new(); uv = bm.loops.layers.uv.new("UVMap")
    jag = lambda w: 0.022 * _noise.noise(Vector((2.1 * math.cos(math.pi * w), 2.1 * math.sin(math.pi * w), 3.7)))

    def place(y, z, kind_, c):
        zs, zd = _roll(ds[c])
        if kind_ == "top":
            z = z + _nz(xw[c], y)
        elif kind_ == "nose":
            y = y + jag(xw[c]); z = z + _nz(xw[c], L_ROOF) * (z / T0)
        return Vector((xs[c], y, zd + z * zs))

    V = [[bm.verts.new(place(y, z, k_, c)) for (y, z, k_) in P] for c in range(len(xs))]
    for c in range(len(xs) - 1):
        u0, u1 = xw[c] / 2, xw[c + 1] / 2
        for i, j, va, vb, slot in S:
            if slot == 3:
                continue  # 脊侧端面藏在屋脊下
            if slot == 2:
                Lb = L_ROOF + NOSE[-1][0]; va, vb = P[i][0] / Lb, P[j][0] / Lb
            _quad(bm, uv, [V[c][i], V[c + 1][i], V[c + 1][j], V[c][j]], [(u0, va), (u1, va), (u1, vb), (u0, vb)], slot)
    # 压条：每层顶端一根竹竿，半径 1.6 厘米，6 棱，贴图取画上的压条行
    R, SEG = 0.016, 6
    rc = [c for c in range(len(xs)) if ds[c] <= 0.2]
    for y, b in rods:
        rings, ctrs = [], []
        for c in rc:
            zs, zd = _roll(ds[c]); ctr = Vector((xs[c], y, zd + (T0 + 0.006 + _nz(xw[c], y)) * zs + 0.006)); ctrs.append(ctr)
            rings.append([bm.verts.new(ctr + Vector((0, R * math.cos(2 * math.pi * s / SEG), R * math.sin(2 * math.pi * s / SEG)))) for s in range(SEG)])
        for a in range(len(rc) - 1):
            ua, ub = xw[rc[a]] / 2, xw[rc[a + 1]] / 2
            for s in range(SEG):
                va, vb = _vr(RODS[b] + 16 * s / SEG), _vr(RODS[b] + 16 * (s + 1) / SEG)
                mid = (rings[a][s].co + rings[a][(s + 1) % SEG].co) / 2
                _quad(bm, uv, [rings[a][s], rings[a + 1][s], rings[a + 1][(s + 1) % SEG], rings[a][(s + 1) % SEG]],
                      [(ua, va), (ub, va), (ub, vb), (ua, vb)], 0, mid - ctrs[a])
        if kind != "mid":  # 收头一端封口
            end = rings[-1] if kind == "verge_r" else rings[0]
            _quad(bm, uv, end, [(0.5 + 0.5 * math.cos(2 * math.pi * s / SEG), _vr(RODS[b] + 8)) for s in range(SEG)], 0,
                  Vector((1 if kind == "verge_r" else -1, 0, 0)))
    # 收头外端封口（截面多边形，端面图）
    if kind != "mid":
        c = len(xs) - 1 if kind == "verge_r" else 0
        ring = V[c]; Lb = L_ROOF + NOSE[-1][0]
        _quad(bm, uv, ring, [((v.co.z + 0.07) / 0.32, v.co.y / Lb) for v in ring], 3, Vector((1 if kind == "verge_r" else -1, 0, 0)))
    # 散草：檐口下两排透明草帘，竖直垂下约 15 厘米
    for (y0, z0, dy, dz, uoff) in ((0.035, 0.06, 0.12, -0.10, 0.0), (0.02, 0.10, 0.13, -0.11, 0.37)):
        top, bot = [], []
        for c in range(len(xs)):
            zs, zd = _roll(ds[c]); yj = L_ROOF + y0 + jag(xw[c])
            top.append(bm.verts.new((xs[c], yj, zd + z0 * zs))); bot.append(bm.verts.new((xs[c], yj + dy, zd + z0 * zs + dz)))
        for c in range(len(xs) - 1):
            u0, u1 = xw[c] / 2 + uoff, xw[c + 1] / 2 + uoff
            _quad(bm, uv, [top[c], top[c + 1], bot[c + 1], bot[c]], [(u0, 1), (u1, 1), (u1, 0), (u0, 0)], 4)
    # 旧化（顶点色）：近脊晒白一点、近檐发暗（雨淋），夹成片的斑；噪声按 2 米周期，相邻件接得上
    col = bm.loops.layers.float_color.new("Col")   # 线性浮点（字节色会按 sRGB 换算多暗一截；glTF 的 COLOR_0 也是线性）
    for f in bm.faces:
        for l in f.loops:
            p = l.vert.co; w = p.x + 1.0 if kind == "mid" else p.x
            t = min(max((p.y / L_ROOF - 0.35) / 0.65, 0.0), 1.0); t = t * t * (3 - 2 * t)
            th = math.pi * w; n = _noise.noise(Vector((1.3 * math.cos(th), 1.3 * math.sin(th), p.y * 2.4 + 11.0)))
            v = (1.04 - 0.2 * t) * (0.92 + 0.1 * n)
            l[col] = (v, v * 0.98, v * 0.95, 1.0)
    bm.normal_update()
    me = bpy.data.meshes.new("roof_" + kind); bm.to_mesh(me); bm.free()
    for img in ("roof_thatch_f.jpg", "thatch_end.jpg", "roof_thatch_b.jpg", "roof_thatch_s.jpg"):
        me.materials.append(mat(img, 0.95, vcol=True))
    me.materials.append(mat("thatch_fringe.png", 0.95, 0, alpha=True, vcol=True))
    return me


def m_ridge(kind="mid"):
    """屋脊：截面半椭圆宽 0.5 高 0.32，底面 z 0。'mid' 沿 x 2 米；'end_r' / 'end_l' 两端 0.3 米收头，截面收到 0.86 并封口。"""
    D, H, seg = 0.5, 0.32, 12
    if kind == "mid":
        cols = [(-1.0, 1.0), (1.0, 1.0)]; xw = lambda x: x + 1.0
    else:
        cc = [(0.0, 1.0), (0.15, 1.0), (0.25, 0.95), (0.30, 0.86)]
        cols = cc if kind == "end_r" else [(-x, s) for x, s in reversed(cc)]; xw = lambda x: x
    prof = [(D/2 * math.cos(math.pi * i / seg), H * math.sin(math.pi * i / seg)) for i in range(seg + 1)]
    bm = bmesh.new(); uv = bm.loops.layers.uv.new("UVMap")
    rings = [[bm.verts.new((x, y * s, z * s)) for y, z in prof] for x, s in cols]
    for c in range(len(cols) - 1):
        u0, u1 = xw(cols[c][0]) / 2, xw(cols[c + 1][0]) / 2
        for i in range(seg):
            a, b = rings[c], rings[c + 1]; m = (a[i].co + a[i + 1].co) / 2
            _quad(bm, uv, [a[i], b[i], b[i + 1], a[i + 1]], [(u0, i / seg), (u1, i / seg), (u1, (i + 1) / seg), (u0, (i + 1) / seg)], 0,
                  Vector((0, m.y, m.z)))
    if kind != "mid":
        ring = rings[-1] if kind == "end_r" else rings[0]; s = cols[-1][1] if kind == "end_r" else cols[0][1]
        _quad(bm, uv, ring, [(v.co.y / (D * s) + 0.5, v.co.z / (H * s)) for v in ring], 1, Vector((1 if kind == "end_r" else -1, 0, 0)))
    bm.normal_update()
    me = bpy.data.meshes.new("ridge" if kind == "mid" else "ridge_" + kind); bm.to_mesh(me); bm.free()
    me.materials.append(mat("ridge_f.jpg", 0.95)); me.materials.append(mat("ridge_s.jpg", 0.95))
    return me


BUILD = {"post": m_post, "beam": m_beam, "wall_plain": m_wall_plain,
         "wall_plain_mir": lambda: m_wall_plain("mir"), "wall_plain_full": lambda: m_wall_plain("full"),
         "wall_door": m_wall_door, "wall_window": m_wall_window, "door_leaf": m_door_leaf, "gable": m_gable,
         "roof_thatch": lambda: m_roof_thatch("mid"), "roof_verge_l": lambda: m_roof_thatch("verge_l"),
         "roof_verge_r": lambda: m_roof_thatch("verge_r"),
         "ridge": m_ridge, "ridge_end_l": lambda: m_ridge("end_l"), "ridge_end_r": lambda: m_ridge("end_r")}


def build_all():
    """重建全部组件网格（同名先删；贴图重读、组件材质重建），返回 {件: mesh}。"""
    for im in bpy.data.images:   # 存过 .blend 后路径会变成相对（//tex\...），按绝对路径比
        if os.path.normcase(bpy.path.abspath(im.filepath)).startswith(os.path.normcase(TEX)):
            im.reload()
    out = {}
    for k in BUILD:
        old = bpy.data.meshes.get(k)
        if old:
            for o in [o for o in bpy.data.objects if o.data == old]:
                bpy.data.objects.remove(o, do_unlink=True)
            bpy.data.meshes.remove(old)
    for m in [m for m in bpy.data.materials if m.name.startswith("m_") and m.name != "m_ground"]:
        bpy.data.materials.remove(m)
    for k, fn in BUILD.items():
        out[k] = fn(); out[k].name = k
    return out


def view(loc, rot_deg, dist, shading="MATERIAL"):
    from mathutils import Euler
    for a in bpy.context.screen.areas:
        if a.type == "VIEW_3D":
            sp = a.spaces[0]; sp.shading.type = shading
            r = sp.region_3d; r.view_perspective = "PERSP"
            r.view_rotation = Euler([math.radians(x) for x in rot_deg], "XYZ").to_quaternion()
            r.view_location = Vector(loc); r.view_distance = dist
