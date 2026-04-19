import os

async def execute_file_read(args: dict) -> str:
    file_path = args.get("file_path")
    if not file_path:
        return "读取文件时出错：file_path 不能为空"
    
    print(f"[FileReadTool] 正在读取文件: {file_path}")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
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