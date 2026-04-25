import os
import json
from pathlib import Path
from dotenv import load_dotenv

# 使用 pathlib 处理路径，比 os.path 更现代化、更安全
# 获取用户的 home 目录 (例如: ~/.mini-cc)
CONFIG_DIR = Path.home() / ".mini-cc"
CONFIG_FILE = CONFIG_DIR / "config.json"

# 加载当前目录下的 .env 文件（如果有的话）
load_dotenv()

def ensure_config_dir():
    """确保配置目录存在"""
    # exist_ok=True 避免目录已存在时报错，parents=True 相当于 mkdir -p
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)

def read_config() -> dict:
    """读取全局配置文件"""
    if not CONFIG_FILE.exists():
        return {}
    
    try:
        # 使用 context manager (with) 确保文件读写后正确关闭
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"读取配置文件失败: {e}")
        return {}

def write_config(config_data: dict):
    """将配置写入全局文件"""
    ensure_config_dir()
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            # indent=2 使 JSON 格式化输出，便于人类阅读
            json.dump(config_data, f, indent=2)
    except Exception as e:
        print(f"写入配置文件失败: {e}")

def get_config_value(key: str) -> str:
    """
    获取配置值
    优先级: 环境变量 (包含 .env) > 全局 config.json
    """
    # 1. 尝试从环境变量获取 (os.environ 包含了从 .env 加载的值)
    env_val = os.environ.get(key)
    if env_val:
        return env_val
        
    # 2. 尝试从全局配置文件获取
    config_data = read_config()
    return config_data.get(key, "")

def set_config_value(key: str, value: str):
    """设置配置值并保存到全局文件"""
    config_data = read_config()
    config_data[key] = value
    write_config(config_data)

def check_first_run_setup():
    """
    首次运行引导
    如果检测不到 API Key，通过交互式 prompt 引导用户配置
    """
    # 这里我们只检查 openai 和 anthropic 的 key，因为这是必须的
    api_key = get_config_value("OPENAI_API_KEY") or get_config_value("ANTHROPIC_API_KEY")
    
    if not api_key:
        from rich.console import Console
        from rich.prompt import Prompt
        console = Console()
        
        console.print("[bold yellow]⚠️ 未检测到大模型 API Key。[/bold yellow]")
        
        # 使用 rich 的 Prompt 进行交互式问答
        provider = Prompt.ask("请选择你想使用的接口", choices=["openai", "anthropic"], default="openai")
        
        if provider == "openai":
            key = Prompt.ask("请粘贴您的 OPENAI_API_KEY (支持兼容接口)", password=True)
            set_config_value("OPENAI_API_KEY", key)
            
            base_url = Prompt.ask("请输入 BASE_URL (默认: https://api.openai.com/v1)", default="https://api.openai.com/v1")
            set_config_value("OPENAI_BASE_URL", base_url)
            
            model = Prompt.ask("请输入你想使用的模型名称", default="gpt-4o")
            set_config_value("MODEL_NAME", model)
            set_config_value("PROVIDER", "openai")
            
        else:
            key = Prompt.ask("请粘贴您的 ANTHROPIC_API_KEY", password=True)
            set_config_value("ANTHROPIC_API_KEY", key)
            set_config_value("MODEL_NAME", "claude-3-5-sonnet-20241022")
            set_config_value("PROVIDER", "anthropic")
            
        console.print(f"[bold green]✓ 配置已保存至全局目录 ({CONFIG_FILE})[/bold green]")
