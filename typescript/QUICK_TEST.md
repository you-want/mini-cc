# 🧪 手动测试快速开始

## ⚡ 一键运行测试准备

```bash
cd /Users/rain9/github/claude-code/mini-cc/typescript
./run-manual-tests.sh
```

这个脚本会自动：
1. ✅ 检查编译状态
2. ✅ 创建测试文件（Notebook 和 TypeScript）
3. ✅ 运行自动化测试
4. ✅ 显示下一步操作指南

---

## 📖 详细测试指南

查看完整的手动测试流程：
```bash
open MANUAL_TEST_GUIDE.md
```

或者在浏览器中打开 `MANUAL_TEST_GUIDE.md` 文件。

---

## 🎯 快速测试清单

### 1️⃣ TodoWriteTool（任务清单）
```
对话输入：请帮我创建任务清单：1.学习TypeScript（进行中） 2.编写测试（待办）
预期：Agent 调用 TodoWrite 工具，创建2个任务
```

### 2️⃣ TaskCreateTool（创建任务）
```
对话输入：请创建任务：实现用户认证模块
预期：返回任务ID，如 task_xxxxxxxx
```

### 3️⃣ TaskListTool（查看任务）
```
对话输入：列出所有任务
预期：显示之前创建的任务列表
```

### 4️⃣ WebSearchTool（网络搜索）
```
对话输入：请搜索 "TypeScript 5.0 新特性"
预期：返回搜索结果（需要网络连接）
```

### 5️⃣ LSPTool（代码分析）
```
对话输入：请分析文件 /tmp/test_manual_lsp.ts 中的所有符号
预期：列出函数、类、接口等符号
```

### 6️⃣ NotebookEditTool（编辑Notebook）
```
对话输入：请在 /tmp/test_manual_notebook.ipynb 中添加一个代码单元格，内容为 print("Hello")
预期：成功添加单元格
```

---

## 🔍 验证要点

启动 mini-cc 后，观察终端输出中的日志：

```
[TodoWrite] 任务列表已更新: 2 个任务
[TaskCreate] 创建新任务: task_5f2400bf - 测试任务
[TaskList] 查询到 1 个任务
[WebSearch] 执行搜索: "TypeScript tutorial"
[LSPTool] 执行操作: getSymbols on /path/to/file.ts
[NotebookEdit] 执行操作: add on /tmp/test.ipynb
```

如果看到这些日志，说明工具被正确调用了！

---

## 📊 测试报告

测试完成后，可以填写简单的报告：

```markdown
## 测试结果

日期: ___________

✅ 通过的测试:
- [ ] TodoWriteTool
- [ ] TaskCreateTool
- [ ] TaskListTool
- [ ] WebSearchTool
- [ ] LSPTool
- [ ] NotebookEditTool

❌ 发现的问题:
1. 
2. 

💡 改进建议:
1. 
2. 
```

---

## 🆘 遇到问题？

### 编译错误
```bash
npm run build
# 查看并修复错误
```

### 工具没有被调用
- 确保描述清晰明确
- 尝试换一种说法
- 查看 Agent 的响应逻辑

### 网络搜索失败
- 检查网络连接
- 这是正常现象（DuckDuckGo 可能需要代理）
- 不影响其他工具的使用

### 文件找不到
- 使用绝对路径
- 确认文件确实存在
- 检查文件权限

---

## 📞 需要帮助？

参考以下文档：
- 📘 `MANUAL_TEST_GUIDE.md` - 详细测试指南
- 📗 `DEVELOPMENT_SUMMARY.md` - 开发总结
- 📙 `dev.md` - 原始开发规划

---

**准备好了吗？开始测试吧！** 🚀

```bash
./run-manual-tests.sh
```
