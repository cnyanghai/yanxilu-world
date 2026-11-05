#!/usr/bin/env python3
"""M2 功能用例（在场）：开 /world/play.html?room=study，用真显卡（Windows Chrome 远程调试，连不上退回软件渲染）把角色走一圈并截图。
每一步都断言：走到了没有、墙透了没有、有没有控制台报错。截图在 tools/out/play/。
用法：python3 tools/tests/play_test.py [--sw] [--port 8797]
以后 M2 的五件事（取书读书放回、开关灯、写一句加墨、买花放窗台、对焦站进出）都接在这里。"""
import asyncio, json, os, subprocess, sys, time, urllib.request
import numpy as np
from PIL import Image
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "tools", "tests")); from measure import stats  # noqa
OUT = os.path.join(ROOT, "tools", "out", "play"); os.makedirs(OUT, exist_ok=True)
PORT = int(sys.argv[sys.argv.index("--port") + 1]) if "--port" in sys.argv else 8797
CDP = 9335
CHROME = "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"


def up(url, n=60):
    for _ in range(n):
        try: urllib.request.urlopen(url, timeout=1); return True
        except Exception: time.sleep(0.25)
    return False


def win_chrome():
    if "--sw" in sys.argv or not os.path.exists(CHROME): return None
    p = subprocess.Popen([CHROME, "--headless=new", f"--remote-debugging-port={CDP}", "--remote-allow-origins=*", r"--user-data-dir=C:\Users\cnyan\yxl_chrome_play",
                          "--no-first-run", "--hide-scrollbars", "--mute-audio", "--ignore-gpu-blocklist"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return p if up(f"http://127.0.0.1:{CDP}/json/version", 40) else (p.kill() or None)


async def main():
    srv = subprocess.Popen([sys.executable, os.path.join(ROOT, "tools", "baba_mock.py"), str(PORT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    chrome = win_chrome(); fails, notes = [], []
    ok = lambda cond, msg: (notes.append(("通过" if cond else "失败") + "：" + msg), None if cond else fails.append(msg))
    try:
        if not up(f"http://127.0.0.1:{PORT}/world/play.html"): raise SystemExit("模拟服务器没起来")
        async with async_playwright() as pw:
            b = await (pw.chromium.connect_over_cdp(f"http://127.0.0.1:{CDP}") if chrome else pw.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]))
            mode = "真显卡" if chrome else "软件渲染"
            for label, ctx_args in (("desktop", {"viewport": {"width": 1600, "height": 1000}}),
                                    ("mobile", {"viewport": {"width": 390, "height": 844}, "is_mobile": True, "has_touch": True, "user_agent": IPHONE})):
                ctx = await b.new_context(device_scale_factor=1, **ctx_args); pg = await ctx.new_page(); errs = []
                pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None); pg.on("pageerror", lambda e: errs.append(str(e)))
                await pg.goto(f"http://127.0.0.1:{PORT}/world/play.html?room=study&clean=1" + ("" if chrome else "&sw=1"))
                await pg.wait_for_function("window.__play && window.__play.ready()", timeout=120000); await pg.wait_for_timeout(800)

                async def shot(name):
                    fn = os.path.join(OUT, f"{label}_{name}.png"); await pg.screenshot(path=fn)
                    st = stats(np.asarray(Image.open(fn).convert("RGB")).astype(np.float32)); info = await pg.evaluate("window.__play.info()")
                    notes.append(f"  截图 {label}_{name}：中位 {st['中位']} 暗5% {st['暗5%']} draw call {info['calls']}"); return st

                async def walk(x, z, limit=12000):
                    pts = await pg.evaluate(f"window.__play.walkTo({x}, {z})")
                    if not pts: return None, None
                    t0 = time.time(); await pg.wait_for_function("!window.__play.presence().moving", timeout=max(limit, 20000))
                    return await pg.evaluate("window.__play.presence()"), (pts, round(time.time() - t0, 1))

                p0 = await pg.evaluate("window.__play.presence()")
                ok(p0 is not None and not p0["moving"], f"[{label}] 书房开在场：角色站在 {p0 and p0['pos']}（场地 {await pg.evaluate('window.__play.site')} 坐标）")
                await shot("01_spawn")
                S = lambda x, z: pg.evaluate(f"window.__play.at('study', {x}, {z})")   # 书房坐标 → 场地坐标
                near = lambda info, p, tol=3: info is not None and abs(info["pos"][0] - p[0]) <= tol and abs(info["pos"][1] - p[1]) <= tol
                p = await S(0, -100); info, meta = await walk(*p)   # 书墙站触发格（rooms.study.stations.shelf.trigger）
                ok(near(info, p), f"[{label}] 走到书墙站 {info and info['pos']}，用时 {meta and meta[1]} 秒，折点 {meta and len(meta[0])}")
                await shot("02_shelf")
                q = await S(150, 125); await pg.evaluate(f"window.__play.walkTo({q[0]}, {q[1]})"); await pg.wait_for_timeout(600)
                p = await S(-175, 75); info, meta = await walk(*p)  # 途中改道：桌子左前
                ok(near(info, p), f"[{label}] 途中改道到桌左前 {info and info['pos']}")
                p = await S(205, -150); info, meta = await walk(*p)  # 右墙边远角：右墙应淡出
                ok(near(info, p), f"[{label}] 走到右后角 {info and info['pos']}")
                faded = (await pg.evaluate("window.__play.presence()"))["faded"]; await shot("03_corner")
                notes.append(f"  [{label}] 右后角时淡出的墙：{faded or '无'}")
                info, meta = await walk(0, 300)    # 出门：院子里石板路上（场地坐标）
                ok(near(info, [0, 300]), f"[{label}] 出门走到石板路 {info and info['pos']}，用时 {meta and meta[1]} 秒")
                door_z = (await S(0, 175))[1]
                cross = [p0[0] + (p1[0] - p0[0]) * (door_z - p0[1]) / (p1[1] - p0[1]) for p0, p1 in zip(meta[0], meta[0][1:]) if (p0[1] - door_z) * (p1[1] - door_z) < 0] if meta else []
                ok(len(cross) == 1 and abs(cross[0]) <= 45, f"[{label}] 出门的路从门洞过：穿过门那条线 {len(cross)} 次，x = {[round(c) for c in cross]}（门洞 ±45）")
                await shot("04_yard")
                info, meta = await walk(-40, -262)  # 绕到屋后长椅边（长椅槽 1 × 1 米在 x -150..-50）
                ok(near(info, [-40, -262]), f"[{label}] 绕到屋后长椅边 {info and info['pos']}，折点 {meta and len(meta[0])}")
                notes.append(f"  [{label}] 屋后时淡出的：{(await pg.evaluate('window.__play.presence()'))['faded']}")
                await shot("05_bench")
                p = await S(100, -50); info, meta = await walk(*p, limit=20000)   # 走回屋里
                ok(near(info, p), f"[{label}] 走回屋里 {info and info['pos']}，用时 {meta and meta[1]} 秒")
                info, meta = await walk(0, 900)    # 点到院墙外：停在院子里最近处
                ok(info and info["pos"][1] <= 450, f"[{label}] 点到院墙外：停在院里最近处 {info and info['pos']}")
                await pg.evaluate("window.__play.setPeriod('night')"); await pg.wait_for_timeout(600); await shot("06_night")
                ok(not errs, f"[{label}] 无控制台报错 {errs[:3]}")
                await ctx.close()
            await b.close()
        print(f"== 在场功能用例（{mode}）"); [print("  " + n) for n in notes]
        print("通过" if not fails else f"不通过 {len(fails)} 项", "  截图在", OUT); sys.exit(1 if fails else 0)
    finally:
        srv.terminate()
        if chrome: chrome.kill()

asyncio.run(main())
