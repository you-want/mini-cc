# 🐹 mini-cc (Go Edition)

这是 `mini-cc` 智能体的 **Go 语言实现版本**。

作为编译型强类型语言，Go 版本在保持极简、函数式架构的同时，具有极高的启动速度、并发性能以及出色的部署便利性。

本版本完全实现了核心的 Agent 循环、多轮工具调用（Tool Use）、安全沙盒机制，以及大模型的流式推理和思维链显示。

## ✨ 已实现功能

1. **高性能与零依赖部署**：编译为单个可执行文件，即可直接在不同环境运行，CLI 启动几乎无延迟。
2. **多模型无缝切换**：采用标准库原生实现 SSE 流式接收，轻松对接各大 OpenAI 兼容模型接口（包含对 Qwen 等模型深度推理 `reasoning_content` 的支持）。
3. **完整工具链 (Tool Use)**：
   - `BashTool`：利用 Go 的 `os/exec` 原生调用系统命令行，支持带工作区隔离的上下文注入。
   - `FileReadTool`：支持读取代码及配置文件，并附带精准的行号返回。
   - `FileWriteTool`：使用原生 `os.MkdirAll` 递归创建目录并写入文件。
4. **安全沙盒隔离**：
   - 内置强大的黑名单正则拦截引擎，防止 `rm -rf /` 等高危命令。
   - 支持多层嵌套包装器（如 `sudo timeout 10 watch ls`）的自动剥离。
   - 带有严格的文件防覆盖（`require_new`）机制，防止大模型意外覆写用户重要代码。
5. **优雅的终端交互**：
   - 引入 `liner` 库，完美支持键盘上下方向键查找输入历史。
   - 针对中文（CJK）环境修复了底层宽度计算，完美解决全角标点符号导致的光标错位与文字重叠问题。
   - 优雅处理 `Ctrl + C` 中断。

## 🚀 安装与使用

### 方法一：全局一键安装 (推荐)

只要你的电脑上安装了 **Go 环境 (>=1.21)**，就可以通过一行命令直接从 GitHub 拉取并编译为全局系统命令：

```bash
go install github.com/you-want/mini-cc/go/cmd/mini-cc@latest
```

安装完成后，确保你的 `$(go env GOPATH)/bin` 已经加入到系统的 `PATH` 环境变量中。然后你就可以在任何目录的终端直接输入以下命令唤起：

```bash
mini-cc
```

### 方法二：源码本地编译

如果你想阅读或修改源码：

```bash
# 1. 克隆代码并进入目录
git clone https://github.com/you-want/mini-cc.git
cd mini-cc/go

# 2. 下载依赖
go mod tidy

# 3. 编译并运行
go build -o mini-cc cmd/mini-cc/main.go
./mini-cc
```

## ⚙️ 配置环境变量

`mini-cc` 启动时会尝试读取配置来获取 API Key。它支持**双层回退机制**：优先读取当前运行目录下的 `.env`，如果没找到，会去读取用户主目录下的全局配置 `~/.mini-cc-env`。

建议你在主目录下创建全局配置：

```bash
nano ~/.mini-cc-env
```

填入以下内容：

```env
# 必填：你的大模型 API Key
OPENAI_API_KEY="sk-xxxxxx"

# 选填：大模型接口的 Base URL（如果不填，默认为 OpenAI 官方地址）
OPENAI_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"

# 选填：你想使用的模型名称（默认为 qwen3.6-plus）
MODEL_NAME="qwen-max"
```

配置完成后，启动程序出现 `mini-cc>` 提示符即代表环境配置成功。快来尝试给它下达你的编程指令吧！
