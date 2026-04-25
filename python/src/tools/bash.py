import asyncio
from pydantic import BaseModel, Field
from .base import BaseTool

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
