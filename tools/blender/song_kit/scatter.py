# 地面散布（Blender 端，接在 kitlib.py 后执行）：读 TEX\scatter.json（prep_textures.py 按固定种子生成，与地面分层图同源），
# 放草丛（三片交叉插片）、石块（四种）、门前踏步石（三种），集合 ground_dress，同种共用网格（游戏里是实例）。
import json
SC = json.load(open(TEX + "\\scatter.json"))
dc = clear_coll("ground_dress")


def _fresh(name):
    old = bpy.data.meshes.get(name)
    if old:
        bpy.data.meshes.remove(old)


def rock_mesh(name, seed, flat=0.55):
    """石块：二十面球细分两次，按方向噪声起伏、压扁，底部压平埋进地里；石面图顶投影。"""
    _fresh(name)
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=3, radius=1.0); uv = bm.loops.layers.uv.new("UVMap")
    off = Vector((seed * 3.1, seed * 1.7, seed * 2.3))
    for v in bm.verts:
        d = v.co.normalized(); n = 0.34 * _noise.noise(d * 1.3 + off) + 0.16 * _noise.noise(d * 2.9 + off) + 0.05 * _noise.noise(d * 6.0 + off)
        v.co = d * (1 + n); v.co.z *= flat
        if v.co.z < -0.12:
            v.co.z = -0.12 + (v.co.z + 0.12) * 0.2
    for f in bm.faces:
        for l in f.loops:
            l[uv].uv = (l.vert.co.x * 0.35 + 0.5 + seed * 0.21, l.vert.co.y * 0.35 + 0.5 + l.vert.co.z * 0.2)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(mat("rock.jpg", 0.8))
    return me


def step_mesh(name, seed):
    """踏步石：14 边不规则扁石板，顶面微拱，厚 7 厘米（埋 4 厘米）。"""
    _fresh(name)
    bm = bmesh.new(); uv = bm.loops.layers.uv.new("UVMap"); N = 14; off = Vector((seed * 2.7, 0.3, seed * 1.9))
    rs = [1 + 0.16 * _noise.noise(off + Vector((math.cos(2 * math.pi * i / N), math.sin(2 * math.pi * i / N), 0)) * 1.3) for i in range(N)]
    ring = lambda z, k: [bm.verts.new((r * k * math.cos(2 * math.pi * i / N), r * k * 0.78 * math.sin(2 * math.pi * i / N), z)) for i, r in enumerate(rs)]
    bot, mid, top = ring(-0.04, 0.96), ring(0.02, 1.0), ring(0.035, 0.88); ctr = bm.verts.new((0, 0, 0.045))
    for a, b in ((bot, mid), (mid, top)):
        for i in range(N):
            j = (i + 1) % N; bm.faces.new([a[i], a[j], b[j], b[i]])
    for i in range(N):
        bm.faces.new([top[i], top[(i + 1) % N], ctr])
    for f in bm.faces:
        for l in f.loops:
            l[uv].uv = (l.vert.co.x * 0.3 + 0.5 + seed * 0.17, l.vert.co.y * 0.3 + 0.5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(mat("rock.jpg", 0.8))
    return me


def tuft_mesh(name="grass_tuft"):
    """草丛：三片 0.4 × 0.32 米插片按 60 度交叉，略向外张。"""
    _fresh(name)
    bm = bmesh.new(); uv = bm.loops.layers.uv.new("UVMap"); w, h = 0.2, 0.32
    for k in range(3):
        a = math.radians(60 * k); c, s_ = math.cos(a), math.sin(a)
        vs = [bm.verts.new((x * c, x * s_, z)) for x, z in ((-w, 0), (w, 0), (w * 1.15, h), (-w * 1.15, h))]
        f = bm.faces.new(vs)
        for l, t in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
            l[uv].uv = t
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    me.materials.append(mat("grass_tuft.png", 0.9, 0, alpha=True))
    return me


rocks = [rock_mesh(f"rock_{i}", i + 1, flat=(0.55, 0.45, 0.7, 0.5)[i]) for i in range(4)]
steps = [step_mesh(f"step_{i}", i + 1) for i in range(3)]
tm = tuft_mesh()
for i, (x, y, r, s_) in enumerate(SC["tufts"]):
    o = obj(f"tuft{i}", tm, dc, (x, y, 0), (0, 0, r), 0); o.scale = (s_, s_, s_ * (0.8 + 0.4 * ((i * 37) % 10) / 10))
for i, (x, y, r, s_, v) in enumerate(SC["stones"]):
    o = obj(f"stone{i}", rocks[v], dc, (x, y, 0), (0, 0, r), 0); o.scale = (s_, s_ * 0.8, s_)
for i, (x, y, r, s_, v) in enumerate(SC["steps"]):
    o = obj(f"step{i}", steps[v], dc, (x, y, 0), (0, 0, r), 0); o.scale = (s_, s_, 1.0)
bpy.ops.wm.save_mainfile()
print("scatter ok", len(dc.objects))
