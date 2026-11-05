# 营地里不属于偏屋的件（篝火）摆进集合 camp_props（Blender 端，接在 kitlib.py 后执行）。位置与 presets/camp.json 一致：three (290, 0, -340) 厘米 = Blender (2.9, 3.4, 0) 米。
cp = clear_coll("camp_props")
obj("campfire", bpy.data.meshes["campfire"], cp, (2.9, 3.4, 0), (0, 0, 0), 0)
me = bpy.data.meshes["campfire"]
print("campfire tris", sum(len(p.vertices) - 2 for p in me.polygons), "dims", [round(v, 3) for v in bpy.data.objects["campfire"].dimensions])
view((2.9, 3.4, 0.2), (55, 0, 200), 2.4)
bpy.ops.wm.save_mainfile()
