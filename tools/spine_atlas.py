#!/usr/bin/env python3
"""书脊底图集（2026-11-05，书墙画质研究）：从版本 1 的「老书皮」（cnyanghai/yanxilu 的 vendor/covers/，维基共享资源上的公有领域 / CC0 / CC BY 2.0 馆藏装帧扫描，
来源逐张在它的 SOURCES.md）每张切下靠左缘的一条（含边框烫金纹），缩成 96 × 512 拼成一张图集。图里不带字：书名、题签、竹节、烫金线由网页按数据叠上去（world/render/shelf.js）。
版本 1 的经验：用代码画书皮三轮不达标，换成真书皮扫描才过关（yanxilu/docs/cover-masters.md 第七、八节）。
用法：python3 tools/spine_atlas.py [老书皮目录]   输出 world/packs/modern/books/spines.webp、spines.json（每条的平均色与明度）、SOURCES.md"""
import json, os, re, sys, glob
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.dirname(ROOT)), "1-Projects", "yanxilu", "vendor", "covers")
if not os.path.isdir(SRC): SRC = os.path.expanduser("~/brain/1-Projects/yanxilu/vendor/covers")
OUT = os.path.join(ROOT, "world", "packs", "modern", "books"); os.makedirs(OUT, exist_ok=True)
CW, CH, PER_ROW = 96, 512, 21          # 一条 96 × 512（书脊宽高比约 0.19），一行 21 条 → 2016 宽
files = sorted(glob.glob(os.path.join(SRC, "c*.webp")))
rows = (len(files) + PER_ROW - 1) // PER_ROW
atlas = Image.new("RGB", (CW * PER_ROW, CH * rows), (40, 30, 24)); meta = []
for i, f in enumerate(files):
    im = Image.open(f).convert("RGB"); w, h = im.size
    y0, y1 = int(h * 0.025), int(h * 0.975); sw = int((y1 - y0) * CW / CH)            # 按书脊比例切宽
    x0 = int(w * 0.035); strip = im.crop((x0, y0, x0 + sw, y1)).resize((CW, CH), Image.LANCZOS)
    atlas.paste(strip, ((i % PER_ROW) * CW, (i // PER_ROW) * CH))
    a = np.asarray(strip).astype(np.float32) / 255; lum = float((a @ [0.2126, 0.7152, 0.0722]).mean())
    meta.append({"i": i, "file": os.path.basename(f), "mean": [round(float(v) * 255) for v in a.reshape(-1, 3).mean(0)], "lum": round(lum, 3)})
atlas.save(os.path.join(OUT, "spines.webp"), quality=86, method=6)
json.dump({"format": 1, "cell": [CW, CH], "perRow": PER_ROW, "rows": rows, "count": len(files), "strips": meta,
           "note": "tools/spine_atlas.py 生成：版本 1 老书皮左缘切条，不带字；来源见同目录 SOURCES.md"}, open(os.path.join(OUT, "spines.json"), "w"), ensure_ascii=False, indent=0)
# 来源：照抄版本 1 的 SOURCES.md 里用到的行
src_md = os.path.join(SRC, "SOURCES.md"); rows_md = []
if os.path.exists(src_md):
    used = {os.path.basename(f)[:-5] for f in files}
    head = []
    for line in open(src_md, encoding="utf-8"):
        m = re.match(r"\|\s*(c\d+)\s*\|", line)
        if m and m.group(1) in used: rows_md.append(line.rstrip("\n"))
open(os.path.join(OUT, "SOURCES.md"), "w", encoding="utf-8").write(
    "# 书脊底图的来源与授权\n\n书墙书脊底图集 `spines.webp` 由 `tools/spine_atlas.py` 生成：取研习录版本 1「老书皮」（cnyanghai/yanxilu 的 vendor/covers/）每张靠左缘的一条，"
    "缩成 96 × 512 拼图，图里不带字。原图全部来自维基共享资源上标为公有领域、CC0 或 CC BY 2.0 的馆藏装帧扫描（原书出版于 1840 到 1910 年代）。\n\n"
    "CC BY 2.0 的图（多为波士顿公共图书馆 Boston Public Library 拍摄的惠特曼 Sarah Wyman Whitman 装帧）按授权署名：摄影与收藏 Boston Public Library，"
    "经修改（裁切、抹字、缩放、切条），授权 https://creativecommons.org/licenses/by/2.0/ 。\n\n| 文件 | 原图 | 授权 | 收藏 / 分类 |\n|---|---|---|---|\n" + "\n".join(rows_md) + "\n")
print(f"{len(files)} 条 → {OUT}/spines.webp {atlas.size}，{os.path.getsize(os.path.join(OUT, 'spines.webp')) // 1024} KB；来源 {len(rows_md)} 行")
