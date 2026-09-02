# 我用 Python 重写了 TypeScript 的 AI Agent - mini-cc

> 一个前端开发者的 Python 实战之旅：不只是语法差异，而是工程决策的全面重塑

---

## 为什么要做这件事

我用 TypeScript 写了一个 AI 编程助手 mini-cc——能对话、能读写文件、能执行命令，类似一个简化版的 Claude Code。

做完后我有个念头：**能不能用 Python 再写一遍？**

动机很简单——我之前学了好几次 Python，每次都停留在"学了语法，不知道怎么用"的阶段。这次决定拿自己熟悉的项目来练手，顺便把过程写成系列文章。

结果：几周后，我把 Python 版发布到了 PyPI（`pip install mini-cc-python`），而且真正理解了 Python 在 AI 工程化上的优势在哪里——不是"语法更简洁"这种空话，而是具体的工程决策差异。

---

## 整体架构

```
用户输入 → Agent（大脑）→ Provider（LLM 通信）→ 模型 API
                ↓ 工具调用                    ↑ 工具结果
           ToolRegistry → 执行工具 ───────────┘
```

核心循环用伪代码表示：

```python
response = await provider.send_message(user_input)
while response.has_tool_calls:       # AI 想调用工具？
    results = await execute_tools(response.tool_calls)
    response = await provider.send_tool_results(results)  # 把结果发回给 AI
return response.text                  # AI 给出最终答案
```

看起来简单，但实现过程中有几个工程问题，TS 版和 Python 版的解法完全不同。

---

## 问题一：流式工具调用的参数拼接

这是整个项目里最棘手的技术问题之一。

OpenAI 的 Function Calling 在流式模式下，**工具调用的参数是分块返回的**。模型说"调用 file_read，参数是 `{"file_path": "/tmp/test.txt"}`"，但这个 JSON 字符串会被拆成多个 chunk 回来：

```
chunk 1: {"file_path": "/tm
chunk 2: p/test.txt"}
```

你需要自己把它们拼起来。TS 版我用了数组累加，Python 版我用了 `tool_calls_map` 字典：

```python
# OpenAI 流式工具调用的核心处理逻辑
tool_calls_map = {}  # 用 index 作为 key，支持多个并行工具调用

async for chunk in stream:
    delta = chunk.choices[0].delta
    
    if delta.tool_calls:
        for tc in delta.tool_calls:
            idx = tc.index  # 第几个工具调用（可能同时调多个工具）
            
            if idx not in tool_calls_map:
                # 首次出现：初始化结构
                tool_calls_map[idx] = {
                    "id": tc.id,
                    "function": {"name": tc.function.name or "", "arguments": ""}
                }
            
            # 增量拼接参数 JSON 字符串
            if tc.function and tc.function.arguments:
                tool_calls_map[idx]["function"]["arguments"] += tc.function.arguments
```

这里有个坑：`tc.id` 只在第一个 chunk 有值，后续 chunk 是 `None`。如果你不小心用 `None` 覆盖了之前的 id，后面发送 tool_result 时就会报错。

**拼接完成后还有第二个坑**：模型生成的 JSON 有时是非法的。比如参数里包含换行符：

```json
{"command": "echo hello
world"}
```

这个 JSON 直接 `json.loads()` 会抛异常。我加了一个修复函数：

```python
def _fix_json_string(self, raw: str) -> str:
    """修复模型生成的带换行符的非法 JSON"""
    return raw.replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')

# 使用时先尝试正常解析，失败再修复后重试
try:
    args = json.loads(raw_args)
except json.JSONDecodeError:
    args = json.loads(self._fix_json_string(raw_args))
```

**而 Anthropic 的 SDK 完全不需要这些**——它提供了 `messages.stream()` 上下文管理器，自动帮你合并工具调用的分块，最终给你一个完整的 `block.input` 字典：

```python
# Anthropic 的流式处理：SDK 帮你做了拼接工作
async with self.client.messages.stream(**request_kwargs) as stream:
    async for event in stream:
        if event.type == "text_delta":
            on_text_response(event.delta.text, False)
    final_message = await stream.get_final_message()  # 直接拿完整结果

for block in final_message.content:
    if block.type == "tool_use":
        # block.input 已经是解析好的字典，不需要手动拼 JSON
        tool_calls.append({"id": block.id, "name": block.name, "args": block.input})
```

这是两个 SDK 在设计哲学上的本质差异：OpenAI 给你底层流，你自己拼装；Anthropic 给你高层抽象，SDK 帮你处理边界情况。

---

## 问题二：Provider 接口到底怎么设计

最初我的设计是暴露一个 `chat(messages)` 方法，让 Agent 管理消息历史——就像直接调用 OpenAI API 那样传 `messages` 数组。

但很快发现问题：**Agent 需要知道 OpenAI 和 Anthropic 的消息格式差异**。

| 场景 | OpenAI 格式 | Anthropic 格式 |
|------|------------|---------------|
| 系统提示 | 放在 messages 里 `{"role": "system"}` | 单独参数 `system="..."` |
| 工具结果 | `{"role": "tool", "tool_call_id": "..."}` | 包在 `role=user` 里的 `tool_result` block |
| 助手回复 | 普通 message + tool_calls 字段 | content 数组包含 text block + tool_use block |

如果让 Agent 管消息，它就得写一堆 `if provider_type == "anthropic"` 的判断。

最终的设计是：**Provider 内部管理自己的消息历史，Agent 只调用两个方法**：

```python
class LLMProvider(ABC):
    @abstractmethod
    async def send_message(self, user_message: str, on_text_response) -> Dict:
        """告诉 Provider：用户说了什么"""

    @abstractmethod
    async def send_tool_results(self, results: List[Dict], on_text_response) -> Dict:
        """告诉 Provider：工具返回了什么"""
```

返回值统一成 `{"text": "...", "toolCalls": [...]}`，Agent 不需要关心底层格式。

这个决策让 Agent 的核心循环只有 **不到 20 行有效代码**，而且切换 LLM 提供商完全透明——新增一个 Gemini Provider 只需要实现那两个方法，Agent 一行代码不用改。

代价是什么？Provider 内部变"胖"了（OpenAI Provider 有 193 行），但这个复杂度被封装在正确的地方。

---

## 问题三：工具别名——LLM 会"叫错名字"

这是个我没预料到的问题。

我给 Bash 工具起的名字是 `"Bash"`，在 system prompt 里也告诉 LLM 工具叫这个名字。但有些模型（特别是小模型）返回的工具名却是 `"BashTool"`——它把类名和工具名搞混了。

最初我的做法是直接返回"找不到工具"错误，让 LLM 重试。但这浪费了一次 API 调用，而且有时 LLM 会反复用同一个错误名字，陷入死循环。

解决方案是**工具注册表支持别名**：

```python
class ToolRegistry:
    def _register_with_aliases(self, tool: BaseTool, aliases: List[str] = None):
        self._tools[tool.name] = tool          # "Bash" → BashTool 实例
        for alias in (aliases or []):
            self._tools[alias] = tool           # "BashTool" → 同一个实例

# 注册时
self._register_with_aliases(BashTool(), ["BashTool"])
self._register_with_aliases(FileReadTool(), ["FileReadTool"])
```

`list_tools()` 需要去重（同一个工具别列两次，否则 OpenAI API 会报 schema 冲突）：

```python
def list_tools(self) -> List[BaseTool]:
    seen = set()
    return [t for t in self._tools.values()
            if id(t) not in seen and not seen.add(id(t))]
```

这个设计虽然简单，但解决了一类真实存在的 LLM 幻觉问题。

---

## 问题四：Pydantic 自动生成 Schema 到底怎么用

TS 版里工具的 JSON Schema 是手写的——容易写错、没有校验、改参数名时经常忘记同步更新 schema。

Python 版用 Pydantic 的 `model_json_schema()` 方法，**从类型注解自动生成 Schema**：

```python
from pydantic import BaseModel, Field

class FileReadArgs(BaseModel):
    file_path: str = Field(..., description="要读取的文件路径")
    limit: Optional[int] = Field(None, description="限制读取的行数")

class FileReadTool(BaseTool):
    name = "FileRead"
    args_schema = FileReadArgs

    def to_openai_schema(self) -> dict:
        schema = self.args_schema.model_json_schema()
        # 清理 Pydantic 自动生成的 title 字段（OpenAI 不需要）
        schema.pop("title", None)
        for prop in schema.get("properties", {}).values():
            prop.pop("title", None)
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": schema   # ← 这就是自动生成的 JSON Schema
            }
        }
```

调用 `FileReadArgs.model_json_schema()` 得到的是：

```json
{
  "type": "object",
  "properties": {
    "file_path": {"type": "string", "description": "要读取的文件路径"},
    "limit": {"anyOf": [{"type": "integer"}, {"type": "null"}], "description": "限制读取的行数"}
  },
  "required": ["file_path"]
}
```

这不只是少写了几行代码——**参数类型在运行时也会校验**。当 LLM 传了个 `file_path: 123`（数字而不是字符串），Pydantic 会抛出校验错误，而不是等到 `open()` 时报一个让人困惑的 `TypeError`。

TS 里没有这种"从类型定义自动生成运行时校验"的能力（zod 能做到，但不是标准做法）。这是 Python AI 工具链选 Pydantic 的核心原因。

---

## TS vs Python：真正有感的差异

不是语法对比表（那种到处都有），而是实际开发中让我有"原来如此"感受的差异：

**1. `asyncio.run()` 不是可选的**

在 TS 里 `await` 直接写就行（Node.js 顶层 await）。Python 里你必须有一个事件循环入口：

```python
# 直接 await 会报错：SyntaxError
# 必须有 asyncio.run() 来启动事件循环
async def main():
    agent = Agent(provider)
    await agent.chat("hello")

asyncio.run(main())  # ← 这一行不能省
```

**2. 包管理：`pyproject.toml` 不只是 `package.json` 的翻版**

`pip install -e .` 对应 `npm link`，但 Python 的可编辑安装机制更复杂——它实际上在你的 site-packages 里创建了一个 `.pth` 文件指向源码目录。这意味着改了源码不需要重新安装，但改了 `pyproject.toml` 的 entry points 需要重新 `pip install -e .`。

**3. 模块导入的"相对 vs 绝对"是个真问题**

TS 的 `import { x } from './y'` 永远相对于当前文件。Python 的 `from .y import x`（相对导入）只在包内部有效，一旦你用 `python -m` 运行或者在不同上下文执行，相对导入就会报 `ImportError`。我最终全部改成了绝对导入 `from mini_cc.core.y import x`。

---

## 项目成果

```bash
pip install mini-cc-python
mini-cc-py --provider openai --model gpt-4o
```

核心能力：
- 流式输出（含 Qwen 等模型的思维链支持）
- 文件读写、命令执行（三层安全拦截）
- 记忆持久化（`.ai_memory/global_memory.txt`）
- 支持 OpenAI / Anthropic / 兼容接口

12 个测试全部通过，覆盖 Agent 循环、工具执行、安全检查、记忆管理。

---

源码：[github.com/you-want/mini-cc](https://github.com/you-want/mini-cc)（Python 版在 `python/` 目录）

---

<!-- 
=== 三平台适配说明（不发，仅供作者参考） ===

【公众号版调整】
- 删掉"问题一"中的完整代码块，改成口述 + 截图
- 保留"问题二"的表格（公众号表格在电脑端还行）
- 增加个人故事比例
- 末尾加二维码/关注引导

【CSDN版调整】
- 标题改为："Python 实现 AI Agent 核心架构：流式工具调用与 Provider 抽象层设计"
- 补充环境配置步骤
- 代码注释更详细

【掘金版】（当前版本，直接使用）
-->
