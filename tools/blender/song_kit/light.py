# 偏屋看光（Blender Eevee 端执行）：白天按 vis 表 yard:day 近似（主光俯角 47 固定、方位取 dir、色 #f5e6c0；天光上 #e8e0c8 下 #6a7a48）；
# 夜晚：冷月光 + 三盏实时光（门边灯笼、窗内透光、篝火）。长焦镜头仿游戏（游戏院子 5 度，这里取 135 毫米约 15 度好看全屋）。
# 用法：拼在一起执行  python3 tools/blender/mcp_call.py exec tools/blender/song_kit/light.py <片段：rig("day"); cam("wide"); shoot("r_day_wide")>
# 这只是资产看光，不等于游戏画面；过 M1 门以 /world 真显卡截图为准。
import bpy, math
from mathutils import Vector

SHOTS = r"C:\Users\cnyan\blender_mcp\shots"
sc = bpy.context.scene


def lin(h):
    h = h.lstrip("#"); return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))


def _set(o, k, v):
    try:
        setattr(o, k, v)
    except Exception as e:
        print("[light] 跳过", k, e)


def engine():
    for e in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
        try:
            sc.render.engine = e; break
        except TypeError:
            pass
    ee = sc.eevee
    for k, v in (("taa_render_samples", 64), ("use_raytracing", True), ("ray_tracing_method", "SCREEN"),
                 ("use_shadows", True), ("shadow_ray_count", 2), ("shadow_step_count", 8),
                 ("fast_gi_method", "GLOBAL_ILLUMINATION"), ("fast_gi_distance", 1.5), ("use_gtao", True), ("gtao_distance", 1.0)):
        _set(ee, k, v)
    _set(ee.ray_tracing_options, "resolution_scale", "1")
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 1600, 1000, 100
    sc.view_settings.view_transform = "AgX"; _set(sc.view_settings, "look", "AgX - Medium High Contrast")
    sc.render.film_transparent = False


def world(top, bottom, strength):
    w = sc.world or bpy.data.worlds.new("World"); sc.world = w; w.use_nodes = True
    nt = w.node_tree; N = nt.nodes
    for n in list(N):
        N.remove(n)
    out = N.new("ShaderNodeOutputWorld"); bg = N.new("ShaderNodeBackground"); tc = N.new("ShaderNodeTexCoord")
    sep = N.new("ShaderNodeSeparateXYZ"); mr = N.new("ShaderNodeMapRange"); mix = N.new("ShaderNodeMix"); mix.data_type = "RGBA"
    mr.inputs["From Min"].default_value = -0.2; mr.inputs["From Max"].default_value = 0.4
    nt.links.new(tc.outputs["Generated"], sep.inputs["Vector"]); nt.links.new(sep.outputs["Z"], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], mix.inputs["Factor"])
    mix.inputs[6].default_value = (*lin(bottom), 1); mix.inputs[7].default_value = (*lin(top), 1)
    nt.links.new(mix.outputs[2], bg.inputs["Color"]); bg.inputs["Strength"].default_value = strength
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])


def light(name, kind, loc=(0, 0, 0), color="#ffffff", energy=1.0, radius=0.1, direction=None, size=None):
    o = bpy.data.objects.get(name)
    if o:
        bpy.data.objects.remove(o, do_unlink=True)
    d = bpy.data.lights.new(name, kind); d.color = lin(color); d.energy = energy
    if kind == "SUN":
        d.angle = math.radians(1.0)
    elif kind == "AREA":
        d.shape = "RECTANGLE"; d.size, d.size_y = size
    else:
        d.shadow_soft_size = radius
    o = bpy.data.objects.new(name, d); bpy.context.scene.collection.objects.link(o); o.location = loc
    if direction is not None:
        o.rotation_euler = Vector(direction).to_track_quat("-Z", "Y").to_euler()
    return o


def sun_dir(az_from_deg, elev_deg=47):
    """光从哪个方位来（0 = 正面 +y，90 = 右 +x），俯角固定 47，返回光的行进方向。"""
    a, e = math.radians(az_from_deg), math.radians(elev_deg)
    return (-math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), -math.sin(e))


def rig(period):
    engine()
    for n in ("sun_key", "lamp_door", "lamp_window", "lamp_fire", "Light"):
        o = bpy.data.objects.get(n)
        if o:
            bpy.data.objects.remove(o, do_unlink=True)
    if period == "day":
        world("#c4d2e8", "#5e5444", 1.45)      # 天光取 vis 补光的冷蓝灰（#dfe6f0 一路），地面反光取土色；阴影偏冷、亮面偏暖
        light("sun_key", "SUN", color="#f5e6c0", energy=6.3, direction=sun_dir(63))   # vis dir (-0.6,-0.9,0.3) 的水平方位：右前方
        sc.view_settings.exposure = -1.15     # 受光 : 背光目标 2.5 : 1，整图中位 40 到 55、最暗 5% ≤ 12
        lantern(0.0)
    else:
        world("#3a4c6e", "#0e1218", 1.2)      # 夜空冷蓝，压住死黑（目标死黑 < 30%）
        light("sun_key", "SUN", color="#9fb4dc", energy=0.9, direction=sun_dir(-130))   # 月光从左后方，勾屋面与轮廓
        light("lamp_door", "POINT", (-1.72, 1.25, 1.72), "#ffc890", 80, 0.06)            # 门边檐下灯笼
        light("lamp_window", "AREA", (1.0, 0.7, 1.3), "#ffbf80", 70, direction=(0, 1, 0), size=(0.9, 0.7))  # 屋里灯从窗透出
        light("lamp_fire", "POINT", (2.9, 3.4, 0.35), "#ffb47a", 330, 0.3)              # 篝火（模型待做）
        sc.view_settings.exposure = 0.0
        lantern(12.0)


def lantern(glow):
    """门边檐下挂一盏纸灯笼（占位：圆柱 + 自发光），glow 0 = 白天不亮。"""
    o = bpy.data.objects.get("lantern")
    if not o:
        import bmesh
        for n in ("lantern", "lantern_cord"):          # 旧网格清掉，免得新建的变成 lantern.001
            old = bpy.data.meshes.get(n)
            if old and not old.users:
                bpy.data.meshes.remove(old)
        bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.09, radius2=0.09, depth=0.26)
        me = bpy.data.meshes.new("lantern"); bm.to_mesh(me); bm.free()
        m = bpy.data.materials.new("m_lantern"); m.use_nodes = True; me.materials.append(m)
        o = bpy.data.objects.new("lantern", me); (bpy.data.collections.get("shed") or sc.collection).objects.link(o)
        o.location = (-1.72, 1.25, 1.72)
        bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.006, radius2=0.006, depth=0.32)
        cm = bpy.data.meshes.new("lantern_cord"); bm.to_mesh(cm); bm.free(); cm.materials.append(bpy.data.materials.get("m_post_f"))
        cd = bpy.data.objects.new("lantern_cord", cm); (bpy.data.collections.get("shed") or sc.collection).objects.link(cd)
        cd.location = (-1.72, 1.25, 1.85 + 0.16)   # 吊绳挂到檐下（檐底在 y 1.25 处约 z 2.15）
    if not o.data.materials or o.data.materials[0] is None:      # 组件库重建会清材质，灯笼丢了就补
        m = bpy.data.materials.get("m_lantern") or bpy.data.materials.new("m_lantern"); m.use_nodes = True
        o.data.materials.clear(); o.data.materials.append(m)
    b = o.data.materials[0].node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*lin("#a89470"), 1); b.inputs["Roughness"].default_value = 0.8
    b.inputs["Emission Color"].default_value = (*lin("#ffc890"), 1); b.inputs["Emission Strength"].default_value = glow


def cam(kind):
    o = bpy.data.objects.get("cam_look")
    if not o:
        o = bpy.data.objects.new("cam_look", bpy.data.cameras.new("cam_look")); sc.collection.objects.link(o)
    c = o.data; c.clip_start, c.clip_end = 0.5, 400
    if kind == "wide":     # 仿游戏：左前方、俯 30 度、长焦
        tgt, az, el, dist, c.lens = Vector((0, 0.4, 1.4)), -35, 30, 27, 135
    elif kind == "close":  # 近景：右前方平视，看檐口、窗、门
        tgt, az, el, dist, c.lens = Vector((0.6, 1.0, 1.7)), 28, 12, 9.5, 85
    else:                  # 细节：3.5 米、50 毫米，画面约 2.5 米宽 = 屏上约 640 像素/米，看贴图清不清楚
        tgt, az, el, dist, c.lens = Vector((1.1, 1.0, 1.55)), 18, 10, 3.5, 50
    a, e = math.radians(az), math.radians(el)
    o.location = tgt + dist * Vector((math.sin(a) * math.cos(e), math.cos(a) * math.cos(e), math.sin(e)))
    o.rotation_euler = (tgt - o.location).to_track_quat("-Z", "Y").to_euler()
    sc.camera = o


def shoot(name):
    import os
    os.makedirs(SHOTS, exist_ok=True)
    sc.render.filepath = SHOTS + "\\" + name + ".png"
    bpy.ops.render.render(write_still=True)
    print("shot", sc.render.filepath)
