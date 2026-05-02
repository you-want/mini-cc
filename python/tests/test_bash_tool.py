import pytest
import os
import asyncio
from mini_cc.tools.bash import BashTool
from mini_cc.tools.security.bash_security import check_bash_security
from mini_cc.tools.security.destructive_warning import is_destructive_command

@pytest.mark.asyncio
async def test_bash_tool_safe():
    tool = BashTool()
    res = await tool.execute("echo 'hello'")
    assert "hello" in res

@pytest.mark.asyncio
async def test_bash_tool_dangerous():
    tool = BashTool()
    dangerous_cmds = [
        "rm -rf /",
        "mkfs.ext4 /dev/sda1",
        "dd if=/dev/zero of=/dev/sda",
        "echo $(ls)",
        "echo `ls`"
    ]
    for cmd in dangerous_cmds:
        res = await tool.execute(cmd)
        assert "拦截" in res or "终止" in res or "安全沙盒" in res

def test_bash_tool_empty():
    tool = BashTool()
    # BaseTool 在没有提供必填参数时会由 Pydantic 在外层报错，但为了测试 execute，我们传入一个空命令
    res = asyncio.run(tool.execute(""))
    assert "执行命令时发生异常" in res or "成功" in res # 空命令可能直接成功返回无输出
