# 人工测试步骤 - 记忆引擎功能

## 测试环境准备

```bash
# 1. 进入项目目录
cd /claude-code/mini-cc/typescript

# 2. 安装依赖
npm install

# 3. 编译项目
npm run build
```

## 一、记忆技能（remember）测试

### 测试 1.1：保存记忆

```bash
# 启动 mini-cc
npm run start

# 在 mini-cc 中输入以下命令：
/skill remember

# 然后输入：
记住：我的项目名称叫 TestProject，技术栈是 TypeScript + React

# 预期结果：
# 1. 显示成功消息
# 2. 在当前目录下创建 .ai_memory/ 目录
# 3. 创建 MEMORY.md 和 TestProject.md 文件
```

### 验证步骤：

```bash
# 检查记忆目录
ls -la .ai_memory/

# 查看 MEMORY.md 内容
cat .ai_memory/MEMORY.md

# 查看具体记忆文件
cat .ai_memory/TestProject.md
```

### 测试 1.2：读取已保存的记忆

```bash
# 在 mini-cc 中输入：
我的项目叫什么名字？

# 预期结果：
# AI 应该能够根据记忆回答：TestProject
```

## 二、记忆扫描与检索测试

### 测试 2.1：创建多个记忆文件

```bash
# 在 mini-cc 中依次输入：

记住：我的代码风格是使用 2 空格缩进
记住：API 基础 URL 是 http://localhost:3000
记住：数据库使用 PostgreSQL
记住：部署平台是 Vercel
```

### 验证步骤：

```bash
# 检查所有记忆文件
ls -la .ai_memory/

# 检查索引文件
cat .ai_memory/MEMORY.md
```

### 测试 2.2：检索相关记忆

```bash
# 在 mini-cc 中输入：
我之前记住的 API 配置是什么？

# 预期结果：
# AI 应该能够检索到包含 "API" 关键词的记忆
```

## 三、消息压缩功能测试

### 测试 3.1：模拟长对话压缩

```bash
# 这个测试需要构造大量对话内容
# 建议使用代码方式测试

# 创建测试脚本 test-compact.ts：
cat > test-compact.ts << 'EOF'
import { stripImagesFromMessages, truncateHeadForPTLRetry } from './src/services/compact/compact';

async function testCompact() {
  // 测试图片剥离
  const messages = [
    {
      role: 'user',
      content: [
        { type: 'image', source: { data: 'base64...' } },
        { type: 'text', text: '这是一张截图' }
      ]
    }
  ];

  const result = stripImagesFromMessages(messages);
  console.log('图片剥离测试:', JSON.stringify(result, null, 2));

  // 测试消息截断
  const longMessages = Array(20).fill(null).map((_, i) => ({
    type: 'user' as const,
    content: `消息 ${i}`
  }));

  const truncated = truncateHeadForPTLRetry(longMessages, {
    error: { message: 'maximum context length exceeded by 5000 tokens' }
  });

  console.log('原始消息数:', longMessages.length);
  console.log('截断后消息数:', truncated?.length);
}

testCompact();
EOF

# 运行测试
npx ts-node test-compact.ts
```

### 预期结果：
- 图片块应该被替换为 `[image]` 占位符
- 消息数量应该减少约 20%

## 四、技能系统测试

### 测试 4.1：查看所有技能

```bash
# 在 mini-cc 中输入：
/skill

# 预期结果：
# 应该显示所有可用技能列表，包括：
# - remember (记忆管理)
# - simplify (代码简化)
# - verify (代码验证)
```

### 测试 4.2：搜索技能

```bash
# 在 mini-cc 中输入：
/skill search memory

# 预期结果：
# 应该显示与 memory 相关的技能
```

## 五、端到端测试流程

### 完整测试场景：

```bash
# 1. 启动 mini-cc
npm run start

# 2. 首次对话：设置项目上下文
记住：我的项目叫 MiniChat，采用 TypeScript + Node.js + Express 架构

# 3. 第二次对话：验证上下文保持
我刚才说的项目叫什么？用的什么技术栈？

# 4. 第三次对话：添加更多记忆
记住：数据库使用 MongoDB
记住：认证使用 JWT token

# 5. 第四次对话：跨会话测试
/new

# 6. 新会话中测试记忆召回
我之前说的项目是什么？用的什么数据库？

# 7. 验证记忆文件持久化
cat .ai_memory/MEMORY.md
```

### 预期结果：

| 步骤 | 预期行为 |
|------|----------|
| 1 | mini-cc 正常启动 |
| 2 | 创建 .ai_memory 目录和记忆文件 |
| 3 | AI 能准确回答项目名和技术栈 |
| 4 | 成功添加更多记忆 |
| 5 | 开始新对话，清空上下文 |
| 6 | AI 能从记忆中检索到项目信息 |
| 7 | MEMORY.md 包含所有记忆的索引 |

## 六、测试结果记录

请在测试过程中记录以下信息：

```
测试日期：__________
测试人员：__________

测试 1.1 (保存记忆)：✅ 通过 / ❌ 失败
测试 1.2 (读取记忆)：✅ 通过 / ❌ 失败
测试 2.1 (多记忆文件)：✅ 通过 / ❌ 失败
测试 2.2 (检索记忆)：✅ 通过 / ❌ 失败
测试 3.1 (消息压缩)：✅ 通过 / ❌ 失败
测试 4.1 (查看技能)：✅ 通过 / ❌ 失败
测试 4.2 (搜索技能)：✅ 通过 / ❌ 失败
测试 5 (端到端)：✅ 通过 / ❌ 失败

发现的问题：
1.
2.
3.

备注：
```

## 常见问题排查

### 问题 1：记忆文件没有创建

```bash
# 检查目录权限
ls -la .ai_memory/

# 检查 mini-cc 是否有写入权限
chmod 755 .ai_memory/
```

### 问题 2：技能列表为空

```bash
# 检查内置技能文件
ls -la src/skills/built-in/

# 重新编译
npm run build
```

### 问题 3：消息压缩不工作

```bash
# 检查 compact 模块
ls -la src/services/compact/

# 运行单元测试
npm test -- --testPathPatterns="compact"
```