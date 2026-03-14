"""
Wonderful AI 引擎
支持 DeepSeek（主）和 GLM-4-Flash（备）双引擎
"""

import httpx
from typing import Optional
from app.config import (
    DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL,
    GLM_API_KEY, GLM_BASE_URL, GLM_MODEL,
    AI_DEFAULT_ENGINE,
)


async def call_ai(
    system_prompt: str,
    user_prompt: str,
    engine: Optional[str] = None,
    temperature: float = 0.8,
    max_tokens: int = 500,
) -> str:
    """
    调用 AI 模型生成回复
    支持 deepseek 和 glm 两个引擎，自动降级

    Args:
        system_prompt: 系统角色设定
        user_prompt: 用户消息/填充后的模板
        engine: 指定引擎 (deepseek/glm)，默认用配置
        temperature: 创意度 (0.0-1.0)
        max_tokens: 最大生成 token 数

    Returns:
        AI 生成的文本
    """
    engine = engine or AI_DEFAULT_ENGINE

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    # 先尝试主引擎，失败则降级到备用引擎
    try:
        return await _call_engine(engine, messages, temperature, max_tokens)
    except Exception as e:
        print(f"[AI引擎] {engine} 调用失败: {e}，尝试备用引擎")
        fallback = "glm" if engine == "deepseek" else "deepseek"
        try:
            return await _call_engine(fallback, messages, temperature, max_tokens)
        except Exception as e2:
            print(f"[AI引擎] 备用引擎 {fallback} 也失败: {e2}，使用兜底回复")
            return _get_fallback_response()


async def _call_engine(
    engine: str,
    messages: list,
    temperature: float,
    max_tokens: int,
) -> str:
    """调用指定引擎"""
    if engine == "deepseek":
        api_key = DEEPSEEK_API_KEY
        base_url = DEEPSEEK_BASE_URL
        model = DEEPSEEK_MODEL
    elif engine == "glm":
        api_key = GLM_API_KEY
        base_url = GLM_BASE_URL
        model = GLM_MODEL
    else:
        raise ValueError(f"不支持的 AI 引擎: {engine}")

    if not api_key:
        raise ValueError(f"{engine} API Key 未配置")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{base_url}/chat/completions",
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"].strip()


def _get_fallback_response() -> str:
    """所有 AI 引擎都挂了时的兜底回复"""
    return (
        "今天也是新的一天！\n\n"
        "AI 暂时开了个小差，但你的任务还在等你。\n"
        "先挑一件最简单的开始吧，做完了记得回来告诉我 ✌️"
    )
