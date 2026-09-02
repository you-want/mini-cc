# 从开发到 PyPI：一个人发布 Python CLI 工具全流程

> 从 `pip install -e .` 到 `pip install mini-cc-python`，记录每个环节

---

之前做的 mini-cc Python 版，最终目标是让人家一行命令就能装上：

```bash
pip install mini-cc-python
```

这篇文章把从项目结构、测试、CI、打包到发布 PyPI 的全流程串一遍。不是教程式的"第一步第二步"，而是我实际做的选择、踩的坑。

---

## 项目结构：src layout

```
python/
├── src/
│   └── mini_cc/          ← 所有代码在这里
│       ├── cli/           ← 命令行入口
│       ├── core/          ← Agent + Provider
│       ├── tools/         ← 工具系统
│       ├── config/        ← 配置管理
│       └── utils/         ← 控制台输出
├── tests/                 ← pytest 测试
├── pyproject.toml         ← 项目元数据 + 构建配置
└── .env                   ← 本地环境变量（不进 git）
```

为什么用 `src/` 而不是直接把 `mini_cc/` 放根目录？

因为直接放根目录有个隐蔽的坑：**可编辑安装时 Python 会优先导入根目录的代码，而不是 site-packages 里的**。如果你在根目录下开发又忘了装包，`import mini_cc` 可能导到当前目录的文件，导致你以为改了代码生效了、其实导入的是别的东西。

用 `src/` layout 就不会有这个问题——根目录没有 `mini_cc/` 文件夹，只有通过安装才能导入。

在 `pyproject.toml` 里声明：
```toml
[tool.setuptools.packages.find]
where = ["src"]
include = ["mini_cc*"]
```

---

## 测试：pytest + pytest-asyncio

因为我大量用了 `async def`（Agent 循环、Provider 调用都是异步的），普通 pytest 跑不了异步测试。需要装 `pytest-asyncio`：

```bash
pip install pytest pytest-asyncio
```

然后在 `pyproject.toml` 里配置：
```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

`asyncio_mode = "auto"` 让 pytest 自动识别 `async def test_xxx()` 并用 asyncio 跑，不需要每个测试函数加 `@pytest.mark.asyncio` 装饰器。

### conftest.py 的坑

测试文件需要能导入 `mini_cc` 包。因为用了 src layout，正常需要先安装。但我在 `conftest.py` 里加了路径 hack，让测试不安装也能跑：

```python
# tests/conftest.py
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src')))
```

这样 CI 和本地开发时，不需要先 `pip install` 就能直接 `pytest`。虽然不太规范，但对个人项目来说省了一个步骤。

### 测试什么

我的测试主要覆盖这几块：

```python
# 1. Agent 循环逻辑（Mock Provider）
class TestAgent:
    async def test_simple_response(self):
        # 不调工具的简单对话
        
    async def test_tool_calling_loop(self):
        # 工具调用 → 结果返回 → 最终答案的完整循环
        
    async def test_max_loop_limit(self):
        # 超过 30 次循环应该停止
        
    async def test_tool_not_found(self):
        # 调用不存在的工具应该返回错误信息

# 2. 安全层
def test_destructive_command():
    assert is_destructive_command("rm -rf /") == True
    assert is_destructive_command("rm -rf ./node_modules") == False

def test_should_use_sandbox():
    assert should_use_sandbox("ls -la") == False       # 安全
    assert should_use_sandbox("curl http://...") == True  # 需要沙箱

# 3. 工具系统
# 4. 文件读写工具
# 5. 记忆系统
```

12 个测试，覆盖了核心循环、安全拦截、工具执行、记忆读写。跑一次不到 2 秒。

---

## GitHub Actions CI

CI 配置在一个仓库里同时跑四个语言的测试（TS、Python、Go、Rust）：

```yaml
python:
  runs-on: ubuntu-latest
  strategy:
    matrix:
      python-version: ["3.10", "3.11", "3.12"]

  steps:
  - uses: actions/checkout@v4

  - name: Setup Python
    uses: actions/setup-python@v5
    with:
      python-version: ${{ matrix.python-version }}

  - name: Install dependencies
    run: |
      python -m pip install --upgrade pip
      pip install -e .
      pip install pytest pytest-asyncio
    working-directory: python

  - name: Run tests
    run: pytest -q
    working-directory: python
```

三个版本都测，确保兼容性。`pip install -e .` 这一步会安装项目依赖和包本身，然后 `pytest -q` 跑测试。

注意 `working-directory: python`——因为我的 Python 项目在 monorepo 的子目录里。

---

## 打包：pyproject.toml 的关键字段

```toml
[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"

[project]
name = "mini-cc-python"
version = "1.1.0"
description = "A lightweight AI pair programming agent in Python"
readme = "README.md"
requires-python = ">=3.9"
license = {text = "MIT"}
authors = [{name = "rain9", email = "developer@example.com"}]
keywords = ["ai", "agent", "claude", "llm", "cli"]
classifiers = [
    "Development Status :: 4 - Beta",
    "Environment :: Console",
    "Programming Language :: Python :: 3.9",
    "Programming Language :: Python :: 3.10",
    "Programming Language :: Python :: 3.11",
    "Programming Language :: Python :: 3.12",
]
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

[project.urls]
Homepage = "https://mini-cc.raingpt.top/"
Repository = "https://github.com/you-want/mini-cc"
```

几个要注意的字段：

- **`name`**: PyPI 上的包名，全局唯一。我用 `mini-cc-python` 而不是 `mini-cc`，因为后者太通用了大概率被占
- **`requires-python`**: 限制了最低 Python 版本。我选 3.9 是因为用了 `typing.Optional` 而不是 `|` 语法
- **`classifiers`**: PyPI 的分类标签，影响你的包在搜索结果里怎么显示
- **`[project.scripts]`**: CLI 入口点，安装后 `mini-cc-py` 命令就可用了

---

## 发布到 PyPI

### 1. 构建

```bash
pip install build
python -m build
```

这会在 `dist/` 目录下生成两个文件：
```
dist/
├── mini_cc_python-1.1.0-py3-none-any.whl    ← wheel 包（推荐安装格式）
└── mini_cc_python-1.1.0.tar.gz               ← 源码包
```

### 2. 上传

```bash
pip install twine

# 先传 TestPyPI 验证
twine upload --repository testpypi dist/*

# 确认没问题后传正式 PyPI
twine upload dist/*
```

上传需要 PyPI 的 API Token。2023 年后 PyPI 强制要求 2FA，API Token 需要在网页上生成。

### 3. 验证

```bash
pip install mini-cc-python
mini-cc-py --help
```

看到帮助信息就说明安装成功。

---

## 发布后用户能怎么用

**方式 1：直接安装**
```bash
pip install mini-cc-python
mini-cc-py
```

**方式 2：pipx 安装（隔离环境）**
```bash
pipx install mini-cc-python
mini-cc-py
```

pipx 是 Python CLI 工具的最佳安装方式——它会创建一个隔离的虚拟环境来装包，但把命令暴露到全局。不会污染系统 Python 环境。

**方式 3：pip install -e .**

面向开发者：
```bash
git clone https://github.com/you-want/mini-cc
cd mini-cc/python
pip install -e .
```

---

## 版本管理策略

```toml
version = "1.1.0"
```

我用 semver（语义化版本）：
- `1.0.x`：修 bug
- `1.x.0`：加功能（比如加了 Anthropic Provider 就是 1.1.0）
- `x.0.0`：大改（比如重构了工具系统接口）

每次发版前：
1. 改 `pyproject.toml` 里的版本号
2. `python -m build` 重新构建
3. `twine upload dist/*` 上传
4. `git tag v1.1.0 && git push --tags`

---

## 踩过的坑

**坑 1：包名冲突**

第一次发布想用 `mini-cc` 作为包名，结果 PyPI 上已经有人占了（虽然是空包）。最后用了 `mini-cc-python`。

建议：先在 PyPI 搜索确认名字没被占，再开始写 `pyproject.toml`。

**坑 2：改了入口点没重新安装**

开发时改了 `[project.scripts]` 的函数路径，本地测试 `mini-cc-py` 一直报 `ImportError`。后来发现入口脚本是安装时生成的，改了 `pyproject.toml` 必须重新 `pip install -e .`。

**坑 3：readme 里的图片路径**

`pyproject.toml` 里 `readme = "README.md"`，这个 README 会被渲染到 PyPI 页面。如果里面有相对路径的图片 `![screenshot](./assets/screenshot.png)`，PyPI 上会显示不出来。要换成绝对路径。

---

## 全流程总结

```
写代码
  ↓
pytest 跑测试（本地）
  ↓
push → GitHub Actions CI 自动跑测试（Python 3.10/3.11/3.12）
  ↓
改版本号 → python -m build → twine upload
  ↓
pip install mini-cc-python → 可用
```

整个流程一个人搞定，不需要运维。这就是 Python 生态的好处——工具链成熟，文档齐全，从开发到发布的路径非常清晰。

---

*本系列完结*

源码：[github.com/you-want/mini-cc](https://github.com/you-want/mini-cc)（Python 版在 `python/` 目录）
