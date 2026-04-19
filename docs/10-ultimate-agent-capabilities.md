# 第十章：我是如何剖析 CLI 里的终极 Agent 能力的（电脑控制与浏览器接管）

大家好。我又来了，抱着打破砂锅问到底的态度，把 Claude Code 源码的 `src/utils/` 目录彻底翻了个底朝天。

结果，我发现了一个**足以颠覆大家对命令行工具认知的秘密**。

你以为 Claude Code 只是一个能在终端里敲敲命令、改改代码的辅助工具？

大错特错！在它的源码深处，竟然藏着全套的**桌面控制（Computer Use）**和**浏览器自动化（Chrome 接管）**模块。

是的，只要给它权限，它完全可以把你的电脑当成自己的游乐场。

今天咱们就来扒一扒，Claude Code 是如何突破终端黑框框的束缚，化身为全能 Agent（智能体）的。

我将带你直接深入源码，用真实的依据来说话。

## 学习目标

在这篇绝对硬核的压轴之作里，你会学到：
1. **跨语言的底层调用**：Node.js CLI 如何通过 Rust 和 Swift 模块控制你的鼠标键盘。
2. **巧妙的窗口管理策略**：大模型截屏时如何避免拍到自己（Terminal 穿透技术）。
3. **浏览器接管**：MCP 协议如何成为 CLI 与 Chrome 扩展之间的通信桥梁。
4. **云端接力**：探索神秘的 `Ultraplan` 指令，看它如何将重度任务卸载到云端多智能体。

---

## 源码探秘：当 AI 长出手眼

### 1. 桌面控制（Computer Use）：鼠标、键盘与截屏

当我打开 `src/utils/computerUse/executor.ts` 文件时，我看到了极其震撼的注释和代码。

Anthropic 的工程师们在这里集成了两个底层原生模块，直接跨语言调用操作系统的底层能力：

- `@ant/computer-use-input`：底层使用 Rust（依赖 `enigo` 库），专门负责模拟鼠标移动、点击和键盘敲击。
- `@ant/computer-use-swift`：底层使用 macOS 原生 Swift API（如 `SCContentFilter` 和 `NSWorkspace`），专门负责高性能截屏和获取前台应用信息。

也就是说，如果 Claude 遇到了一个它无法通过命令行解决的 Bug，它甚至可以**自己打开模拟器，通过视觉截屏分析 UI 界面，然后直接用鼠标去点击界面的按钮**！

**防穿帮设计（Terminal as Surrogate Host）**：
这里有一个极其精妙的设计。因为大模型是在终端里运行的，如果它截屏，难道截到的全是满屏幕滚动的代码日志？

在源码的注释里，工程师详细解释了 `getTerminalBundleId()` 的作用：
- 代码会检测当前运行的终端应用（比如 iTerm2 还是 macOS Terminal），并在截屏时**主动把终端窗口从画面中排除（Capture Excluding）**。
- 同时，它甚至在点击事件时绕过终端窗口，确保点击能精准落在背后的目标应用上。

源码中是这样处理剪贴板的，它没有依赖庞大的 Electron 模块，而是直接调用了 macOS 的 `pbcopy` 和 `pbpaste`，非常轻量硬核：

```typescript
// 节选自 src/utils/computerUse/executor.ts
async function readClipboardViaPbpaste(): Promise<string> {
  const { stdout, code } = await execFileNoThrow('pbpaste', [], {
    useCwd: false,
  })
  if (code !== 0) {
    throw new Error(`pbpaste exited with code ${code}`)
  }
  return stdout
}
```

**为什么目前不支持 Windows？**

在探索这段代码时，我发现了一个关键的跨平台限制：**桌面控制目前被强行锁死在了 macOS，暂时不支持 Windows**。

工程师直接在核心执行器的入口写死了拦截：

```typescript
// 节选自 src/utils/computerUse/executor.ts
export function createCliExecutor(opts: { ... }): ComputerExecutor {
  if (process.platform !== 'darwin') { // 'darwin' 即 macOS
    throw new Error(
      `createCliExecutor called on ${process.platform}. Computer control is macOS-only.`,
    )
  }
  // ...
}
```

这并非他们不想支持，而是**卡在了智能截屏与窗口管理**。

底层键盘鼠标库 `@ant/computer-use-input` (Rust/enigo) 其实是跨平台的，但为了实现上述精妙的“终端穿透”，系统截屏模块 `@ant/computer-use-swift` 深度依赖了 macOS 原生的 `SCContentFilter` 和 `NSWorkspace`。

在未来，Anthropic 只需补充一个调用 Windows DXGI 和 Win32 API 的底层包，就能平滑解锁 Windows 桌面。

### 2. 浏览器接管（Claude in Chrome）

如果你觉得控制鼠标还不够，来看看 `src/utils/claudeInChrome/mcpServer.ts`。

官方在这里利用 MCP（Model Context Protocol）协议，搭建了一个桥接服务。

它的作用是让 CLI 工具能够直接与你浏览器里的 **Claude for Chrome** 插件进行实时通信。

源码显示，这个桥接不仅支持通过 WebSocket 连接到官方的 Bridge 服务器，还支持本地连接。

```typescript
// 节选自 src/utils/claudeInChrome/mcpServer.ts
function getChromeBridgeUrl(): string | undefined {
  const bridgeEnabled =
    process.env.USER_TYPE === 'ant' ||
    getFeatureValue_CACHED_MAY_BE_STALE('tengu_copper_bridge', false)

  if (!bridgeEnabled) {
    return undefined
  }

  if (
    isEnvTruthy(process.env.USE_LOCAL_OAUTH) ||
    isEnvTruthy(process.env.LOCAL_BRIDGE)
  ) {
    return 'ws://localhost:8765'
  }
  // ...
  return 'wss://bridge.claudeusercontent.com'
}
```

在 `createChromeContext` 函数中，CLI 注册了处理工具调用的回调，比如当浏览器插件断开连接时，会提示用户：
`"Browser extension is not connected. Please ensure the Claude browser extension is installed and running..."`

这意味着，大模型如果需要查阅文档或进行端到端测试，它可以直接通过 MCP 协议向 Chrome 插件发送指令：
- 获取当前页面的 DOM 结构（绕过反爬虫）、点击网页上的某个链接、或者在输入框里填入测试数据。
- Claude Code 彻底打通了从“本地源码修改”到“浏览器预览与测试”的全链路自动化。

**与桌面控制不同，浏览器接管已完美支持 Windows！**

虽然电脑控制目前只支持 macOS，但我在源码中发现，**浏览器自动化这部分是完全跨平台的**。

在 `src/utils/claudeInChrome/setupPortable.ts` 里，工程师不仅支持了 macOS 和 Linux，甚至连 Windows 的各个 Chromium 内核浏览器路径都穷举了一遍：

```typescript
// 节选自 src/utils/claudeInChrome/setupPortable.ts
export function getAllBrowserDataPathsPortable(): BrowserPath[] {
  // ...
  switch (process.platform) {
    // ...
    case 'win32': {
      if (config.windows.path.length > 0) {
        // 专门针对 Windows 的 AppData 目录结构进行了判断
        const appDataBase = config.windows.useRoaming
          ? join(home, 'AppData', 'Roaming')
          : join(home, 'AppData', 'Local')
        paths.push({
          browser: browserId,
          path: join(appDataBase, ...config.windows.path),
        })
      }
      continue
    }
  }
  // ...
}
```

他们甚至硬核到将 Windows 上的 Chrome、Edge、Brave、Arc、Vivaldi 等主流浏览器的用户配置路径全写进了枚举配置里。

所以，只要你在 Windows 电脑上使用支持的浏览器，MCP 桥接通道畅通无阻，大模型依然可以愉快地帮你自动跑测试、查资料。

### 3. 云端大脑接力：神秘的 Ultraplan

大模型在本地终端里跑，受限于 Token 窗口，遇到极其复杂的架构重构任务怎么办？

在 `src/utils/ultraplan/ccrSession.ts` 里，我找到了答案。这里隐藏着一个强大的端云协同机制。

CCR 代表 Claude Code Remote，当任务过于庞大时，系统会将任务打包，传送到云端多智能体环境中执行。

源码中定义了详细的轮询和状态解析逻辑，它会不断地拉取云端的执行事件（`pollRemoteSessionEvents`），直到获取到一个被批准的最终执行计划（Exit Plan）。

```typescript
// 节选自 src/utils/ultraplan/ccrSession.ts
export type ScanResult =
  | { kind: 'approved'; plan: string }
  | { kind: 'teleport'; plan: string }
  | { kind: 'rejected'; id: string }
  | { kind: 'pending' }
  | { kind: 'terminated'; subtype: string }
  | { kind: 'unchanged' }

export class ExitPlanModeScanner {
  // ... 纯状态分类器，用于解析 CCR 事件流
  ingest(newEvents: SDKMessage[]): ScanResult {
    // 遍历云端返回的事件，寻找 EXIT_PLAN_MODE_V2_TOOL_NAME 相关的工具调用
    // ...
  }
}
```

更令人拍案叫绝的是，源码中有一个名为 `__ULTRAPLAN_TELEPORT_LOCAL__` 的魔法字符串（Sentinel）。

当你在浏览器的云端任务界面点击“传送回终端执行”时，云端会将这个标记连同制定好的计划一起发回本地，你的 CLI 接收到后，就会像拿到剧本一样，开始在你的本地机器上飞速敲代码！

这种**端云协同、算力卸载**的架构，本地负责执行，云端负责深度思考和推演，绝对是未来 AI 编程工具的发展方向！

---

## 最后：这才是完全体的 Agent

看完 `src/utils/computerUse/`、`claudeInChrome/` 和 `ultraplan/` 的源码，我深受震撼。

Anthropic 并没有把 Claude Code 局限为一个“聊天机器人 + 文件读写器”，而是把它定位成了一个**长了手、长了眼、还能召唤云端分身的超级数字员工**。

它能敲 Bash 命令，能控制你的鼠标键盘，能读懂你的 Chrome 浏览器，遇到搞不定的活儿还能呼叫云端大哥帮你推演架构。

能把这么多超前的黑科技塞进一个 NPM 安装包里，并且在代码架构上保持得如此优雅（大量使用 MCP 解耦，跨语言调用处理得滴水不漏），这源码扒得实在是太值了。

>一键三连奥，关注不迷路哈！

