# 让 AI 能动手：我用 Pydantic 搞定了一套工具系统

> BaseTool + Pydantic 自动生成 JSON Schema，比手写 schema 强在哪

---

AI Agent 要"能做事"，靠的是工具系统——读文件、写文件、跑命令，这些能力不是 LLM 自带的，而是你给它装上的。

这篇文章聊聊我在 mini-cc 里怎么设计工具系统的。核心思路就一个：**用 Pydantic 的 BaseModel 定义参数，自动生成 JSON Schema，省去手写 schema 的痛苦**。

---

## 手写 Schema 有多痛

TS 版本里我是这么定义工具的：

```typescript
const tool = {
  name: "file_read",
  description: "读取文件",
  input_schema: {
    type: "object",
    properties: {
      file_path: { type: "string", description: "文件路径" },
      limit: { type: "integer", description: "限制行数" }
    },
    required: ["file_path"]
  }
}
```

问题：
1. 每次改参数名，要同步改 schema（经常忘）
2. `required` 数组要手动维护
3. 参数类型没有运行时校验
4. `Optional` 类型要写 `anyOf: [{type: "integer"}, {type: "null"}]`，丑得要死

---

## Pydantic 方案：类型注解 → Schema 一步到位

```python
from pydantic import BaseModel, Field
from typing import Optional

class FileReadArgs(BaseModel):
    file_path: str = Field(..., description="要读取的文件路径")
    limit: Optional[int] = Field(None, description="限制读取的行数")
```

就这几行，`FileReadArgs.model_json_schema()` 直接输出：

```json
{
  "type": "object",
  "properties": {
    "file_path": {
      "type": "string",
      "description": "要读取的文件路径"
    },
    "limit": {
      "anyOf": [{"type": "integer"}, {"type": "null"}],
      "description": "限制读取的行数"
    }
  },
  "required": ["file_path"]
}
```

`required` 自动推导（`file_path` 没有默认值所以要传，`limit` 有默认值 `None` 所以可选）。`Optional[int]` 自动转成 `anyOf`。

**而且参数在运行时也会校验**。LLM 传了 `file_path: 123`（数字），Pydantic 会直接报 `ValidationError`，而不是等到 `open()` 时给你一个让人困惑的 `TypeError`。

---

## BaseTool 抽象基类

```python
from abc import ABC, abstractmethod
from typing import Type
from pydantic import BaseModel

class BaseTool(ABC):
    name: str = ""
    description: str = ""
    args_schema: Type[BaseModel] = BaseModel
    
    def to_openai_schema(self) -> dict:
        schema = self.args_schema.model_json_schema()
        # Pydantic 会生成 title 字段，OpenAI API 不需要，清掉
        schema.pop("title", None)
        for prop in schema.get("properties", {}).values():
            prop.pop("title", None)
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": schema
            }
        }
    
    @abstractmethod
    async def execute(self, **kwargs) -> str:
        pass
```

每个工具继承 `BaseTool`，指定 `args_schema`，实现 `execute()` 方法。完事。

---

## 实际工具长什么样

### FileReadTool

```python
class FileReadTool(BaseTool):
    name = "FileRead"
    description = "读取文件内容，支持 limit 参数限制行数"
    args_schema = FileReadArgs
    
    async def execute(self, file_path: str, limit: Optional[int] = None) -> str:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except FileNotFoundError:
            return f"错误：文件 '{file_path}' 不存在"
        except UnicodeDecodeError:
            # 非 UTF-8 文件，用 latin-1 兜底
            with open(file_path, 'r', encoding='latin-1') as f:
                content = f.read()
        
        if limit and len(content.split('\n')) > limit:
            lines = content.split('\n')[:limit]
            return f"共 {len(content.split(chr(10)))} 行，显示前 {limit} 行：\n" + '\n'.join(lines)
        
        return f"成功读取，共 {len(content)} 字符：\n\n{content}"
```

有个细节：`UnicodeDecodeError` 的兜底处理。LLM 有时候让我读二进制文件或者编码奇怪的配置文件，如果只处理 UTF-8 就会报错。`latin-1` 能读取任意字节，虽然不是正确编码，但至少不会崩。

### FileWriteTool

```python
class FileWriteTool(BaseTool):
    name = "FileWrite"
    description = "写入文件，自动创建不存在的父目录"
    args_schema = FileWriteArgs  # 包含 file_path, content, append, require_new
    
    async def execute(self, file_path, content, append=False, require_new=False):
        # 防覆盖机制
        if require_new and os.path.exists(file_path):
            return f"错误：文件已存在，拒绝覆盖"
        
        # 自动创建父目录
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        mode = 'a' if append else 'w'
        with open(file_path, mode, encoding='utf-8') as f:
            f.write(content)
        return f"成功写入，{len(content)} 字符"
```

`require_new` 参数是个很有意思的设计——当用户说"帮我新建一个文件"时，LLM 会把这个参数设为 `true`，防止意外覆盖已有文件。这是在 system prompt 里告诉 LLM 的规则。

### BashTool

```python
class BashTool(BaseTool):
    name = "Bash"
    description = "执行 shell 命令，超时 30 秒"
    args_schema = BashArgs
    
    async def execute(self, command: str) -> str:
        # 安全检查（后面详细讲）
        if is_destructive_command(command):
            return "安全拦截：检测到高危命令"
        if check_bash_security(command):
            return "安全拦截：检测到可疑的命令替换"
        
        result = subprocess.run(
            command, shell=True, capture_output=True,
            text=True, timeout=30
        )
        
        output = ""
        if result.stdout:
            output += f"标准输出:\n{result.stdout}\n"
        if result.stderr:
            output += f"错误输出:\n{result.stderr}\n"
        
        if result.returncode == 0:
            output += f"执行成功，退出码: {result.returncode}"
        else:
            output += f"退出码: {result.returncode}"
        return output
```

---

## 工具注册表：别名机制

```python
class ToolRegistry:
    def __init__(self):
        self._tools: Dict[str, BaseTool] = {}
        self._register_with_aliases(BashTool(), ["BashTool"])
        self._register_with_aliases(FileReadTool(), ["FileReadTool"])
        self._register_with_aliases(FileWriteTool(), ["FileWriteTool"])
    
    def _register_with_aliases(self, tool, aliases=None):
        self._tools[tool.name] = tool       # "Bash" → BashTool 实例
        for alias in (aliases or []):
            self._tools[alias] = tool        # "BashTool" → 同一个实例
```

为什么需要别名？因为**不同 LLM 对工具名的处理不一样**。

我在 system prompt 里告诉 LLM 工具叫 `"Bash"`，但有些模型（特别是小模型）会返回 `"BashTool"`——它把类名当成工具名了。与其让 Agent 报"找不到工具"再让 LLM 重试（浪费一次 API 调用），不如直接注册个别名一步到位。

`list_tools()` 需要去重，不然同一个工具会出现在 schema 列表里两次：

```python
def list_tools(self) -> List[BaseTool]:
    seen = set()
    return [t for t in self._tools.values()
            if id(t) not in seen and not seen.add(id(t))]
```

用 `id(t)` 而不是 `t` 来判断，因为 Python 的 `set` 需要可哈希的对象，而自定义类默认按 identity 比较。

---

## 添加工具有多简单

要加一个新工具，只需要三步：

1. 定义参数类（Pydantic）
2. 继承 BaseTool，实现 execute()
3. 在 Registry 里注册

```python
# 1. 参数
class WebSearchArgs(BaseModel):
    query: str = Field(..., description="搜索关键词")

# 2. 工具
class WebSearchTool(BaseTool):
    name = "WebSearch"
    description = "搜索网页"
    args_schema = WebSearchArgs
    
    async def execute(self, query: str) -> str:
        # 你的搜索逻辑
        return f"搜索 '{query}' 的结果..."

# 3. 注册
registry.register(WebSearchTool())
```

不需要改 Agent、不需要改 Provider、不需要改 Schema 生成逻辑。Pydantic 自动生成 schema，Registry 自动把它加入工具列表，Provider 的 `_get_tool_schemas()` 自动把它传给 LLM。

---

## 小结

| 设计点 | 做法 | 为什么 |
|--------|------|--------|
| 参数定义 | Pydantic BaseModel | 自动生成 schema + 运行时校验 |
| 工具基类 | BaseTool(ABC) | 统一接口，强制实现 execute() |
| Schema 生成 | `model_json_schema()` | 不再手写 JSON Schema |
| 工具查找 | Registry + 别名 | 兼容不同 LLM 的工具命名习惯 |
| 添加工具 | 继承 + 注册 | 三步搞定，不改其他模块 |

---

*下一篇：AI 的记忆和安全，我踩过的坑*

源码：[github.com/you-want/mini-cc](https://github.com/you-want/mini-cc)（Python 版在 `python/` 目录）
