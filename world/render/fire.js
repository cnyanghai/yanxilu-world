/* 渲染层：程序化的火（营地小试，2026-11-05）。不用任何贴图素材：
   - 火焰：几片交叉的竖面，片元着色器里用分形噪声往上翻滚、收尖，根部白黄、往上橙红，叠加混合（不写深度，不挡环境遮蔽）；
   - 火星：一把点精灵，每颗按自己的种子循环上升、左右晃、变小变暗；
   - 烟：一片始终朝向镜头的竖面（只绕竖轴转），噪声做出往上飘散的烟柱，普通混合。
   定义来自 packs/<包>/vfx/<名>.json（预设里 Vfx 组件指过去）；mode 三档：off 灭、smolder 余烬冒烟、burn 烧旺。 */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const NOISE = `
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
  float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; } return v; }`;

/* 几片火焰面合成一个网格（手机档省 draw call，2026-11-05）：每片的随机种子放在顶点属性 aSeed 里 */
function flameMaterial(def) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uIntensity: { value: def.intensity ?? 6 }, uLevel: { value: 1 },
                uLow: { value: new THREE.Color(def.colors?.[0] ?? "#ff3a08") }, uMid: { value: new THREE.Color(def.colors?.[1] ?? "#ff9a2e") },
                uHot: { value: new THREE.Color(def.colors?.[2] ?? "#fff0b8") } },
    vertexShader: `attribute float aSeed; varying vec2 vUv; varying float vSeed; void main(){ vUv = uv; vSeed = aSeed; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime, uIntensity, uLevel; uniform vec3 uLow, uMid, uHot; varying vec2 vUv; varying float vSeed; ${NOISE}
      void main(){
        float uSeed = vSeed;
        /* 噪声减高度：噪声高的地方火舌蹿得高，往上自然断开成几条；外包络底宽上窄 */
        float t = uTime * 1.6 + uSeed * 7.3, x = (vUv.x - 0.5) * 2.0, y = vUv.y / max(uLevel, 0.05);
        float n = fbm(vec2(x * 2.2 + uSeed * 3.1, y * 2.6 - t)) + 0.35 * fbm(vec2(x * 5.0 - uSeed, y * 5.0 - t * 1.8));
        float env = 1.0 - smoothstep(0.25, 0.95, abs(x) + y * 0.55);
        float f = env * (n * 1.2 - y * 1.55 + 0.3) * smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.8, 1.0, vUv.y));   /* 顶端留余量，不会被面片边切平 */
        float body = smoothstep(0.06, 0.26, f), core = smoothstep(0.3, 0.62, f);
        vec3 col = mix(uLow, uMid, smoothstep(0.06, 0.38, f)); col = mix(col, uHot, core);
        gl_FragColor = vec4(col * uIntensity, body);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: true,
  });
}

function smokeMaterial(def) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: new THREE.Color(def.color ?? "#5a5a58") } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime, uOpacity; uniform vec3 uColor; varying vec2 vUv; ${NOISE}
      void main(){
        float t = uTime * 0.35;
        float drift = (fbm(vec2(vUv.y * 1.5 - t * 0.6, 3.1)) - 0.5) * 0.7 * vUv.y;   /* 烟柱往上飘、往一边歪 */
        float x = (vUv.x - 0.5) * 2.0 - drift;
        float w = mix(0.12, 0.85, vUv.y);
        float puff = fbm(vec2(vUv.x * 4.0, vUv.y * 3.0 - t * 2.0));
        float a = (1.0 - smoothstep(w * 0.3, w, abs(x))) * smoothstep(0.0, 0.12, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y)) * smoothstep(0.25, 0.62, puff);
        gl_FragColor = vec4(uColor, a * uOpacity);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
}

function sparks(def) {
  const n = def.count ?? 40, seed = new Float32Array(n);
  for (let i = 0; i < n; i++) seed[i] = Math.random();
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uRise: { value: def.rise ?? 1.6 }, uRadius: { value: def.radius ?? 0.18 }, uSize: { value: def.size ?? 0.03 },
                uScale: { value: 500 }, uIntensity: { value: def.intensity ?? 8 }, uOn: { value: 1 } },
    vertexShader: `uniform float uTime, uRise, uRadius, uSize, uScale, uOn; attribute float aSeed; varying float vLife;
      void main(){
        float life = fract(uTime * (0.35 + aSeed * 0.4) + aSeed * 13.0); vLife = life;
        float a = aSeed * 40.0 + uTime * (0.6 + aSeed);
        vec3 p = vec3(cos(aSeed * 91.0) * uRadius * (1.0 - life * 0.5) + sin(a) * 0.08 * life, 0.15 + life * uRise, sin(aSeed * 57.0) * uRadius * (1.0 - life * 0.5) + cos(a * 1.3) * 0.08 * life);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = uOn * uSize * (1.0 - life) * uScale / -mv.z;
      }`,
    fragmentShader: `uniform float uIntensity; varying float vLife;
      void main(){ vec2 c = gl_PointCoord - 0.5; float d = 1.0 - smoothstep(0.15, 0.5, length(c));
        vec3 col = mix(vec3(1.0, 0.55, 0.15), vec3(0.9, 0.18, 0.03), vLife); gl_FragColor = vec4(col * uIntensity * (1.0 - vLife * 0.8), d); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false; return p;
}

export class Fire {
  constructor(def) {
    this.def = def; this.group = new THREE.Group(); this.group.name = "vfx-" + (def.id || "fire"); this.mode = "off";
    const F = def.flame, S = def.smoke;
    const n = F.planes ?? 3, planes = [];
    for (let i = 0; i < n; i++) {
      const g = new THREE.PlaneGeometry(F.radius * 2, F.height); g.translate(0, F.height / 2 + (F.base ?? 0), 0); g.rotateY((Math.PI / n) * i);
      g.setAttribute("aSeed", new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(i * 1.37 + 0.2), 1)); planes.push(g);
    }
    const fm = new THREE.Mesh(mergeGeometries(planes), flameMaterial(F)); fm.renderOrder = 10; fm.frustumCulled = false;
    this.group.add(fm); this.flames = [fm];
    this.sparks = def.sparks ? sparks(def.sparks) : null; if (this.sparks) { this.sparks.renderOrder = 11; this.group.add(this.sparks); }
    this.smoke = null;
    if (S) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(S.width, S.height), smokeMaterial(S)); m.geometry.translate(0, S.height / 2 + (S.base ?? 0.2), 0);
      m.renderOrder = 9; m.frustumCulled = false; this.smoke = m; this.group.add(m);
    }
  }
  /* mode：off / smolder / burn（由 def.modes 按时段给） */
  setMode(mode) {
    this.mode = mode;
    const burn = mode === "burn", smolder = mode === "smolder";
    for (const f of this.flames) { f.visible = burn; }
    if (this.sparks) this.sparks.visible = burn;
    if (this.smoke) { this.smoke.visible = burn || smolder; this.smoke.material.uniforms.uOpacity.value = burn ? (this.def.smoke.burnOpacity ?? 0.18) : (this.def.smoke.opacity ?? 0.35); }
  }
  update(t, camera, pixelHeight) {
    for (const f of this.flames) f.material.uniforms.uTime.value = t;
    if (this.sparks) { const u = this.sparks.material.uniforms; u.uTime.value = t; u.uScale.value = pixelHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)); }
    if (this.smoke) {   /* 烟片只绕竖轴转，始终正对镜头 */
      this.smoke.material.uniforms.uTime.value = t;
      const p = new THREE.Vector3(); this.smoke.getWorldPosition(p); this.smoke.rotation.y = Math.atan2(camera.position.x - p.x, camera.position.z - p.z);
    }
  }
}

/* 火光闪烁：两三个不同频率的正弦叠起来，0 附近摆动，乘到灯的强度上 */
export function flicker(t, seed = 0) {
  return 0.55 * Math.sin(t * 7.3 + seed) + 0.3 * Math.sin(t * 13.1 + seed * 2.1) + 0.15 * Math.sin(t * 23.7 + seed * 3.7);
}
