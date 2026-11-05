#!/usr/bin/env bash
# three.js 压缩版（营地页面用；2026-11-05）。0.186 起 npm 包不再带 .min.js，这里用系统自带的 terser（apt 包，/usr/bin/terser 5.19）
# 只做压缩（去空白与注释、改短局部变量名），保留许可证注释，不打包、不改模块结构。
# vendor 里的 three.core.js / three.module.js 与 npm three@0.186.0 逐字节一致；换版本时先更新这两个，再跑本脚本。
set -euo pipefail
cd "$(dirname "$0")/../world/vendor/three"
terser three.core.js --module --compress --mangle --comments '/@license|SPDX/' -o three.core.min.js
terser three.module.js --module --compress --mangle --comments '/@license|SPDX/' -o three.module.min.js.tmp
sed -E "s#(['\"])\./three\.core\.js(['\"])#\1./three.core.min.js\2#g" three.module.min.js.tmp > three.module.min.js && rm three.module.min.js.tmp
grep -q 'three.core.min.js' three.module.min.js || { echo "three.module.min.js 没改到 three.core.min.js 的引用"; exit 1; }
ls -la three.core.min.js three.module.min.js
