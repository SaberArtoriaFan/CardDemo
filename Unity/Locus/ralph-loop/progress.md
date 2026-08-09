# Ralph Loop Progress

## Iteration 1
- 已完成首个工程落地检查点：在 `Assets/Game/Scripts/Runtime/` 下建立独立战斗领域基础代码骨架。
- 新增核心枚举与数据模型：`Side`、`CardType`、`KeywordType`、`CardDefinition`、`RuntimeCard`。
- 新增战斗流程/状态骨架：`BattlePhase`、`TurnMode`、`BattleWinner`、`BattleConstants`、`BattleState`、`SideState`、`BattleLogEntry`、`SlotResult`、`RoundSnapshot`、`SelectionState`。
- 新增命令层基础类型：`BattleCommandType`、`BattleCommand` 及 Place/Reorder/Replace/Confirm/StartResolution/NextRound/Reset 命令。

## Verification
- `unity_recompile` 成功。
- `unity_execute` 反射验证 `Game.Battle.BattleState.Create(20)` 成功，结果为 `round=1`、`phase=SetupRound`、双方生命值均为 `20`。

## Next Checkpoint
- 实现 BattleState 的回合预算与指令执行入口，先落地“首回合放 3 张、之后未满 6 张每回合放 1 张、满 6 张后切换 reorder/replace”的规则层。
## Iteration 1

Session: 836e4245-6318-4f9c-9e76-c9ff0cbc360a
Run: 836e4245-6318-4f9c-9e76-c9ff0cbc360a_1786275451274
Status: done

本轮完成了第一个工程检查点：已在 `Assets/Game/Scripts/Runtime/` 下建立独立战斗领域基础骨架，未改动 `Assets/TcgEngine/`。  
新增了卡牌/战斗核心类型：`Side`、`CardType`、`KeywordType`、`CardDefinition`、`RuntimeCard`、`BattleState`、`SideState` 以及基础命令模型。  
验证结果：`unity_recompile` 成功；`BattleState.Create(20)` 运行验证通过，得到 `round=1`、`phase=SetupRound`、双方 HP=20。  
进度已写入 `Locus/ralph-loop/progress.md`，项目理解已更新到 `memory/unity-project-understanding/migration-baseline.md`。  
下一检查点：实现回合预算和命令执行入口，先落地“首回合 3 张 / 未满 6 张每回合 1 张 / 满 6 张后 reorder 或 replace”的规则层。

