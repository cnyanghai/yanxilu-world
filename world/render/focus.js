/* 渲染层：对焦站（M2，2026-11-05）—— 在场为底、对焦为点（SCOPE 第三稿；study-plan 第 2 节；proposals/02 第四条）。
   - 进站：角色走到站的触发格停下，或在跟随镜头里点站所属的物件（先走到触发格再进；点的是一本书就进站后指到那本）；
   - 镜头：从跟随镜头缓动到站的机位（inOutCubic，rooms 表 stations.<站>.ease 秒，默认 1.2）；系统设了"减少动态效果"就直接切；
     机位按画面取景算：看向 at，方位角 az、俯角 pitch、视场角 fov，距离让 frame（宽 × 高，厘米）正好装下；竖屏只装 frame.portraitW 宽，左右拖动沿墙平移；
   - 站里：角色淡出（不挡书）；悬停或点一本书 → 往外滑 2 厘米、浮出题签（书名、领域、读到哪）；
   - 出站：Esc、浏览器后退、点空处（不是书）、左上"回到书房"按钮；镜头缓动回跟随，角色淡入。
   单位：表里厘米，这里米；坐标是场地坐标。 */
import * as THREE from "three";

const deg = THREE.MathUtils.degToRad;
const inOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class Focus {
  /* o：camera、presence、dom（画布）、stations：[{ id, def（rooms 表的站）, off（房间原点在场地里，厘米）, content（如书墙：pick / setFocus / info / anchor / hitsShelf） }]、
     ui：{ back（按钮）, tag（题签） } */
  constructor(o) {
    Object.assign(this, { camera: o.camera, presence: o.presence, dom: o.dom, stations: o.stations, ui: o.ui || {}, occluders: o.occluders || [] });
    this.faded = []; this.fadeK = 1;
    this.state = "follow"; this.cur = null; this.t = 0; this.pan = new THREE.Vector2(); this.hover = -1; this.select = -1; this.pending = null; this.wasMoving = false;
    this.from = null; this.ray = new THREE.Raycaster(); this.figOpacity = 1; this.reduce = matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    this.bindInput();
    if (o.presence) o.presence.onTap = (x, y) => this.tapInFollow(x, y);
  }
  /* 站的触发点（场地厘米） */
  trigger(st) { return [st.def.trigger.x + st.off[0], st.def.trigger.z + st.off[1]]; }
  rayAt(cx, cy) { const r = this.dom.getBoundingClientRect(); this.ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), this.camera); return this.ray; }
  /* 取景框：frame.fit = "content" 时按站内容（书墙上有书的格子）加边距取景，夹在 minW / minH 与整框之间；否则整框。米，世界坐标 */
  frameOf(st) {
    const d = st.def, fr = d.frame || { w: 380, h: 250, portraitW: 120 }, ax = (d.at.x + st.off[0]) / 100, ay = d.at.y / 100, cb = fr.fit === "content" ? st.content?.content?.() : null;
    if (!cb) return { w: fr.w / 100, h: fr.h / 100, cx: ax, cy: ay, fw: fr.w / 100, fh: fr.h / 100, ax, ay };
    const m = (fr.margin ?? 12) / 100, cl = THREE.MathUtils.clamp;
    return { w: cl(cb.w + 2 * m, (fr.minW ?? 160) / 100, fr.w / 100), h: cl(cb.h + 2 * m, (fr.minH ?? 120) / 100, fr.h / 100), cx: cb.center.x, cy: cb.center.y, fw: fr.w / 100, fh: fr.h / 100, ax, ay };
  }
  /* 站的机位：{ pos, target, fov } */
  pose(st, pan = this.pan) {
    const d = st.def, a = this.camera.aspect, fr = d.frame || { portraitW: 120 }, F = this.frameOf(st), fov = d.fov ?? 14;
    const frameH = a >= 1 ? Math.max(F.h, F.w / a) : (fr.portraitW ?? 120) / 100 / a;
    const dist = frameH / 2 / Math.tan(deg(fov) / 2), az = deg(d.az ?? 0), el = deg(d.pitch ?? 12);
    const target = new THREE.Vector3(F.cx + pan.x, F.cy + pan.y, (d.at.z + st.off[1]) / 100);
    const pos = target.clone().add(new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(dist));
    return { pos, target, fov, frameH, dist };
  }
  /* 平移范围：画面不出整框（整面书墙）；返回 [xmin, xmax, ymin, ymax]（相对取景中心） */
  panLimit(st) {
    const P = this.pose(st, new THREE.Vector2()), F = this.frameOf(st), visW = P.frameH * this.camera.aspect, lx = Math.max(0, (F.fw - visW) / 2), ly = Math.max(0, (F.fh - P.frameH) / 2);
    const ox = F.ax - F.cx, oy = F.ay - F.cy;
    return [Math.min(0, ox - lx), Math.max(0, ox + lx), Math.min(0, oy - ly), Math.max(0, oy + ly)];
  }
  enter(id, select = -1) {
    const st = this.stations.find((s) => s.id === id); if (!st || this.state === "in" || this.state === "entering") return false;
    this.cur = st; this.state = "entering"; this.t = 0; this.pan.set(0, 0); this.select = select; this.hover = -1;
    this.from = { pos: this.camera.position.clone(), target: this.presence ? this.presence.target.clone() : this.pose(st).target, fov: this.camera.fov };
    this.lookTarget = this.from.target.clone();
    if (this.presence) { this.presence.enabled = false; this.presence.walker.stop(); }
    this.pickOccluders(st);
    if (history.state?.focus !== id) history.pushState({ focus: id }, "");
    if (this.ui.back) this.ui.back.hidden = false;
    document.body.dataset.focus = id;
    return true;
  }
  exit(fromPop = false) {
    if (this.state !== "in" && this.state !== "entering") return false;
    this.state = "leaving"; this.t = 0; this.from = { pos: this.camera.position.clone(), target: this.lookTarget.clone(), fov: this.camera.fov };
    this.cur.content?.setFocus?.(-1); this.hover = this.select = -1; this.showTag(-1);
    if (!fromPop && history.state?.focus) { this.ignorePop = true; history.back(); }
    if (this.ui.back) this.ui.back.hidden = true;
    delete document.body.dataset.focus;
    return true;
  }
  /* 挡住站内容的家具（站的机位看过去，屏幕上和书墙重叠、又比书墙近的）：进站时淡到 0.18，出站还原 */
  pickOccluders(st) {
    this.restoreOccluders(); const face = st.content?.face?.(); if (!face) return;
    const P = this.pose(st, new THREE.Vector2()), cam = this.camera.clone(); cam.position.copy(P.pos); cam.fov = P.fov; cam.lookAt(P.target); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const rect = (pts) => { const r = [Infinity, Infinity, -Infinity, -Infinity]; for (const v of pts) { const p = v.clone().project(cam); r[0] = Math.min(r[0], p.x); r[1] = Math.min(r[1], p.y); r[2] = Math.max(r[2], p.x); r[3] = Math.max(r[3], p.y); } return r; };
    const c = face.center, S = rect([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => new THREE.Vector3(c.x + u * face.w / 2, c.y + v * face.h / 2, c.z))), dFace = P.pos.distanceTo(c) - 0.05, box = new THREE.Box3();
    for (const o of this.occluders) {
      if (o === st.content.group) continue; box.setFromObject(o); if (box.isEmpty()) continue;
      const pts = []; for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) pts.push(new THREE.Vector3(x, y, z));
      const ctr = box.getCenter(new THREE.Vector3()), fwd = P.target.clone().sub(P.pos).normalize(), ahead = pts.every((v) => v.clone().sub(P.pos).dot(fwd) > 0.3);   /* 镜头背后的（院门口的信箱）投影是反的，不算 */
      const R = rect(pts), near = ahead && P.pos.distanceTo(ctr) < dFace;
      if (near && R[0] < S[2] && R[2] > S[0] && R[1] < S[3] && R[3] > S[1]) o.traverse((m) => { if (m.isMesh && !m.isInstancedMesh) { m.userData.focusMat = m.material; m.material = m.material.clone(); m.material.transparent = true; this.faded.push(m); } });
    }
    this.fadeK = 1;
  }
  restoreOccluders() { for (const m of this.faded) { m.material.dispose(); m.material = m.userData.focusMat; delete m.userData.focusMat; } this.faded = []; }
  /* 跟随镜头里点：点中某站的物件 → 走到触发格再进站 */
  tapInFollow(cx, cy) {
    const ray = this.rayAt(cx, cy);
    for (const st of this.stations) {
      const c = st.content; if (!c?.hitsShelf?.(ray)) continue;
      const book = c.pick ? c.pick(ray) : -1, [tx, tz] = this.trigger(st), p = this.presence.walker.pos;
      if (Math.hypot(p[0] - tx, p[1] - tz) < 13) { this.enter(st.id, book); return true; }
      this.pending = { id: st.id, book }; this.presence.walkTo(tx, tz); return true;
    }
    this.pending = null; return false;
  }
  bindInput() {
    let down = null, drag = false;
    this.dom.addEventListener("pointerdown", (e) => { if (this.state !== "in") return; down = { x: e.clientX, y: e.clientY, px: this.pan.x, py: this.pan.y, t: performance.now() }; drag = false; });
    this.dom.addEventListener("pointermove", (e) => {
      if (this.state !== "in") return;
      if (down) {   /* 拖动：沿墙平移（竖屏或画面装不下时） */
        const dx = e.clientX - down.x, dy = e.clientY - down.y; if (Math.hypot(dx, dy) > 8) drag = true;
        if (drag) { const P = this.pose(this.cur, new THREE.Vector2()), r = this.dom.getBoundingClientRect(), mpp = P.frameH / r.height, [x0, x1, y0, y1] = this.panLimit(this.cur);
          this.pan.set(THREE.MathUtils.clamp(down.px - dx * mpp, x0, x1), THREE.MathUtils.clamp(down.py + dy * mpp, y0, y1)); }
        return;
      }
      if (e.pointerType === "mouse") this.setHover(this.cur.content?.pick ? this.cur.content.pick(this.rayAt(e.clientX, e.clientY)) : -1);
    });
    this.dom.addEventListener("pointerup", (e) => {
      if (this.state !== "in" || !down) return; const was = drag; down = null; drag = false; if (was) return;
      const i = this.cur.content?.pick ? this.cur.content.pick(this.rayAt(e.clientX, e.clientY)) : -1;
      if (i >= 0) { this.select = i; this.setHover(i, true); } else this.exit();   /* 点空处出站 */
    });
    addEventListener("keydown", (e) => { if (e.key === "Escape" && (this.state === "in" || this.state === "entering")) this.exit(); });
    addEventListener("popstate", () => { if (this.ignorePop) { this.ignorePop = false; return; } if (this.state === "in" || this.state === "entering") this.exit(true); });
    this.ui.back?.addEventListener("click", () => this.exit());
  }
  setHover(i, force = false) {
    const show = i >= 0 ? i : this.select; if (!force && show === this.hover) return;
    this.hover = show; this.cur.content?.setFocus?.(show); this.showTag(show);
  }
  showTag(i) {
    const tag = this.ui.tag; if (!tag) return;
    const inf = i >= 0 ? this.cur?.content?.info?.(i) : null; if (!inf) { tag.hidden = true; return; }
    tag.querySelector("b").textContent = inf.title; tag.querySelector("small").textContent = `${inf.domName} · ${inf.state}`; tag.hidden = false; this.placeTag();
  }
  placeTag() {
    const tag = this.ui.tag; if (!tag || tag.hidden || this.hover < 0) return;
    const p = this.cur.content.anchor(this.hover).project(this.camera), r = this.dom.getBoundingClientRect();
    const x = (p.x + 1) / 2 * r.width, y = (1 - p.y) / 2 * r.height, w = tag.offsetWidth, h = tag.offsetHeight;
    tag.style.left = Math.round(THREE.MathUtils.clamp(x - w / 2, 8, r.width - w - 8)) + "px"; tag.style.top = Math.round(THREE.MathUtils.clamp(y - h - 10, 8, r.height - h - 8)) + "px";
  }
  /* 每帧：跟随时看有没有走到触发格；进出站时镜头缓动；站里跟着平移；角色淡入淡出 */
  update(dt) {
    const pr = this.presence;
    if (this.state === "follow" && pr) {
      const moving = pr.walker.moving;
      if (this.wasMoving && !moving) {   /* 刚停下：停在某站的触发格就进站 */
        const p = pr.walker.pos, st = this.stations.find((s) => { const [tx, tz] = this.trigger(s); return Math.hypot(p[0] - tx, p[1] - tz) < 13; });
        if (st) this.enter(st.id, this.pending?.id === st.id ? this.pending.book : -1);
        this.pending = null;
      }
      this.wasMoving = moving;
    }
    const dur = this.reduce ? 0 : (this.cur?.def.ease ?? 1.2);
    if (this.state === "entering" || this.state === "in" || this.state === "leaving") {
      this.t = Math.min(1, this.t + (dur ? dt / dur : 1)); const e = inOutCubic(this.t);
      const to = this.state === "leaving" ? pr.followPose() : this.pose(this.cur);
      const k = this.state === "in" ? 1 : e, from = this.from;
      const pos = this.state === "in" ? to.pos : from.pos.clone().lerp(to.pos, k), target = this.state === "in" ? to.target : from.target.clone().lerp(to.target, k);
      this.camera.position.copy(pos); this.lookTarget = target; this.camera.lookAt(target);
      this.camera.fov = this.state === "in" ? to.fov : from.fov + (to.fov - from.fov) * k;
      const dist = pos.distanceTo(target); this.camera.near = Math.max(0.2, dist - 12); this.camera.far = dist + 30; this.camera.updateProjectionMatrix();
      if (this.t >= 1 && this.state === "entering") { this.state = "in"; if (this.select >= 0) this.setHover(this.select, true); }
      if (this.t >= 1 && this.state === "leaving") { this.state = "follow"; this.cur = null; if (pr) pr.enabled = true; this.wasMoving = false; this.restoreOccluders(); }
    }
    /* 读书灯：进站亮起、出站熄灭（灯一直在场景里，只改强度，免得着色器重编译卡一下） */
    for (const st of this.stations) if (st.light) {
      const goal = st === this.cur && (this.state === "entering" || this.state === "in") ? 1 : 0, k = st.light.userData.k ?? 0, nk = k + (goal - k) * (1 - Math.exp(-dt * 3.5));
      st.light.userData.k = nk; st.light.intensity = st.light.userData.power * nk;
    }
    /* 挡书的家具：进站淡到 0.18、出站淡回 */
    if (this.faded.length) { const g = this.state === "leaving" || this.state === "follow" ? 1 : 0.18; this.fadeK += (g - this.fadeK) * (1 - Math.exp(-dt * 6)); for (const m of this.faded) { m.material.opacity = this.fadeK; m.material.depthWrite = this.fadeK > 0.9; } }
    /* 角色：站里淡出（不挡书），回到跟随淡入 */
    if (pr) {
      const goal = this.state === "follow" || this.state === "leaving" ? 1 : 0; this.figOpacity += (goal - this.figOpacity) * (1 - Math.exp(-dt * 8));
      pr.setFigureOpacity(this.figOpacity);
    }
    this.cur?.content?.update?.(dt);
    if (this.state === "in") this.placeTag();
  }
  info() { return { occluded: [...new Set(this.faded.map((m) => { let o = m; while (o && !this.occluders.includes(o)) o = o.parent; return o?.name; }))], state: this.state, id: this.cur?.id || null, hover: this.hover, select: this.select, pan: [+this.pan.x.toFixed(3), +this.pan.y.toFixed(3)], fov: +this.camera.fov.toFixed(2) }; }
}
