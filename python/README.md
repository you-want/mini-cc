# 🐍 mini-cc (Python Edition)

这是 `mini-cc` 智能体的 **Python 语言实现版本**。本项目旨在通过 Python 极简的脚本生态与 `asyncio` 异步特性，复刻 TypeScript 版本的全套 Agent 能力。

本项目同样遵循**纯函数式设计**与**无状态闭包**的理念，将大模型（LLM）、工具系统（Tool Use）和 Agent 事件循环高度解耦。

## ✨ 已实现功能

1. **OpenAI 兼容接口支持**：支持所有兼容 OpenAI 格式的模型（默认针对 Qwen 系列模型进行优化，支持提取并展示 `reasoning_content` 思维链）。
2. **极速流式输出**：通过 `AsyncOpenAI` 客户端实现异步流式文本渲染，无需等待模型全部生成完毕。
3. **完整工具链 (Tool Use)**：
   - `BashTool`：赋予大模型在本地执行终端命令的能力。
   - `FileReadTool`：支持读取并智能截断超长本地文件。
   - `FileWriteTool`：全自动补全缺失目录并写入文件。
4. **Agent 智能循环**：多轮连续调用工具直至完成用户设定的目标。

## 🚀 使用步骤

### 1. 环境准备

确保你的系统已安装 **Python 3.8+**。

### 2. 安装依赖

进入项目目录并安装所需的 Python 依赖包：

```bash
cd mini-cc/python
pip install -r requirements.txt
```

### 3. 配置环境变量

在 `mini-cc/python` 目录下创建一个 `.env` 文件，并填入以下内容：

```env
# 必填：你的大模型 API Key
OPENAI_API_KEY="sk-xxxxxx"

# 选填：大模型接口的 Base URL（如果不填，默认为 OpenAI 官方地址）
OPENAI_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"

# 选填：你想使用的模型名称（默认为 qwen3.6-plus，如果使用其他模型请对应修改）
MODEL_NAME="qwen-max"
```

### 4. 启动 Agent

运行入口文件启动你的专属 AI 助手：

```bash
python src/main.py
```

启动后，在终端中会出现 `mini-cc>` 提示符，你就可以直接输入自然语言（例如：“帮我在上一级目录创建一个 index.html，写一个贪吃蛇游戏”）让它为你工作了！
