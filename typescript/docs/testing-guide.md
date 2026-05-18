# 新工具测试指南

本文档提供新增工具的自动化测试和人工测试步骤。

## 自动化测试

### 运行测试

```bash
# 运行所有新工具的测试
npm test -- GlobTool.test
npm test -- GrepTool.test
npm test -- FileEditTool.test
npm test -- WebFetchTool.test

# 或者运行所有测试
npm test
```

### 测试覆盖

已创建的测试文件：
- `src/infrastructure/tools/__tests__/GlobTool.test.ts` - 6 个测试用例
- `src/infrastructure/tools/__tests__/GrepTool.test.ts` - 9 个测试用例
- `src/infrastructure/tools/__tests__/FileEditTool.test.ts` - 8 个测试用例
- `src/infrastructure/tools/__tests__/WebFetchTool.test.ts` - 5 个测试用例

总计：28 个自动化测试用例

---

## 人工测试步骤

### 准备工作

1. 编译项目：
```bash
cd /Users/rain9/github/claude-code/mini-cc/typescript
npm run build
```

2. 启动 mini-cc：
```bash
npm start
# 或者
node dist/cli.js
```

---

## 测试 1: GlobTool - 文件搜索

### 测试目标
验证 GlobTool 能够正确搜索文件。

### 测试步骤

1. 启动 mini-cc 后，输入以下提示：
```
请使用 GlobTool 查找项目中所有的 TypeScript 文件
```

2. 预期结果：
   - AI 应该调用 GlobTool
   - 参数应该是 `{"pattern": "**/*.ts"}`
   - 返回结果应该包含项目中的 .ts 文件列表
   - 应该看到类似 `src/main.ts`, `src/cli.ts` 等文件

3. 进阶测试 - 指定目录：
```
请查找 src/infrastructure/tools 目录下的所有工具文件
```

4. 预期结果：
   - 参数应该包含 `path: "src/infrastructure/tools"`
   - 返回的文件应该都在该目录下

### 验证要点
- ✅ 能找到正确的文件
- ✅ 自动忽略 node_modules 等目录
- ✅ 结果数量合理（不超过 100 个）
- ✅ 返回的是相对路径

---

## 测试 2: GrepTool - 内容搜索

### 测试目标
验证 GrepTool 能够在文件中搜索内容。

### 测试步骤

1. 基础搜索：
```
请在项目中搜索所有包含 "Tool" 这个词的地方
```

2. 预期结果：
   - AI 调用 GrepTool
   - 参数：`{"pattern": "Tool"}`
   - 返回匹配的文件、行号和内容
   - 应该找到多个匹配项

3. 正则表达式搜索：
```
请搜索所有的函数定义（使用正则表达式 "function\\s+\\w+"）
```

4. 预期结果：
   - 参数：`{"pattern": "function\\s+\\w+"}`
   - 找到所有函数定义

5. 文件类型过滤：
```
请在所有 .ts 文件中搜索 "export"
```

6. 预期结果：
   - 参数应该包含 `filePattern: "**/*.ts"`
   - 只在 TypeScript 文件中搜索

### 验证要点
- ✅ 能找到匹配的内容
- ✅ 返回正确的行号
- ✅ 支持正则表达式
- ✅ 文件类型过滤有效
- ✅ 结果不超过 200 个匹配

---

## 测试 3: FileEditTool - 文件编辑

### 测试目标
验证 FileEditTool 能够安全地编辑文件。

### 测试步骤

1. 创建测试文件：
```
请创建一个测试文件 test-edit.ts，内容是：
const x = 10;
const y = 20;
```

2. 简单替换：
```
请把 test-edit.ts 中的 "const x = 10;" 改为 "const x = 100;"
```

3. 预期结果：
   - AI 调用 FileEditTool
   - 参数：
     ```json
     {
       "file_path": "test-edit.ts",
       "old_string": "const x = 10;",
       "new_string": "const x = 100;"
     }
     ```
   - 返回成功消息和预览
   - 文件内容已更新

4. 验证编辑结果：
```
请读取 test-edit.ts 的内容
```

5. 预期结果：
   - 应该看到 `const x = 100;`

6. 测试安全机制 - 多个匹配：
```
请创建文件 test-multi.ts，内容是：
const a = 10;
const b = 10;
const c = 10;

然后把所有的 10 改为 20
```

7. 预期结果：
   - AI 应该使用 `replace_all: true` 参数
   - 或者提示需要更精确的匹配

### 验证要点
- ✅ 能成功替换内容
- ✅ 提供编辑预览
- ✅ 多个匹配时有安全提示
- ✅ 文件不存在时有错误提示
- ✅ 未找到内容时有明确提示

---

## 测试 4: WebFetchTool - 网络请求

### 测试目标
验证 WebFetchTool 能够发起网络请求。

### 测试步骤

1. 简单 GET 请求：
```
请访问 https://api.github.com/repos/nodejs/node 获取 Node.js 仓库信息
```

2. 预期结果：
   - AI 调用 WebFetchTool
   - 参数：`{"url": "https://api.github.com/repos/nodejs/node"}`
   - 返回 JSON 格式的仓库信息
   - 包含 statusCode: 200

3. 测试错误处理 - 无效 URL：
```
请访问 invalid-url
```

4. 预期结果：
   - 返回错误信息："无效的 URL 格式"

5. 测试协议限制：
```
请访问 ftp://example.com
```

6. 预期结果：
   - 返回错误信息："不支持的协议"

### 验证要点
- ✅ 能成功发起 HTTP/HTTPS 请求
- ✅ 返回正确的状态码和内容
- ✅ 无效 URL 有错误提示
- ✅ 不支持的协议被拒绝
- ✅ 响应大小有限制（50KB）

---

## 测试 5: 工具组合使用

### 测试目标
验证多个工具能够协同工作。

### 测试场景 1：代码重构

```
请帮我完成以下任务：
1. 找到所有包含 "console.log" 的文件
2. 在其中一个文件中，把 "console.log" 替换为 "logger.info"
```

预期流程：
1. AI 使用 GrepTool 搜索 "console.log"
2. AI 使用 FileReadTool 读取某个文件
3. AI 使用 FileEditTool 进行替换
4. AI 可能使用 FileReadTool 验证结果

### 测试场景 2：项目分析

```
请分析项目结构：
1. 列出所有的工具文件
2. 统计每个工具文件的行数
3. 找出最大的工具文件
```

预期流程：
1. AI 使用 GlobTool 查找工具文件
2. AI 使用 FileReadTool 读取文件
3. AI 进行分析和统计

### 测试场景 3：API 集成

```
请帮我：
1. 获取 GitHub API 的某个数据
2. 将数据保存到本地文件
```

预期流程：
1. AI 使用 WebFetchTool 获取数据
2. AI 使用 FileWriteTool 保存数据

### 验证要点
- ✅ 工具能够按正确顺序调用
- ✅ 工具之间能够传递数据
- ✅ AI 能够理解任务并选择合适的工具
- ✅ 错误处理正确

---

## 性能测试

### 测试大文件处理

1. 创建大文件：
```bash
# 在项目目录下创建一个大文件
for i in {1..2000}; do echo "Line $i: Some content here" >> large-file.txt; done
```

2. 测试 GrepTool：
```
请在 large-file.txt 中搜索 "Line 1000"
```

3. 验证：
   - ✅ 能够处理大文件
   - ✅ 搜索速度合理
   - ✅ 结果正确

### 测试大量文件

1. 测试 GlobTool：
```
请查找项目中所有文件（包括 node_modules）
```

2. 验证：
   - ✅ 自动忽略 node_modules
   - ✅ 结果被限制在 100 个以内
   - ✅ 有截断提示

---

## 错误处理测试

### 测试各种错误情况

1. 文件不存在：
```
请读取 nonexistent-file.ts
```

2. 目录不存在：
```
请在 nonexistent-dir 目录下搜索文件
```

3. 无效的正则表达式：
```
请搜索模式 "[invalid"
```

4. 网络错误：
```
请访问 https://this-domain-does-not-exist-12345.com
```

### 验证要点
- ✅ 所有错误都有清晰的提示
- ✅ 错误不会导致程序崩溃
- ✅ AI 能够理解错误并给出建议

---

## 测试检查清单

### GlobTool
- [ ] 基础文件搜索
- [ ] 指定目录搜索
- [ ] 复杂 glob 模式
- [ ] 自动忽略目录
- [ ] 结果限制
- [ ] 错误处理

### GrepTool
- [ ] 基础文本搜索
- [ ] 正则表达式搜索
- [ ] 大小写敏感/不敏感
- [ ] 文件类型过滤
- [ ] 上下文行显示
- [ ] 行号显示
- [ ] 结果限制
- [ ] 错误处理

### FileEditTool
- [ ] 简单替换
- [ ] 多行替换
- [ ] replace_all 模式
- [ ] 编辑预览
- [ ] 唯一性验证
- [ ] 错误处理

### WebFetchTool
- [ ] GET 请求
- [ ] POST 请求
- [ ] 自定义请求头
- [ ] URL 验证
- [ ] 协议限制
- [ ] 大小限制
- [ ] 超时处理
- [ ] 错误处理

### 工具组合
- [ ] 多工具协同
- [ ] 数据传递
- [ ] 任务规划
- [ ] 错误恢复

---

## 测试报告模板

完成测试后，请填写以下报告：

### 测试环境
- 操作系统：
- Node.js 版本：
- mini-cc 版本：
- 测试日期：

### 测试结果

#### GlobTool
- 通过：[ ] 是 [ ] 否
- 问题：

#### GrepTool
- 通过：[ ] 是 [ ] 否
- 问题：

#### FileEditTool
- 通过：[ ] 是 [ ] 否
- 问题：

#### WebFetchTool
- 通过：[ ] 是 [ ] 否
- 问题：

#### 工具组合
- 通过：[ ] 是 [ ] 否
- 问题：

### 发现的问题
1. 
2. 
3. 

### 改进建议
1. 
2. 
3. 

---

## 快速测试脚本

如果你想快速验证所有工具，可以使用以下提示：

```
请依次测试以下功能：
1. 使用 GlobTool 查找所有 .ts 文件
2. 使用 GrepTool 搜索 "Tool" 关键词
3. 创建一个测试文件并使用 FileEditTool 修改它
4. 使用 WebFetchTool 访问 https://api.github.com
5. 总结测试结果
```

AI 会自动执行所有测试并给出结果。
