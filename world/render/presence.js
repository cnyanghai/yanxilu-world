/* 渲染层：在场（M2，2026-11-05）—— 角色、点地走路、跟随镜头、墙透。逻辑在 world/sim/walker.js（纯函数），这里只管画与输入。
   设计依据：proposals/02 第六条（点地寻路、途中改道）、05 主张四（跟随镜头 = 角色位置的低通、俯角 40、两档距离；墙透 = 射线从镜头到角色，
   挡住的墙段淡到 0.15）。角色先用 1.5 米素模人形占位（M2 不验收画质）。单位：sim 层厘米，这里米。
   镜头分区（2026-11-05 院子与书房合成一块场地后）：zones 里每个区（书房）有自己的方位角、俯角、画面高，区外用 base（院子）；
   角色跨过区的边界时三样一起缓动过去（约 1 秒），不切镜头。 */
import * as THREE from "three";
import { Walker, plan } from "../sim/walker.js";

const deg = THREE.MathUtils.degToRad;

/* 1.5 米素模人形：胶囊身体 + 球头 + 一个朝前的小鼻子（看得出朝向） */
export function makeFigure(color = 0x8f8f8c) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 }), g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.86, 6, 16), mat); body.position.y = 0.59;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.165, 20, 14), mat); head.position.y = 1.335;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.08, 10), mat); nose.rotation.x = Math.PI / 2; nose.position.set(0, 1.33, 0.17);
  for (const m of [body, head, nose]) { m.castShadow = m.receiveShadow = true; g.add(m); }
  g.userData.body = body; g.userData.head = head; g.name = "figure"; return g;
}

export class Presence {
  /* opts：scene、camera、dom（画布）、grid（world/sim/grid.js 的 Grid，已写好阻挡）、room（rooms 表的一行）、walls（可淡出的墙网格）、spawn（厘米）、
     base / zones：镜头分区 { id, az, pitch, frameH（米）, rect（厘米，zones 才有） } */
  constructor(o) {
    Object.assign(this, { scene: o.scene, camera: o.camera, dom: o.dom, grid: o.grid, room: o.room, walls: o.walls || [] });
    const F = o.room.follow || {};
    this.fov = F.fov ?? 20; this.zooms = F.zoom || [1, 0.65]; this.zi = 0;
    this.base = o.base || { id: o.room.id, az: F.az ?? 20, pitch: F.pitch ?? 40, frameH: (F.frameH ?? 420) / 100 }; this.zones = o.zones || [];
    const z0 = this.zoneAt(o.spawn || [0, 0]); this.az = z0.az; this.pitch = z0.pitch; this.frameH = z0.frameH; this.zone = z0.id;   /* frameH：第一档画面高（米），第二档乘 zoom */
    this.clear = o.clear ?? 10;                                    /* 拉直路线时离家具留多少厘米 */
    this.walker = new Walker(o.spawn || [0, 0], { speed: o.speed ?? 140, heading: Math.PI });
    this.fig = makeFigure(); this.scene.add(this.fig);
    this.target = new THREE.Vector3(); this.dist = this.distFor(0); this.distNow = this.dist; this.snap = true;
    this.marker = this.makeMarker(); this.scene.add(this.marker);
    this.fade = new Map(); for (const w of this.walls) { w.material = w.material.clone(); w.material.transparent = true; this.fade.set(w, 1); }
    this.ray = new THREE.Raycaster(); this.floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); this.enabled = true; this.t = 0;
    this.bindInput();
    this.syncFigure(0);
  }
  distFor(i) { return (this.frameH * this.zooms[i] / 2) / Math.tan(deg(this.fov) / 2); }
  zoneAt(p) { for (const z of this.zones) if (p[0] > z.rect.x0 && p[0] < z.rect.x1 && p[1] > z.rect.z0 && p[1] < z.rect.z1) return z; return this.base; }
  makeMarker() {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.11, 0.15, 32), new THREE.MeshBasicMaterial({ color: 0xf3d98a, transparent: true, opacity: 0, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.015; m.renderOrder = 5; return m;
  }
  /* 屏幕坐标 → 地面上的点（厘米） */
  floorAt(cx, cy) {
    const r = this.dom.getBoundingClientRect(), p = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(p, this.camera); const hit = new THREE.Vector3();
    return this.ray.ray.intersectPlane(this.floor, hit) ? [hit.x * 100, hit.z * 100] : null;
  }
  /* 走到某点（厘米）；返回规划出的折线（含起点），走不到返回 null */
  walkTo(x, z, onArrive) {
    const pts = plan(this.grid, this.walker.pos, [x, z], this.clear); if (!pts) return null;
    this.walker.go(pts, onArrive || null);
    const end = pts[pts.length - 1]; this.marker.position.set(end[0] / 100, 0.015, end[1] / 100); this.marker.material.opacity = 0.9; this.markerT = 0;
    return pts;
  }
  bindInput() {
    let down = null;
    this.dom.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    this.dom.addEventListener("pointerup", (e) => {
      if (!down || !this.enabled) return; const d = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t; down = null;
      if (d > 8 || dt > 600) return;   /* 拖动、长按不算点 */
      const p = this.floorAt(e.clientX, e.clientY); if (p) this.walkTo(p[0], p[1]);
    });
    this.dom.addEventListener("wheel", (e) => { if (!this.enabled) return; e.preventDefault(); this.setZoom(e.deltaY < 0 ? 1 : 0); }, { passive: false });
    /* 双指捏合：张开拉近、合拢退回（两档） */
    const touches = new Map(); let pinch0 = 0;
    this.dom.addEventListener("pointerdown", (e) => { if (e.pointerType === "touch") touches.set(e.pointerId, [e.clientX, e.clientY]); if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); down = null; } });
    this.dom.addEventListener("pointermove", (e) => {
      if (!touches.has(e.pointerId)) return; touches.set(e.pointerId, [e.clientX, e.clientY]);
      if (touches.size === 2 && pinch0) { const [a, b] = [...touches.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (d / pinch0 > 1.25) { this.setZoom(1); pinch0 = d; } else if (d / pinch0 < 0.8) { this.setZoom(0); pinch0 = d; } }
    });
    const end = (e) => { touches.delete(e.pointerId); if (touches.size < 2) pinch0 = 0; };
    this.dom.addEventListener("pointerup", end); this.dom.addEventListener("pointercancel", end);
  }
  setZoom(i) { this.zi = Math.max(0, Math.min(this.zooms.length - 1, i)); this.dist = this.distFor(this.zi); }
  syncFigure(dt) {
    const w = this.walker, f = this.fig; f.position.set(w.pos[0] / 100, 0, w.pos[1] / 100); f.rotation.y = w.heading;
    /* 走路的上下起伏（素模也要看得出在走） */
    this.t += dt; const bob = w.moving ? Math.abs(Math.sin(this.t * 8.5)) * 0.03 : 0; f.userData.body.position.y = 0.59 + bob; f.userData.head.position.y = 1.335 + bob;
  }
  /* 每帧：走、跟随、墙透。返回是否在动 */
  update(dt) {
    const moved = this.walker.update(dt) > 0; this.syncFigure(dt);
    if (this.marker.material.opacity > 0) { this.markerT += dt; this.marker.material.opacity = Math.max(0, 0.9 - this.markerT * 0.9); this.marker.scale.setScalar(1 + this.markerT * 0.6); }
    if (this.enabled) this.follow(dt);
    this.wallFade(dt);
    return moved;
  }
  /* 跟随镜头：目标点是角色位置（胸口高）的低通，距离两档缓动；俯角与方位固定 */
  follow(dt) {
    const zg = this.zoneAt(this.walker.pos), kz = this.snap ? 1 : 1 - Math.exp(-dt * 2.4); this.zone = zg.id;   /* 镜头分区缓动 */
    let da = zg.az - this.az; da = Math.atan2(Math.sin(deg(da)), Math.cos(deg(da))) * 180 / Math.PI;
    this.az += da * kz; this.pitch += (zg.pitch - this.pitch) * kz; this.frameH += (zg.frameH - this.frameH) * kz; this.dist = this.distFor(this.zi);
    const want = new THREE.Vector3(this.walker.pos[0] / 100, 0.9, this.walker.pos[1] / 100), k = this.snap ? 1 : 1 - Math.exp(-dt * 3.2);
    this.target.lerp(want, k); this.distNow += (this.dist - this.distNow) * (this.snap ? 1 : 1 - Math.exp(-dt * 4)); this.snap = false;
    const a = deg(this.az), e = deg(this.pitch), back = this.camera.aspect >= 1.6 ? 1 : Math.min(1.6, Math.sqrt(1.6 / this.camera.aspect));   /* 竖屏退一些（跟着人走，不必看全房；退满 1.6 / 宽高比 时房子太小） */
    const d = this.distNow * back;
    this.camera.position.copy(this.target).add(new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).multiplyScalar(d));
    this.camera.lookAt(this.target);
    if (Math.abs(this.camera.fov - this.fov) > 1e-3) this.camera.fov = this.fov;
    this.camera.near = Math.max(0.2, d - 12); this.camera.far = d + 30; this.camera.updateProjectionMatrix();
  }
  /* 墙透：镜头到角色头、胸两条射线，挡住的墙段淡到 0.15，其余回到不透明 */
  wallFade(dt) {
    if (!this.walls.length) return;
    const hit = new Set(), from = this.camera.position;
    for (const y of [0.9, 1.4]) {
      const to = new THREE.Vector3(this.walker.pos[0] / 100, y, this.walker.pos[1] / 100), dir = to.clone().sub(from), len = dir.length();
      this.ray.set(from, dir.normalize()); this.ray.far = len - 0.2;
      for (const h of this.ray.intersectObjects(this.walls, false)) hit.add(h.object.userData.fadeKey || h.object.uuid);
    }
    this.ray.far = Infinity;
    for (const w of this.walls) {   /* 同一件家具的几块（书墙的板与隔板）一起淡出 */
      const goal = hit.has(w.userData.fadeKey || w.uuid) ? 0.15 : 1, cur = this.fade.get(w), next = cur + (goal - cur) * (1 - Math.exp(-dt * 8));
      this.fade.set(w, next); w.material.opacity = next; w.material.depthWrite = next > 0.98; w.castShadow = true;
    }
  }
  info() { return { pos: this.walker.pos.map((v) => Math.round(v)), heading: +this.walker.heading.toFixed(3), moving: this.walker.moving, zoom: this.zi, zone: this.zone, az: +this.az.toFixed(1), faded: [...new Set(this.walls.filter((w) => this.fade.get(w) < 0.5).map((w) => w.userData.side))] }; }
}
