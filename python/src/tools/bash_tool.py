import subprocess
import os

def check_command_security(command: str):
    # A simple mock of security check
    forbidden = ["rm -rf /", "mkfs", "dd if="]
    for f in forbidden:
        if f in command:
            return {"isSafe": False, "reason": f"包含高危操作: {f}"}
    return {"isSafe": True}

async def execute_bash(args: dict) -> str:
    command = args.get("command")
    if not command:
        return "执行命令时出错: command 不能为空"
    
    security_check = check_command_security(command)
    if not security_check["isSafe"]:
        print(f"\n[BashTool 安全拦截] 拒绝执行高危命令: {command}")
        return f"命令执行被安全沙盒拒绝：{security_check['reason']}\n请修改你的方案或采取其他不具备破坏性的方式。"
    
    print(f"[BashTool] 正在执行命令: {command}")
    
    try:
        import asyncio
        process = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=os.getcwd()
        )
        stdout, stderr = await process.communicate()
        out = stdout.decode('utf-8')
        err = stderr.decode('utf-8')
        
        if err:
            return f"[stdout]\n{out}\n[stderr]\n{err}"
        return out or "命令执行成功，但没有输出。"
    except Exception as e:
        return f"执行命令时出错:\n{str(e)}"

bash_tool = {
    "name": "BashTool",
    "description": """
    在本地系统执行 Bash/Shell 命令。
    使用该工具来运行测试、执行脚本、操作文件系统或调用命令行工具。
    注意：
    - 命令是无交互式的（non-interactive），请避免运行需要用户输入的命令（如 vim, nano）。
    - 始终使用绝对路径或基于当前工作目录的相对路径。
    - 如果命令可能会产生大量输出，请使用 `head` 或 `grep` 进行截断和过滤。
    - 如果你仅仅是为了在写入文件前创建目录（如 mkdir -p），请不要使用此工具！FileWriteTool 在写入时会自动为你创建所需的目录层级。
    """,
    "inputSchema": {
        "type": "object",
        "properties": {
            "command": {
                "type": "string",
                "description": "需要执行的 shell 命令，例如：npm run build",
            },
        },
        "required": ["command"],
    },
    "execute": execute_bash
}