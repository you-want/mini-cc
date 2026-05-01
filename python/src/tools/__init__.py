from .bash import BashTool
from .file_read import FileReadTool
from .file_write import FileWriteTool
from .git_status_tool import git_status_tool
from .agent_tool import agent_tool
from .mcp_tool import MCPTool

# 所有注册在 Agent 中的工具实例。
# 扩展时可以在此注册更多工具，例如 GitTool、GlobTool 等。
tools = [
    BashTool(),
    FileReadTool(),
    FileWriteTool(),
    git_status_tool,
    agent_tool
]