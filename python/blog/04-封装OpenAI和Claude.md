# 用 Python 封装 OpenAI 和 Claude，它们的 API 差得比你想的多

> Provider 策略模式实战：同一个接口，两套完全不同的实现

---

做 mini-cc 的时候，我一开始只用 OpenAI。后来想加 Claude 支持，心想"加个 Provider 不就行了嘛"。

结果发现 **OpenAI 和 Anthropic 的 API 差异比想象中大得多**。不是改个 URL 和参数名的事，而是消息结构、工具调用机制、流式处理方式全都不一样。

这篇文章记录我在实现两个 Provider 时遇到的真实差异，以及怎么用策略模式把它们统一起来。

---

## 先看差异有多大

| 场景 | OpenAI | Anthropic |
|------|--------|-----------|
| 系统提示词 | 放在 messages 数组里 `{"role": "system"}` | 单独的 `system` 参数 |
| 工具结果怎么传 | `{"role": "tool", "tool_call_id": "..."}` | 包在 `{"role": "user"}` 里的 `tool_result` block |
| 助手回复结构 | content 是字符串，tool_calls 是独立字段 | content 是数组，包含 text block 和 tool_use block |
| 流式工具调用 | 参数分 chunk 返回，需要手动拼接 | SDK 自动合并，给你完整的 input 字典 |
| 工具 Schema 格式 | `{"function": {"parameters": ...}}` | `{"input_schema": ...}` |

如果你直接把调用代码写在 Agent 里，就会变成一坨 `if provider_type == "openai" else ...` 的分支。所以必须用抽象层。

---

## 接口设计：为什么只有两个方法

```python
from abc import ABC, abstractmethod

class LLMProvider(ABC):
    @abstractmethod
    async def send_message(self, user_message: str, on_text_response) -> Dict:
        """用户说了什么"""

    @abstractmethod
    async def send_tool_results(self, results: List[Dict], on_text_response) -> Dict:
        """工具返回了什么"""
```

你可能会问：为什么不设计成 `chat(messages)` 让调用方传消息列表？

因为我发现 Agent 根本不需要关心消息格式。它只需要知道两件事：
1. 把用户的话告诉 LLM
2. 把工具结果告诉 LLM

至于消息怎么拼、系统提示放哪、工具结果用什么 role——这些都是 Provider 内部的事。

返回值也统一了：
```python
{"text": "最终文本", "toolCalls": [{"id": "...", "name": "...", "args": {...}}]}
```

不管底层是 OpenAI 还是 Anthropic，Agent 拿到的都是这个结构。

---

## OpenAI Provider：流式拼接的复杂度

OpenAI 的 SDK 给你底层流，所有拼装工作自己做。

**文本回复的流式处理：**
```python
async for chunk in stream:
    delta = chunk.choices[0].delta
    
    # 普通文本
    if delta.content:
        full_content += delta.content
        on_text_response(delta.content, False)
```

**工具调用的流式处理**（这是最复杂的部分）：

OpenAI 把工具调用的参数拆成多个 chunk 返回。你需要用 `index` 来区分"这是第几个工具调用"，然后逐个拼接 JSON 字符串：

```python
tool_calls_map = {}  # {index: {id, function: {name, arguments}}}

if delta.tool_calls:
    for tc in delta.tool_calls:
        idx = tc.index
        if idx not in tool_calls_map:
            tool_calls_map[idx] = {
                "id": tc.id or f"call_{int(time.time() * 1000)}_{idx}",
                "function": {"name": tc.function.name or "", "arguments": ""}
            }
        if tc.function and tc.function.arguments:
            tool_calls_map[idx]["function"]["arguments"] += tc.function.arguments
```

**Qwen 等模型的思维链支持：**

很多 OpenAI 兼容接口（比如通义千问）支持 `reasoning_content` 字段，在正式回复前先输出一段思考过程：

```python
reasoning = getattr(delta, 'reasoning_content', None)
if reasoning:
    on_text_response(reasoning, True)  # is_thinking=True
```

这里用了 `getattr` 而不是直接访问 `delta.reasoning_content`，因为 OpenAI 官方 SDK 的 delta 对象没有这个属性（它是第三方扩展），直接访问会报 `AttributeError`。

---

## Anthropic Provider：SDK 帮你做了很多事

对比 Anthropic 的实现，你会发现简洁得多：

```python
async with self.client.messages.stream(**request_kwargs) as stream:
    async for event in stream:
        if event.type == "text_delta":
            full_content += event.delta.text
            on_text_response(event.delta.text, False)
    
    final_message = await stream.get_final_message()

for block in final_message.content:
    if block.type == "text":
        # 文本回复
    elif block.type == "tool_use":
        # 工具调用——block.input 已经是解析好的字典！
        tool_calls.append({"id": block.id, "name": block.name, "args": block.input})
```

**关键区别：`block.input` 是一个字典，不是 JSON 字符串。** Anthropic 的 SDK 帮你做了拼接和解析，不需要像 OpenAI 那样手动拼 JSON。

但是 Anthropic 有另一个坑：**工具结果的格式**。

OpenAI 的工具结果是 `role: "tool"` 的独立消息：
```python
# OpenAI
self.messages.append({
    "role": "tool",
    "tool_call_id": result["id"],
    "content": result["result"]
})
```

Anthropic 要求工具结果**包在 role: "user" 的消息里**，而且用 `tool_result` type：
```python
# Anthropic
self.messages.append({
    "role": "user",  # ← 注意是 "user" 不是 "tool"
    "content": [{
        "type": "tool_result",
        "tool_use_id": result["id"],
        "content": result["result"],
        "is_error": result.get("isError", False)
    }]
})
```

第一次写的时候我在这里卡了好久——Claude 一直报 "unexpected role" 错误，后来翻文档才发现 Anthropic 没有 `role: "tool"` 这个概念。

---

## 工具 Schema 的格式转换

工具定义的格式也不一样。我项目里工具统一用 OpenAI 格式的 Schema（因为 Pydantic 生成的就是这种），然后在 Anthropic Provider 里做转换：

```python
# OpenAI 格式
{
    "type": "function",
    "function": {
        "name": "FileRead",
        "description": "读取文件",
        "parameters": { ... }   # ← 关键字段
    }
}

# Anthropic 格式（需要转换）
{
    "name": "FileRead",
    "description": "读取文件",
    "input_schema": { ... }     # ← 换了个名字
}
```

转换代码：
```python
def _get_tool_schemas(self) -> List[Dict]:
    from mini_cc.tools.registry import registry
    result = []
    for tool in registry.list_tools():
        schema = tool.to_openai_schema()
        result.append({
            "name": schema["function"]["name"],
            "description": schema["function"]["description"],
            "input_schema": schema["function"]["parameters"]  # 只是改了个字段名
        })
    return result
```

看起来简单，但这个"字段名不同"的问题，在第一次对接的时候让我 debug 了半小时——Claude 说"工具没有 input_schema"，我才发现 Anthropic 不认 `parameters` 这个键。

---

## 工厂函数：一行代码切换 Provider

```python
def create_provider(provider_type="openai", api_key=None, base_url=None, model=None):
    if provider_type == "anthropic":
        key = api_key or get_config_value("ANTHROPIC_API_KEY")
        if not key:
            raise ValueError("ANTHROPIC_API_KEY 未配置")
        return AnthropicProvider(api_key=key, model=model or "claude-sonnet-4-20250514")
    else:
        key = api_key or get_config_value("OPENAI_API_KEY")
        if not key:
            raise ValueError("OPENAI_API_KEY 未配置")
        return OpenAIProvider(api_key=key, base_url=base_url, model=model or "gpt-4o")
```

CLI 里用起来：
```python
provider = create_provider(provider_type=args.provider)
agent = Agent(provider)
# Agent 完全不知道用的是哪个 LLM
```

---

## 一个意外收获：兼容 OpenAI 接口的第三方服务

因为 OpenAI Provider 支持 `base_url` 参数，所以任何兼容 OpenAI API 格式的服务都能直接用：

```python
# 通义千问
provider = create_provider(
    provider_type="openai",
    api_key="sk-xxx",
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    model="qwen-max"
)

# DeepSeek
provider = create_provider(
    provider_type="openai",
    api_key="sk-xxx",
    base_url="https://api.deepseek.com/v1",
    model="deepseek-chat"
)
```

不需要写新 Provider——只要对方实现了 OpenAI 的 API 规范，就能无缝对接。这在国内 API 环境下特别有用，因为很多国内模型都做了 OpenAI 兼容接口。

---

## 如果要加 Gemini 怎么办？

加一个新 Provider 只需要：
1. 创建 `gemini_provider.py`
2. 继承 `LLMProvider`
3. 实现 `send_message()` 和 `send_tool_results()`
4. 在工厂函数里加一个 `elif provider_type == "gemini":`

Agent、工具系统、CLI——一行代码都不用改。这就是策略模式的价值。

---

*下一篇：让 AI 能动手：工具系统的 Pydantic 方案*

源码：[github.com/you-want/mini-cc](https://github.com/you-want/mini-cc)（Python 版在 `python/` 目录）
