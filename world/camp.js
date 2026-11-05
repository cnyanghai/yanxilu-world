/* 营地小试（宋代田园包第一次进引擎，2026-11-05）：读表与预设，搭地面分层 + 散布 + 预制体（茅草偏屋）+ 灯，按 vis 切白天 / 夜晚。
   和 world.js（现代书房，烘焙无光照）不同：这里是实时光照的 PBR —— 一盏平行光带阴影、半球天光、局部点光、合成后期里的环境遮蔽。
   网址参数：?shot=wide|close|detail&period=day|night&sw=1（软件渲染：不开多重采样）。单位：表里厘米，场景里米；three 轴向，偏屋正面朝 -z。 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { loadTables } from "./data/tables.js";
import { detectTier } from "./render/tiers.js";
import { Composite } from "./render/post.js";

const Q = new URLSearchParams(location.search);
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: true });
renderer.setPixelRatio(Q.has("shot") ? 1 : Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;   /* 0.186 起 PCFSoft 已去掉，回退到这个 */
renderer.toneMapping = THREE.AgXToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
const EXPOSURE = 0.33;                                   /* 全时段恒定（vis.mapping_camp）；Blender 白天是 -1.15 档（0.45），three 的天光无遮挡、AgX 实现也不同，真显卡量过后压到 0.33 */
renderer.toneMappingExposure = EXPOSURE; renderer.info.autoReset = false;   /* draw call 按整帧累计（场景 + 阴影 + 合成） */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(9.5, 1.6, 1, 200);
const T = await loadTables("./");
if (T.problems.length) console.warn("表校验问题", T.problems);
const ROOM = T.rooms.camp, PRESET = T.presets.camp;
const isMobile = Math.min(innerWidth, innerHeight) < 700;
const TIER = detectTier(renderer, { isMobile });
const composite = TIER >= 1 ? new Composite(renderer, { samples: Q.get("sw") ? 0 : 4 }) : null;
const gltf = new GLTFLoader(), tl = new THREE.TextureLoader();
const getJSON = (u) => fetch(u, { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); });
const deg = THREE.MathUtils.degToRad;

/* ---------- 光：平行光（太阳 / 月亮，带阴影）+ 半球天光 + 局部点光 ---------- */
const sun = new THREE.DirectionalLight(0xffffff, 1); scene.add(sun, sun.target);
sun.castShadow = true; sun.shadow.mapSize.setScalar(TIER >= 2 ? 4096 : 2048);
Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 60 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); scene.add(hemi);
const locals = [], glowMats = [];
function addLight(parent, L) {
  const pl = new THREE.PointLight(new THREE.Color().setRGB(L.color[0], L.color[1], L.color[2], THREE.SRGBColorSpace), 0, 0, 2);
  pl.userData = { power: L.power, periods: L.periods || ["dawn", "day", "dusk", "night"] }; parent.add(pl); locals.push(pl); return pl;
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
  return models[id] ||= gltf.loadAsync("./" + a.model).then((g) => {
    g.scene.traverse((o) => { if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true;
      const m = o.material; if (m.map) m.map.anisotropy = 8;
      const g = /lantern/.test(m.name) ? ["#ffc890", 12] : /ember/.test(m.name) ? ["#ff6a1f", 5] : null;   /* 灯笼纸、篝火的炭：夜里自发光（同 Blender 看光） */
      if (g && !glowMats.includes(m)) { m.emissive = new THREE.Color(g[0]); m.userData.glow = g[1]; glowMats.push(m); } });
    return g.scene;
  });
}
async function placePrefab(e) {
  const pf = await getJSON("./" + e.components.Prefab.file), root = new THREE.Group(); applyT(root, e.components.Transform); root.name = e.id;
  await Promise.all(pf.entities.map(async (pe) => {
    const c = pe.components, o = c.Model ? (await model(c.Model.file)).clone() : new THREE.Group();
    applyT(o, c.Transform); o.name = pe.id; root.add(o);
    if (c.Model && c.Model.castShadow === false) o.traverse((m) => { m.castShadow = false; });
    if (c.Light) addLight(o, c.Light);
  }));
  scene.add(root);
}

/* ---------- 地面分层：土为底，草按分层图 R 混入，G 压暗（潮处、路）；大尺度明暗用两道正弦 ---------- */
function ground(e) {
  const G = e.components.Ground, S = G.size / 100, [L0, L1] = G.layers;
  const tex = (u, srgb, rep) => { const t = tl.load("./" + u); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
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
  period = pd; const v = T.visFor("camp", pd), d = new THREE.Vector3().fromArray(v.key.dir).normalize();
  sun.color.set(v.key.color); sun.intensity = v.key.power; sun.position.copy(d).multiplyScalar(-25); sun.target.position.set(0, 0, 0);
  hemi.color.set(v.ambient.sky); hemi.groundColor.set(v.ambient.ground); hemi.intensity = v.ambient.power * Math.PI;
  const mul = v.localLightMul ?? 1;
  for (const l of locals) l.intensity = l.userData.periods.includes(pd) ? l.userData.power / (4 * Math.PI) * mul : 0;
  for (const m of glowMats) m.emissiveIntensity = pd === "night" || pd === "dusk" ? m.userData.glow * mul : 0;
  scene.background = new THREE.Color(v.fog.color);
  if (composite) composite.setVis({ fogColor: v.fog.color, fogDensity: v.fog.density, fogStart: 30, vignette: v.vignette ?? 0.25, grade: [1, 1, 1], ao: v.ao, contrast: v.contrast ?? 1 });
  document.body.dataset.period = pd;
}

/* ---------- 机位：rooms.camp.stations（与 world.js shotTowards 同一约定：方位角从 +z 起算） ---------- */
let shot = Q.get("shot") || "wide";
function setShot(k) {
  shot = k; const st = ROOM.stations[k], tg = new THREE.Vector3(...st.target.map((c) => c / 100)), a = deg(st.az), e = deg(st.el);
  camera.position.copy(tg).add(new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).multiplyScalar(st.dist / 100));
  camera.fov = st.fov; camera.near = Math.max(0.3, st.dist / 100 - 15); camera.far = st.dist / 100 + 40; camera.lookAt(tg); camera.updateProjectionMatrix();
}

/* ---------- 搭场景 ---------- */
const t0 = performance.now(); let ready = false;
await Promise.all(PRESET.entities.map((e) => {
  const c = e.components;
  if (c.Prefab) return placePrefab(e);
  if (c.Model) return model(c.Model.file).then((m) => { const o = m.clone(); applyT(o, c.Transform); o.name = e.id; scene.add(o); if (c.Light) addLight(o, c.Light); });
  if (c.Ground) return ground(e);
  if (c.Scatter) return scatter(e);
  if (c.Light) { const g = new THREE.Group(); applyT(g, c.Transform); scene.add(g); addLight(g, c.Light); }
  return null;
}));
setPeriod(period); setShot(shot);
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();
let frames = 0;
function frame() {
  renderer.info.reset();
  if (composite) composite.render(scene, camera); else renderer.render(scene, camera);
  if (++frames === 3) { ready = true; document.getElementById("st").textContent = stats(); }
  requestAnimationFrame(frame);
}
function gpu() { const g = renderer.getContext(), x = g.getExtension("WEBGL_debug_renderer_info"); return x ? g.getParameter(x.UNMASKED_RENDERER_WEBGL) : "?"; }
function stats() { const i = renderer.info.render; return `档位 ${TIER} · draw call ${i.calls} · 三角面 ${i.triangles.toLocaleString()} · 加载 ${((performance.now() - t0) / 1000).toFixed(1)} 秒 · ${gpu()}`; }
document.querySelectorAll("[data-period]").forEach((b) => b.addEventListener("click", () => setPeriod(b.dataset.period)));
document.querySelectorAll("[data-shot]").forEach((b) => b.addEventListener("click", () => setShot(b.dataset.shot)));
window.__camp = { ready: () => ready, setPeriod, setShot, info: () => ({ ...renderer.info.render, tier: TIER, gpu: gpu() }), scene, renderer };
frame();
