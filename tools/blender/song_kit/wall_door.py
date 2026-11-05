# 营地小试：门洞墙（ASSET-SPEC 10.1 第 3 件）。在开着的 Blender 窗口里执行：python3 tools/blender/mcp_call.py exec tools/blender/song_kit/wall_door.py
# 贴图先由三视图按真尺寸拉好（门洞内圈 → 0.9 × 1.95），放在 TEX 目录；正面朝 +Y（= three.js -Z）。
import bpy, bmesh
from mathutils import Vector
TEX=r"C:\Users\cnyan\blender_mcp\tex"
for o in list(bpy.data.objects):
    if o.name in ("Cube","wall_door","person_1p5"): bpy.data.objects.remove(o, do_unlink=True)
W,T,H=2.0,0.12,2.2; DW,DH=0.9,1.95
L=(W-DW)/2
boxes=[(-W/2,-W/2+L,0,H),(W/2-L,W/2,0,H),(-DW/2,DW/2,DH,H)]   # 左段、右段、门楣（x0,x1,z0,z1）
bm=bmesh.new(); uv=bm.loops.layers.uv.new("UVMap")
for x0,x1,z0,z1 in boxes:
    vs=[bm.verts.new((x,y,z)) for x in (x0,x1) for y in (-T/2,T/2) for z in (z0,z1)]
    idx=lambda i,j,k: vs[i*4+j*2+k]
    faces=[(idx(0,0,0),idx(1,0,0),idx(1,0,1),idx(0,0,1)),(idx(1,1,0),idx(0,1,0),idx(0,1,1),idx(1,1,1)),
           (idx(0,1,0),idx(0,0,0),idx(0,0,1),idx(0,1,1)),(idx(1,0,0),idx(1,1,0),idx(1,1,1),idx(1,0,1)),
           (idx(0,0,1),idx(1,0,1),idx(1,1,1),idx(0,1,1)),(idx(0,1,0),idx(1,1,0),idx(1,0,0),idx(0,0,0))]
    for f in faces:
        try: bm.faces.new(f)
        except ValueError: pass
bm.normal_update()
for f in bm.faces:
    n=f.normal
    f.material_index = 0 if abs(n.y)>0.5 else 1
    for l in f.loops:
        p=l.vert.co
        if abs(n.y)>0.5:   # 正背面：正面投影，背面镜像
            u=(p.x+W/2)/W if n.y>0 else 1-(p.x+W/2)/W
            l[uv].uv=(u, p.z/H)
        else:             # 侧边、门洞内侧、顶底：侧视条
            s=(p.y+T/2)/T
            l[uv].uv=(s, p.z/H) if abs(n.z)<0.5 else (s,(p.x+W/2)/W)
me=bpy.data.meshes.new("wall_door"); bm.to_mesh(me); bm.free()
ob=bpy.data.objects.new("wall_door",me); bpy.context.collection.objects.link(ob)
def mat(name,img):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name); m.use_nodes=True
    nt=m.node_tree; bsdf=nt.nodes.get("Principled BSDF"); t=nt.nodes.new("ShaderNodeTexImage")
    t.image=bpy.data.images.load(TEX+"\\"+img, check_existing=True); nt.links.new(t.outputs["Color"],bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value=0.85; return m
me.materials.append(mat("wall_door_front","wall_door_front.jpg")); me.materials.append(mat("wall_door_side","wall_door_side.jpg"))
bev=ob.modifiers.new("bevel","BEVEL"); bev.width=0.008; bev.segments=2; bev.harden_normals=True
# 人形量杆 1.5 米，站在门洞里
bpy.ops.mesh.primitive_cylinder_add(radius=0.18, depth=1.5, location=(0,0,0.75)); p=bpy.context.object; p.name="person_1p5"
# 视口：材质预览、正对正面（+Y 朝向镜头，按 ASSET-SPEC 正面 = three.js -Z = Blender +Y）
for a in bpy.context.screen.areas:
    if a.type=="VIEW_3D":
        sp=a.spaces[0]; sp.shading.type="MATERIAL"
        r3=sp.region_3d; r3.view_perspective="PERSP"
        from mathutils import Euler
        r3.view_rotation=Euler((1.25,0,3.14159+0.5),"XYZ").to_quaternion(); r3.view_location=Vector((0,0,1.1)); r3.view_distance=6.5
print("ok", len(me.polygons), "faces")
