# 把全部组件建出来，在 y = -4 一字排开看（集合 song_kit）
for n in ("wall_door", "person_1p5", "Cube"):
    o = bpy.data.objects.get(n)
    if o: bpy.data.objects.remove(o, do_unlink=True)
M = build_all(); c = clear_coll(KIT)
x = -7.0
for k in BUILD:
    w = {"post": 0.6, "beam": 2.4, "door_leaf": 1.3, "roof_verge_l": 0.9, "roof_verge_r": 0.9, "ridge_end_l": 0.7, "ridge_end_r": 0.7}.get(k, 2.5)
    obj("kit_" + k, M[k], c, loc=(x + w / 2, -4, 0))
    x += w
view((-1.5, -4, 0.9), (72, 0, 0), 13)
print("lineup ok")
