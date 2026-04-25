# Architecture Mocks (架构级演练演示)

**⚠️ 诚实声明：本目录下的代码仅供源码架构学习与演示，并不提供实际的系统级控制能力。**

## 为什么有这个目录？

`mini-cc`（Mini Claude Code）是一个旨在剖析、学习和复刻大厂 AI 编程智能体架构的开源项目。
在官方原版的 Claude Code 中，存在着许多非常底层的“终极 Agent 能力”，例如：

1. **桌面控制 (Computer Use)**：跨语言调用 Rust 和 Swift 模块控制用户的鼠标、键盘并进行智能截屏。
2. **浏览器接管 (Claude in Chrome)**：通过 MCP 协议与浏览器扩展通信，甚至能嗅探各个操作系统的 AppData 数据目录。
3. **云端接力 (Ultraplan / CCR)**：将重度架构推演任务卸载到云端的多智能体集群执行。

为了保持 `mini-cc` 的纯粹性、安全性和跨平台易安装性（避免引入过于庞大、包含 C++ 编译的底层依赖如 `robotjs` 或 `puppeteer`），我们在这里采用了 **“接口先行 (Interface-first)”** 的 Mock 机制。

## 包含的内容

- `computerUse/`：还原了系统拦截逻辑与跨平台锁死机制的架构。
- `claudeInChrome/`：还原了跨平台浏览器数据路径（AppData）嗅探与 WebSocket 桥接分发。
- `ultraplan/`：还原了 CCR（Claude Code Remote）状态机的轮询事件解析与 `teleport` (传送门) 拦截逻辑。

这些模块配有完善的单元测试。未来如果有开发者想要为 `mini-cc` 接入真实的 `nut.js` 或者 `Puppeteer`，可以直接在此接口基础上进行二次开发！
