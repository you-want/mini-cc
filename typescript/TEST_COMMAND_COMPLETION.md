# 命令补全功能测试指南

## 功能说明

当用户在输入框中输入 `/` 时，系统会自动显示所有可用的命令和技能提示，用户可以通过键盘导航选择并执行。

## 新增文件

1. **src/components/CommandSuggestions.tsx** - 命令补全建议显示组件
2. **src/commands/CommandCompletionManager.ts** - 命令补全管理器

## 修改文件

1. **src/components/App.tsx** - 集成命令补全功能

## 功能特性

### 1. 自动提示
- 用户输入 `/` 时自动显示所有可用命令
- 支持模糊搜索过滤
- 实时更新建议列表

### 2. 命令分类
- **系统命令** (黄色标签): `/help`, `/clear`, `/provider`, `/permissions` 等
- **内置技能** (青色标签): `/skill remember`, `/skill verify`, `/skill simplify` 等
- **自定义技能** (品红色标签): 从 `~/.cursor/skills-cursor/` 加载的 Cursor 技能

### 3. 键盘导航
- `↑` / `↓` - 上下选择命令
- `Tab` / `Enter` - 确认选择并填充到输入框
- `Esc` - 取消并关闭建议列表

### 4. 智能过滤
- 输入 `/` - 显示所有命令
- 输入 `/skill` - 显示所有技能相关命令
- 输入 `/help` - 过滤匹配的命令

## 测试步骤

### 1. 启动应用
```bash
cd /Users/rain9/github/claude-code/mini-cc/typescript
npm run dev
```

### 2. 测试基本功能
1. 在输入框中输入 `/`
2. 应该看到一个带边框的命令建议列表
3. 列表显示所有可用的系统命令和技能

### 3. 测试键盘导航
1. 输入 `/`
2. 按 `↓` 键向下选择
3. 按 `↑` 键向上选择
4. 按 `Tab` 或 `Enter` 确认选择
5. 选中的命令应该填充到输入框

### 4. 测试过滤功能
1. 输入 `/skill`
2. 应该只显示技能相关的命令
3. 继续输入 `/skill rem`
4. 应该过滤出 `/skill remember` 命令

### 5. 测试取消功能
1. 输入 `/`
2. 按 `Esc` 键
3. 建议列表应该关闭

## 技能来源

### 内置技能
位置: `src/skills/built-in/`
- `remember` - 记忆管理
- `verify` - 代码验证
- `simplify` - 代码简化

### 自定义技能
位置: `~/.cursor/skills-cursor/`
- 自动扫描所有包含 `SKILL.md` 的目录
- 解析 YAML frontmatter 获取技能名称和描述

### 用户技能
位置: 
- `~/.mini-cc/skills/` (全局)
- `.mini-cc/skills/` (项目级)

## 实现细节

### CommandCompletionManager
- 单例模式管理所有命令和技能
- 自动加载内置技能和自定义技能
- 提供搜索和过滤功能

### CommandSuggestions 组件
- 显示最多 10 个建议
- 高亮当前选中项
- 按分类显示不同颜色标签

### App 组件集成
- 监听输入变化自动更新建议
- 处理键盘导航事件
- 管理建议显示状态

## 注意事项

1. 命令补全只在非加载和非语音模式下激活
2. 建议列表最多显示 10 条，超过会显示省略提示
3. 自定义技能需要符合 Cursor Skills 规范（包含 SKILL.md 文件）
4. 技能描述从 YAML frontmatter 的 `description` 字段读取

## 未来改进

1. 支持命令历史记录
2. 支持命令别名
3. 添加命令使用频率统计
4. 支持更丰富的命令参数提示
5. 添加命令文档预览
