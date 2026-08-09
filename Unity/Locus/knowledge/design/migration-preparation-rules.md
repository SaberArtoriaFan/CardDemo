---
id: kd_769f6d8b-9225-47db-93b1-c3417a435606
type: design
path: migration-preparation-rules.md
title: migration-preparation-rules
inheritInjectMode: true
summaryEnabled: true
commandEnabled: false
readOnly: false
inheritAiConfig: true
createdAt: 1786274339357
updatedAt: 1786275198819
---

# migration-preparation-rules

## Summary
单机卡牌项目迁移前期约束：TCGEngine仅作参考与可复制来源，不直接修改；新项目核心逻辑独立实现，并统一收口到 `Assets/Game/` 独立目录。

## Content
## 目标定位

- 本项目当前迁移目标是单机卡牌游戏。
- 可参考 TCGEngine 的通用卡牌能力与资源组织方式，但核心玩法逻辑、项目结构和代码实现以本项目自写为准。

## 边界约束

- 不直接修改 `Assets/TcgEngine/` 下的任何现有内容。
- 不把新业务代码写入 `Assets/TcgEngine/` 或 `TcgEngine.*` 命名空间。
- 若需复用 TCGEngine 的代码、Prefab、ScriptableObject、材质、贴图或配置，先复制到项目自有目录，再在副本上调整。
- 复制出的内容必须保持来源可追溯，避免后续混淆原件与项目副本。

## 架构原则

- 首期不接入 TCGEngine 的联网、服务器、账号、房间、匹配等多人流程。
- 新项目核心回合、卡牌规则、战斗结算、存档/进度等核心逻辑独立实现。
- 仅在确认依赖简单且收益明确时，才迁移 TCGEngine 的通用能力；优先迁移可独立复用的局部功能，而不是整体搬运系统。

## 目录原则

- 新项目代码、资源和配置统一放在 `Assets/Game/` 下，与 `Assets/TcgEngine/` 隔离。
- 复制自 TCGEngine 的项目内副本也放在 `Assets/Game/` 下，不回写原目录。
- 迁移准备阶段先固定使用 `Game` 作为项目自有��目录名，后续如需按正式产品名重命名，再统一处理。

## 目录规范

- `Assets/Game/Scenes/`：项目自有场景；若参考 TCGEngine 场景，复制后在这里维护。
- `Assets/Game/Scripts/Runtime/`：运行时代码，按业务域继续分层，如 `Core/`、`Cards/`、`Battle/`、`UI/`、`Data/`。
- `Assets/Game/Scripts/Editor/`：仅编辑器工具、迁移辅助脚本、数据导入工具。
- `Assets/Game/Prefabs/`：项目自有 Prefab。
- `Assets/Game/Data/`：项目自有 ScriptableObject、配置资产、静态表。
- `Assets/Game/UI/`：UI Prefab、UI 图集、UI 相关配置。
- `Assets/Game/Art/`：项目自有美术资源，按 2D、3D、VFX 等继续分层。
- `Assets/Game/Audio/`：音频资源与音频配置。
- `Assets/Game/Materials/`：项目自有材质与相关渲染资源。
- `Assets/Game/Imported/TcgEngine/`：从 TCGEngine 复制出来、尚在整理中的副本；用于明确区分“借鉴/迁移中资源”和“已沉淀为项目正式资源”。

## 命名空间与程序集规则

- 新代码暂定统一使用 `Game` 作为根命名空间，如 `Game.Core`、`Game.Cards`、`Game.Battle`、`Game.UI`。
- 编辑器代码使用 `Game.Editor` 或其子命名空间，不与运行时代码混放。
- 在正式开始写项目代码前，优先补建项目自有 asmdef；建议至少拆分 `Game.Runtime` 与 `Game.Editor`。
- `Game.Editor` 仅引用运行时代码，不允许反向依赖。
- 从 TCGEngine 复制出的代码在完成清理前，优先放入 `Assets/Game/Imported/TcgEngine/`；确认长期保留后，再迁入正式运行时目录并改为项目自有命名空间。

## 命名与组织约束

- 运行时代码优先按业务域分目录，不按“Utils/Helper/Misc”这类宽泛名字堆放。
- 临时迁移脚本、对照脚本、一次性工具放在 `Assets/Game/Scripts/Editor/`，完成后可删除，不进入运行时目录。
- 复制出的 TCGEngine 副本在文件夹名或相邻说明中保留来源信息，避免后续无法追踪出处。
- 除非 Unity 机制强制要求，否则不新增 `Resources/` 依赖；优先显式引用、Prefab 引用或独立数据入口。
- 场景名、Prefab 名、ScriptableObject 名使用清晰业务名，不沿用 TCGEngine 示例命名，除非该资源仍明确处于迁移中副本目录。
- 稳定后的正式资源不要长期留在 `Imported/TcgEngine` 目录；整理完成后应迁入 `Prefabs`、`Data`、`UI`、`Art` 等正式目录。

## 数据与依赖规则

- 项目自有运行时代码不得把 `Assets/TcgEngine/` 当作必需运行时依赖。
- 如果某项功能依赖 TCGEngine 资源，先确认能否通过复制、裁剪、去耦后独立使用。
- 单机流程所需的数据入口、卡牌定义、战斗配置、关卡配置统一沉淀到 `Assets/Game/Data/`。
- 新系统优先显式声明入口资产或入口 Prefab，避免把初始化分散在多个临时对象和示例场景里。

## 迁移流程规则

- 每次迁移先确认目标功能的最小可用范围，再决定是“参考实现”还是“复制后裁剪”。
- 迁移步骤固定为：确认来源 -> 评估依赖 -> 复制到 `Assets/Game/Imported/TcgEngine/` -> 去除多人/示例耦合 -> 验证可独立运行 -> 再决定是否迁入正式目录。
- 每次迁移都应记录来源、用途、是否已去除多人依赖，避免后续把 TCGEngine 当作运行时前置依赖。
- 优先先建立 `Assets/Game/` 目录边界，再开始复制或实现具体功能。
