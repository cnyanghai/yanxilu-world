# 营地小试的组件库（Blender 端执行）。约定：单位米，原点底面中心（门扇例外：原点在门轴），正面朝 +Y（= three.js -Z）。
# 贴图由 prep_textures.py 写到 TEX；正面贴图按 u = x / 宽、v = z / 高 投到 ±Y 面（背面镜像），顶底面也用正面图，±X 面用侧视图。
import bpy, bmesh, math
from mathutils import Vector

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


def mat(img, rough=0.85):
    name = "m_" + img.split(".")[0]
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; bsdf = nt.nodes.get("Principled BSDF"); t = nt.nodes.new("ShaderNodeTexImage")
    t.image = bpy.data.images.load(TEX + "\\" + img, check_existing=True)
    nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
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


# ---------- 组件 ----------

def m_post():
    W = T = 0.16; H = 2.4
    return box_mesh("post", [(-W/2, W/2, -T/2, T/2, 0, H, None)], W, T, H, [mat("post_f.jpg"), mat("post_s.jpg")])


def m_beam():
    W, T, H = 2.0, 0.16, 0.16
    return box_mesh("beam", [(-W/2, W/2, -T/2, T/2, 0, H, None)], W, T, H, [mat("beam_f.jpg"), mat("beam_s.jpg")])


def m_wall_plain():
    W, T, H = 2.0, 0.12, 2.2
    return box_mesh("wall_plain", [(-W/2, W/2, -T/2, T/2, 0, H, None)], W, T, H, [mat("wall_plain_f.jpg"), mat("wall_plain_s.jpg")])


def _trim(x0, x1, z0, z1, T, out=0.02):
    """洞口一圈凸出的木框（材质槽 2）。"""
    return (x0, x1, -T/2 - out, T/2 + out, z0, z1, 2)


def m_wall_door():
    W, T, H = 2.0, 0.12, 2.2; DW, DH = 0.9, 1.95; L = (W - DW) / 2; f = 0.06
    boxes = [(-W/2, -W/2 + L, -T/2, T/2, 0, H, None), (W/2 - L, W/2, -T/2, T/2, 0, H, None),
             (-DW/2, DW/2, -T/2, T/2, DH, H, None),
             _trim(-DW/2 - f, -DW/2, 0, DH + f, T), _trim(DW/2, DW/2 + f, 0, DH + f, T), _trim(-DW/2, DW/2, DH, DH + f, T)]
    return box_mesh("wall_door", boxes, W, T, H, [mat("wall_door_front.jpg"), mat("wall_door_side.jpg"), mat("post_f.jpg")])


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


def m_roof_thatch():
    """屋面片：本地 x 沿脊 -1 到 1，y 0（脊）到 1.7（檐），z 0（底面）到 0.25；顶面正视图、底面仰视图、四边侧视图。
    檐口一边做成锯齿散草（每 5 厘米一齿，长短随机）。"""
    import random; random.seed(7)
    W, L, T = 2.0, 1.7, 0.25
    bm = bmesh.new(); uv = bm.loops.layers.uv.new("UVMap")
    xs = [-W/2 + i * 0.05 for i in range(int(W / 0.05) + 1)]
    eave = [L + random.uniform(-0.03, 0.05) for _ in xs]
    top = [bm.verts.new((x, 0, T)) for x in xs] + [bm.verts.new((x, e, T * 0.55)) for x, e in zip(xs, eave)]
    bot = [bm.verts.new((x, 0, 0)) for x in xs] + [bm.verts.new((x, e - 0.04, 0)) for x, e in zip(xs, eave)]
    n = len(xs)
    def q(vs, slot):
        f = bm.faces.new(vs); f.material_index = slot
        for l in f.loops:
            p = l.vert.co
            if slot == 0: l[uv].uv = ((p.x + W/2) / W, 1 - p.y / L)
            elif slot == 2: l[uv].uv = ((p.x + W/2) / W, p.y / L)
            else: l[uv].uv = (p.z / T, p.y / L if abs(p.x) > W/2 - 1e-4 else (p.x + W/2) / W)
    for i in range(n - 1):
        q([top[i], top[i+1], top[n+i+1], top[n+i]][::-1], 0)
        q([bot[i], bot[i+1], bot[n+i+1], bot[n+i]], 2)
        q([bot[n+i], bot[n+i+1], top[n+i+1], top[n+i]], 1)      # 檐口
        q([bot[i+1], bot[i], top[i], top[i+1]], 1)              # 脊边
    q([bot[0], bot[n], top[n], top[0]], 1); q([bot[2*n-1], bot[n-1], top[n-1], top[2*n-1]], 1)
    bm.normal_update()
    me = bpy.data.meshes.new("roof_thatch"); bm.to_mesh(me); bm.free()
    for img in ("roof_thatch_f.jpg", "roof_thatch_s.jpg", "roof_thatch_b.jpg"):
        me.materials.append(mat(img, 0.95))
    return me


def m_ridge():
    """屋脊：沿 x 2 米，截面半椭圆宽 0.45 高 0.3，底面在 z 0。"""
    W, D, H, seg = 2.0, 0.45, 0.3, 12
    bm = bmesh.new(); uv = bm.loops.layers.uv.new("UVMap")
    prof = [(D/2 * math.cos(math.pi * i / seg), H * math.sin(math.pi * i / seg)) for i in range(seg + 1)]
    L = [bm.verts.new((-W/2, y, z)) for y, z in prof]; R = [bm.verts.new((W/2, y, z)) for y, z in prof]
    for i in range(seg):
        f = bm.faces.new([L[i], R[i], R[i+1], L[i+1]]); f.material_index = 0
        for l, (u, v) in zip(f.loops, [(0, i/seg), (1, i/seg), (1, (i+1)/seg), (0, (i+1)/seg)]): l[uv].uv = (u, v)
    for ring, sgn in ((L, -1), (R, 1)):
        f = bm.faces.new(ring if sgn > 0 else list(reversed(ring))); f.material_index = 1
        for l in f.loops: l[uv].uv = (l.vert.co.y / D + 0.5, l.vert.co.z / H)
    bm.normal_update(); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("ridge"); bm.to_mesh(me); bm.free()
    me.materials.append(mat("ridge_f.jpg", 0.95)); me.materials.append(mat("ridge_s.jpg", 0.95))
    return me


BUILD = {"post": m_post, "beam": m_beam, "wall_plain": m_wall_plain, "wall_door": m_wall_door,
         "wall_window": m_wall_window, "door_leaf": m_door_leaf, "gable": m_gable,
         "roof_thatch": m_roof_thatch, "ridge": m_ridge}


def build_all():
    """重建全部组件网格（同名先删），返回 {件: mesh}。"""
    out = {}
    for k, fn in BUILD.items():
        old = bpy.data.meshes.get(k)
        if old:
            for o in [o for o in bpy.data.objects if o.data == old]:
                bpy.data.objects.remove(o, do_unlink=True)
            bpy.data.meshes.remove(old)
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
