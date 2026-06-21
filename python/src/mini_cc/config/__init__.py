"""
配置模块 (config)
================

提供配置管理功能，支持环境变量、配置文件和默认值三级优先级。
"""

from .settings import (
    get_config_value,
    set_config_value,
    read_config,
    write_config,
    check_first_run_setup,
    CONFIG_DIR,
    CONFIG_FILE,
)

__all__ = [
    "get_config_value",
    "set_config_value",
    "read_config",
    "write_config",
    "check_first_run_setup",
    "CONFIG_DIR",
    "CONFIG_FILE",
]
