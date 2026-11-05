/* 世界层：场地 —— 套在一起的房间合成一块地、一张寻路网（M2，2026-11-05：院子套书房，人能出门进门）。纯函数，不 import three。
   rooms 表里某间房写了 rooms: [{ id, x, z }]，表示这些房间按 (x, z)（厘米，本房坐标）摆在它里面。
   打开其中任一间，引擎都搭整块场地，角色从屋里走出门就到院子，不切场景。 */
import { Grid } from "./grid.js";

/* 某间房所在的场地：{ site：最外面那间, members：[{ id, x, z }]（套在里面的，含位置）, offset：这间房原点在场地里的位置 } */
export function siteOf(rooms, roomId) {
  for (const r of Object.values(rooms)) {
    const m = (r.rooms || []).find((x) => x.id === roomId);
    if (m) return { site: r, members: r.rooms, offset: [m.x, m.z] };
  }
  const r = rooms[roomId]; return { site: r, members: r.rooms || [], offset: [0, 0] };
}

/* 场地的寻路网：场地自己的格子大小与范围；挡路 = 每间房的固定落地 / 靠墙槽（同 roomGrid 的规则）+ 墙体 blocks（厘米，场地坐标） */
export function siteGrid(site, members, rooms, objects, blocks = []) {
  const g = new Grid(site);
  const slots = (room, ox, oz) => {
    for (const s of room.slots || []) {
      if (!s.fixed || (s.type !== "floor" && s.type !== "wall")) continue;
      const o = objects[s.fixed]; if (o && o.collision === false) continue;
      g.blockRect(s.x + ox, s.z + oz, s.w, s.d, s.rot || 0);
    }
  };
  slots(site, 0, 0);
  for (const m of members) slots(rooms[m.id], m.x, m.z);
  for (const b of blocks) g.blockRect((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, b.x1 - b.x0, b.z1 - b.z0, 0);
  return g;
}
