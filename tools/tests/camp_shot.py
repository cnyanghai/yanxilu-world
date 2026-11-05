#!/usr/bin/env python3
"""营地小试截图（M1 画质门）：起本地模拟服务器，开 /world/camp.html，白天 / 夜晚 × 远景 / 近景 / 细节各一张，量明度。
真显卡（REVIEW-1 第 5 条）：在 Windows 侧起无头 Chrome（远程调试端口），Playwright 连上去截；连不上就退回本机软件渲染（sw=1，只算功能）。
WSL 是镜像网络，两边都走 127.0.0.1。截图在 tools/out/camp/。
用法：python3 tools/tests/camp_shot.py [--sw] [--port 8792] [--walk] [--tier 0|1|2] [--mobile]
--tier：强制档位（网址 tier=），截图文件名前加 t<档>_；--mobile：手机竖屏 390 × 844、手机 UA（档位由页面自己探测，通常是 1 档），文件名前加 m_。
每轮报告下载量（同源资源压缩后正文之和）与 draw call，手机档目标：下载 ≤ 8 MB、draw call ≤ 120（render/tiers.js 的 TIER_BUDGET）
--walk：先跑 node tools/tests/walk_check.mjs，按它的报告把门推开、在门洞 / 屋里 / 檐下 / 篝火边各放一个 1.5 米素模人形、地上画路线，多拍三张（walk_*.png）"""
import asyncio, json, os, subprocess, sys, time, urllib.request
import numpy as np
from PIL import Image
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "tools", "tests")); from measure import stats  # noqa
OUT = os.path.join(ROOT, "tools", "out", "camp"); os.makedirs(OUT, exist_ok=True)
PORT = int(sys.argv[sys.argv.index("--port") + 1]) if "--port" in sys.argv else 8792
CDP = 9333
CHROME = "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
SHOTS = [(p, s) for p in ("day", "night") for s in ("wide", "close", "detail", "fire")]
TIER = sys.argv[sys.argv.index("--tier") + 1] if "--tier" in sys.argv else None
MOBILE = "--mobile" in sys.argv
PRE = ("m_" if MOBILE else "") + (f"t{TIER}_" if TIER is not None else "")
IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"


def up(url, n=60):
    for _ in range(n):
        try: urllib.request.urlopen(url, timeout=1); return True
        except Exception: time.sleep(0.25)
    return False


def win_chrome():
    """Windows 侧无头 Chrome，带显卡；返回进程或 None。"""
    if not os.path.exists(CHROME): return None
    p = subprocess.Popen([CHROME, "--headless=new", f"--remote-debugging-port={CDP}", "--remote-allow-origins=*",
                          r"--user-data-dir=C:\Users\cnyan\yxl_chrome_shot", "--no-first-run", "--hide-scrollbars", "--mute-audio",
                          "--ignore-gpu-blocklist", "--enable-gpu-rasterization", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return p if up(f"http://127.0.0.1:{CDP}/json/version", 40) else (p.kill() or None)


async def main():
    if "--walk" in sys.argv:
        r = subprocess.run(["node", os.path.join(ROOT, "tools", "tests", "walk_check.mjs"), "camp"], capture_output=True, text=True); print(r.stdout.strip())
    srv = subprocess.Popen([sys.executable, os.path.join(ROOT, "tools", "baba_mock.py"), str(PORT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    chrome = None
    try:
        if not up(f"http://127.0.0.1:{PORT}/world/camp.html"): raise SystemExit("模拟服务器没起来")
        async with async_playwright() as pw:
            sw = "--sw" in sys.argv
            chrome = None if sw else win_chrome()
            if chrome:
                b = await pw.chromium.connect_over_cdp(f"http://127.0.0.1:{CDP}"); mode = "真显卡（Windows Chrome）"
            else:
                b = await pw.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]); sw = True; mode = "软件渲染（swiftshader）"
            ctx = await (b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1, is_mobile=True, has_touch=True, user_agent=IPHONE) if MOBILE
                         else b.new_context(viewport={"width": 1600, "height": 1000}, device_scale_factor=1))
            pg = await ctx.new_page(); errs = []
            pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            pg.on("pageerror", lambda e: errs.append(str(e)))
            rows = []
            # 只加载一次页面，切时段与机位走 window.__camp（每张都重载会累积显存，2026-11-05 第 7 张起上下文丢失、页面崩）
            await pg.goto(f"http://127.0.0.1:{PORT}/world/camp.html?shot=wide&period=day&clean=1" + ("&sw=1" if sw else "") + (f"&tier={TIER}" if TIER is not None else ""))
            await pg.wait_for_function("window.__camp && window.__camp.ready()", timeout=120000); await pg.wait_for_timeout(1500)
            load = await pg.evaluate("window.__camp.info()")
            for period, shot in SHOTS:
                t = time.time()
                await pg.evaluate(f"window.__camp.setPeriod('{period}'); window.__camp.setShot('{shot}')"); await pg.wait_for_timeout(900)
                fn = os.path.join(OUT, f"{PRE}{period}_{shot}.png"); await pg.screenshot(path=fn)
                info = await pg.evaluate("window.__camp.info()")
                st = stats(np.asarray(Image.open(fn).convert("RGB")).astype(np.float32))
                rows.append((period, shot, info, st, round(time.time() - t, 1)))
            if "--walk" in sys.argv:
                W = json.load(open(os.path.join(OUT, "walk_check.json")))
                door = W["door"]["at"]; dx = sum(p[0] for p in door) / len(door); dz = sum(p[1] for p in door) / len(door)
                pts = {"门洞": [dx, dz]} | {k: v["path"][-1] for k, v in W["routes"].items() if v}
                route = (W["routes"].get("屋里") or {}).get("path", []) + (W["routes"].get("篝火边") or {}).get("path", [])
                await pg.evaluate(f"""(() => {{ const c = window.__camp; c.setState('door', 'open');
                  for (const p of {json.dumps(list(pts.values()))}) c.figure(p[0], p[1], 200); c.path({json.dumps(route)}); }})()""")
                for period, shot in (("day", "wide"), ("day", "door"), ("night", "door")):
                    await pg.evaluate(f"window.__camp.setPeriod('{period}'); window.__camp.setShot('{shot}')"); await pg.wait_for_timeout(900)
                    fn = os.path.join(OUT, f"{PRE}walk_{period}_{shot}.png"); await pg.screenshot(path=fn)
                    st = stats(np.asarray(Image.open(fn).convert("RGB")).astype(np.float32))
                    rows.append((period, "walk-" + shot, await pg.evaluate("window.__camp.info()"), st, 0))
            if chrome:
                try: s = await b.new_browser_cdp_session(); await s.send("Browser.close")
                except Exception: pass
            await b.close()
        print(f"== {mode}；显卡：{rows[0][2]['gpu']}；档位 {rows[0][2]['tier']}；贴图 {'半分辨率' if load['texLo'] else '原分辨率'}；"
              f"{'手机竖屏 390 × 844' if MOBILE else '1600 × 1000'}；首次加载下载 {load['bytes'] / 1e6:.2f} MB（{load['files']} 个文件）")
        for period, shot, info, st, sec in rows:
            print(f"  {period:5s} {shot:6s} calls={info['calls']:4d} tris={info['triangles']:7d}  中位 {st['中位']:3d} 暗5% {st['暗5%']:3d} 亮5% {st['亮5%']:3d} 死黑 {st['死黑%']:4.1f}% 过曝 {st['过曝%']:3.1f}%  {sec}s")
        if errs: print("  控制台报错："); [print("   ", e[:300]) for e in errs[:10]]
        json.dump([{"period": r[0], "shot": r[1], "info": r[2], "stats": {k: (float(v) if not isinstance(v, list) else v) for k, v in r[3].items()}} for r in rows],
                  open(os.path.join(OUT, f"{PRE}camp_shot.json"), "w"), ensure_ascii=False, indent=1)
        print("截图在", OUT); sys.exit(1 if errs else 0)
    finally:
        srv.terminate()
        if chrome: chrome.kill()

asyncio.run(main())
