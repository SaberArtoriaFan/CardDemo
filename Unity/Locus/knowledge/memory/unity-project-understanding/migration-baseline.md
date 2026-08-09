---
id: kd_2bfe3a27-7486-47c7-9879-6c10ab129683
type: memory
path: unity-project-understanding/migration-baseline.md
title: migration-baseline
inheritInjectMode: true
summaryEnabled: true
commandEnabled: false
readOnly: false
inheritAiConfig: true
createdAt: 1786274339391
updatedAt: 1786275723651
---

# migration-baseline

## Summary
当前工程仍以 TCGEngine 示例内容为主体，但 `Assets/Game/` 已建立独立目录、程序集和首批战斗领域基础运行时代码。

<!-- locus:body:start -->
- 当前项目自有基础目录已建立在 `Assets/Game/`。
- 当前 `Assets/Game/` 已建立首批分层：`Scenes/`、`Prefabs/`、`Data/`、`UI/`、`Art/`、`Audio/`、`Materials/`、`Imported/TcgEngine/`、`Scripts/Runtime/`、`Scripts/Editor/`。
- `Assets/Game/Scripts/Runtime/` 下已预建 `Core/`、`Cards/`、`Battle/`、`UI/`、`Data/` 子目录。
- 已创建项目自有程序集定义：`Assets/Game/Scripts/Runtime/Game.Runtime.asmdef` 与 `Assets/Game/Scripts/Editor/Game.Editor.asmdef`。
- `Game.Editor` 当前仅引用 `Game.Runtime`，符合编辑器层单向依赖运行时层的约束。
- 已建立首批核心运行时领域模型：`Game.Core.Side`、`Game.Cards.CardType`、`Game.Cards.KeywordType`、`Game.Data.CardDefinition`、`Game.Cards.RuntimeCard`。
- 已建立首批战斗状态与命令骨架：`Game.Battle.BattlePhase`、`TurnMode`、`BattleWinner`、`BattleState`、`SideState`、`BattleLogEntry`、`SlotResult`、`RoundSnapshot`、`SelectionState` 与 `Game.Battle.Commands` 下的基础命令类型。
- 当前 `BattleState.Create(int startingHp)` 已可成功构造初始对局状态，默认 round=1、phase=`SetupRound`，并为玩家/敌方写入初始生命值。
- `Assets/TcgEngine/` 下仍保留完整示例资源与脚本分层：`AI`、`Api`、`Data`、`Effects`、`GameClient`、`GameLogic`、`GameServer`、`Network`、`UI` 等，后续仅作为参考与复制来源。
- 后续迁移工作可在 `Assets/Game/` 边界内继续补齐规则层、命令执行、结算流程、AI 与原型场景。
<!-- locus:body:end -->
