# Mini-CC 工具使用指南

本文档详细介绍 mini-cc 中所有可用的工具及其使用方法。

## 目录

- [文件操作工具](#文件操作工具)
  - [FileReadTool](#filereadtool)
  - [FileWriteTool](#filewritetool)
  - [FileEditTool](#fileedittool)
- [文件搜索工具](#文件搜索工具)
  - [GlobTool](#globtool)
  - [GrepTool](#greptool)
- [系统操作工具](#系统操作工具)
  - [BashTool](#bashtool)
  - [GitStatusTool](#gitstatustool)
- [网络工具](#网络工具)
  - [WebFetchTool](#webfetchtool)
- [高级工具](#高级工具)
  - [AgentTool](#agenttool)

---

## 文件操作工具

### FileReadTool

**功能**：读取本地文件的内容。

**使用场景**：
- 查看代码文件
- 读取配置文件
- 检查日志文件

**参数**：
```json
{
  "file_path": "要读取的文件路径（支持相对路径和绝对路径）"
}
```

**示例**：
```json
{
  "file_path": "src/main.ts"
}
```

**注意事项**：
- 支持相对路径（相对于当前工作目录）
- 大文件会自动截断到前 1000 行
- 二进制文件可能无法正确读取

---

### FileWriteTool

**功能**：创建新文件或覆盖现有文件。

**使用场景**：
- 创建新的代码文件
- 生成配置文件
- 保存数据到文件

**参数**：
```json
{
  "file_path": "文件路径",
  "content": "文件内容"
}
```

**示例**：
```json
{
  "file_path": "config.json",
  "content": "{\n  \"port\": 3000,\n  \"host\": \"localhost\"\n}"
}
```

**注意事项**：
- 如果文件已存在，会被完全覆盖
- 会自动创建不存在的父目录
- 建议先用 FileReadTool 检查文件是否存在

---

### FileEditTool

**功能**：通过精确的字符串替换来编辑文件内容。

**使用场景**：
- 修改函数实现
- 更新配置项
- 重构代码
- 修复 bug

**参数**：
```json
{
  "file_path": "文件路径",
  "old_string": "要替换的原始字符串（必须精确匹配）",
  "new_string": "替换后的新字符串",
  "replace_all": false  // 可选，是否替换所有匹配项
}
```

**示例 1：修改函数**
```json
{
  "file_path": "src/utils.ts",
  "old_string": "function add(a, b) {\n  return a + b;\n}",
  "new_string": "function add(a, b) {\n  return a + b + 1;\n}"
}
```

**示例 2：更新配置**
```json
{
  "file_path": "config.json",
  "old_string": "\"port\": 3000",
  "new_string": "\"port\": 8080"
}
```

**示例 3：替换所有匹配项**
```json
{
  "file_path": "src/app.ts",
  "old_string": "console.log",
  "new_string": "logger.info",
  "replace_all": true
}
```

**重要提示**：
- `old_string` 必须精确匹配，包括所有空格和缩进
- 如果有多个匹配但未设置 `replace_all=true`，操作会失败
- 建议先用 FileReadTool 读取文件，确认要替换的内容
- 工具会返回替换前后的预览

---

## 文件搜索工具

### GlobTool

**功能**：使用 glob 模式搜索匹配的文件。

**使用场景**：
- 查找所有 TypeScript 文件
- 查找特定目录下的配置文件
- 查找所有测试文件

**参数**：
```json
{
  "pattern": "glob 匹配模式",
  "path": "可选，搜索的起始目录"
}
```

**Glob 模式语法**：
- `*`：匹配任意字符（不包括路径分隔符）
- `**`：匹配任意层级的目录
- `?`：匹配单个字符
- `[abc]`：匹配方括号中的任意一个字符

**示例 1：查找所有 TypeScript 文件**
```json
{
  "pattern": "**/*.ts"
}
```

**示例 2：查找 src 目录下的测试文件**
```json
{
  "pattern": "**/*.test.ts",
  "path": "src"
}
```

**示例 3：查找所有 JSON 配置文件**
```json
{
  "pattern": "**/*.json"
}
```

**注意事项**：
- 自动忽略 `node_modules`、`.git`、`dist` 等目录
- 结果限制为 100 个文件
- 只返回文件，不返回目录

---

### GrepTool

**功能**：在文件中搜索匹配指定模式的内容（支持正则表达式）。

**使用场景**：
- 查找包含特定函数名的文件
- 搜索 TODO 注释
- 查找导入语句
- 搜索配置项

**参数**：
```json
{
  "pattern": "搜索模式（支持正则表达式）",
  "path": "可选，搜索的目录",
  "filePattern": "可选，文件过滤模式（如 *.ts）",
  "caseSensitive": false,  // 可选，是否区分大小写
  "contextLines": 0  // 可选，显示上下文行数（0-3）
}
```

**示例 1：查找函数定义**
```json
{
  "pattern": "function\\s+\\w+",
  "filePattern": "**/*.ts"
}
```

**示例 2：搜索 TODO 注释**
```json
{
  "pattern": "TODO|FIXME",
  "caseSensitive": false
}
```

**示例 3：查找导入语句（带上下文）**
```json
{
  "pattern": "import.*from.*react",
  "filePattern": "**/*.tsx",
  "contextLines": 2
}
```

**示例 4：搜索 API 密钥配置**
```json
{
  "pattern": "API_KEY|SECRET",
  "filePattern": "**/*.env*",
  "caseSensitive": true
}
```

**正则表达式常用模式**：
- `\b[A-Z_]+\b`：匹配全大写的常量名
- `function\s+\w+`：匹配函数定义
- `class\s+\w+`：匹配类定义
- `import.*from`：匹配 import 语句
- `TODO|FIXME|HACK`：匹配注释标记

**注意事项**：
- 默认不区分大小写
- 自动忽略常见的构建目录和二进制文件
- 结果限制为 200 个匹配
- 返回匹配的行号和内容

---

## 系统操作工具

### BashTool

**功能**：执行 Bash 命令。

**使用场景**：
- 运行构建脚本
- 执行测试
- 安装依赖
- 查看系统信息

**参数**：
```json
{
  "command": "要执行的命令"
}
```

**示例**：
```json
{
  "command": "npm install"
}
```

**安全机制**：
- 自动检测破坏性命令（如 `rm -rf /`）
- 沙盒执行模式
- 命令执行前会请求用户确认

---

### GitStatusTool

**功能**：查看 Git 仓库状态。

**使用场景**：
- 查看修改的文件
- 检查当前分支
- 查看暂存区状态

**参数**：无

**示例**：
```json
{}
```

---

## 网络工具

### WebFetchTool

**功能**：发起 HTTP/HTTPS 请求，获取网页内容或 API 数据。

**使用场景**：
- 获取 REST API 数据
- 下载网页内容
- 查询在线文档
- 获取远程配置

**参数**：
```json
{
  "url": "请求的 URL",
  "method": "GET",  // 可选，GET 或 POST
  "headers": {},  // 可选，自定义请求头
  "body": ""  // 可选，请求体（仅用于 POST）
}
```

**示例 1：获取 GitHub API 数据**
```json
{
  "url": "https://api.github.com/repos/nodejs/node",
  "method": "GET",
  "headers": {
    "User-Agent": "mini-cc"
  }
}
```

**示例 2：POST 请求**
```json
{
  "url": "https://api.example.com/data",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": "{\"key\": \"value\"}"
}
```

**示例 3：获取网页内容**
```json
{
  "url": "https://example.com"
}
```

**限制**：
- 响应大小限制为 50KB
- 超时时间为 30 秒
- 仅支持 HTTP/HTTPS 协议

---

## 高级工具

### AgentTool

**功能**：创建子 Agent 执行复杂任务（Agent 分身术）。

**使用场景**：
- 并行执行多个任务
- 委托复杂的子任务
- 隔离执行环境

**参数**：
```json
{
  "task": "要执行的任务描述"
}
```

**示例**：
```json
{
  "task": "分析 src 目录下所有 TypeScript 文件的代码质量"
}
```

**注意事项**：
- 子 Agent 拥有独立的上下文
- 可以访问所有工具
- 执行结果会返回给主 Agent

---

## 工具组合使用示例

### 场景 1：重构代码

1. 使用 **GrepTool** 查找所有使用旧 API 的地方
2. 使用 **FileReadTool** 读取相关文件
3. 使用 **FileEditTool** 逐个替换
4. 使用 **BashTool** 运行测试验证

### 场景 2：分析项目结构

1. 使用 **GlobTool** 查找所有源文件
2. 使用 **FileReadTool** 读取关键文件
3. 使用 **GrepTool** 搜索特定模式
4. 生成分析报告

### 场景 3：集成外部 API

1. 使用 **WebFetchTool** 获取 API 文档
2. 使用 **FileWriteTool** 创建集成代码
3. 使用 **BashTool** 安装依赖
4. 使用 **BashTool** 运行测试

---

## 最佳实践

1. **先读后写**：在修改文件前，先用 FileReadTool 读取内容
2. **精确匹配**：使用 FileEditTool 时，确保 old_string 精确匹配
3. **限制范围**：使用搜索工具时，尽量指定具体的目录和文件类型
4. **验证结果**：修改代码后，使用 BashTool 运行测试
5. **安全第一**：执行破坏性操作前，先备份重要文件

---

## 常见问题

**Q: FileEditTool 报错"未找到要替换的内容"怎么办？**

A: 确保 old_string 精确匹配，包括所有空格、缩进和换行符。建议先用 FileReadTool 读取文件，复制要替换的内容。

**Q: GlobTool 返回的文件太多怎么办？**

A: 使用更具体的模式，或者指定 path 参数限制搜索范围。

**Q: WebFetchTool 超时怎么办？**

A: 检查网络连接，或者尝试请求更小的资源。超时时间固定为 30 秒。

**Q: 如何查看工具的详细输出？**

A: 工具执行时会在控制台输出日志，可以查看详细的执行过程。

---

## 更新日志

### v1.0.0 (2026-05-18)

**新增工具**：
- GlobTool：文件模式匹配搜索
- GrepTool：内容搜索（支持正则表达式）
- FileEditTool：智能文件编辑
- WebFetchTool：网络请求能力

**改进**：
- 完善工具注册机制
- 优化错误处理
- 添加详细的文档注释

---

## 贡献

如果你想为 mini-cc 添加新工具，请参考现有工具的实现，并遵循以下步骤：

1. 在 `src/infrastructure/tools/` 目录下创建新工具文件
2. 实现 `Tool` 接口
3. 在 `src/infrastructure/tools/index.ts` 中注册工具
4. 更新本文档
5. 添加测试用例

---

## 相关文档

- [架构设计文档](./architecture.md)
- [开发教程](./tutorial.md)
- [高级特性教程](./advanced-features-tutorial.md)
