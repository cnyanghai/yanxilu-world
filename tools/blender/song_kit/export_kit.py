# 营地小试：组件、散布物、灯笼导出 glTF（分离式：.gltf + .bin + 贴图），偏屋拼法导出预制体 JSON（Blender 端，接在 kitlib.py 后执行）。
# 导完由 WSL 侧 python3 tools/asset_import.py --components <导出目录> --pack song 入库（贴图去重、法线转 jpg、透明小图内嵌、几何内嵌）。
# 坐标：glTF 本身是 Y 上（导出器把 Blender 的 (x, y, z) 换成 (x, z, -y)）；预制体里的位置与四元数也按同样换算，单位厘米。
import os, json
OUT = r"C:\Users\cnyan\blender_mcp\export"
os.makedirs(OUT, exist_ok=True)
BEVEL = {"post", "beam", "wall_plain", "wall_plain_mir", "wall_plain_full", "wall_door", "wall_window", "door_leaf", "gable"}
KIND = {k: "building" for k in BUILD}
KIND.update({f"rock_{i}": "scatter" for i in range(4)}); KIND.update({f"step_{i}": "scatter" for i in range(3)})
KIND.update({"grass_tuft": "scatter", "lantern": "prop"})
tmpc = clear_coll("_export")


def direct_base_color(me):
    """glTF 里 COLOR_0 本来就乘底色，导出时把"贴图 × 顶点色"的混合节点绕开，直接接底色；返回恢复函数。"""
    undo = []
    for m in me.materials:
        if not m or not m.use_nodes:
            continue
        nt = m.node_tree; b = nt.nodes.get("Principled BSDF")
        mx = next((n for n in nt.nodes if n.type == "MIX" and n.blend_type == "MULTIPLY"), None)
        tex = next((n for n in nt.nodes if n.type == "TEX_IMAGE" and n.image and not n.image.name.endswith("_n.png")), None)
        if mx and tex and b:
            old = [l for l in nt.links if l.to_socket == b.inputs["Base Color"]]
            for l in old:
                nt.links.remove(l)
            nt.links.new(tex.outputs["Color"], b.inputs["Base Color"])
            undo.append((nt, tex, mx, b))
    def restore():
        for nt, tex, mx, b in undo:
            for l in [l for l in nt.links if l.to_socket == b.inputs["Base Color"]]:
                nt.links.remove(l)
            nt.links.new(mx.outputs[2], b.inputs["Base Color"])
    return restore


def export_one(name, meshes):
    """meshes：[(mesh, 位置)]；放进临时集合、只选它们、导出。"""
    for o in list(tmpc.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    objs = []
    for me, loc in meshes:
        o = obj("x_" + me.name, me, tmpc, loc, (0, 0, 0), 0.008 if name in BEVEL else 0); objs.append(o)
        for md in o.modifiers:      # 导出时倒角只用一段：8 毫米看不出区别，面数减半（窗洞墙 7 根窗棂两段时 1620 面超预算）
            if md.type == "BEVEL":
                md.segments = 1
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    restores = [direct_base_color(me) for me, _ in meshes]
    try:
        bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, name + ".gltf"), export_format="GLTF_SEPARATE", export_texture_dir="tex",
                                  use_selection=True, export_apply=True, export_yup=True, export_image_format="AUTO",
                                  export_vertex_color="ACTIVE", export_materials="EXPORT", export_cameras=False, export_lights=False,
                                  export_extras=False, export_animations=False)
    finally:
        for r in restores:
            r()


done = []
for k in BUILD:
    export_one(k, [(bpy.data.meshes[k], (0, 0, 0))]); done.append(k)
for k in [f"rock_{i}" for i in range(4)] + [f"step_{i}" for i in range(3)] + ["grass_tuft"]:
    if bpy.data.meshes.get(k):
        export_one(k, [(bpy.data.meshes[k], (0, 0, 0))]); done.append(k)
if bpy.data.objects.get("lantern"):   # 灯笼 + 吊绳：原点在灯笼中心；按物体取网格（重建时网格名可能带 .001）
    export_one("lantern", [(bpy.data.objects["lantern"].data, (0, 0, 0)), (bpy.data.objects["lantern_cord"].data, (0, 0, 0.16))]); done.append("lantern")
for o in list(tmpc.objects):
    bpy.data.objects.remove(o, do_unlink=True)
bpy.data.collections.remove(tmpc)


def to3(v):
    return [round(v.x * 100), round(v.z * 100), round(-v.y * 100)]


def q3(q):
    return [round(q.x, 6), round(q.z, 6), round(-q.y, 6), round(q.w, 6)]


ents = []
for o in bpy.data.collections["shed"].objects:
    if o.type != "MESH" or o.data.name not in BUILD:
        continue
    loc, rot, sc = o.matrix_world.decompose()
    t = {"x": to3(loc)[0], "y": to3(loc)[1], "z": to3(loc)[2], "q": q3(rot)}
    if abs(sc.x - 1) > 1e-4 or abs(sc.y - 1) > 1e-4 or abs(sc.z - 1) > 1e-4:
        t["s"] = [round(sc.x, 4), round(sc.z, 4), round(sc.y, 4)]
    ents.append({"id": o.name, "components": {"Transform": t, "Model": {"file": o.data.name, "castShadow": True}}})
lan = bpy.data.objects.get("lantern")
if lan:
    p = to3(lan.location)
    ents.append({"id": "lantern", "components": {"Transform": {"x": p[0], "y": p[1], "z": p[2]}, "Model": {"file": "lantern", "castShadow": False},
                                                 "Light": {"kind": "point", "color": [1.0, 0.784, 0.565], "power": 80, "radius": 6, "periods": ["dusk", "night"], "emissive": True}}})
ents.append({"id": "window_glow", "components": {"Transform": {"x": 100, "y": 130, "z": -70},
                                                 "Light": {"kind": "point", "color": [1.0, 0.75, 0.5], "power": 70, "radius": 30, "periods": ["dusk", "night"],
                                                           "note": "屋里的灯，从窗棂透出来（Blender 看光里是 0.9 × 0.7 的面光）"}}})
prefab = {"format": 1, "units": "cm", "id": "shed", "pack": "song", "name": "茅草偏屋",
          "note": "由 tools/blender/song_kit/export_kit.py 从 shed.py 拼好的场景导出；坐标 three.js 轴向（y 上、正面朝 +z），四元数 q = [x, y, z, w]；s 为三轴缩放",
          "entities": ents}
json.dump(prefab, open(os.path.join(OUT, "shed.prefab.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump(KIND, open(os.path.join(OUT, "kinds.json"), "w"), indent=1)
print("export ok", len(done), "件；预制体", len(ents), "个实体")
