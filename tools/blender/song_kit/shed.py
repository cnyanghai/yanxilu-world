# 拼偏屋（ASSET-SPEC 10.1）：占地 x -2..2、y -1..1，正面 +Y；檐口 2.4，屋面 45 度，脊高 3.4。共用组件网格（链接复制）。
M = {k: bpy.data.meshes[k] for k in BUILD}
c = clear_coll("shed")
P = lambda n, k, loc, rot=(0, 0, 0), bev=0.008: obj(n, M[k], c, loc, rot, bev)
for i, (x, y) in enumerate([(-2, 1), (0, 1), (2, 1), (-2, -1), (0, -1), (2, -1)]):
    P(f"post{i}", "post", (x, y, 0))
P("wall_f_door", "wall_door", (-1, 1, 0)); P("wall_f_win", "wall_window", (1, 1, 0))
P("wall_b0", "wall_plain", (-1, -1, 0), (0, 0, 180)); P("wall_b1", "wall_plain", (1, -1, 0), (0, 0, 180))
P("wall_l", "wall_plain", (-2, 0, 0), (0, 0, 90)); P("wall_r", "wall_plain", (2, 0, 0), (0, 0, -90))
for i, (x, y, r) in enumerate([(-1, 1, 0), (1, 1, 0), (-1, -1, 180), (1, -1, 180), (-2, 0, 90), (2, 0, -90)]):
    P(f"beam{i}", "beam", (x, y, 2.24), (0, 0, r))
P("gable_l", "gable", (-2, 0, 2.4), (0, 0, 90)); P("gable_r", "gable", (2, 0, 2.4), (0, 0, -90))
for i, x in enumerate((-1, 1)):
    P(f"roof_f{i}", "roof_thatch", (x, 0, 3.4), (-45, 0, 0), 0)
    P(f"roof_b{i}", "roof_thatch", (x, 0, 3.4), (-45, 0, 180), 0)
    P(f"ridge{i}", "ridge", (x, 0, 3.52), (0, 0, 0), 0)
for o in c.objects:   # 屋面与屋脊两片各放宽 2%，接缝处重叠盖住黑缝
    if o.name.startswith(("roof_", "ridge")): o.scale.x = 1.02
P("door", "door_leaf", (-1.45, 1, 0), (0, 0, -70))
# 人形量杆 1.5 米：站在门口内侧
pm = bpy.data.meshes.get("person_1p5")
if not pm:
    import bmesh as _b
    bm = _b.new(); _b.ops.create_cone(bm, cap_ends=True, segments=16, radius1=0.2, radius2=0.2, depth=1.5)
    pm = bpy.data.meshes.new("person_1p5"); bm.to_mesh(pm); bm.free()
o = bpy.data.objects.new("person_1p5", pm); c.objects.link(o); o.location = (-1, 0.95, 0.75)
# 土地面 10 × 8 米，贴图每 2 米一铺
g = bpy.data.meshes.get("ground_dirt")
if g: bpy.data.meshes.remove(g)
import bmesh as _b
bm = _b.new(); uvl = bm.loops.layers.uv.new("UVMap")
vs = [bm.verts.new(p) for p in ((-5, -4, 0), (5, -4, 0), (5, 4, 0), (-5, 4, 0))]
f = bm.faces.new(vs)
for l in f.loops: l[uvl].uv = (l.vert.co.x / 2, l.vert.co.y / 2)
g = bpy.data.meshes.new("ground_dirt"); bm.to_mesh(g); bm.free()
gm = bpy.data.materials.get("m_ground_dirt") or bpy.data.materials.new("m_ground_dirt"); gm.use_nodes = True
if not any(n.type == "TEX_IMAGE" for n in gm.node_tree.nodes):
    t = gm.node_tree.nodes.new("ShaderNodeTexImage"); t.image = bpy.data.images.load(TEX + "\\ground_dirt.jpg", check_existing=True)
    gm.node_tree.links.new(t.outputs["Color"], gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"])
g.materials.append(gm); o = bpy.data.objects.new("ground", g); c.objects.link(o); o.location.z = -0.001
coll(KIT).hide_viewport = True
view((-0.8, 0.6, 1.2), (43, 0, 200), 6.5)
bpy.ops.wm.save_as_mainfile(filepath=r"C:\Users\cnyan\blender_mcp\song_shed.blend")
print("shed ok", len(c.objects), "objects")
