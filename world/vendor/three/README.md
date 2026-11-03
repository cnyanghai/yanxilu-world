three.js 0.186.1（MIT，见 LICENSE），来自 npm 包 three@0.186.1。
目录照 examples/jsm 的结构放在 addons/ 下，页面里用 importmap：
  "three": "../vendor/three/three.module.js", "three/addons/": "../vendor/three/addons/"
只带了用得上的：核心、GLTF/DRACO/KTX2 三个加载器及其依赖、OrbitControls（只在开发时用）。
