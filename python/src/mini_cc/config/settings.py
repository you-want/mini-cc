"""
配置管理 (settings.py)
====================

管理全局配置，包括 API Key、模型选择等。
配置优先级：环境变量 > config.json > 默认值

配置文件存储位置：~/.mini-cc/config.json
"""

import os
import json
from pathlib import Path
from dotenv import load_dotenv

# 加载当前目录下的 .env 文件（如果有的话）
load_dotenv()

# ============================================================
# 配置路径
# ============================================================

# 使用 pathlib 处理路径，比 os.path 更现代化、更安全
# 获取用户的 home 目录 (例如: ~/.mini-cc)
CONFIG_DIR = Path.home() / ".mini-cc"
CONFIG_FILE = CONFIG_DIR / "config.json"


# ============================================================
# 配置读写
# ============================================================

def ensure_config_dir() -> None:
    """确保配置目录存在"""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)


def read_config() -> dict:
    """
    读取全局配置文件。
    
    :return: 配置字典，如果文件不存在或读取失败则返回空字典
    """
    if not CONFIG_FILE.exists():
        return {}
    
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"读取配置文件失败: {e}")
        return {}


def write_config(config_data: dict) -> None:
    """
    将配置写入全局文件。
    
    :param config_data: 要保存的配置字典
    """
    ensure_config_dir()
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(config_data, f, indent=2)
    except Exception as e:
        print(f"写入配置文件失败: {e}")


def get_config_value(key: str, default: str = "") -> str:
    """
    获取配置值。
    
    优先级: 环境变量 (包含 .env) > 全局 config.json > 默认值
    
    :param key: 配置键名
    :param default: 默认值
    :return: 配置值
    """
    # 1. 尝试从环境变量获取
    env_val = os.environ.get(key)
    if env_val:
        return env_val
        
    # 2. 尝试从全局配置文件获取
    config_data = read_config()
    value = config_data.get(key)
    if value:
        return value
    
    # 3. 返回默认值
    return default


def set_config_value(key: str, value: str) -> None:
    """
    设置配置值并保存到全局文件。
    
    :param key: 配置键名
    :param value: 配置值
    """
    config_data = read_config()
    config_data[key] = value
    write_config(config_data)


# ============================================================
# 首次运行引导
# ============================================================

def check_first_run_setup() -> None:
    """
    首次运行引导。
    
    如果检测不到 API Key，通过交互式 prompt 引导用户配置。
    这是用户第一次运行 mini-cc 时的体验优化。
    """
    api_key = get_config_value("OPENAI_API_KEY") or get_config_value("ANTHROPIC_API_KEY")
    
    if api_key:
        return  # 已有 API Key，跳过引导
    
    from rich.console import Console
    from rich.prompt import Prompt
    console = Console()
    
    console.print("[bold yellow]⚠️  未检测到大模型 API Key。[/bold yellow]")
    console.print("mini-cc 需要一个 LLM API Key 才能运行。\n")
    
    provider = Prompt.ask(
        "请选择你想使用的接口",
        choices=["openai", "anthropic"],
        default="openai"
    )
    
    if provider == "openai":
        key = Prompt.ask("请粘贴您的 OPENAI_API_KEY (支持兼容接口)", password=True)
        set_config_value("OPENAI_API_KEY", key)
        
        base_url = Prompt.ask(
            "请输入 BASE_URL",
            default="https://api.openai.com/v1"
        )
        set_config_value("OPENAI_BASE_URL", base_url)
        
        model = Prompt.ask("请输入模型名称", default="gpt-4o")
        set_config_value("MODEL_NAME", model)
        set_config_value("PROVIDER", "openai")
        
    else:
        key = Prompt.ask("请粘贴您的 ANTHROPIC_API_KEY", password=True)
        set_config_value("ANTHROPIC_API_KEY", key)
        set_config_value("MODEL_NAME", "claude-sonnet-4-20250514")
        set_config_value("PROVIDER", "anthropic")
        
    console.print(f"\n[bold green]✓ 配置已保存至 {CONFIG_FILE}[/bold green]")
