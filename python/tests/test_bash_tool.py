import pytest
import os
import asyncio
from src.tools.bash_tool import execute_bash, check_command_security

@pytest.mark.asyncio
async def test_bash_tool_safe():
    res = await execute_bash({"command": "echo 'hello'"})
    assert "hello" in res

@pytest.mark.asyncio
async def test_bash_tool_dangerous():
    dangerous_cmds = [
        "rm -rf /",
        "mkfs.ext4 /dev/sda1",
        "dd if=/dev/zero of=/dev/sda",
        "echo $(ls)",
        "echo `ls`"
    ]
    for cmd in dangerous_cmds:
        res = await execute_bash({"command": cmd})
        assert "安全沙盒拒绝" in res or "安全沙盒拦截" in res

def test_bash_tool_empty():
    res = asyncio.run(execute_bash({}))
    assert "不能为空" in res
