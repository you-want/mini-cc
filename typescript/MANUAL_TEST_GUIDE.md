# Mini-CC 新工具手动测试指南

## 📋 测试准备

### 1. 环境检查
```bash
# 确保在项目根目录
cd /Users/rain9/github/claude-code/mini-cc/typescript

# 检查依赖是否安装
npm install

# 编译项目（确保没有错误）
npm run build
```

### 2. 启动 mini-cc
```bash
# 使用开发模式启动（支持热重载）
npm dev

# 或者使用生产模式
npm start
```

---

## 🧪 测试流程

### 测试 1: TodoWriteTool - 任务清单管理

**目标**: 验证任务清单的创建、更新和完成功能

#### 步骤 1: 创建任务清单
在 mini-cc 对话中输入：
```
请帮我创建一个任务清单，包含以下任务：
1. 学习 TypeScript 基础（进行中）
2. 编写单元测试（待办）
3. 阅读文档（待办）
```

**预期行为**:
- Agent 应该调用 `TodoWrite` 工具
- 创建包含 3 个任务的清单
- 第一个任务状态为 `in_progress`，其他为 `pending`

#### 步骤 2: 更新任务状态
继续输入：
```
我已经完成了第一个任务，现在正在编写单元测试
```

**预期行为**:
- Agent 应该再次调用 `TodoWrite` 工具
- 更新任务状态：第一个变为 `completed`，第二个变为 `in_progress`

#### 步骤 3: 完成所有任务
继续输入：
```
所有任务都已完成
```

**预期行为**:
- Agent 调用 `TodoWrite` 工具
- 所有任务标记为 `completed`
- 任务清单自动清空

**✅ 验证点**:
- [ ] 任务能够正确创建
- [ ] 状态能够正确更新
- [ ] 全部完成后清单清空
- [ ] 控制台输出 `[TodoWrite] 任务列表已更新` 日志

---

### 测试 2: TaskCreateTool & TaskListTool - 后台任务管理

**目标**: 验证任务的创建和列表查看功能

#### 步骤 1: 创建任务
在 mini-cc 对话中输入：
```
请创建一个任务：实现用户认证模块，需要包括 JWT token 生成和验证功能
```

**预期行为**:
- Agent 调用 `TaskCreate` 工具
- 生成唯一的任务 ID（格式：task_xxxxxxxx）
- 返回成功消息

#### 步骤 2: 再创建一个任务
继续输入：
```
再创建一个任务：编写 API 文档，描述所有接口的使用方法
```

**预期行为**:
- 创建第二个任务
- 有不同的任务 ID

#### 步骤 3: 查看任务列表
输入：
```
请列出当前所有的任务
```

**预期行为**:
- Agent 调用 `TaskList` 工具
- 显示两个任务的列表
- 包含任务 ID、状态和描述

**✅ 验证点**:
- [ ] 任务能够成功创建
- [ ] 每个任务有唯一的 ID
- [ ] 任务列表正确显示所有任务
- [ ] 控制台输出 `[TaskCreate]` 和 `[TaskList]` 日志

---

### 测试 3: WebSearchTool - 网络搜索

**目标**: 验证网络搜索功能

#### 步骤 1: 执行简单搜索
在 mini-cc 对话中输入：
```
请搜索一下 "TypeScript 5.0 新特性"
```

**预期行为**:
- Agent 调用 `WebSearch` 工具
- 返回搜索结果列表
- 包含标题、URL 和摘要

#### 步骤 2: 指定结果数量
继续输入：
```
请搜索 "React hooks 最佳实践"，只返回 3 个结果
```

**预期行为**:
- 返回恰好 3 个搜索结果
- 结果质量较高

**⚠️ 注意**: 
- 此测试需要网络连接
- 如果网络不通或 DuckDuckGo 无法访问，可能会失败
- 这是正常现象，不影响工具的其他功能

**✅ 验证点**:
- [ ] 能够发起网络搜索请求
- [ ] 返回搜索结果（如果网络正常）
- [ ] 控制台输出 `[WebSearch] 执行搜索` 日志

---

### 测试 4: LSPTool - 代码智能（简化版）

**目标**: 验证代码符号查找功能

#### 准备工作
首先，确保项目中有一个 TypeScript 文件，例如：
```bash
# 创建一个测试文件
cat > /tmp/test_lsp.ts << 'EOF'
function calculateTotal(items: number[]): number {
  return items.reduce((sum, item) => sum + item, 0);
}

class UserService {
  getUsers(): string[] {
    return ["Alice", "Bob"];
  }
}

const MAX_RETRY = 3;
EOF
```

#### 步骤 1: 获取文件中的符号
在 mini-cc 对话中输入：
```
请分析文件 /tmp/test_lsp.ts，列出其中定义的所有符号
```

**预期行为**:
- Agent 调用 `LSPTool` 工具，操作为 `getSymbols`
- 返回找到的符号列表
- 应该包含：calculateTotal、UserService、getUsers、MAX_RETRY

#### 步骤 2: 查找符号定义
继续输入：
```
请在 /tmp/test_lsp.ts 中查找 calculateTotal 的定义位置
```

**预期行为**:
- Agent 调用 `LSPTool` 工具，操作为 `findDefinition`
- 返回定义所在的行号和内容

#### 步骤 3: 查找符号引用
继续输入：
```
请在当前项目中查找 console 的所有引用
```

**预期行为**:
- Agent 调用 `LSPTool` 工具，操作为 `findReferences`
- 在整个项目中搜索（可能需要一些时间）
- 返回多个引用位置

**✅ 验证点**:
- [ ] 能够正确识别文件中的符号
- [ ] 能够找到符号的定义位置
- [ ] 能够搜索符号的引用
- [ ] 控制台输出 `[LSPTool]` 相关日志

---

### 测试 5: NotebookEditTool - Jupyter Notebook 编辑

**目标**: 验证 Notebook 文件的读写和编辑功能

#### 步骤 1: 创建测试 Notebook
在终端中执行：
```bash
# 创建一个空的 Notebook 文件
cat > /tmp/test_notebook.ipynb << 'EOF'
{
  "cells": [],
  "metadata": {},
  "nbformat": 4,
  "nbformat_minor": 5
}
EOF
```

#### 步骤 2: 添加代码单元格
在 mini-cc 对话中输入：
```
请在 /tmp/test_notebook.ipynb 中添加一个代码单元格，内容为：print("Hello, World!")
```

**预期行为**:
- Agent 调用 `NotebookEdit` 工具，操作为 `add`
- 添加一个新的 code 类型单元格
- 返回成功消息，显示当前单元格数量

#### 步骤 3: 添加 Markdown 单元格
继续输入：
```
再添加一个 Markdown 单元格，内容为：# 这是我的第一个 Notebook
```

**预期行为**:
- 添加一个 markdown 类型单元格
- 单元格数量增加到 2

#### 步骤 4: 读取 Notebook 内容
输入：
```
请读取 /tmp/test_notebook.ipynb 的内容
```

**预期行为**:
- Agent 调用 `NotebookEdit` 工具，操作为 `read`
- 返回所有单元格的列表
- 显示 2 个单元格的详细信息

#### 步骤 5: 更新单元格
输入：
```
请更新第 1 个单元格（索引 0）的内容为：print("Updated Hello")
```

**预期行为**:
- Agent 调用 `NotebookEdit` 工具，操作为 `update`
- 更新指定索引的单元格内容
- 返回成功消息

#### 步骤 6: 删除单元格
输入：
```
请删除第 2 个单元格（索引 1）
```

**预期行为**:
- Agent 调用 `NotebookEdit` 工具，操作为 `delete`
- 删除指定索引的单元格
- 剩余 1 个单元格

**✅ 验证点**:
- [ ] 能够添加 code 和 markdown 单元格
- [ ] 能够读取 Notebook 内容
- [ ] 能够更新现有单元格
- [ ] 能够删除单元格
- [ ] 控制台输出 `[NotebookEdit]` 相关日志

---

## 📊 综合测试场景

### 场景 1: 完整的开发工作流

**模拟任务**: 开发一个简单的 Python 数据分析脚本

1. **创建任务清单**
   ```
   我要开发一个数据分析脚本，请帮我创建任务清单：
   1. 导入必要的库（pandas, numpy）
   2. 加载 CSV 数据
   3. 数据清洗和预处理
   4. 执行统计分析
   5. 可视化结果
   ```

2. **创建后台任务**
   ```
   请创建任务：编写数据加载函数，支持多种文件格式
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
