/* 实时光照的房间运行时（2026-11-05 由营地小试的 camp.js 改成通用）：?room=<rooms 表 id>，读表与预设搭场景，按 vis 切时段。
   - 营地（camp）：地面分层 + 散布 + 预制体（茅草偏屋）+ 火 + 灯；
   - 书房（study，M2 第一个可玩版本）：瓦片表生成地板与墙（render/shell.js），家具按预设摆（有模型的按占地缩放，没有的出灰盒），
     房间有 follow 的开在场（render/presence.js：素模人形、点地走路、跟随镜头、墙透）。
   和 world.js（现代书房，烘焙无光照）不同：这里是实时光照的 PBR —— 一盏平行光带阴影、半球天光、局部点光、合成后期里的环境遮蔽。
   网址参数：?shot=wide|close|detail|fire|door&period=day|night&sw=1（软件渲染：不开多重采样）&tier=0|1|2&tex=lo|hi。单位：表里厘米，场景里米；three 轴向，偏屋正面朝 -z。
   分档（2026-11-05 手机档优化，render/tiers.js 的 TIER_BUDGET）：0 档无阴影无后期、1 档一盏阴影 2048 + 后期（环境遮蔽 8 采样）、2 档阴影 4096 + 后期 16 采样；
   0、1 档用半分辨率贴图 tex_lo/；偏屋的静态件按材质合并成少数几个网格；像素密度 0 档 1、1 档 ≤ 1.5、2 档 ≤ 2。 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { loadTables } from "./data/tables.js";
import { detectTier } from "./render/tiers.js";
import { Composite } from "./render/post.js";
import { Fire, flicker } from "./render/fire.js";
import { buildShell, greyBox, slotBoxes } from "./render/shell.js";
import { Presence } from "./render/presence.js";
import { buildBookshelf } from "./render/shelf.js";
import { Focus } from "./render/focus.js";
import { BOOKS, DOMAINS } from "./sample.js";
import { siteOf, siteGrid, siteParts } from "./sim/site.js";
import { rasterize, stamp, blockBits } from "./sim/collide.js";

const Q = new URLSearchParams(location.search);
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: true });
renderer.shadowMap.type = THREE.PCFShadowMap;   /* 0.186 起 PCFSoft 已去掉，回退到这个 */
THREE.Cache.enabled = true;   /* 同一张贴图被几件模型引用时只下载一次（图片加载器把下载中的请求也记在缓存里） */
renderer.toneMapping = THREE.AgXToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
const EXPOSURE = 0.33;                                   /* 全时段恒定（vis.mapping_camp）；Blender 白天是 -1.15 档（0.45），three 的天光无遮挡、AgX 实现也不同，真显卡量过后压到 0.33 */
renderer.toneMappingExposure = EXPOSURE; renderer.info.autoReset = false;   /* draw call 按整帧累计（场景 + 阴影 + 合成） */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(9.5, 1.6, 1, 200);
const T = await loadTables("./");
if (T.problems.length) console.warn("表校验问题", T.problems);
const ROOM_ID = Q.get("room") || document.body.dataset.room || "camp";
const ROOM = T.rooms[ROOM_ID]; if (!ROOM) throw new Error(`rooms 里没有 ${ROOM_ID}`);
/* 场地：这间房若套在别的房间里（书房在院子里），搭整块场地；坐标一律用场地坐标（厘米），OFF 是本房原点在场地里的位置 */
const { site: SITE, members: MEMBERS, offset: OFF } = siteOf(T.rooms, ROOM_ID);
const PARTS = siteParts(SITE, MEMBERS, T.rooms);
const isMobile = Math.min(innerWidth, innerHeight) < 700 || /Mobi|Android/i.test(navigator.userAgent);
const TIER = detectTier(renderer, { isMobile });
renderer.setPixelRatio(Q.has("shot") ? 1 : Math.min(devicePixelRatio || 1, [1, 1.5, 2][TIER]));
renderer.shadowMap.enabled = TIER >= 1;
const composite = TIER >= 1 ? new Composite(renderer, { samples: Q.get("sw") ? 0 : 4, aoSamples: TIER >= 2 ? 16 : 8 }) : null;
/* 贴图分档：0、1 档换成半分辨率的 tex_lo/；路径先规整成绝对地址（几件模型从不同目录用 ../../tex/ 引用同一张图，缓存要认得出是同一张） */
const TEX_LO = Q.get("tex") ? Q.get("tex") === "lo" : TIER < 2;
const texURL = (u) => { const a = new URL(u, location.href).href; return TEX_LO ? a.replace("/tex/", "/tex_lo/") : a; };
const manager = new THREE.LoadingManager(); manager.setURLModifier(texURL);
const gltf = new GLTFLoader(manager), tl = new THREE.TextureLoader(manager);
const getJSON = (u) => fetch(u, { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); });
const deg = THREE.MathUtils.degToRad;

/* ---------- 光：平行光（太阳 / 月亮，带阴影）+ 半球天光 + 局部点光 ---------- */
const sun = new THREE.DirectionalLight(0xffffff, 1); scene.add(sun, sun.target);
sun.castShadow = TIER >= 1; sun.shadow.mapSize.setScalar(TIER >= 2 ? 4096 : 2048);
const SHADOW_EXT = (SITE.shadow?.half ?? 800) / 100;   /* 阴影相机半边长（rooms 表 shadow.half，厘米；默认 8 米，院子 12 米见方连房子高度要 9.5） */
Object.assign(sun.shadow.camera, { left: -SHADOW_EXT, right: SHADOW_EXT, top: SHADOW_EXT, bottom: -SHADOW_EXT, near: 1, far: 60 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); scene.add(hemi);
const locals = [], glowMats = [], fires = [], interact = {}; let groundExtent = Infinity;
/* 交互物件切状态（门：ajar 半开 / open 全开 / closed 关）；现在只换朝向，动画以后接状态机 */
function setState(id, st) { const it = interact[id], s = it?.I.states?.[st]; if (!s) return false; it.o.quaternion.identity(); it.o.rotation.set(0, deg(s.rotY || 0), 0); return true; }
function addLight(parent, L) {
  const pl = new THREE.PointLight(new THREE.Color().setRGB(L.color[0], L.color[1], L.color[2], THREE.SRGBColorSpace), 0, 0, 2);
  pl.userData = { power: L.power, periods: L.periods || ["dawn", "day", "dusk", "night"], flicker: L.flicker || 0, seed: Math.random() * 10, base: 0 };
  parent.add(pl); locals.push(pl); return pl;
}

/* ---------- 实体：Transform（厘米、四元数 / 欧拉 / 绕 y） ---------- */
function applyT(o, t = {}) {
  o.position.set((t.x || 0) / 100, (t.y || 0) / 100, (t.z || 0) / 100);
  if (t.q) o.quaternion.fromArray(t.q); else if (t.rot) o.rotation.set(deg(t.rot[0]), deg(t.rot[1]), deg(t.rot[2])); else if (t.rotY) o.rotation.y = deg(t.rotY);
  if (t.s) o.scale.fromArray(t.s); else if (t.scale) o.scale.setScalar(t.scale);
}
const models = {};
function model(id) {   /* props 表找文件，同一件只加载一次，克隆共用几何与材质 */
  const a = T.props.assets[id]; if (!a) return Promise.reject(new Error("props 里没有 " + id));
  return models[id] ||= gltf.loadAsync(new URL("./" + a.model, location.href).href).then((g) => {
    g.scene.traverse((o) => { if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true; o.userData.kind = a.kind;   /* 挡路按 kind：prop 按包围盒 */
      const m = o.material; if (m.map) m.map.anisotropy = 8;
      const g = /lantern/.test(m.name) ? ["#ffc890", 12] : /ember/.test(m.name) ? ["#ff6a1f", 5] : null;   /* 灯笼纸、篝火的炭：夜里自发光（同 Blender 看光） */
      if (g && !glowMats.includes(m)) { m.emissive = new THREE.Color(g[0]); m.userData.glow = g[1]; glowMats.push(m); } });
    return g.scene;
  });
}
/* 预设里单件模型：props 有 fit 的（Rodin 家具）按 objects 表占地缩放、原点落地、放到 Transform；没有模型的（shell: / procedural: / 未入库）出灰盒 */
async function placeModel(e, parent = scene, roomId = ROOM_ID) {
  const c = e.components, file = c.Model.file, asset = T.props.assets[file], obj = T.objects[c.Data?.object];
  let o;
  if (asset && /\.(gltf\.json|glb)$/.test(asset.model || "")) {
    o = (await model(file)).clone();
    if (asset.fit && obj?.footprint) {
      const fp = obj.footprint, t = c.Transform || {}; o.rotation.y = deg(t.rotY || 0);
      const b = new THREE.Box3().setFromObject(o), sz = b.getSize(new THREE.Vector3()), sy = fp.h / 100 / sz.y;
      o.scale.set(asset.fit.includes("w") ? fp.w / 100 / sz.x : sy, sy, asset.fit.includes("d") ? fp.d / 100 / sz.z : sy); b.setFromObject(o);
      o.position.set((t.x || 0) / 100 - (b.min.x + b.max.x) / 2, (t.y || 0) / 100 - b.min.y, (t.z || 0) / 100 - (b.min.z + b.max.z) / 2);
    } else applyT(o, c.Transform);
  } else if (obj?.data?.layout === "cubbies") {   /* 书墙：程序化格子架 + 按数据摆的书（render/shelf.js；数据现在是 sample.js，接 Baba 后换 S.data） */
    const api = await buildBookshelf(obj, BOOKS, DOMAINS, { books: "./packs/modern/books/", wood: "./packs/modern/tex/oak_veneer_", texURL }); o = api.group; applyT(o, c.Transform); shelves[e.id] = api;
  } else if (file === "shell:door") { return null;   /* 门：壳里已开门洞（近墙压低），不出灰盒挡镜头 */
  } else { o = greyBox(c.Data?.object || e.id, obj); applyT(o, c.Transform); }
  o.name = e.id; parent.add(o); props3d[e.id] = o;
  for (const [k, L] of Object.entries(c)) if (k.startsWith("Light") && L) { const def = L.fromObject ? obj?.light : L; if (def) addObjLight(o, e.id, def, roomId); }
  if (c.Light && !c.Light.fromObject) addLight(o, c.Light);
  return o;
}
const props3d = {}, objLights = {}, shelves = {};
/* 物件自带的灯（objects 表 light）：瓦数按 vis 的 physical.lights[实体 id]，亮不亮按 localLights */
function addObjLight(o, id, def, roomId) {
  const col = new THREE.Color(def.color), dist = (def.distance || 4);
  const l = def.type === "spot" ? new THREE.SpotLight(col, 0, dist * 2, deg(def.angle || 60) / 2, 0.5, 2) : new THREE.PointLight(col, 0, dist * 2, 2);
  const b = new THREE.Box3().setFromObject(o); l.position.set(0, (b.max.y - b.min.y) * 0.9 / Math.max(o.scale.y, 1e-6), 0);
  if (l.isSpotLight) { l.target.position.set(0, -1, 0.15); o.add(l.target); l.castShadow = !!def.shadow && TIER >= 2; l.shadow.mapSize.setScalar(512); }
  o.add(l); l.userData.room = roomId; objLights[id] = l;
}

async function placePrefab(e, parent = scene) {
  const pf = await getJSON("./" + e.components.Prefab.file), root = new THREE.Group(); applyT(root, e.components.Transform); root.name = e.id;
  await Promise.all(pf.entities.map(async (pe) => {
    const c = pe.components, o = c.Model ? (await model(c.Model.file)).clone() : new THREE.Group();
    applyT(o, c.Transform); o.name = pe.id; root.add(o);
    if (c.Model && c.Model.castShadow === false) o.traverse((m) => { m.castShadow = false; });
    if (c.Light) addLight(o, c.Light);
    if (c.Interact) interact[pe.id] = { o, I: c.Interact };
    if (!c.Interact && !c.Light) o.userData.static = true;
  }));
  mergeStatic(root);
  root.userData.collide = true; root.userData.fadeName = e.id;   /* 按真实模型挡路（sim/collide.js）；挡住角色时整栋淡出 */
  parent.add(root);
}
/* 静态件按材质合并（手机档优化）：偏屋 30 来个件、每件两三种材质，原来一件一种材质一个 draw call；同名材质（同一套贴图）的几何烘上变换后合成一个网格。
   门（交互）、灯笼（带灯）不合并。合并后同名材质只留一份，贴图也只上传一次。 */
function mergeStatic(root) {
  root.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), groups = new Map(), done = [];
  for (const o of root.children) {
    if (!o.userData.static) continue;
    o.traverse((m) => {
      if (!m.isMesh) return;
      const g = m.geometry, key = m.material.name + "|" + (m.userData.kind || "") + "|" + Object.keys(g.attributes).sort().join(",") + (g.index ? "|i" : "|n");
      const geo = g.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      if (!groups.has(key)) groups.set(key, { mat: m.material, geos: [], cast: false }); const G = groups.get(key); G.geos.push(geo); G.cast ||= m.castShadow;
    });
    done.push(o);
  }
  for (const o of done) root.remove(o);
  for (const [key, G] of groups) {
    const m = new THREE.Mesh(mergeGeometries(G.geos, false), G.mat); m.castShadow = G.cast; m.receiveShadow = true; m.name = "merged:" + key.split("|")[0]; m.userData.kind = key.split("|")[1]; root.add(m);
  }
}

/* ---------- 地面分层：土为底，草按分层图 R 混入，G 压暗（潮处、路）；大尺度明暗用两道正弦 ---------- */
function ground(e) {
  const G = e.components.Ground, S = G.size / 100, [L0, L1] = G.layers;
  const tex = (u, srgb, rep) => { const t = tl.load(new URL("./" + u, location.href).href); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.setScalar(rep); } return t; };
  const E = (G.extent || G.size) / 100, rep = (G.extent || G.size) / L0.tiling, geo = new THREE.PlaneGeometry(E, E); geo.rotateX(-Math.PI / 2);   /* 地面铺 extent，分层图只管中间 size，外圈沿用边缘值 */
  const mat = new THREE.MeshStandardMaterial({ map: tex(L0.alb, true, rep), normalMap: L0.nrm ? tex(L0.nrm, false, rep) : null, roughness: 0.95, metalness: 0 });
  const grass = tex(L1.alb, true, rep), mask = tex(G.mask, false, 0);
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { tGrass: { value: grass }, tMask: { value: mask }, uDamp: { value: G.damp ?? 0.4 }, uMaskSize: { value: S } });
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec2 vGUv; varying vec3 vGW;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvGUv = uv; vGW = (modelMatrix * vec4(position, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform sampler2D tGrass, tMask; uniform float uDamp, uMaskSize; varying vec2 vGUv; varying vec3 vGW;")
      .replace("#include <map_fragment>", `
        vec3 gm = texture2D(tMask, clamp(vec2(0.5 + vGW.x / uMaskSize, 0.5 - vGW.z / uMaskSize), 0.002, 0.998)).rgb;
        vec3 alb = mix(texture2D(map, vMapUv).rgb, texture2D(tGrass, vMapUv).rgb, gm.r);
        float macro = 0.96 + 0.07 * sin(vGW.x * 0.83 + 1.7) * sin(vGW.z * 0.71 + 0.4) + 0.04 * sin(vGW.x * 0.31 - vGW.z * 0.27);
        diffuseColor.rgb *= alb * (1.0 - uDamp * gm.g) * macro;`);
  };
  const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; applyT(m, e.components.Transform); m.position.y -= 0.001; m.name = "ground"; scene.add(m);
  groundExtent = E;
}

/* ---------- 散布：同种一个实例网格；表里是 Blender 的 (x, y) 平面，换成 three 的 (x, -y) ---------- */
async function scatter(e) {
  const C = e.components.Scatter, SC = await getJSON("./" + C.file), flip = C.axes === "blender" ? -1 : 1;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), s = new THREE.Vector3();
  for (const [cat, ids] of Object.entries(C.models)) {
    const rows = SC[cat] || [];
    for (let v = 0; v < ids.length; v++) {
      const mine = rows.map((r, i) => [r, i]).filter(([r]) => (r.length > 4 ? r[4] : 0) % ids.length === v); if (!mine.length) continue;
      let mesh = null; (await model(ids[v])).traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
      const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, mine.length); im.castShadow = true; im.receiveShadow = true; im.name = ids[v];
      im.userData.collide = true; im.userData.kind = T.props.assets[ids[v]]?.kind;
      mine.forEach(([r, i], k) => {
        p.set(r[0], 0, flip * r[1]); q.setFromAxisAngle(up, deg(r[2])); const z = r[3];
        if (cat === "tufts") s.set(z, z * (0.8 + 0.4 * ((i * 37) % 10) / 10), z); else if (cat === "stones") s.set(z, z, z * 0.8); else s.set(z, 1, z);
        im.setMatrixAt(k, m4.compose(p, q, s));
      });
      scene.add(im);
    }
  }
}

/* ---------- 时段：vis 的 camp:day / camp:night（物理单位，见 vis.mapping_camp） ---------- */
let period = Q.get("period") || "day";
function setPeriod(pd) {
  const phys = (id) => { const v0 = T.visFor(id, pd); return v0.units === "physical" ? v0 : { ...v0, ...(v0.physical || {}) }; };
  period = pd; const v = phys(SITE.id), d = new THREE.Vector3().fromArray(v.key.dir).normalize();   /* 整块场地用最外层房间的光；屋里的灯按各自房间的 localLights 开 */
  for (const [id, l] of Object.entries(objLights)) { const r = phys(l.userData.room); l.intensity = (r.localLights?.[id] ? (r.lights?.[id] ?? 30) * r.localLights[id] : 0) / (4 * Math.PI) * (v.localLightMul ?? 1); }
  sun.color.set(v.key.color); sun.intensity = v.key.power; sun.position.copy(d).multiplyScalar(-25); sun.target.position.set(0, 0, 0);
  hemi.color.set(v.ambient.sky); hemi.groundColor.set(v.ambient.ground); hemi.intensity = v.ambient.power * Math.PI;
  const mul = v.localLightMul ?? 1;
  for (const l of locals) l.intensity = l.userData.base = l.userData.periods.includes(pd) ? l.userData.power / (4 * Math.PI) * mul : 0;
  for (const m of glowMats) m.emissiveIntensity = m.userData.base = pd === "night" || pd === "dusk" ? m.userData.glow * mul : 0;
  for (const f of fires) f.setMode(f.def.modes?.[pd] || "off");
  scene.background = new THREE.Color(v.fog.color);
  if (composite) composite.setVis({ fogColor: v.fog.color, fogDensity: v.fog.density, fogStart: 30, vignette: v.vignette ?? 0.25, grade: [1, 1, 1], ao: v.ao, contrast: v.contrast ?? 1 });
  document.body.dataset.period = pd;
}

/* ---------- 机位：rooms.camp.stations（与 world.js shotTowards 同一约定：方位角从 +z 起算） ---------- */
let shot = Q.get("shot") || (ROOM.stations?.wide ? "wide" : null);
/* 机位按 16:10 横屏定；屏幕更窄（手机竖屏）时镜头往后退，让左右看到的范围不变，视场角不动（保住长焦的压缩感；放宽视场角会露出地面尽头，2026-11-05 试过） */
const REF_ASPECT = 1.6;
function setShot(k) {
  if (!k || !ROOM.stations?.[k]?.target) return; if (presence) presence.enabled = false;
  shot = k; const st = ROOM.stations[k], tg = new THREE.Vector3(...st.target.map((c) => c / 100)), a = deg(st.az), e = deg(st.el);
  const back = camera.aspect >= REF_ASPECT ? 1 : REF_ASPECT / camera.aspect, d = st.dist / 100 * back;
  camera.position.copy(tg).add(new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).multiplyScalar(d));
  camera.fov = st.fov; camera.near = Math.max(0.3, d - 15 * back); camera.far = d + 40 * back; camera.lookAt(tg); camera.updateProjectionMatrix();
}

/* ---------- 搭场景 ---------- */
const t0 = performance.now(); let ready = false;
/* 每间房一个挂点（场地坐标的原点平移），预设里的实体挂在各自房间下；没有预设的房间（院子）固定槽出灰盒 */
await Promise.all(PARTS.flatMap(({ room, off }) => {
  const parent = new THREE.Group(); parent.position.set(off[0] / 100, 0, off[1] / 100); parent.name = "room:" + room.id; scene.add(parent);
  const preset = T.presets[room.id];
  if (!preset) { parent.add(slotBoxes(room, T.objects)); return []; }
  return preset.entities.map((e) => {
    const c = e.components;
    if (c.Prefab) return placePrefab(e, parent);
    if (c.Model && c.Data) return placeModel(e, parent, room.id);
    if (c.Vfx) return getJSON("./" + c.Vfx.file).then((def) => { const f = new Fire(def); applyT(f.group, c.Transform); parent.add(f.group); fires.push(f); });
    if (c.Model) return model(c.Model.file).then((m) => { const o = m.clone(); applyT(o, c.Transform); o.name = e.id; o.userData.collide = true; parent.add(o); if (c.Light) addLight(o, c.Light); });
    if (c.Ground) return ground(e);
    if (c.Scatter) return scatter(e);
    if (c.Light) { const g = new THREE.Group(); applyT(g, c.Transform); parent.add(g); addLight(g, c.Light); }
    return null;
  });
}));
/* 壳（有瓦片墙的房间；场地的地板跳过套在里面的房间）与在场（有 follow 的房间） */
let presence = null; const shells = [];
const hasWalls = (r) => r.tiles?.walls?.some((w) => T.tiles.wall[w.type]?.segment !== "none");
const memberRects = PARTS.slice(1).map(({ room, off }) => ({ x0: off[0] - room.size.w / 2, x1: off[0] + room.size.w / 2, z0: off[1] - room.size.d / 2, z1: off[1] + room.size.d / 2 }));
const hasGround = (r) => !!T.presets[r.id]?.entities.some((e) => e.components.Ground);   /* 有地面分层的房间（院子）不画瓦片地板 */
for (const [i, { room, off }] of PARTS.entries()) if (hasWalls(room)) { const sh = buildShell(room, T.tiles, { offset: off, skip: i === 0 ? memberRects : [], floor: !hasGround(room) }); scene.add(sh.group); shells.push(sh); }
let nav = null;
if (ROOM.follow && !Q.get("shot")) {
  const grid = siteGrid(SITE, MEMBERS, T.rooms, T.objects, T.tiles);
  nav = buildNav(grid);
  const door = ROOM.door ? [ROOM.door.x + OFF[0], ROOM.size.d / 2 - 35 + OFF[1]] : [OFF[0], OFF[1]];
  /* 会挡住人的：墙段 + 高过 1.5 米的家具、树与房子（书墙 2.6 米，人走到屋后会被整个挡住；偏屋 3.75 米，人走到它北头时被屋顶挡住） */
  const tall = []; scene.traverse((o) => { const key = o.userData.objectId || o.userData.fadeName; if (!key) return; const b = new THREE.Box3().setFromObject(o); if (b.max.y - b.min.y >= 1.5) o.traverse((m) => { if (m.isMesh && !m.isInstancedMesh) { m.userData.side = key; m.userData.fadeKey = o.uuid; tall.push(m); } }); });
  /* 镜头分区：套在里面的房间（书房）内用它自己的 follow，其余用场地的（院子从西南看、拉远） */
  const view = (F = {}) => ({ az: F.az ?? 20, pitch: F.pitch ?? 40, frameH: (F.frameH ?? 420) / 100 });
  const zones = PARTS.slice(1).filter(({ room }) => room.follow).map(({ room, off }) => ({ id: room.id, rect: { x0: off[0] - room.size.w / 2, x1: off[0] + room.size.w / 2, z0: off[1] - room.size.d / 2, z1: off[1] + room.size.d / 2 }, ...view(room.follow) }));
  presence = new Presence({ scene, camera, dom: canvas, grid, room: ROOM, walls: [...shells.flatMap((s) => s.walls), ...tall], spawn: ROOM.walk?.spawn && ROOM === SITE ? ROOM.walk.spawn : door,
    base: { id: SITE.id, ...view(SITE.follow || ROOM.follow) }, zones });
}
/* 对焦站：各房间 stations 里有 trigger 的（书墙站先做；笔记本架、案头站接上内容后同法） */
const focusStations = PARTS.flatMap(({ room, off }) => Object.entries(room.stations || {}).filter(([, d]) => d.trigger && d.at && d.frame).map(([id, def]) => ({ id, def, off, room: room.id, content: shelves[def.entity] || null, light: stationLight(def.light, off) })));
/* 对焦站的读书灯（rooms 表 stations.<站>.light）：进站时亮起、出站熄灭，由 render/focus.js 控制强度；书墙在北墙阴影里，没有它站里中位明度只有 16 */
function stationLight(L, off) {
  if (!L) return null; const s = new THREE.SpotLight(new THREE.Color(L.color || "#ffe9cc"), 0, (L.distance || 800) / 100, deg(L.angle || 40), L.penumbra ?? 0.8, 2);
  s.position.set((L.x + off[0]) / 100, L.y / 100, (L.z + off[1]) / 100); s.target.position.set((L.at.x + off[0]) / 100, L.at.y / 100, (L.at.z + off[1]) / 100);
  s.castShadow = TIER >= 2 && !!L.shadow; s.shadow.mapSize.setScalar(1024); s.shadow.bias = -0.0005; s.shadow.normalBias = 0.02; s.userData.power = L.intensity ?? 40;
  scene.add(s, s.target); return s;
}
const focus = presence && focusStations.length ? new Focus({ camera, presence, dom: canvas, stations: focusStations, ui: { back: document.getElementById("back"), tag: document.getElementById("tag") }, occluders: Object.values(props3d) }) : null;
/* 寻路网盖上按真实模型算的挡路（world/sim/collide.js，人形巡检同一份）：收集不占槽位的实体的三角面（场地坐标，米），交互物件按 Interact.walk 的状态 */
function buildNav(grid) {
  const t0 = performance.now(), C = T.raw.characters.skeletons.humanoid.collider, col = { height: C.height / 100, radius: C.radius / 100, maxStep: C.maxStep / 100 };
  const saved = []; for (const [id, it] of Object.entries(interact)) if (it.I.walk) { saved.push([it.o, it.o.quaternion.clone()]); setState(id, it.I.walk); }
  scene.updateMatrixWorld(true);
  /* 一"件"一项（同巡检）：预制体里的每一件、单件模型整件、散布的每一个实例；kind 为 prop 的件按整件包围盒算 */
  const items = [], v = new THREE.Vector3(), m4 = new THREE.Matrix4(), units = [];
  scene.traverse((root) => { if (!root.userData.collide) return; if (root.isInstancedMesh) for (let k = 0; k < root.count; k++) units.push([root, k]); else if (root.userData.fadeName) for (const ch of root.children) units.push([ch]); else units.push([root]); });
  for (const [obj, k] of units) {
    const parts = [], meshes = []; let kind = null;
    obj.traverse((o) => { if (o.isMesh && !(o.material.alphaTest > 0)) meshes.push(o); });   /* 透明裁切（散草、茅草檐口的草帘）不挡 */
    for (const o of meshes) {
      const pos = o.geometry.attributes.position, idx = o.geometry.index, n = idx ? idx.count : pos.count, P = new Float64Array(n * 3);
      if (o.isInstancedMesh) { o.getMatrixAt(k, m4); m4.premultiply(o.matrixWorld); } else m4.copy(o.matrixWorld);
      for (let i = 0; i < n; i++) { v.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(m4); P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z; }
      parts.push(P); if (o.userData.kind === "prop" || !kind) kind = o.userData.kind;
    }
    if (!parts.length) continue;
    const tris = new Float64Array(parts.reduce((a, p) => a + p.length, 0)); let off = 0; for (const p of parts) { tris.set(p, off); off += p.length; }
    items.push({ id: obj.name + (k !== undefined ? "#" + k : ""), kind, tris });
  }
  for (const [o, q] of saved) o.quaternion.copy(q);
  scene.updateMatrixWorld(true);
  const W = SITE.size.w / 100, D = SITE.size.d / 100, before = grid.block.reduce((a, b) => a + b, 0);
  const R = rasterize(items, { x0: -W / 2, z0: -D / 2, w: W, d: D, res: 0.025 }, col, groundExtent), S = stamp(grid, R, col);
  return { items: items.length, tris: items.reduce((a, it) => a + it.tris.length / 9, 0), ms: Math.round(performance.now() - t0), bySlotOrWall: before, byModel: grid.block.reduce((a, b) => a + b, 0) - before, grid, why: S.why };
}
/* 交互门：角色走近（1.6 米内）推到 Interact.walk 的状态，走远回到摆放的状态；按角度缓动 */
const doors = Object.values(interact).filter((it) => it.I.walk && it.I.states?.[it.I.walk]).map((it) => ({ ...it, ang: it.I.states[it.I.default]?.rotY ?? 0, wp: new THREE.Vector3() }));
function doorsUpdate(dt) {
  if (!presence) return; const p = presence.walker.pos;
  for (const d of doors) {
    d.o.getWorldPosition(d.wp); const near = Math.hypot(d.wp.x * 100 - p[0], d.wp.z * 100 - p[1]) < 160;
    const goal = d.I.states[near ? d.I.walk : d.I.default]?.rotY ?? 0; if (Math.abs(goal - d.ang) < 0.05) continue;
    d.ang += (goal - d.ang) * (1 - Math.exp(-dt * 6)); d.o.rotation.set(0, deg(d.ang), 0);
  }
}
setPeriod(period);
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; if (shot && !presence?.enabled) setShot(shot); else camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();
let frames = 0, last = performance.now(), elapsed = 0;   /* 计时：three 的 Clock 在 0.186 已弃用 */
function frame() {
  renderer.info.reset();
  const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now; elapsed += dt; const t = elapsed;
  if (presence) { presence.update(dt); doorsUpdate(dt); }
  if (focus) focus.update(dt);
  for (const f of fires) f.update(t, camera, renderer.domElement.height);
  for (const l of locals) if (l.userData.flicker && l.userData.base) l.intensity = l.userData.base * (1 + l.userData.flicker * flicker(t, l.userData.seed));
  for (const m of glowMats) if (m.userData.base) m.emissiveIntensity = m.userData.base * (1 + 0.06 * flicker(t, 3.3));
  if (composite) composite.render(scene, camera); else renderer.render(scene, camera);
  if (++frames === 3) { ready = true; document.getElementById("st").textContent = stats(); }
  requestAnimationFrame(frame);
}
function gpu() { const g = renderer.getContext(), x = g.getExtension("WEBGL_debug_renderer_info"); return x ? g.getParameter(x.UNMASKED_RENDERER_WEBGL) : "?"; }
/* 已下载字节（同源资源的压缩后正文大小；缓存命中的不算） */
function bytes() { return performance.getEntriesByType("resource").reduce((s, r) => s + (r.encodedBodySize || 0), 0) + (performance.getEntriesByType("navigation")[0]?.encodedBodySize || 0); }
function stats() { const i = renderer.info.render; return `档位 ${TIER} · 贴图 ${TEX_LO ? "半分辨率" : "原分辨率"} · draw call ${i.calls} · 三角面 ${i.triangles.toLocaleString()} · 下载 ${(bytes() / 1e6).toFixed(1)} MB · 加载 ${((performance.now() - t0) / 1000).toFixed(1)} 秒${nav ? ` · 挡路 ${nav.ms} 毫秒` : ""} · ${gpu()}`; }
document.querySelectorAll("[data-period]").forEach((b) => b.addEventListener("click", () => setPeriod(b.dataset.period)));
document.querySelectorAll("[data-shot]").forEach((b) => b.addEventListener("click", () => setShot(b.dataset.shot)));
/* 人形巡检看图用（tools/tests/camp_shot.py --walk）：1.5 米灰色素模人形、地上一串蓝点标路线；坐标厘米，three 轴向 */
const figMat = new THREE.MeshStandardMaterial({ color: 0x8f8f8c, roughness: 0.8 });
function figure(x, z, rotY = 0) {
  const g = new THREE.Group(), body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.86, 6, 16), figMat), headM = new THREE.Mesh(new THREE.SphereGeometry(0.165, 20, 14), figMat);
  body.position.y = 0.16 + 0.43; headM.position.y = 1.5 - 0.165;   /* 胶囊 0 到 1.18 米，头顶 1.5 米 */
  for (const m of [body, headM]) { m.castShadow = m.receiveShadow = true; g.add(m); }
  g.position.set(x / 100, 0, z / 100); g.rotation.y = deg(rotY); g.name = "figure"; scene.add(g); return g;
}
function path(points) {
  const geo = new THREE.CircleGeometry(0.05, 12); geo.rotateX(-Math.PI / 2);
  const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0x3f6fd8 }), points.length), m4 = new THREE.Matrix4();
  points.forEach((p, i) => im.setMatrixAt(i, m4.makeTranslation(p[0] / 100, 0.02, p[1] / 100))); im.name = "walk-path"; scene.add(im); return im;
}
/* 回到跟随（离开对焦机位） */
function follow() { if (presence) { presence.enabled = true; presence.snap = true; shot = null; } }
/* 本房坐标 → 场地坐标（厘米） */
function at(roomId, x, z) { const p = PARTS.find((q) => q.room.id === roomId) || PARTS[0]; return [x + p.off[0], z + p.off[1]]; }
window.__play = window.__camp = { ready: () => ready, room: ROOM_ID, site: SITE.id, at, setPeriod, setShot, setState, figure, path, follow,
  walkTo: (x, z) => presence?.walkTo(x, z), presence: () => presence?.info() || null,
  doors: () => doors.map((d) => ({ id: d.o.name, ang: +d.ang.toFixed(1) })),
  focus: focus && { info: () => focus.info(), enter: (id, b = -1) => focus.enter(id, b), exit: () => focus.exit(),
    books: () => Object.values(shelves)[0]?.layout.books.map((b) => ({ i: b.i, title: b.title, dom: b.dom, state: b.state, cell: [b.c, b.r] })) || [],
    tag: () => { const t = document.getElementById("tag"); return t.hidden ? null : t.innerText; },
    /* 某本书书脊中心的屏幕坐标（页面像素）；whole：书墙中心 */
    screen: (i) => { const sh = Object.values(shelves)[0]; if (!sh) return null; const v = i === "whole" ? sh.face().center : sh.anchor(i).add(new THREE.Vector3(0, -sh.layout.books[i].h / 200, 0)); const p = v.project(camera); return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]; },
    /* 可读性：每本书脊在屏幕上的宽与一个字的高（像素，按设备像素） */
    legibility: () => { const sh = Object.values(shelves)[0], dpr = renderer.getPixelRatio(); return sh.layout.books.map((b, i) => { const c = sh.spineCorners(i).map((v) => v.project(camera)), w = Math.abs(c[1].x - c[0].x) / 2 * renderer.domElement.width, h = Math.abs(c[2].y - c[1].y) / 2 * renderer.domElement.height, G = sh.glyph(i);
      const vis = c.every((p) => Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1);   /* 整本在画面里 */
      return { i, w: +w.toFixed(1), charW: +(w * G.w).toFixed(1), charH: +(h * G.h).toFixed(1), char: +Math.min(w * G.w, h * G.h).toFixed(1), vis, dpr }; }); } },
  nav: () => nav && { cols: nav.grid.cols, rows: nav.grid.rows, cell: nav.grid.cell, bits: blockBits(nav.grid), items: nav.items, tris: nav.tris, ms: nav.ms, bySlotOrWall: nav.bySlotOrWall, byModel: nav.byModel },
  info: () => ({ ...renderer.info.render, tier: TIER, gpu: gpu(), texLo: TEX_LO, bytes: bytes(), files: performance.getEntriesByType("resource").length }), scene, renderer, camera };
frame();
