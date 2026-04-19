"""
文件读取工具 (file_read_tool.py)
==============================
为 Agent 提供读取本地文件内容的能力。
包含文件大小截断机制，防止读取过大的文件撑爆大模型上下文。
"""

import os

async def execute_file_read(args: dict) -> str:
    """
    异步执行文件读取操作
    """
    file_path = args.get("file_path")
    if not file_path:
        return "读取文件时出错：file_path 不能为空"
    
    print(f"[FileReadTool] 正在读取文件: {file_path}")
    
    try:
        # 以 UTF-8 编码读取文件
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 安全限制：如果文件行数超过 1000 行，则进行截断
        # 避免如 package-lock.json 或巨大日志文件消耗过多 token
        lines = content.split('\n')
        if len(lines) > 1000:
            print(f"[FileReadTool] 文件 {file_path} 行数超过 1000 行，将进行截断")
            return '\n'.join(lines[:1000]) + '\n\n... (文件已截断，仅显示前 1000 行)'
        
        return content
    except FileNotFoundError:
        return f"错误：文件未找到。路径：{file_path}"
    except Exception as e:
        return f"读取文件时出错：{str(e)}"

file_read_tool = {
    "name": "FileReadTool",
    "description": """
    读取本地系统上的文件内容。
    用于获取代码文件、配置文件或者日志。
    注意：
    - 请提供需要读取的文件的绝对路径，不要使用相对路径。
    - 如果遇到过大文件（如日志），该工具只会返回前 1000 行。
    """,
    "inputSchema": {
        "type": "object",
        "properties": {
            "file_path": {
                "type": "string",
                "description": "需要读取文件的绝对路径",
            },
        },
        "required": ["file_path"],
    },
    "execute": execute_file_read
}