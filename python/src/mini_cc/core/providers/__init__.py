"""
LLM 提供商模块 (providers)
========================

提供统一的 LLM 接口，支持多个模型提供商。
"""

from typing import Optional
from .base import LLMProvider
from .openai_provider import OpenAIProvider
from .anthropic_provider import AnthropicProvider


def create_provider(
    provider_type: str = "openai",
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    model: Optional[str] = None,
) -> LLMProvider:
    """
    Provider 工厂函数。
    
    根据类型创建对应的 Provider 实例。
    
    :param provider_type: 提供商类型 ("openai" 或 "anthropic")
    :param api_key: API 密钥
    :param base_url: API 基础 URL（仅 OpenAI 兼容接口）
    :param model: 模型名称
    :return: LLMProvider 实例
    """
    if provider_type == "anthropic":
        from mini_cc.config import get_config_value
        key = api_key or get_config_value("ANTHROPIC_API_KEY")
        if not key:
            raise ValueError("ANTHROPIC_API_KEY 未配置")
        m = model or get_config_value("MODEL_NAME", "claude-sonnet-4-20250514")
        return AnthropicProvider(api_key=key, model=m)
    else:
        from mini_cc.config import get_config_value
        key = api_key or get_config_value("OPENAI_API_KEY")
        if not key:
            raise ValueError("OPENAI_API_KEY 未配置")
        url = base_url or get_config_value("OPENAI_BASE_URL", "https://api.openai.com/v1")
        m = model or get_config_value("MODEL_NAME", "gpt-4o")
        return OpenAIProvider(api_key=key, base_url=url, model=m)


__all__ = [
    'LLMProvider',
    'OpenAIProvider',
    'AnthropicProvider',
    'create_provider',
]
