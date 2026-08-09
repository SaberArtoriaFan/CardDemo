---
id: kd_builtin_memory_user_preference
type: memory
path: user-preference.md
title: user-preference
injectMode: rule
summaryEnabled: false
commandEnabled: false
readOnly: false
aiMaintained: true
explicitMaintenanceRules: true
createdAt: 1786272797671
updatedAt: 1786274339371
---

# user-preference

<!-- locus:maintain-rules:start -->
- Record only long-term user preferences that stay stable across tasks
- Prioritize language, reporting style, code style, taboos, and explicit requirements
- Keep each entry short and limited to stable preferences or hard constraints
- Keep the list within 20 items and merge similar preferences
- Remove one-off arrangements, temporary phrasing, and unconfirmed inferences
<!-- locus:maintain-rules:end -->

<!-- locus:body:start -->
- 默认用中文沟通，回复保持简洁直接。
- 当前项目目标是单机卡牌游戏，不引入 TCGEngine 的多人/服务器架构作为核心方案。
- 不修改 `Assets/TcgEngine/` 现有内容。
- 新核心逻辑和项目代码必须放在独立目录，不写入 `Assets/TcgEngine/`。
- 需要复用 TCGEngine 内容时，先复制到项目自有目录，再在副本上修改。
<!-- locus:body:end -->
