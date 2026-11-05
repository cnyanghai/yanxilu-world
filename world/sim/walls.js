/* 世界层：按瓦片表算房间的墙块（2026-11-05 从 render/shell.js 拆出来的纯函数，不 import three）。
   渲染（render/shell.js）拿它出几何，寻路（sim/site.js）拿它挡路，人形巡检（tools/tests/walk_check.mjs）在 Node 里也用它——三处同一份。
   规则：tiles.walls 的每段沿格边，墙心在房间边线外半个墙厚；近侧（south）nearLowered 的墙压到 60 厘米；
   门段按房间 door.w 开口（门宽大于门段格时相邻墙段也扣掉），窗段按 room.window 开洞，opening 段（院门）只立两根门柱，四角补柱。
   单位米，房间本地坐标（原点房间中心，x 向右，z 向镜头，y 向上）。 */
export const LOWERED = 0.6;

/* 一块：{ side, type, x0, x1, y0, y1, z0, z1 } */
const B = (side, type, cx, y0, y1, cz, sx, sz) => ({ side, type, x0: cx - sx / 2, x1: cx + sx / 2, y0, y1, z0: cz - sz / 2, z1: cz + sz / 2 });

export function wallBoxes(room, tiles) {
  const T = room.tiles, cell = T.cell / 100, W = room.size.w / 100, D = room.size.d / 100;
  let boxes = []; const trims = [], win = room.window, door = room.door;
  for (const s of T.walls) {
    const def = tiles.wall[s.type]; if (!def || def.segment === "none") continue;
    const t = def.t / 100, h = s.side === "south" && def.nearLowered ? LOWERED : def.h / 100;
    const a = s.from * cell, b = s.to * cell, along = s.side === "north" || s.side === "south";
    const at = (u, y0, y1, L, tt = t) => along                    /* 这一面上中心 u、长 L、高 y0..y1 的一块 */
      ? B(s.side, s.type, -W / 2 + u, y0, y1, s.side === "north" ? -D / 2 - t / 2 : D / 2 + t / 2, L, tt)
      : B(s.side, s.type, s.side === "west" ? -W / 2 - t / 2 : W / 2 + t / 2, y0, y1, -D / 2 + u, tt, L);
    const span = (u0, u1, y0, y1) => { if (u1 - u0 > 1e-4 && y1 - y0 > 1e-4) boxes.push(at((u0 + u1) / 2, y0, y1, u1 - u0)); };
    if (def.opening) {                                            /* 院门：开口，两端各一根门柱 */
      const p = Math.min(t, 0.3); boxes.push(at(a + p / 2, 0, h, p, p), at(b - p / 2, 0, h, p, p));
    } else if (s.type === "window" && win) {                      /* 窗洞：窗台以下、窗顶以上两块，两侧补齐 */
      const z0 = win.z0 / 100 + D / 2, z1 = win.z1 / 100 + D / 2, sill = win.sill / 100, top = win.top / 100;
      span(a, Math.max(a, z0), 0, h); span(Math.min(b, z1), b, 0, h);
      span(Math.max(a, z0), Math.min(b, z1), 0, sill); span(Math.max(a, z0), Math.min(b, z1), top, h);
      const zc = -D / 2 + (z0 + z1) / 2, xw = s.side === "west" ? -W / 2 - t / 2 : W / 2 + t / 2;
      trims.push(B(s.side, "trim", xw, sill - 0.06, sill, zc, t + 0.04, z1 - z0 + 0.12), B(s.side, "trim", xw, top, top + 0.06, zc, t + 0.04, z1 - z0 + 0.12));
    } else if (s.type === "door" && door) {                       /* 门洞：按房间 door.w 开口（门段格子可能比门窄） */
      const u = door.x / 100 + W / 2, hw = door.w / 200;
      span(a, Math.max(a, u - hw), 0, h); span(Math.min(b, u + hw), b, 0, h);
    } else span(a, b, 0, h);
  }
  /* 门宽大于门段格时，相邻墙段伸进门洞的部分扣掉 */
  if (door) {
    const u0 = door.x / 100 - door.w / 200, u1 = door.x / 100 + door.w / 200;
    boxes = boxes.flatMap((it) => {
      if (it.side !== "south" || it.x1 <= u0 + 1e-4 || it.x0 >= u1 - 1e-4) return [it];
      const out = []; if (it.x0 < u0) out.push({ ...it, x1: u0 }); if (it.x1 > u1) out.push({ ...it, x0: u1 }); return out;
    });
  }
  /* 四角补柱（墙厚见方），算在西 / 东墙上 */
  const cw = T.walls.find((w) => w.side === "north"), ct = cw?.type || "plaster", cdef = tiles.wall[ct] || { t: 24, h: 300 };
  if (cdef.segment !== "none") {
    const t0 = cdef.t / 100, hN = cdef.h / 100, sw = T.walls.find((w) => w.side === "south"), low = tiles.wall[sw?.type]?.nearLowered ? LOWERED : hN;
    boxes.push(B("west", ct, -W / 2 - t0 / 2, 0, hN, -D / 2 - t0 / 2, t0, t0), B("west", ct, -W / 2 - t0 / 2, 0, low, D / 2 + t0 / 2, t0, t0),
               B("east", ct, W / 2 + t0 / 2, 0, hN, -D / 2 - t0 / 2, t0, t0), B("east", ct, W / 2 + t0 / 2, 0, low, D / 2 + t0 / 2, t0, t0));
  }
  return { boxes, trims };
}

/* 挡路范围：墙块的平面投影，厘米，场地坐标（off 是本房原点在场地里的位置） */
export function wallBlocks(room, tiles, off = [0, 0]) {
  if (!room.tiles?.walls) return [];
  return wallBoxes(room, tiles).boxes.map((b) => ({ x0: b.x0 * 100 + off[0], x1: b.x1 * 100 + off[0], z0: b.z0 * 100 + off[1], z1: b.z1 * 100 + off[1] }));
}
