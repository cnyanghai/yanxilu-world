#!/usr/bin/env python3
"""M2 功能用例（在场）：开 /world/play.html?room=study，用真显卡（Windows Chrome 远程调试，连不上退回软件渲染）把角色走一圈并截图。
场地是院子连书房（rooms.yard，2026-11-05 扩成宋代院落：书房北、茅草偏屋东、篝火院心偏东）。
书墙对焦站：停在触发格进站、书名可读、指 / 点书出题签、竖屏拖动平移、Esc / 回到书房按钮 / 浏览器后退 / 点空处出站、在房里点书先走过去再进站。
每一步都断言：走到了没有、墙透了没有、镜头分区切了没有、门推开了没有、绕没绕开篝火、有没有控制台报错；
开头先和人形巡检对账：游戏里按真实模型算出的寻路格阻挡，与 tools/tests/walk_check.mjs yard 的结果逐格相同。截图在 tools/out/play/。
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


ROOMS = {r["id"]: r for r in json.load(open(os.path.join(ROOT, "world", "data", "rooms.json"), encoding="utf-8"))["rooms"]}
YARD_AZ, STUDY_AZ = ROOMS["yard"]["follow"]["az"], ROOMS["study"]["follow"]["az"]
SHELF = ROOMS["study"]["stations"]["shelf"]
CHAR_PX = 10   # 书名一个字至少 10 像素（设备像素，截图 1 倍）算读得出；study-plan 第 4 节原写 OCR 读出 ≥ 8 / 10，这里先用字的像素大小代
FIRE = next([e["components"]["Transform"]["x"], e["components"]["Transform"]["z"]] for e in json.load(open(os.path.join(ROOT, "world", "data", "presets", "yard.json"), encoding="utf-8"))["entities"] if e["id"] == "campfire")


async def main():
    if subprocess.run(["node", os.path.join(ROOT, "tools", "tests", "walk_check.mjs"), "yard"], capture_output=True).returncode: raise SystemExit("人形巡检（院子）不过，先修它")
    global WALK; WALK = json.load(open(os.path.join(ROOT, "tools", "out", "yard", "walk_check.json"), encoding="utf-8"))
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
                ok(p0 is not None and not p0["moving"], f"[{label}] 书房开在场：角色站在 {p0 and p0['pos']}（场地 {await pg.evaluate('window.__play.site')} 坐标），镜头区 {p0 and p0['zone']}")
                nav = await pg.evaluate("window.__play.nav()")
                diff = sum(1 for a_, b_ in zip(nav["bits"], WALK["bits"]) if a_ != b_) if len(nav["bits"]) == len(WALK["bits"]) else -1
                ok(diff == 0, f"[{label}] 挡路与人形巡检对账：{nav['cols']} × {nav['rows']} 格不同 {diff} 格（槽位与墙 {nav['bySlotOrWall']} 格、按模型 {nav['byModel']} 格；{nav['items']} 件 {nav['tris']} 个三角面，算了 {nav['ms']} 毫秒）")
                await shot("01_spawn")
                S = lambda x, z: pg.evaluate(f"window.__play.at('study', {x}, {z})")   # 书房坐标 → 场地坐标
                near = lambda info, p, tol=3: info is not None and abs(info["pos"][0] - p[0]) <= tol and abs(info["pos"][1] - p[1]) <= tol
                def crossings(pts, axis, at):   # 折线穿过 x = at（axis 0）或 z = at（axis 1）那条线的位置（另一个坐标）
                    o = 1 - axis; return [a_[o] + (b_[o] - a_[o]) * (at - a_[axis]) / (b_[axis] - a_[axis]) for a_, b_ in zip(pts, pts[1:]) if (a_[axis] - at) * (b_[axis] - at) < 0]
                def seg_min(pts, c):            # 折线离点 c 最近的距离
                    best = 1e9
                    for a_, b_ in zip(pts, pts[1:]):
                        vx, vz = b_[0] - a_[0], b_[1] - a_[1]; L2 = vx * vx + vz * vz or 1e-9; t = max(0, min(1, ((c[0] - a_[0]) * vx + (c[1] - a_[1]) * vz) / L2))
                        best = min(best, ((c[0] - a_[0] - t * vx) ** 2 + (c[1] - a_[1] - t * vz) ** 2) ** 0.5)
                    return best
                p = await S(0, -100); info, meta = await walk(*p)   # 书墙站触发格（rooms.study.stations.shelf.trigger）
                ok(near(info, p), f"[{label}] 走到书墙站 {info and info['pos']}，用时 {meta and meta[1]} 秒，折点 {meta and len(meta[0])}")
                # ---- 书墙对焦站（M2 第 3 天）：走到触发格停下就进站 ----
                FI = "window.__play.focus.info()"
                try: await pg.wait_for_function(f"{FI}.state === 'in'", timeout=6000)
                except Exception: pass
                fi = await pg.evaluate(FI)
                ok(fi["state"] == "in" and fi["id"] == "shelf" and abs(fi["fov"] - SHELF["fov"]) < 0.1, f"[{label}] 停在书墙前就进书墙站：{fi['state']} {fi['id']}，视场角 {fi['fov']}；淡出挡书的家具 {fi['occluded']}")
                await shot("02_shelf_station")
                L = await pg.evaluate("window.__play.focus.legibility()"); vis = [x for x in L if x["vis"]]; cs = sorted(x["char"] for x in vis)
                good = sum(1 for c in cs if c >= CHAR_PX)
                ok(vis and good >= 0.8 * len(vis), f"[{label}] 书名可读：画面里 {len(vis)} 本，字 ≥ {CHAR_PX} 像素的 {good} 本（最小 {cs and cs[0]}、中位 {cs and cs[len(cs) // 2]} 像素）")
                books = await pg.evaluate("window.__play.focus.books()")
                pick = next((x["i"] for x in vis if books[x["i"]]["state"] == "在读"), vis[len(vis) // 2]["i"] if vis else 0); xy = await pg.evaluate(f"window.__play.focus.screen({pick})")
                if label == "mobile": await pg.touchscreen.tap(*xy)
                else: await pg.mouse.move(*xy)
                await pg.wait_for_timeout(500); tg = await pg.evaluate("window.__play.focus.tag()") or ""
                ok(books[pick]["title"] in tg, f"[{label}] {'点' if label == 'mobile' else '指'}到一本书浮出题签：{tg.replace(chr(10), ' · ')}（{books[pick]['title']}）")
                await shot("02_book")
                if label == "mobile":   # 竖屏：左右拖动沿墙平移
                    await pg.mouse.move(300, 420); await pg.mouse.down(); await pg.mouse.move(200, 420, steps=6); await pg.mouse.move(120, 420, steps=6); await pg.mouse.up(); await pg.wait_for_timeout(300)
                    fi = await pg.evaluate(FI); ok(fi["state"] == "in" and fi["pan"][0] > 0.2, f"[{label}] 竖屏拖动沿墙平移：平移 {fi['pan']} 米，仍在站里")
                    await shot("02_pan"); await pg.click("#back")      # 手机用"回到书房"按钮出站
                else: await pg.keyboard.press("Escape")
                await pg.wait_for_timeout(1700); fi = await pg.evaluate(FI); pr = await pg.evaluate("window.__play.presence()")
                ok(fi["state"] == "follow" and abs(fi["fov"] - 20) < 0.1 and not fi["occluded"], f"[{label}] {'回到书房按钮' if label == 'mobile' else 'Esc'} 出站：{fi['state']}，视场角 {fi['fov']}，家具还原 {not fi['occluded']}")
                q = await S(100, 25); await walk(*q)               # 站开一点，再点书墙上的一本书：先走过去，进站后指到那本
                pick2 = vis[0]["i"] if vis else 0; xy = await pg.evaluate(f"window.__play.focus.screen({pick2})")
                if label == "mobile": await pg.touchscreen.tap(*xy)
                else: await pg.mouse.click(*xy)
                try: await pg.wait_for_function(f"{FI}.state === 'in'", timeout=12000); await pg.wait_for_timeout(300)
                except Exception: pass
                fi = await pg.evaluate(FI); tg = await pg.evaluate("window.__play.focus.tag()") or ""
                ok(fi["state"] == "in" and fi["select"] == pick2 and books[pick2]["title"] in tg, f"[{label}] 在房里点书墙上的书：走过去进站并指到那本（{fi['state']}，选中 {fi['select']} / {pick2}，题签 {tg.split(chr(10))[0]}）")
                await pg.evaluate("history.back()"); await pg.wait_for_timeout(1700); fi = await pg.evaluate(FI)
                ok(fi["state"] == "follow", f"[{label}] 浏览器后退出站：{fi['state']}")
                await pg.evaluate("window.__play.focus.enter('shelf')"); await pg.wait_for_function(f"{FI}.state === 'in'", timeout=5000)
                if label == "mobile": await pg.touchscreen.tap(195, 150)
                else: await pg.mouse.click(800, 120)              # 点书墙上方的空格子
                await pg.wait_for_timeout(1700); fi = await pg.evaluate(FI); ok(fi["state"] == "follow", f"[{label}] 点空处出站：{fi['state']}")
                await shot("02_shelf")
                q = await S(150, 125); await pg.evaluate(f"window.__play.walkTo({q[0]}, {q[1]})"); await pg.wait_for_timeout(600)
                p = await S(-175, 75); info, meta = await walk(*p)  # 途中改道：桌子左前
                ok(near(info, p), f"[{label}] 途中改道到桌左前 {info and info['pos']}")
                p = await S(205, -150); info, meta = await walk(*p)  # 右墙边远角：右墙应淡出
                ok(near(info, p), f"[{label}] 走到右后角 {info and info['pos']}")
                faded = (await pg.evaluate("window.__play.presence()"))["faded"]; await shot("03_corner")
                notes.append(f"  [{label}] 右后角时淡出的：{faded or '无'}")
                info, meta = await walk(0, 300)    # 出门：院子里（场地坐标），篝火西边的踏步石路上
                ok(near(info, [0, 300]), f"[{label}] 出门走到院里 {info and info['pos']}，用时 {meta and meta[1]} 秒")
                door_z = (await S(0, 175))[1]; cross = crossings(meta[0], 1, door_z) if meta else []
                ok(len(cross) == 1 and abs(cross[0]) <= 45, f"[{label}] 出门的路从书房门洞过：穿过门那条线 {len(cross)} 次，x = {[round(c) for c in cross]}（门洞 ±45）")
                await pg.wait_for_timeout(1500); pr = await pg.evaluate("window.__play.presence()")
                ok(pr["zone"] == "yard" and abs(pr["az"] - YARD_AZ) < 3, f"[{label}] 出门后镜头转到院子区：区 {pr['zone']}，方位角 {pr['az']}（院子 {YARD_AZ}）")
                await shot("04_yard")
                pts = await pg.evaluate("window.__play.walkTo(440, -60)"); t0 = time.time(); most = 0   # 进偏屋：从朝西的门进；边走边看门开到多大
                while (await pg.evaluate("window.__play.presence()"))["moving"] and time.time() - t0 < 20:
                    most = min(most, (await pg.evaluate("window.__play.doors()"))[0]["ang"]); await pg.wait_for_timeout(100)
                info, meta = await pg.evaluate("window.__play.presence()"), (pts, round(time.time() - t0, 1))
                ok(near(info, [440, -60]), f"[{label}] 走进偏屋 {info and info['pos']}，用时 {meta and meta[1]} 秒")
                cross = crossings(meta[0], 0, 332) if meta else []
                ok(len(cross) == 1 and -5 <= cross[0] <= 85, f"[{label}] 进偏屋的路从门洞过：穿过正面那条线 {len(cross)} 次，z = {[round(c) for c in cross]}（门洞 z -5..85）")
                ok(most <= -85, f"[{label}] 走近时门推开：过门时开到 {most} 度（全开 -90）")
                notes.append(f"  [{label}] 偏屋里时淡出的：{(await pg.evaluate('window.__play.presence()'))['faded']}")
                await shot("05_shed")
                info, meta = await walk(-440, -60, limit=20000)  # 去树下长椅：从篝火北边绕过
                ok(near(info, [-440, -60]), f"[{label}] 走到长椅边 {info and info['pos']}，用时 {meta and meta[1]} 秒")
                dmin = seg_min(meta[0], FIRE) if meta else 0
                ok(dmin >= 60, f"[{label}] 路绕开篝火：离火心最近 {round(dmin)} 厘米（篝火石圈半径约 53）")
                dr = await pg.evaluate("window.__play.doors()"); ok(dr and abs(dr[0]["ang"] + 28) < 6, f"[{label}] 走远后门回到半开：{dr}")
                await shot("06_bench")
                info, meta = await walk(420, -420, limit=20000)  # 偏屋北头（书房东、偏屋北的空地）：偏屋屋顶挡住镜头，应整栋淡出
                ok(near(info, [420, -420]), f"[{label}] 走到偏屋北头 {info and info['pos']}")
                await pg.wait_for_timeout(500); faded = (await pg.evaluate("window.__play.presence()"))["faded"]
                ok("shed" in faded, f"[{label}] 偏屋北头时偏屋淡出：淡出的 {faded}")
                await shot("07_ne")
                p = await S(100, -50); info, meta = await walk(*p, limit=20000)   # 走回屋里
                ok(near(info, p), f"[{label}] 走回书房 {info and info['pos']}，用时 {meta and meta[1]} 秒")
                await pg.wait_for_timeout(1500); pr = await pg.evaluate("window.__play.presence()")
                ok(pr["zone"] == "study" and abs(pr["az"] - STUDY_AZ) < 3, f"[{label}] 进屋后镜头转回书房区：区 {pr['zone']}，方位角 {pr['az']}")
                info, meta = await walk(0, 900, limit=20000)    # 点到院墙外：停在院子里最近处
                ok(info and info["pos"][1] <= 600, f"[{label}] 点到院墙外：停在院里最近处 {info and info['pos']}")
                info, meta = await walk(60, 230, limit=20000)   # 篝火边
                ok(near(info, [60, 230]), f"[{label}] 走到篝火边 {info and info['pos']}")
                await shot("08_fire_day")
                await pg.evaluate("window.__play.setPeriod('night')"); await pg.wait_for_timeout(900); await shot("09_fire_night")
                ok(not errs, f"[{label}] 无控制台报错 {errs[:3]}")
                await ctx.close()
            await b.close()
        print(f"== 在场功能用例（{mode}）"); [print("  " + n) for n in notes]
        print("通过" if not fails else f"不通过 {len(fails)} 项", "  截图在", OUT); sys.exit(1 if fails else 0)
    finally:
        srv.terminate()
        if chrome: chrome.kill()

asyncio.run(main())
