#!/usr/bin/env python3
"""明度量尺（PIPELINE 5 验收、M1 画质门；排练里的 measure.py 转正，2026-11-04）。
用法：python3 tools/tests/measure.py 图.png [图2.png ...] [--box 名=x0,y0,x1,y1 ...]
每张图输出：明度中位、最暗 5%、最亮 5%、跨度（95 分位 - 5 分位）、死黑占比（明度 ≤ 6）、过曝占比（≥ 250）、平均饱和度、RGB 均值；
--box 给出的区域另算中位（比如受光墙 : 背光墙、门内 : 门外）。明度 = Rec.601 亮度，0 到 255。
M1 门（白天）：中位 40 到 55、最暗 5% ≤ 12；夜晚：死黑 < 30%、过曝 0。"""
import sys
import numpy as np
from PIL import Image


def stats(a):
    L = a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114
    mx, mn = a.max(-1), a.min(-1); sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    p5, p50, p95 = np.percentile(L, [5, 50, 95])
    return {"中位": round(p50), "暗5%": round(p5), "亮5%": round(p95), "跨度": round(p95 - p5),
            "死黑%": round(100 * (L <= 6).mean(), 1), "过曝%": round(100 * (L >= 250).mean(), 1),
            "饱和": round(float(sat.mean()), 2), "RGB": [round(float(a[..., i].mean())) for i in range(3)]}


def main(argv):
    imgs, boxes = [], {}
    it = iter(argv)
    for x in it:
        if x == "--box":
            continue
        if "=" in x:
            k, v = x.split("=", 1); boxes[k] = [int(t) for t in v.split(",")]
        else:
            imgs.append(x)
    for f in imgs:
        a = np.asarray(Image.open(f).convert("RGB")).astype(np.float32)
        print(f, stats(a))
        for k, (x0, y0, x1, y1) in boxes.items():
            print("  ", k, stats(a[y0:y1, x0:x1])["中位"])


if __name__ == "__main__":
    main(sys.argv[1:])
