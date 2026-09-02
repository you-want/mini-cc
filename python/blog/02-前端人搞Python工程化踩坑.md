# 前端人搞 Python 工程化，踩了多少坑

> 从 npm 到 pip，从 package.json 到 pyproject.toml，一个前端开发者的 Python 工程化血泪史

---

作为一个写了多年 TypeScript 的前端，我以为 Python 工程化也就是把 `npm` 换成 `pip`，`package.json` 换成 `requirements.txt`。

结果我错了，错得挺彻底的。

这篇文章记录我在做 mini-cc Python 版的过程中，在工程化层面踩过的真实坑。不是语法教学，是那种"Google 了一圈也没找到明确答案"的实际问题。

---

## 坑一：pyproject.toml 不是 package.json 的翻版

刚建项目时我写了个 `pyproject.toml`，心想跟 `package.json` 差不多嘛：

```toml
[project]
name = "mini-cc-python"
version = "1.1.0"
dependencies = [
    "openai>=1.0.0",
    "anthropic>=0.18.0",
    "pydantic>=2.0.0",
    "python-dotenv>=1.0.0",
    "rich>=13.0.0",
    "prompt_toolkit>=3.0.0",
]

[project.scripts]
mini-cc-py = "mini_cc.cli.main:run_cli"
```

看起来没问题对吧？但有几个 TS 人不会预料到的点：

**1. 入口点的格式**

`package.json` 里写 `"bin": {"mini-cc": "./dist/cli.js"}`，指向一个文件。

`pyproject.toml` 里写 `mini-cc-py = "mini_cc.cli.main:run_cli"`，指向一个**函数**。这个函数必须是无参的，而且必须自己调 `asyncio.run()` 来启动异步循环。

```python
# 这个函数就是 pyproject.toml 里的入口
def run_cli() -> None:
    args = parse_args()
    asyncio.run(main_loop(args))  # ← 必须在这里启动事件循环
```

**2. 可编辑安装的机制完全不同**

`npm link` 是创建符号链接。`pip install -e .` 是在 `site-packages` 里创建一个 `.pth` 文件，内容是你的 `src/` 目录路径。Python 启动时会读所有 `.pth` 文件，把这些路径加入 `sys.path`。

这意味着：
- 改了 `.py` 源码 → 不需要重新安装（因为是路径引用）
- 改了 `pyproject.toml` 的 `[project.scripts]` → **必须重新** `pip install -e .`（因为入口脚本是安装时生成的）

我在这上面浪费了一个小时：改了入口点函数名，怎么运行都报 `ImportError`，最后才发现要重新安装。

**3. `[build-system]` 不是摆设**

```toml
[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"
```

这两行告诉 Python 用什么构建工具打包。Node.js 世界你不需要关心这个（npm publish 直接传文件），但 Python 的 `pip install` 会先读这两行，安装构建依赖，然后调用 `build-backend` 来编译。

如果你漏了这两行，`pip install` 会失败并报一堆看不懂的错。

---

## 坑二：模块导入的"相对 vs 绝对"问题

这是 Python 独有的坑，TS 里没有对应的概念。

TS 的导入永远相对于当前文件：
```typescript
import { Agent } from './core/agent';  // 永远OK
```

Python 有两种导入方式：
```python
# 相对导入（用 . 表示当前包）
from .core.agent import Agent

# 绝对导入（从包的根目录开始）
from mini_cc.core.agent import Agent
```

**相对导入的坑：**

我一开始在包内部全用相对导入，觉得简洁。结果在用 `pytest` 跑测试时炸了：

```
ImportError: attempted relative import beyond top-level package
```

原因是 pytest 的执行上下文跟 `python -m` 不一样，Python 解释器不认为你的文件在一个"包"里，相对导入就失效了。

**我的最终方案：全部用绝对导入。**

```python
# 不管在哪个文件里，一律 from mini_cc.xxx import
from mini_cc.core.agent import Agent
from mini_cc.tools.registry import registry
from mini_cc.config import get_config_value
```

唯一的例外是 `__init__.py` 里的导出，用相对导入更方便：
```python
# mini_cc/core/providers/__init__.py
from .base import LLMProvider
from .openai_provider import OpenAIProvider
from .anthropic_provider import AnthropicProvider
```

因为 `__init__.py` 永远在包内部被加载，不存在上下文问题。

---

## 坑三：`__init__.py` 不只是"标记文件"

在 TS 里，`index.ts` 就是导出个东西。Python 的 `__init__.py` 有两个作用：

1. 告诉 Python "这个目录是个包"（Python 3.3+ 其实可以不用，但最好还是加上）
2. 控制包的公共 API

我项目里的实际用法：

```python
# mini_cc/tools/__init__.py
from .base import BaseTool, Tool
from .registry import ToolRegistry, registry
from .file_read import FileReadTool
from .file_write import FileWriteTool
from .bash import BashTool

# 这样别人就可以：from mini_cc.tools import registry
# 而不需要写：from mini_cc.tools.registry import registry
```

**坑点：** `__init__.py` 里的代码在包被导入时就会执行。如果你在 `__init__.py` 里做了耗时的操作（比如网络请求、文件IO），每次 `import` 这个包都会卡一下。

我在 `tools/__init__.py` 里注册了所有工具实例（`BashTool()`、`FileReadTool()` 等），这意味着**任何地方** `import mini_cc.tools` 都会触发所有工具的实例化。大部分时候没问题，但写测试时会导致意想不到的副作用。

---

## 坑四：Type Hints 不是装饰，是救命稻草

Python 的类型注解不像 TypeScript 会编译时报错，它是**运行时不检查的**。听起来很鸡肋？但实际上配合 Pydantic 和 IDE 的类型推导，它变成了我写 Python 代码最重要的工具。

**一个真实例子：**

```python
# 没有类型注解时——这个函数接收什么？返回什么？全靠猜
def handle_tool_calls(tool_calls):
    results = []
    for tc in tool_calls:
        # tc 是什么结构？得去看调用方才知道
        ...

# 有类型注解后——IDE 自动提示，Pydantic 运行时校验
async def handle_tool_calls(
    self,
    tool_calls: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    # 现在我知道 tool_calls 是一个字典列表
    # 每个字典有 id, name, args 字段
    ...
```

但有个坑：`typing` 模块在不同 Python 版本里语法不一样。

```python
# Python 3.9+ 才能用 list[str] 代替 List[str]
# Python 3.10+ 才能用 str | None 代替 Optional[str]
# 我的项目要求 >=3.9，所以还得用老语法
from typing import List, Dict, Optional

def get_tools() -> List[BaseTool]:
    ...

def find_tool(name: str) -> Optional[BaseTool]:
    ...
```

我一开始用了 `str | None` 语法，结果在 Python 3.9 环境下直接报 `TypeError`。改成 `Optional[str]` 后才修好。

---

## 坑五：配置管理的优先级设计

TS 项目里我用 `dotenv` 读 `.env` 文件就完事了。Python 版我设计了三层配置优先级：

```
环境变量（含 .env）> ~/.mini-cc/config.json > 默认值
```

实现核心代码：

```python
from dotenv import load_dotenv
load_dotenv()  # 加载 .env 文件到 os.environ

CONFIG_DIR = Path.home() / ".mini-cc"
CONFIG_FILE = CONFIG_DIR / "config.json"

def get_config_value(key: str, default: str = "") -> str:
    # 1. 先查环境变量（包括 .env 注入的）
    env_val = os.environ.get(key)
    if env_val:
        return env_val
    # 2. 再查全局配置文件
    config_data = read_config()
    value = config_data.get(key)
    if value:
        return value
    # 3. 最后用默认值
    return default
```

**为什么要这样设计？**

因为 CLI 工具的使用场景和 Web 应用不一样。Web 应用的配置基本固定（部署后就定了），但 CLI 工具的用户可能：
- 在公司用 `OPENAI_API_KEY=sk-xxx` 环境变量
- 在家里用 `~/.mini-cc/config.json` 里的配置
- 临时切换：`OPENAI_API_KEY=sk-yyy mini-cc-py`

三层优先级让这些场景都能 work，不需要用户记特殊的命令。

**首次运行的体验优化：**

如果用户第一次运行（没有 API Key 也没有配置文件），我会弹出一个交互式引导：

```python
def check_first_run_setup():
    api_key = get_config_value("OPENAI_API_KEY") or get_config_value("ANTHROPIC_API_KEY")
    if api_key:
        return  # 已有配置，跳过
    
    # 交互式引导
    provider = Prompt.ask("请选择接口", choices=["openai", "anthropic"])
    key = Prompt.ask("请粘贴 API Key", password=True)
    set_config_value("OPENAI_API_KEY", key)
    # 保存到 ~/.mini-cc/config.json
```

这个小细节让 `pip install` 后的首次体验变得顺滑——不需要先去查文档看怎么配置。

---

## 坑六：pathlib 比 os.path 好用一万倍

TS 里拼路径用 `path.join()`，Python 老代码用 `os.path.join()`。但 Python 3 的 `pathlib` 才是正确选择：

```python
from pathlib import Path

# os.path 的方式（丑，还容易写错分隔符）
config_dir = os.path.join(os.path.expanduser("~"), ".mini-cc")
config_file = os.path.join(config_dir, "config.json")

# pathlib 的方式（优雅，跨平台）
config_dir = Path.home() / ".mini-cc"
config_file = config_dir / "config.json"
```

`/` 运算符重载用来拼路径，第一次看到时觉得"这也能行？"，用习惯了就回不去了。

而且 `Path` 对象自带很多实用方法：
```python
path = Path("/tmp/test.txt")
path.parent       # Path("/tmp")
path.name         # "test.txt"
path.stem         # "test"
path.suffix       # ".txt"
path.exists()     # True/False
path.mkdir(parents=True, exist_ok=True)  # 创建目录
```

---

## 小结：给前端人的建议

| 场景 | TS/Node.js | Python | 建议 |
|------|-----------|--------|------|
| 包管理 | `package.json` | `pyproject.toml` | 别用 `requirements.txt`，过时了 |
| 链接本地包 | `npm link` | `pip install -e .` | 改了 entry point 要重装 |
| 导入 | `import { x } from './y'` | `from mini_cc.y import x` | 用绝对导入，别用相对 |
| 类型 | TS 编译器检查 | 运行时不检查 | 配合 Pydantic 才有意义 |
| 配置 | `.env` | `.env` + config.json | 三层优先级更灵活 |
| 路径 | `path.join()` | `Path() / "sub"` | 用 pathlib，别用 os.path |

这些都是我实际踩过的坑，希望帮你省点时间。

---

*下一篇：AI Agent 的核心循环，其实就这几十行代码*

源码：[github.com/you-want/mini-cc](https://github.com/you-want/mini-cc)（Python 版在 `python/` 目录）
