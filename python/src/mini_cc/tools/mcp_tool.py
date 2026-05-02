import json
import asyncio
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional

from .base import BaseTool

class MCPToolArgs(BaseModel):
    # MCP 工具的参数是动态的，所以我们用 dict 来接收
    # 实际上，注册到大模型时，我们会直接把 MCP Server 返回的 JSON Schema 喂给大模型
    args: Dict[str, Any] = Field(default_factory=dict, description="传递给 MCP 插件的参数字典")

class MCPTool(BaseTool):
    """
    透明代理工具 (Model Context Protocol)
    这是一个特殊的 Tool。它不是在执行本地 Python 代码，
    而是将大模型的请求通过 stdio 或 HTTP 转发给另外一个独立的 MCP Server 进程。
    """
    def __init__(self, name: str, description: str, server_command: str, args_schema: dict):
        self.name = name
        self.description = description
        self.server_command = server_command
        self._custom_schema = args_schema
        # 默认的参数校验模型，虽然实际上我们会重写 to_openai_schema
        self.args_schema = MCPToolArgs
        
    def to_openai_schema(self) -> dict:
        """
        重写 schema 生成逻辑，直接使用从 MCP Server 读来的真实 Schema
        """
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self._custom_schema
            }
        }
        
    async def execute(self, **kwargs) -> str:
        """
        核心逻辑：当大模型想调用这个 MCP 工具时，
        我们启动 MCP Server 进程，把 JSON 发给它，并读取它的 stdout 响应。
        """
        try:
            # 构造符合 MCP 协议规范的 JSON-RPC 请求
            request = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/call",
                "params": {
                    "name": self.name,
                    "arguments": kwargs
                }
            }
            
            req_str = json.dumps(request) + "\n"
            
            # 通过 asyncio.create_subprocess_shell 启动基于 stdio 的 MCP Server
            process = await asyncio.create_subprocess_shell(
                self.server_command,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            # 向子进程发送请求并等待响应
            stdout, stderr = await process.communicate(input=req_str.encode('utf-8'))
            
            if process.returncode != 0:
                err_msg = stderr.decode('utf-8').strip()
                return f"MCP 插件执行失败 (退出码 {process.returncode}): {err_msg}"
                
            # 解析 MCP Server 返回的 JSON-RPC 响应
            resp_str = stdout.decode('utf-8').strip()
            
            try:
                # 有些 MCP Server 可能会混杂一些普通的 log 打印，我们需要找到最后那行合法的 JSON
                lines = [line for line in resp_str.split('\n') if line.strip().startswith('{')]
                if not lines:
                    return f"MCP 插件返回格式错误: {resp_str}"
                    
                resp_data = json.loads(lines[-1])
                
                if "error" in resp_data:
                    return f"MCP 插件业务错误: {resp_data['error'].get('message', '未知错误')}"
                    
                # 提取返回内容
                result_content = resp_data.get("result", {}).get("content", [])
                if not result_content:
                    return "MCP 插件执行成功，但没有返回内容。"
                    
                # 将 MCP 的 content 数组（可能包含 text/image）拼接成字符串发给大模型
                texts = [item.get("text", "") for item in result_content if item.get("type") == "text"]
                return "\n".join(texts)
                
            except json.JSONDecodeError:
                return f"无法解析 MCP 插件响应: {resp_str}"
                
        except Exception as e:
            return f"调用 MCP 插件时发生系统错误: {str(e)}"
