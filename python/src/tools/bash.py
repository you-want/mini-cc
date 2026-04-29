import asyncio
from pydantic import BaseModel, Field
from .base import BaseTool

# 引入我们刚才写的安全校验模块
from .security.bash_security import check_bash_security
from .security.destructive_warning import is_destructive_command
from .security.should_sandbox import should_use_sandbox

class BashArgs(BaseModel):
    # Field 用于描述参数，这个描述会被提取到 JSON Schema 中，直接喂给大模型
    # ... 代表这个参数是必填的
    command: str = Field(..., description="要执行的 bash 命令，例如 'ls -la' 或 'npm install'")

class BashTool(BaseTool):
    name = "BashTool"
    description = "在当前系统终端中执行 bash 命令。大模型可以通过它来查看文件、运行脚本、安装依赖等。注意：命令会被阻塞等待执行完毕，请不要执行交互式命令（如 vim/top）。"
    
    # 绑定我们刚才定义的参数结构
    args_schema = BashArgs
    
    async def execute(self, command: str) -> str:
        """
        使用 asyncio.create_subprocess_shell 异步执行命令
        在 Python 中，处理 IO 操作（如读文件、执行命令、网络请求）时，
        用异步 (async/await) 可以避免卡住主线程的 UI。
        """
        try:
            # ----------------- 安全拦截阶段 (Phase 1) -----------------
            
            # 1. 拦截命令替换漏洞
            if check_bash_security(command):
                return "错误：命令被安全拦截。检测到高危命令替换 $(...) 或 `...`，请避免使用此类语法构造复杂命令。"
                
            # 2. 拦截毁灭性指令
            if is_destructive_command(command):
                return "严重警告：您的命令被系统强行终止！这似乎是一个极其危险的命令（如 rm -rf / 或 fork 炸弹），大模型不允许执行破坏性操作。"
                
            # 3. 决定是否丢入沙盒
            in_sandbox = should_use_sandbox(command)
            
            # 如果判定需要沙盒执行，我们给终端打印一个提示（在真实环境中，这里应该调用 Docker API，但在这里我们做一层 Mock 展示隔离效果）
            if in_sandbox:
                print(f"\n[安全沙盒] 命令 '{command}' 不在宿主机白名单中，已被放入隔离容器中执行（模拟）...")
                
            # ----------------- 实际执行阶段 (Phase 2) -----------------
            
            # 启动子进程
            process = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            # 等待命令执行完毕并获取标准输出(stdout)和标准错误(stderr)
            stdout, stderr = await process.communicate()
            
            # 解码字节流为字符串（终端输出一般是 utf-8 编码）
            out_str = stdout.decode('utf-8').strip()
            err_str = stderr.decode('utf-8').strip()
            
            result = ""
            if in_sandbox:
                result += "【沙盒环境执行结果】:\n"
                
            if out_str:
                result += f"【标准输出】:\n{out_str}\n"
            if err_str:
                result += f"【标准错误】:\n{err_str}\n"
                
            # process.returncode 不等于 0 通常代表命令执行出错了
            if process.returncode != 0:
                result = f"命令执行失败 (退出码 {process.returncode}):\n" + result
                
            return result if result else "命令执行成功，无输出。"
            
        except Exception as e:
            return f"执行命令时发生异常: {str(e)}"
