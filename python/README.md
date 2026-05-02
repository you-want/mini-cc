# mini-cc (Python Edition)

`you-want-mini-cc` is the Python port of the lightweight AI pair programming agent `@you-want/mini-cc`. 
It provides a seamless, terminal-based pair programming experience powered by Large Language Models (LLMs) such as Claude 3.5 Sonnet and Qwen.

## Installation

```bash
pip install you-want-mini-cc
```

## Quick Start

Before running, you need to configure your LLM provider credentials. The agent supports both OpenAI-compatible APIs and Anthropic.

1. Create a `.env` file in your working directory (or set environment variables globally):
```env
# For OpenAI Compatible Models (e.g., Qwen, DeepSeek)
PROVIDER=openai
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://api.your-provider.com/v1
MODEL_NAME=qwen3.6-plus

# OR For Anthropic Models
PROVIDER=anthropic
ANTHROPIC_API_KEY=your_api_key_here
MODEL_NAME=claude-3-7-sonnet-20250219
```

2. Run the CLI in your terminal:
```bash
mini-cc
```

## Features
- **Pure Python & Asyncio**: Fully asynchronous architecture for blazing-fast non-blocking I/O.
- **Agentic Loop**: Built-in `BashTool`, `FileReadTool`, `FileWriteTool` for autonomous coding and execution.
- **Security Sandbox**: Built-in bash execution wrapper stripper and destructive command interception.
- **High-fidelity Terminal UI**: Supports dynamic ANSI-rendered banners and streaming responses.
- **MCP Support**: Connects seamlessly with Model Context Protocol (MCP) plugins via `stdio`.

## Usage
Inside the `mini-cc>` prompt, simply ask the agent to perform tasks:
> "Read the src/main.py file and add comments to the functions."
> "Run tests and fix any failing ones."

Use `/help` for more built-in commands.

## License
MIT License
