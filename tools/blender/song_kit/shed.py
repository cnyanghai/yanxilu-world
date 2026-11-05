# 拼偏屋（ASSET-SPEC 10.1）：占地 x -2..2、y -1..1，正面 +Y；檐口 2.4，屋面 45 度，脊高 3.4。共用组件网格（链接复制）。
# 2026-11-04 补弱项：屋面 = 2 段中段 + 两端悬山收头（出山 0.3、出檐约 0.4）；屋脊同理；平墙三种变体；门扇半开；地面两层。
M = {k: bpy.data.meshes[k] for k in BUILD}
c = clear_coll("shed")
P = lambda n, k, loc, rot=(0, 0, 0), bev=0.008: obj(n, M[k], c, loc, rot, bev)
for i, (x, y) in enumerate([(-2, 1), (0, 1), (2, 1), (-2, -1), (0, -1), (2, -1)]):
    P(f"post{i}", "post", (x, y, 0))
P("wall_f_door", "wall_door", (-1, 1, 0)); P("wall_f_win", "wall_window", (1, 1, 0))
P("wall_b0", "wall_plain", (-1, -1, 0), (0, 0, 180)); P("wall_b1", "wall_plain_full", (1, -1, 0), (0, 0, 180))
P("wall_l", "wall_plain_mir", (-2, 0, 0), (0, 0, 90)); P("wall_r", "wall_plain_full", (2, 0, 0), (0, 0, -90))
for i, (x, y, r) in enumerate([(-1, 1, 0), (1, 1, 0), (-1, -1, 180), (1, -1, 180), (-2, 0, 90), (2, 0, -90)]):
    P(f"beam{i}", "beam", (x, y, 2.24), (0, 0, r))
P("gable_l", "gable", (-2, 0, 2.4), (0, 0, 90)); P("gable_r", "gable", (2, 0, 2.4), (0, 0, -90))
for s, rz, sgn in (("f", 0, 1), ("b", 180, -1)):          # 背坡绕 z 转 180 度，本地 +x 朝世界 -x
    for i, x in enumerate((-1, 1)):
        P(f"roof_{s}{i}", "roof_thatch", (x, 0, 3.4), (-45, 0, rz), 0)
    P(f"roof_{s}_vr", "roof_verge_r", (2 * sgn, 0, 3.4), (-45, 0, rz), 0)
    P(f"roof_{s}_vl", "roof_verge_l", (-2 * sgn, 0, 3.4), (-45, 0, rz), 0)
for i, x in enumerate((-1, 1)):
    P(f"ridge{i}", "ridge", (x, 0, 3.43), (0, 0, 0), 0)
P("ridge_er", "ridge_end_r", (2, 0, 3.43), (0, 0, 0), 0); P("ridge_el", "ridge_end_l", (-2, 0, 3.43), (0, 0, 0), 0)
P("door", "door_leaf", (-1.45, 1, 0), (0, 0, -28))          # 向内半开，从外面看得见
# 人形量杆 1.5 米：站在门外檐下
pm = bpy.data.meshes.get("person_1p5")
if not pm:
    import bmesh as _b
    bm = _b.new(); _b.ops.create_cone(bm, cap_ends=True, segments=16, radius1=0.2, radius2=0.2, depth=1.5)
    pm = bpy.data.meshes.new("person_1p5"); bm.to_mesh(pm); bm.free()
o = bpy.data.objects.new("person_1p5", pm); c.objects.link(o); o.location = (-1, 1.55, 0.75)


# ---------- 地面：土（底层）+ 草（第二层，噪声成片，房子周围 1 米内踩秃）+ 大尺度明暗 ----------
def ground_mat():
    m = bpy.data.materials.get("m_ground")
    if m:
        bpy.data.materials.remove(m)
    m = bpy.data.materials.new("m_ground"); m.use_nodes = True; nt = m.node_tree; N = nt.nodes; Lk = nt.links.new
    bsdf = N["Principled BSDF"]; bsdf.inputs["Roughness"].default_value = 0.95
    tc = N.new("ShaderNodeTexCoord"); mp = N.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (0.5, 0.5, 0.5)
    Lk(tc.outputs["Object"], mp.inputs["Vector"])
    def tex(f, data=False):
        t = N.new("ShaderNodeTexImage"); t.image = _img(f, data); Lk(mp.outputs["Vector"], t.inputs["Vector"]); return t
    dirt, grass, dn, gn = tex("ground_dirt.jpg"), tex("ground_grass.jpg"), tex("ground_dirt_n.png", True), tex("ground_grass_n.png", True)
    nz = N.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 0.35; nz.inputs["Detail"].default_value = 6
    Lk(tc.outputs["Object"], nz.inputs["Vector"])
    ramp = N.new("ShaderNodeMapRange"); ramp.inputs["From Min"].default_value = 0.46; ramp.inputs["From Max"].default_value = 0.58
    Lk(nz.outputs["Fac"], ramp.inputs["Value"])
    sep = N.new("ShaderNodeSeparateXYZ"); Lk(tc.outputs["Object"], sep.inputs["Vector"])
    def op(kind, a, b=None, v=None):
        n = N.new("ShaderNodeMath"); n.operation = kind
        Lk(a, n.inputs[0]) if not isinstance(a, float) else n.inputs[0].__setattr__("default_value", a)
        if b is not None:
            Lk(b, n.inputs[1]) if not isinstance(b, float) else n.inputs[1].__setattr__("default_value", b)
        return n.outputs[0]
    dx = op("SUBTRACT", op("ABSOLUTE", sep.outputs["X"]), 2.5); dy = op("SUBTRACT", op("ABSOLUTE", sep.outputs["Y"]), 1.5)
    away = N.new("ShaderNodeMapRange"); away.inputs["From Min"].default_value = 0.3; away.inputs["From Max"].default_value = 1.6
    Lk(op("MAXIMUM", dx, dy), away.inputs["Value"])
    mask = op("MULTIPLY", ramp.outputs["Result"], away.outputs["Result"])
    mix = N.new("ShaderNodeMix"); mix.data_type = "RGBA"; Lk(mask, mix.inputs["Factor"])
    Lk(dirt.outputs["Color"], mix.inputs[6]); Lk(grass.outputs["Color"], mix.inputs[7])
    big = N.new("ShaderNodeTexNoise"); big.inputs["Scale"].default_value = 0.12; Lk(tc.outputs["Object"], big.inputs["Vector"])
    br = N.new("ShaderNodeMapRange"); br.inputs["To Min"].default_value = 0.82; br.inputs["To Max"].default_value = 1.1
    Lk(big.outputs["Fac"], br.inputs["Value"])
    mul = N.new("ShaderNodeMix"); mul.data_type = "RGBA"; mul.blend_type = "MULTIPLY"; mul.inputs["Factor"].default_value = 1.0
    Lk(mix.outputs[2], mul.inputs[6]); Lk(br.outputs["Result"], mul.inputs[7])
    Lk(mul.outputs[2], bsdf.inputs["Base Color"])
    nmix = N.new("ShaderNodeMix"); nmix.data_type = "RGBA"; Lk(mask, nmix.inputs["Factor"])
    Lk(dn.outputs["Color"], nmix.inputs[6]); Lk(gn.outputs["Color"], nmix.inputs[7])
    nm = N.new("ShaderNodeNormalMap"); Lk(nmix.outputs[2], nm.inputs["Color"]); Lk(nm.outputs["Normal"], bsdf.inputs["Normal"])
    return m


g = bpy.data.meshes.get("ground_plane")
if g:
    bpy.data.meshes.remove(g)
import bmesh as _b
bm = _b.new()
_b.ops.create_grid(bm, x_segments=1, y_segments=1, size=12)
g = bpy.data.meshes.new("ground_plane"); bm.to_mesh(g); bm.free(); g.materials.append(ground_mat())
o = bpy.data.objects.new("ground", g); c.objects.link(o); o.location.z = -0.001
old = bpy.data.meshes.get("ground_dirt")
if old and not old.users:
    bpy.data.meshes.remove(old)
coll(KIT).hide_viewport = True; coll(KIT).hide_render = True
view((-0.8, 0.6, 1.2), (43, 0, 200), 6.5)
bpy.ops.wm.save_as_mainfile(filepath=r"C:\Users\cnyan\blender_mcp\song_shed.blend")
print("shed ok", len(c.objects), "objects")
