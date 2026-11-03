# 研习录·小世界（yanxilu-world）· 给 Claude Code 的项目说明

这是研习录的版本 2：一个可以养的三维小世界（书房、小院，以后是小镇），学习、养成、种植、社交。2026-11-02 从 `cnyanghai/yanxilu`（书架网页，版本 1）拆出来单独成仓库；两个项目共用 Baba 的数据接口，代码互不引用。线上演示在 https://baba.wogucloud.cn/world （Baba 另克隆本仓库，在书架克隆里放一个 `world` 链接；推到 main 就是上线）。

## 先读什么

- `STATUS.md`：进度的唯一事实源，先读它。`REFERENCES.md`：参考与结论。
- `design/PRODUCTION-PLAN.md`：**唯一的计划**，里程碑、门、预算、待办区；会话开头先报现在在哪一步、这次做哪个交付物，新想法进待办区不打断当前阶段。评审会与里程碑定义在 `design/studio/REVIEW-1.md`。
- `design/studio/PIPELINE.md`：生产流程 1.0（草案）。`design/studio/REHEARSAL.md`：用暗黑 2 的资产把它的流程排练一遍的记录与结论。
- `design/ART-BIBLE.md`（风格）、`design/ASSET-SPEC.md`（尺寸、槽位、面数、交付定义）：做任何资产前先读。
- `design/D2R-DISSECTION.md`：暗黑 2 重制版的制作拆解（表、预设、预制体、vis、状态机、时间线、文件格式）。
- `design/MASTER-PLAN.md`、`design/BRIEF.md`、`design/SCOPE.md`：总体方案、气质与范围。
- `design/TECH-NOTES.md`：技术卡，每张对应工坊面板的一个开关；引入新技术要加卡。
- `design/studio/README.md`：团队建制（照暗黑 2 的岗位分岗提案、评审合成），代理怎么用。

## 代码结构

- `world/`：小世界（WebGL，three.js 0.186 自带在 `vendor/three/`，importmap 引用，不打包不引框架不走 CDN）。`index.html` 外壳与 HUD，`world.js` 全部逻辑，`sample.js` 样例数据，`assets/` 是 Blender 烘焙的壳，`packs/<包>/<类>/<id>/` 一件资产一个目录加定义 JSON。按反引号键或 `?dev=1` 开「工坊」面板。
- `world/data/`：九张表（objects、rooms、vis、props、items、economy、sound、tiles、characters）+ `presets/`（实体-组件预设）+ `schema/`（draft-07）。单位厘米整数。代码只读表：`world/data/tables.js`。`world/sim/grid.js` 格子与寻路，`world/render/{post,tiers}.js` 合成后期与硬件分档。
- `room/`：CSS 3D 书房样机（早期），版本 2 第 3 步后归档。`studies/`：临摹练习。
- `tools/`：`asset_import.py`（资产入库一条命令）、`asset_shrink.py`、`fal_image3d.py`（Rodin）、`paint_texture.py`、`tables_check.py`（Schema + 交叉引用 + 格子校验，**测试前置**）、`d2_decode.py`（暗黑 2 图像格式，仅本机研究）、`blender/`（`study_scene.py` 场景、`bake_study.py` 烘焙、`bake.sh` 一键，优先 Windows 侧 Blender 4.5 显卡）、`baba_mock.py`（本地模拟 Baba 静态与接口）、`tests/`（`world_test.py` 四景别三种光截图、`paint_verify.py`、`sim_test.mjs`）。
- `tools/out/`：全部本机产物（截图、解包、研究），gitignore。`tools/out/d2r_local/` 是暗黑 2 的研究产物，永不入库，`tables_check` 会拦任何引用它的已跟踪文件。
- 数据：现在是 `sample.js`；接 Baba 时走 `/api/yxl/*`，和书架项目共用一个账号的数据。

## 怎么测

```
python3 tools/tables_check.py              # 表校验（先跑）
python3 tools/baba_mock.py 8790            # 本地静态与接口（另开终端）
python3 tools/tests/world_test.py          # 四景别截图、三种光、draw call 数（自己起模拟服务器，约 3 分钟，单独跑）
bash tools/blender/bake.sh                 # 重新烘焙壳（约 10 分钟，显卡）
```
Windows 上 `python3` 换 `python`。截图在 `tools/out/`。gltf-transform 要 node ≥ 22（`~/.nvm/versions/node/v24*`）。

## 规矩（人定的，不要改）

- 每次改完同步到 GitHub（提交并推送 main，先 fetch 变基）；永远不要 force-push。
- 回复用简体中文。
- 博采众长：游戏（暗黑 2、炉石、魔兽、恶意不息、kriss）的机制、结构、数据表、制作流程、光与镜头都拆开学；但**不把任何一家的资产（贴图、模型、图标、字体、音效、原文）放进仓库和产品**。拆解研究时可以在本机读它们的文件。
- 生图前先报模型、单价、张数、完整提示词；打分按绝对画质，先量明度与贴图密度。
- 用户只在看得见的事上做决定；技术决定由 Claude 做、记录、可逆。
- 提交用 `git -c user.name="cnyanghai" -c user.email="usyanghai86@gmail.com" commit`，提交信息用中文，结尾带 `Co-Authored-By: Claude <模型名> <noreply@anthropic.com>`。
- 不打印、不传递任何密钥（FAL_KEY 在 `~/brain/.env`，脚本自己读）；不碰 nginx 的 80/443；Baba 的部署由人跑，Claude 不部署。
- 用户重度色弱：图不靠红绿区分；笔记不加 emoji。
