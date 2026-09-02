# AI Agent 的核心循环，其实就这几十行代码

> 拆开 Agent 的神秘面纱：它不过是一个 while 循环加一堆 if-else

---

很多人觉得 AI Agent 是个很高深的东西——什么"自主决策"、"多步推理"、"工具调用"。

我自己写完之后发现：**核心逻辑真的就几十行代码**。

这篇文章带你拆开看 Agent 到底是怎么工作的。不是理论框架，是我实际跑的代码。

---

## 一张图看懂 Agent 循环

```
用户说话
   ↓
发给 LLM（OpenAI/Claude）
   ↓
LLM 回复了 ──── 有工具调用？─── 否 ──→ 直接返回答案给用户
                    │ 是
                    ↓
              执行工具（读文件/跑命令）
                    ↓
              把工具结果发回给 LLM
                    ↓
              回到「LLM 回复了」（继续循环）
```

就这么简单。Agent 本质上就是一个 **while 循环**——只要 LLM 还想调用工具，就一直转，直到它给出最终答案。

---

## 核心代码：真的就这些

这是我项目里 `agent.py` 的核心逻辑，去掉注释和错误处理后：

```python
class Agent:
    def __init__(self, provider: LLMProvider):
        self.provider = provider
    
    async def chat(self, user_input: str, on_text_response) -> str:
        # 第一步：把用户的话发给 LLM
        response = await self.provider.send_message(user_input, on_text_response)
        
        # 第二步：只要 LLM 还想调工具，就一直循环
        loop_count = 0
        while response.get("toolCalls") and loop_count < 30:
            loop_count += 1
            results = await self.handle_tool_calls(response["toolCalls"])
            response = await self.provider.send_tool_results(results, on_text_response)
        
        # 第三步：LLM 不再调工具了，返回最终答案
        return response.get("text", "")
```

数数看，有效代码不到 10 行。

但魔鬼在细节——`handle_tool_calls()` 里面有不少工程考量：

```python
async def handle_tool_calls(self, tool_calls: List[Dict]) -> List[Dict]:
    results = []
    for tc in tool_calls:
        tc_id = tc.get("id", "")
        tc_name = tc.get("name", "")
        tc_args = tc.get("args", {})
        
        # 情况 1：参数 JSON 解析失败了
        # （LLM 生成的 JSON 有时候是非法的，Provider 解析不了会打标记）
        if tc_args.get("_parse_error"):
            results.append({
                "id": tc_id,
                "result": f"工具 '{tc_name}' 的参数解析失败，请重试。",
                "isError": True
            })
            continue
        
        # 情况 2：找不到这个工具
        # （LLM 有时会编造不存在的工具名）
        tool = registry.get_tool(tc_name)
        if not tool:
            results.append({
                "id": tc_id,
                "result": f"找不到工具 '{tc_name}'。可用工具: {', '.join(...)}",
                "isError": True
            })
            continue
        
        # 情况 3：正常执行
        try:
            result = await tool.execute(**tc_args)
            results.append({"id": tc_id, "result": result, "isError": False})
        except Exception as e:
            results.append({
                "id": tc_id,
                "result": f"工具执行异常: {e}",
                "isError": True
            })
    
    return results
```

---

## 三个关键的设计决策

### 1. 为什么要限制最大循环次数？

```python
MAX_AGENT_LOOPS = 30
```

这行看起来保守得不像话，但实际上非常必要。

LLM 有时候会陷入**工具调用死循环**：调用 Bash 工具 → 看到结果不满意 → 再调用 → 又不满意 → 又调用...

我测试时遇到过一次，GPT-4o 试图修复一个报错文件，改了 15 次都没改对，一直在 FileWrite → FileRead → FileWrite 之间循环。如果没有 30 次的上限，这个循环会一直转下去，烧掉你一堆 token。

30 次对大多数任务绰绰有余（通常 3-5 次就够了），但能防止极端情况下的无限消耗。

### 2. 错误不要抛异常，要返回给 LLM

注意看我的错误处理——不管是"找不到工具"还是"执行异常"，我都把错误信息作为**字符串结果**返回给 LLM，而不是抛 Python 异常。

```python
# ❌ 不要这样做（直接抛异常会中断整个 Agent 循环）
raise ValueError(f"找不到工具: {tc_name}")

# ✅ 要这样做（把错误信息发回给 LLM，让它自己决定怎么办）
results.append({"id": tc_id, "result": f"找不到工具 '{tc_name}'", "isError": True})
```

为什么？因为 **LLM 看到错误信息后可能会自我修正**。

比如 LLM 调用了不存在的工具 `"ReadFile"`（正确的叫 `"FileRead"`），我把"找不到工具，可用的有: FileRead, FileWrite, Bash"这个信息返回给它，它下次就会用正确的名字重新调用。

这就是 Agent 和普通 API 调用的区别：Agent 有**自我纠错的能力**，前提是你不要把异常直接抛到循环外面。

### 3. Agent 自己不管消息历史

最初我的设计是 Agent 持有 `messages` 列表，手动拼装发给 LLM：

```python
# 旧设计（后来放弃了）
class Agent:
    messages = []
    
    async def chat(self, user_input):
        self.messages.append({"role": "user", "content": user_input})
        response = await self.provider.chat(self.messages)  # ← Agent 管消息
        self.messages.append({"role": "assistant", ...})
```

问题是 OpenAI 和 Anthropic 的消息格式差太多了（系统提示位置不同、工具结果的包装方式不同、助手回复的结构不同）。如果 Agent 管消息，它就得写一堆 `if provider_type == "anthropic"` 的判断。

最终我让 **Provider 内部管理自己的消息历史**，Agent 只管调用：

```python
# 新设计（实际采用的）
response = await self.provider.send_message(user_input, on_text_response)
# ↑ Provider 内部自动把 user_input 加到自己的 messages 里

response = await self.provider.send_tool_results(results, on_text_response)
# ↑ Provider 内部自动把工具结果包装成正确的格式
```

Agent 完全不知道消息长什么样，也不需要知道。这让切换 LLM 提供商变得完全透明。

---

## `on_text_response` 回调是干嘛的

你可能注意到 `chat()` 方法有个 `on_text_response` 参数。这是为了支持**流式输出**。

LLM 的回复不是一个字符串一下子回来的，而是一个 token 一个 token 流式返回的。`on_text_response` 就是一个回调函数，每收到一个 chunk 就调一次：

```python
# 签名
on_text_response(text: str, is_thinking: bool) -> None

# 默认实现：直接打印到终端
@staticmethod
def _default_text_handler(text: str, is_thinking: bool) -> None:
    print(text, end="", flush=True)
```

`is_thinking` 参数用来区分模型的"思维链"和"正式回复"。Qwen 等模型支持先输出一段思考过程，再输出最终答案，我用不同的标记把它们区分开：

```
==================== 思考过程 ====================
让我先看看这个文件的内容...需要先读取 package.json...

==================== 完整回复 ====================
这个项目的依赖结构如下...
```

---

## `/clear` 命令的实现

Agent 还有一个 `clear_history()` 方法，对应用户的 `/clear` 命令：

```python
def clear_history(self) -> None:
    """清空对话历史，但保留系统提示词"""
    if hasattr(self.provider, 'messages'):
        # 只保留第一条消息（系统提示）
        self.provider.messages = self.provider.messages[:1]
```

这个实现很 hacky——Agent 直接操作 Provider 内部的 `messages` 属性。正常来说这违反了封装原则，但在当前规模下这是最简单的方案。如果以后 Provider 变复杂了（比如消息存在数据库里），这个方法也得跟着改。

---

## 从测试角度看 Agent 设计

写测试时你会发现这种设计的好处——Agent 只依赖 Provider 接口，Mock 一个 Provider 就能完整测试 Agent 循环：

```python
class MockProvider(LLMProvider):
    def __init__(self):
        self.loop_count = 0
    
    async def send_message(self, user_message, on_text_response):
        self.loop_count += 1
        # 第一次：返回一个工具调用
        return {
            "text": "好的，我来执行",
            "toolCalls": [{"id": "call_1", "name": "BashTool", "args": {"command": "echo hello"}}]
        }
    
    async def send_tool_results(self, results, on_text_response):
        self.loop_count += 1
        # 第二次：不再调工具，循环结束
        return {"text": "执行完毕！", "toolCalls": []}

# 测试
agent = Agent(MockProvider())
result = await agent.chat("帮我跑个命令")
assert result == "执行完毕！"
assert mock.loop_count == 2  # 确实循环了两次
```

注意 MockProvider 返回的工具名是 `"BashTool"`（而不是 `"Bash"`）。这就是为什么我在工具注册表里加了别名机制——LLM 用哪个名字，我们都能找到正确的工具。

---

## 总结

Agent 的设计原则其实就三条：

1. **循环有上限**——防止死循环烧 token
2. **错误要返回给 LLM**——让它有自我修正的机会
3. **Agent 不管消息格式**——Provider 自己处理差异

核心代码不到 30 行有效逻辑，但每条 `if` 背后都有一个真实的踩坑故事。

---

*下一篇：用 Python 封装 OpenAI 和 Claude，我选了这种方式*

源码：[github.com/you-want/mini-cc](https://github.com/you-want/mini-cc)（Python 版在 `python/` 目录）
