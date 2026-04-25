# mini-cc (Python 版本)

这是一个用 Python 语言复刻的 `mini-cc` 轻量级 AI 编程智能体项目，专注于用最清晰的代码向 Python 开发者展示 Agent 的事件循环、Tool Use 以及沙盒安全。

## 🎯 当前状态 (开发中)
目前刚刚完成了项目初始化，搭建了：
- **配置文件管理**: 支持 `.env` 和 `~/.mini-cc/config.json`，并提供和 TS 版一致的 `config set` 命令行。
- **终端交互基础**: 基于 `rich` 和 `prompt_toolkit` 构建了漂亮的控制台输出。
- **异步主循环骨架**: 使用 `asyncio` 作为事件循环的核心底座，为后续并发调用大模型和工具做好准备。

## 🚀 如何运行

1. **创建虚拟环境并安装依赖**
   ```bash
   cd python
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. **启动应用**
   ```bash
   python main.py
   ```

   首次启动会自动引导你配置 API Key，你也可以手动配置：
   ```bash
   python main.py config set OPENAI_API_KEY sk-xxx
   ```

## 🛠 学习指南 (给 Python 学习者的注释)

我们在源码中留下了大量的中文注释，解释了 **“为什么要这么写”**。
例如：
- `pathlib` 为什么比 `os.path` 好？
- `asyncio` 的作用是什么？
- `rich` 怎么进行控制台渲染？
- 怎么编写干净的 CLI (使用 `argparse`)？