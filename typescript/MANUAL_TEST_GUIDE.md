# Mini-CC 生产版本手动测试指南

文档对应关系：
- 产品说明：README.md
- 快速冒烟：QUICK_TEST.md
- 完整手测：你正在阅读的 MANUAL_TEST_GUIDE.md
- 版本变更：CHANGELOG.md

## 📋 测试准备（必做）

### 1. 环境检查
```bash
cd typescript
pnpm install
pnpm run build
pnpm test
```

### 2. 启动 mini-cc
```bash
pnpm start
```

（截图占位：启动欢迎页 / WelcomeBanner）

---

## 🧪 测试流程（生产关键路径）

### 测试 1：权限系统（默认安全 + 可预审批）

**目标**：确认敏感工具默认拒绝，授权后可执行，并能查看权限状态

1) 输入：`/permissions`  
预期：显示策略、allow/deny 列表、hard_deny 信息

2) 输入：`请用 BashTool 执行 echo hello`  
预期：被拒绝，并提示使用 `/allow BashTool`

3) 输入：`/allow BashTool`  
再输入：`请用 BashTool 执行 echo hello`  
预期：执行成功并输出 `hello`

4) 输入：`/deny BashTool`  
再输入：`请用 BashTool 执行 echo hello`  
预期：再次被拒绝

（截图占位：权限拒绝提示 + /allow 授权 + /deny 禁止）

**✅ 验证点**
- [ ] 默认拒绝敏感工具（BashTool/FileWriteTool/FileEditTool/AgentTool/NotebookEdit）
- [ ] /allow 与 /deny 生效
- [ ] /permissions 输出正确

---

### 测试 2：Provider 热切换（会话级/全局级）

**目标**：无需重启切换 provider，并且切换后上下文被正确清空

1) 输入：`/provider`  
预期：显示当前 provider + 可用 provider 列表

2) 输入：`/provider openai -s` 或 `/provider anthropic -s`  
预期：提示“已切换”，并清空会话（历史消息归零）

（截图占位：/provider 列表与切换成功提示）

**✅ 验证点**
- [ ] 会话级切换成功（无需重启）
- [ ] 切换后上下文清空，避免混聊

---

### 测试 3：工具生态（核心能力覆盖）

**目标**：覆盖“读/搜/编/写/网/任务/代码智能/Notebook”等关键工具

#### 3.1 只读工具（无需授权）
- 输入：`请读取 package.json 并告诉我 version 字段`
- 预期：调用 FileReadTool

#### 3.2 搜索工具（无需授权）
- 输入：`请用 GrepTool 搜索 src 下出现 "createAgent(" 的位置，显示 3 行上下文`
- 预期：调用 GrepTool

#### 3.3 编辑/写入工具（需要 /allow）
- 输入：`请把 README.md 的标题下方增加一行 "test line"（用 FileEditTool）`
- 预期：未 /allow 时被拒绝；`/allow FileEditTool` 后可执行

#### 3.4 网络工具（无需授权，依赖网络）
- 输入：`请用 WebFetchTool 获取 https://example.com 的标题`
- 输入：`请用 WebSearchTool 搜索 "TypeScript 5.0 release notes" 返回 3 条`

#### 3.5 任务工具（无需授权）
- 输入：`请创建任务：实现登录页`
- 输入：`列出当前所有任务`

#### 3.6 代码智能与 Notebook（NotebookEdit 需要 /allow）
- 输入：`请用 LSPTool 列出 src/application/QueryEngine.ts 中的符号`
- NotebookEdit：参考 QUICK_TEST 脚本生成的 `/tmp/*.ipynb` 文件，然后：
  - `/allow NotebookEdit`
  - `请在 /tmp/test_manual_notebook.ipynb 中添加一个 code cell：print("Hello")`

---

### 测试 4：技能系统（内置 + 自定义）

**目标**：技能列表可见、可激活、激活后 prompt 注入生效；可加载用户自定义技能

1) 输入：`/skill`  
预期：能看到 remember/simplify/verify 等

2) 输入：`/skill simplify`  
再输入：`把下面这段话用更简单的方式表达：......`  
预期：回答风格/约束发生变化（说明注入生效）

3) 自定义技能（可选）
- 创建 `~/.mini-cc/skills/my_style.json`：
```json
{
  "name": "my_style",
  "displayName": "我的输出风格",
  "description": "强制用要点列表输出，避免长段落",
  "category": "workflow",
  "prompt": "接下来所有回复请使用要点列表输出，避免长段落。",
  "tags": ["style"]
}
```
- 重启 mini-cc
- 输入：`/skill my_style`
- 预期：技能出现在列表里并可激活

（截图占位：/skill 列表 + 激活提示）

**✅ 验证点**
- [ ] /skill 列表可用
- [ ] 激活技能后注入生效
- [ ] 自定义技能可加载（重启后生效）

---

### 测试 5：MCP 插件（动态工具加载）

**目标**：启动时连接 MCP server，并将远端工具注册进工具列表（模型可调用）

建议用仓库自带示例：`examples/mcp-servers/weather.js`（Node）。

1) 创建项目级 MCP 配置 `<project>/.mini-cc/settings.json`（示例）：
```json
{
  "mcpServers": {
    "weather": {
      "command": "node",
      "args": ["examples/mcp-servers/weather.js"]
    }
  }
}
```

2) 启动 mini-cc，观察日志  
预期：出现 `[MCP] 已连接 ... 注册 ... 个工具`

3) 提示模型使用 MCP 工具（示例）：  
输入：`请调用天气 MCP 工具查询 Shanghai 的天气`  
预期：模型触发 `mcp__weather__...` 工具调用并返回结果

（截图占位：启动日志 + MCP tool 调用记录）

**✅ 验证点**
- [ ] 启动时能连接 MCP
- [ ] 工具被注册并可被模型调用
- [ ] 退出应用后 MCP 连接被关闭（无残留进程/无持续输出）

---

## 🧯 故障排查（发布前常见）

- 工具被拒绝：先 `/permissions` 看状态，必要时 `/allow <ToolName>`
- 网络相关失败：可能是网络/代理环境问题，不影响离线能力
- MCP 连接失败：检查 settings.json 的 command/args 是否可运行
- 退出卡住：优先检查是否有外部 MCP 子进程未退出（正常情况下 AppExit 会自动断开）
   ```

3. **搜索最新信息**
   ```
   请搜索 "pandas 最佳实践 2024"
   ```

4. **分析代码结构**
   ```
   请分析 src/utils/helper.ts 文件中的所有函数和类
   ```

5. **记录到 Notebook**
   ```
   请在 /tmp/analysis.ipynb 中添加一个代码单元格，包含 pandas 数据加载示例代码
   ```

**预期结果**: 所有工具协同工作，完成完整的开发流程

---

## 🔍 调试技巧

### 1. 查看控制台日志
在运行 mini-cc 的终端中，你会看到类似这样的日志：
```
[TodoWrite] 任务列表已更新: 2 个任务
[TaskCreate] 创建新任务: task_5f2400bf - 测试任务
[TaskList] 查询到 1 个任务
[WebSearch] 执行搜索: "TypeScript tutorial" (期望 3 个结果)
[LSPTool] 执行操作: getSymbols on /path/to/file.ts
[NotebookEdit] 执行操作: add on /tmp/test.ipynb
```

### 2. 检查工具调用
观察 Agent 是否正确调用了相应的工具：
- 工具名称是否正确
- 参数是否符合预期
- 返回值是否合理

### 3. 验证状态变化
对于有状态的工具（如 TodoWrite、TaskCreate）：
- 多次调用后状态是否正确累积
- 状态更新是否符合预期

---

## ✅ 测试检查清单

### 基础功能
- [ ] TodoWriteTool 能够创建和更新任务清单
- [ ] TaskCreateTool 能够创建新任务
- [ ] TaskListTool 能够列出所有任务
- [ ] WebSearchTool 能够执行网络搜索（需要网络）
- [ ] LSPTool 能够分析代码符号
- [ ] NotebookEditTool 能够编辑 Notebook 文件

### 错误处理
- [ ] 输入无效参数时给出友好提示
- [ ] 文件不存在时正确处理
- [ ] 网络失败时有适当的错误消息

### 用户体验
- [ ] 工具的 description 清晰易懂
- [ ] 返回的消息对用户有帮助
- [ ] 日志输出便于调试

### 代码质量
- [ ] TypeScript 编译无错误
- [ ] 所有工具通过自动化测试
- [ ] 代码注释完整清晰

---

## 🐛 常见问题

### Q1: WebSearchTool 总是失败？
**A**: 这可能是网络问题。检查：
- 网络连接是否正常
- 是否能够访问 duckduckgo.com
- 是否需要配置代理

### Q2: LSPTool 找不到符号？
**A**: 简化版 LSP 使用正则表达式匹配，可能不够精确。建议：
- 确保符号名称拼写正确
- 使用标准的代码格式
- 生产环境建议使用完整的 LSP 服务器

### Q3: NotebookEditTool 说文件不存在？
**A**: 检查：
- 文件路径是否正确（绝对路径或相对路径）
- 文件扩展名是否为 `.ipynb`
- 文件是否有读取权限

### Q4: 任务创建后看不到？
**A**: TaskListTool 只显示当前会话的任务。确认：
- 是否在同一个会话中
- 任务是否被意外删除

---

## 📝 测试报告模板

完成测试后，可以填写以下报告：

```markdown
## 测试报告

**测试日期**: YYYY-MM-DD
**测试人员**: [你的名字]
**mini-cc 版本**: [版本号]

### 测试结果汇总
- 总测试数: X
- 通过: Y
- 失败: Z

### 详细结果

#### TodoWriteTool
- [ ] 创建任务清单: 通过/失败
- [ ] 更新任务状态: 通过/失败
- [ ] 完成任务: 通过/失败
- 备注: ...

#### TaskCreateTool & TaskListTool
- [ ] 创建任务: 通过/失败
- [ ] 列出任务: 通过/失败
- 备注: ...

#### WebSearchTool
- [ ] 基本搜索: 通过/失败/跳过（网络问题）
- 备注: ...

#### LSPTool
- [ ] 获取符号: 通过/失败
- [ ] 查找定义: 通过/失败
- [ ] 查找引用: 通过/失败
- 备注: ...

#### NotebookEditTool
- [ ] 添加单元格: 通过/失败
- [ ] 读取内容: 通过/失败
- [ ] 更新单元格: 通过/失败
- [ ] 删除单元格: 通过/失败
- 备注: ...

### 发现的问题
1. ...
2. ...

### 改进建议
1. ...
2. ...
```

---

## 🎉 测试完成

如果所有测试都通过了，恭喜你！新工具已经可以正常使用了。

如果发现任何问题，请：
1. 记录详细的错误信息
2. 查看控制台日志
3. 检查输入参数是否正确
4. 参考代码中的注释和文档

祝你测试顺利！🚀
