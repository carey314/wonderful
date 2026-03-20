"""
Wonderful AI 对话路由
晨启、晚审、思维转换、自由聊天
"""

from fastapi import APIRouter, Depends
from app.routers.users import get_current_user_id
from app.models.schemas import (
    MorningRequest, EveningRequest, ChatRequest, AIChatResponse,
)
from app.services.ai_engine import call_ai
from app.services.card_service import get_today_tasks, get_user_cards
from app.database import get_db
from app.prompts.templates import (
    SYSTEM_ROLE, MORNING_PROMPT, EVENING_PROMPT,
    MINDSET_SHIFT_PROMPT, CHAT_PROMPT, COMEBACK_PROMPT,
    DECOMPOSE_VISION_PROMPT, DECOMPOSE_GOAL_PROMPT,
)
from app.services.card_service import get_card

router = APIRouter(prefix="/api/ai", tags=["AI 对话"])


@router.post("/morning", response_model=AIChatResponse, summary="晨启对话")
async def morning_chat(
    request: MorningRequest = None,
    user_id: int = Depends(get_current_user_id),
):
    """
    每日晨启对话：AI 帮用户规划今天最值得做的事
    - 从待办中挑出 1-3 件推荐任务
    - 给一句思维转换
    - 温和提及昨日未完成的任务
    """
    # 获取用户信息和任务数据
    user, tasks, ai_memory, yesterday = _get_user_context(user_id)

    # 构建 prompt
    tasks_text = _format_tasks(tasks) if tasks else "暂无待办任务"
    yesterday_text = yesterday or "昨天没有记录"
    memory_text = _format_ai_memory(ai_memory) if ai_memory else "还在了解你中..."

    prompt = MORNING_PROMPT.format(
        nickname=user["nickname"],
        streak_days=user["streak_days"],
        tasks_list=tasks_text,
        yesterday_summary=yesterday_text,
        ai_memory=memory_text,
    )

    # 调用 AI
    ai_response = await call_ai(SYSTEM_ROLE, prompt)

    # 保存对话记录
    _save_conversation(user_id, "morning", prompt, ai_response)

    # 保存到每日记录
    _update_daily_log(user_id, morning_message=ai_response)

    return AIChatResponse(
        message=ai_response,
        conversation_type="morning",
    )


@router.post("/evening", response_model=AIChatResponse, summary="晚审对话")
async def evening_chat(
    request: EveningRequest = None,
    user_id: int = Depends(get_current_user_id),
):
    """
    每日晚审对话：AI 帮用户复盘今天的完成情况
    - 肯定完成的部分
    - 温和分析未完成的原因
    - 给明天的建议
    """
    user, tasks, ai_memory, _ = _get_user_context(user_id)

    # 分离已完成和未完成任务
    completed = [t for t in tasks if t["status"] == "completed"]
    uncompleted = [t for t in tasks if t["status"] == "active"]

    # 计算今日金币
    coins_earned = sum(t.get("coin_reward", 0) for t in completed)

    prompt = EVENING_PROMPT.format(
        nickname=user["nickname"],
        streak_days=user["streak_days"],
        planned_tasks=_format_tasks(tasks) if tasks else "今天没有安排任务",
        completed_tasks=_format_tasks(completed) if completed else "今天还没完成任务",
        uncompleted_tasks=_format_tasks(uncompleted) if uncompleted else "全部完成了！",
        coins_earned=coins_earned,
        ai_memory=_format_ai_memory(ai_memory) if ai_memory else "还在了解你中...",
    )

    ai_response = await call_ai(SYSTEM_ROLE, prompt)

    _save_conversation(user_id, "evening", prompt, ai_response)
    _update_daily_log(user_id, evening_summary=ai_response, coins_earned=coins_earned)

    return AIChatResponse(
        message=ai_response,
        conversation_type="evening",
        coins_earned=coins_earned,
    )


@router.post("/mindset", response_model=AIChatResponse, summary="思维转换")
async def mindset_shift(
    request: ChatRequest,
    user_id: int = Depends(get_current_user_id),
):
    """
    思维转换：当用户不想做某件事时，AI 帮换个角度看
    把抽象的"意义"变成具体的、有画面感的东西
    """
    user, tasks, ai_memory, _ = _get_user_context(user_id)

    # 尝试找到相关任务
    task_title = ""
    task_desc = ""
    if tasks:
        task_title = tasks[0]["title"]
        task_desc = tasks[0].get("description", "")

    prompt = MINDSET_SHIFT_PROMPT.format(
        nickname=user["nickname"],
        task_title=task_title,
        task_description=task_desc,
        user_message=request.message,
        ai_memory=_format_ai_memory(ai_memory) if ai_memory else "",
    )

    # 思维转换需要创意，用稍高的 temperature
    ai_response = await call_ai(SYSTEM_ROLE, prompt, temperature=0.9)

    _save_conversation(user_id, "mindset", request.message, ai_response)

    return AIChatResponse(
        message=ai_response,
        conversation_type="mindset",
    )


@router.post("/decompose", response_model=AIChatResponse, summary="AI 目标拆解")
async def ai_decompose(
    request: ChatRequest,
    user_id: int = Depends(get_current_user_id),
):
    """
    AI 拆解目标：
    - message 格式: "card_id:{id}" — 根据卡片类型自动选择拆解方式
    - vision → 拆成 goals
    - goal → 拆成 daily tasks
    返回 suggested_cards 列表，前端确认后批量创建
    """
    import json as json_lib

    # 解析 card_id
    card_id = None
    if request.message.startswith("card_id:"):
        try:
            card_id = int(request.message.split(":")[1])
        except (ValueError, IndexError):
            pass

    if card_id:
        card = get_card(card_id, user_id)
    else:
        card = None

    if not card:
        return AIChatResponse(
            message="未找到对应的卡片",
            conversation_type="chat",
            suggested_cards=[],
        )

    card_type = card.get("card_type", "daily")
    parent_title = ""

    if card_type == "vision":
        prompt = DECOMPOSE_VISION_PROMPT.format(
            title=card["title"],
            description=card.get("description", ""),
            deadline=card.get("due_date", "未设定"),
        )
    elif card_type == "goal":
        # 获取父愿景标题
        parent_id = card.get("parent_card_id")
        if parent_id:
            parent = get_card(parent_id, user_id)
            parent_title = parent["title"] if parent else ""
        prompt = DECOMPOSE_GOAL_PROMPT.format(
            title=card["title"],
            description=card.get("description", ""),
            parent_title=parent_title or "未关联愿景",
        )
    else:
        return AIChatResponse(
            message="每日任务不需要拆解，可以在任务详情页添加子步骤",
            conversation_type="chat",
            suggested_cards=[],
        )

    ai_response = await call_ai(SYSTEM_ROLE, prompt, temperature=0.7)

    # 尝试解析 JSON
    suggested = []
    try:
        json_match = __import__("re").search(r"\[[\s\S]*\]", ai_response)
        if json_match:
            suggested = json_lib.loads(json_match.group())
    except (json_lib.JSONDecodeError, AttributeError):
        pass

    _save_conversation(user_id, "chat", f"拆解{card_type}: {card['title']}", ai_response)

    return AIChatResponse(
        message=ai_response,
        conversation_type="chat",
        suggested_cards=suggested,
    )


@router.post("/chat", response_model=AIChatResponse, summary="自由聊天")
async def free_chat(
    request: ChatRequest,
    user_id: int = Depends(get_current_user_id),
):
    """自由对话：闲聊、求助、倾诉等"""
    user, tasks, ai_memory, _ = _get_user_context(user_id)

    prompt = CHAT_PROMPT.format(
        nickname=user["nickname"],
        user_message=request.message,
        tasks_list=_format_tasks(tasks[:5]) if tasks else "暂无任务",
        ai_memory=_format_ai_memory(ai_memory) if ai_memory else "",
    )

    ai_response = await call_ai(SYSTEM_ROLE, prompt)

    _save_conversation(user_id, "chat", request.message, ai_response)

    return AIChatResponse(
        message=ai_response,
        conversation_type="chat",
    )


# ============================================
# 内部工具函数
# ============================================

def _get_user_context(user_id: int) -> tuple:
    """获取用户上下文信息（用户资料、任务、AI记忆、昨日记录）"""
    with get_db() as db:
        user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        user = dict(user) if user else {"nickname": "朋友", "streak_days": 0}

    tasks = get_user_cards(user_id, status="active")

    with get_db() as db:
        # 获取 AI 记忆
        ai_memory = db.execute(
            "SELECT * FROM ai_memory WHERE user_id = ? ORDER BY confidence DESC LIMIT 10",
            (user_id,),
        ).fetchall()
        ai_memory = [dict(row) for row in ai_memory]

        # 获取昨日记录
        yesterday_log = db.execute(
            """SELECT evening_summary FROM daily_logs
               WHERE user_id = ? ORDER BY log_date DESC LIMIT 1""",
            (user_id,),
        ).fetchone()
        yesterday = yesterday_log["evening_summary"] if yesterday_log else None

    return user, tasks, ai_memory, yesterday


def _format_tasks(tasks: list) -> str:
    """格式化任务列表为文本"""
    if not tasks:
        return "无"
    lines = []
    for t in tasks:
        priority_emoji = {
            "firefighter": "🚨", "sniper": "🎯",
            "seed": "🌱", "recycle": "🗑",
        }.get(t.get("priority", "seed"), "📋")
        lines.append(f"- {priority_emoji} {t['title']}（预计{t.get('estimated_minutes', 30)}分钟）")
    return "\n".join(lines)


def _format_ai_memory(memories: list) -> str:
    """格式化 AI 记忆为文本"""
    if not memories:
        return ""
    return "\n".join(f"- {m['content']}" for m in memories)


def _save_conversation(user_id: int, conv_type: str, user_msg: str, ai_msg: str):
    """保存对话记录"""
    with get_db() as db:
        db.execute(
            "INSERT INTO ai_conversations (user_id, conversation_type, role, content) VALUES (?, ?, 'user', ?)",
            (user_id, conv_type, user_msg),
        )
        db.execute(
            "INSERT INTO ai_conversations (user_id, conversation_type, role, content) VALUES (?, ?, 'assistant', ?)",
            (user_id, conv_type, ai_msg),
        )


def _update_daily_log(
    user_id: int,
    morning_message: str = None,
    evening_summary: str = None,
    coins_earned: int = 0,
):
    """更新今日的每日记录"""
    from datetime import date
    today = date.today().isoformat()

    with get_db() as db:
        # 查找今日记录，没有则创建
        log = db.execute(
            "SELECT * FROM daily_logs WHERE user_id = ? AND log_date = ?",
            (user_id, today),
        ).fetchone()

        if not log:
            db.execute(
                "INSERT INTO daily_logs (user_id, log_date) VALUES (?, ?)",
                (user_id, today),
            )

        if morning_message:
            db.execute(
                "UPDATE daily_logs SET morning_message = ? WHERE user_id = ? AND log_date = ?",
                (morning_message, user_id, today),
            )
        if evening_summary:
            db.execute(
                "UPDATE daily_logs SET evening_summary = ?, coins_earned = ? WHERE user_id = ? AND log_date = ?",
                (evening_summary, coins_earned, user_id, today),
            )
