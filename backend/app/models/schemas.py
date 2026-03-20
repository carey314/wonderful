"""
Wonderful Pydantic 数据模型
用于请求/响应的数据校验
"""

import json
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, model_validator


# ============================================
# 用户相关
# ============================================

class WxLoginRequest(BaseModel):
    """微信登录请求"""
    code: str = Field(..., description="微信 login code")


class UserProfile(BaseModel):
    """用户信息"""
    id: int
    nickname: str
    avatar_url: str
    coins: int
    streak_days: int
    max_streak_days: int
    morning_remind_time: str
    evening_remind_time: str
    notify_enabled: bool
    created_at: str


class UserSettingsUpdate(BaseModel):
    """用户设置更新"""
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None
    morning_remind_time: Optional[str] = None
    evening_remind_time: Optional[str] = None
    notify_enabled: Optional[bool] = None


class TokenResponse(BaseModel):
    """登录返回 token — 同时返回 token 和 access_token 兼容新旧前端"""
    token: str
    access_token: str = ""  # 兼容旧前端 app.js 读 access_token
    user: UserProfile

    @model_validator(mode="before")
    @classmethod
    def sync_token_fields(cls, data):
        if isinstance(data, dict):
            # 保证 token 和 access_token 同步
            if "token" in data and not data.get("access_token"):
                data["access_token"] = data["token"]
            elif "access_token" in data and not data.get("token"):
                data["token"] = data["access_token"]
        return data


# ============================================
# 卡片/任务相关 — V2 数据模型
# ============================================

class SubtaskItem(BaseModel):
    """子任务"""
    id: str = ""
    title: str = ""
    completed: bool = False
    estimatedMinutes: int = 0


class CardCreate(BaseModel):
    """创建卡片 — V2：接收前端 camelCase 字段"""
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    priority: str = Field(default="normal")  # urgent_important, important, urgent, normal
    card_type: str = Field(default="daily")  # vision, goal, daily
    category: str = Field(default="")
    project: str = Field(default="")
    due_date: Optional[str] = Field(default=None, alias="deadline")  # 前端用 deadline
    parent_card_id: Optional[int] = None
    estimatedMinutes: int = Field(default=30, ge=1, le=480)
    coinReward: int = Field(default=0, ge=0, le=10000)
    isUrgent: bool = Field(default=False)
    isImportant: bool = Field(default=False)
    energy: str = Field(default="medium")  # high, medium, low
    subtasks: list[SubtaskItem] = Field(default_factory=list)
    status: str = Field(default="pending")

    model_config = {"populate_by_name": True}

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data):
        """兼容前端 camelCase 和后端 snake_case"""
        if isinstance(data, dict):
            # deadline -> due_date
            if "deadline" in data and "due_date" not in data:
                data["due_date"] = data.pop("deadline")
            # 也接受 due_date 直接传入
            # estimated_minutes -> estimatedMinutes
            if "estimated_minutes" in data and "estimatedMinutes" not in data:
                data["estimatedMinutes"] = data.pop("estimated_minutes")
            if "coin_reward" in data and "coinReward" not in data:
                data["coinReward"] = data.pop("coin_reward")
            if "is_urgent" in data and "isUrgent" not in data:
                data["isUrgent"] = data.pop("is_urgent")
            if "is_important" in data and "isImportant" not in data:
                data["isImportant"] = data.pop("is_important")
        return data


class CardUpdate(BaseModel):
    """更新卡片 — V2"""
    title: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    priority: Optional[str] = None
    status: Optional[str] = None  # pending, in_progress, completed, archived
    category: Optional[str] = None
    project: Optional[str] = None
    due_date: Optional[str] = None
    estimatedMinutes: Optional[int] = Field(default=None, ge=1, le=480)
    coinReward: Optional[int] = Field(default=None, ge=0, le=10000)
    isUrgent: Optional[bool] = None
    isImportant: Optional[bool] = None
    energy: Optional[str] = None
    subtasks: Optional[list[SubtaskItem]] = None
    progress: Optional[int] = Field(default=None, ge=0, le=100)

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data):
        if isinstance(data, dict):
            if "deadline" in data and "due_date" not in data:
                data["due_date"] = data.pop("deadline")
            if "estimated_minutes" in data and "estimatedMinutes" not in data:
                data["estimatedMinutes"] = data.pop("estimated_minutes")
            if "coin_reward" in data and "coinReward" not in data:
                data["coinReward"] = data.pop("coin_reward")
            if "is_urgent" in data and "isUrgent" not in data:
                data["isUrgent"] = data.pop("is_urgent")
            if "is_important" in data and "isImportant" not in data:
                data["isImportant"] = data.pop("is_important")
        return data


class CardResponse(BaseModel):
    """卡片响应 — V2：返回 camelCase 给前端"""
    id: int
    title: str
    description: str
    priority: str
    status: str
    cardType: str = ""
    category: str = ""
    project: str = ""
    deadline: str = ""       # 前端用 deadline（对应 DB due_date）
    parentCardId: Optional[int] = None
    estimatedMinutes: int = 30
    coinReward: int = 0
    isUrgent: bool = False
    isImportant: bool = False
    energy: str = "medium"
    subtasks: list = Field(default_factory=list)
    progress: int = 0
    postponedCount: int = 0
    createdAt: str = ""
    completedAt: Optional[str] = None
    updatedAt: str = ""


def row_to_card_response(row: dict) -> CardResponse:
    """将数据库行 (snake_case) 转换为 V2 CardResponse (camelCase)"""
    subtasks = []
    raw = row.get("subtasks_json", "[]")
    if raw:
        try:
            subtasks = json.loads(raw) if isinstance(raw, str) else raw
        except (json.JSONDecodeError, TypeError):
            subtasks = []

    return CardResponse(
        id=row["id"],
        title=row["title"],
        description=row.get("description", ""),
        priority=row.get("priority", "normal"),
        status=row.get("status", "pending"),
        cardType=row.get("card_type", "daily"),
        category=row.get("category", ""),
        project=row.get("project", ""),
        deadline=row.get("due_date", ""),
        parentCardId=row.get("parent_card_id"),
        estimatedMinutes=row.get("estimated_minutes", 30),
        coinReward=row.get("coin_reward", 0),
        isUrgent=bool(row.get("is_urgent", 0)),
        isImportant=bool(row.get("is_important", 0)),
        energy=row.get("energy", "medium"),
        subtasks=subtasks,
        progress=row.get("progress", 0),
        postponedCount=row.get("postponed_count", 0),
        createdAt=row.get("created_at", ""),
        completedAt=row.get("completed_at"),
        updatedAt=row.get("updated_at", ""),
    )


# ============================================
# AI 对话相关
# ============================================

class MorningRequest(BaseModel):
    """晨启请求（可选用户消息）"""
    message: Optional[str] = None


class EveningRequest(BaseModel):
    """晚审请求（可选用户消息）"""
    message: Optional[str] = None


class ChatRequest(BaseModel):
    """自由对话请求"""
    message: str = Field(..., min_length=1, max_length=1000)


class AIChatResponse(BaseModel):
    """AI 对话响应"""
    message: str
    conversation_type: str  # morning, evening, mindset, chat
    suggested_cards: list = Field(default_factory=list)  # AI 推荐的今日任务
    coins_earned: int = 0


# ============================================
# 奖励相关
# ============================================

class RewardCreate(BaseModel):
    """创建奖励"""
    title: str = Field(..., min_length=1, max_length=100)
    emoji: str = Field(default="🎁", max_length=10)
    coin_cost: int = Field(..., ge=1, le=10000)


class RewardUpdate(BaseModel):
    """更新奖励"""
    title: Optional[str] = Field(default=None, max_length=100)
    emoji: Optional[str] = Field(default=None, max_length=10)
    coin_cost: Optional[int] = Field(default=None, ge=1, le=10000)
    is_active: Optional[bool] = None


class RewardResponse(BaseModel):
    """奖励响应"""
    id: int
    title: str
    emoji: str
    coin_cost: int
    times_redeemed: int
    is_active: bool
    created_at: str


# ============================================
# 每日记录相关
# ============================================

class DailyLogResponse(BaseModel):
    """每日记录响应"""
    id: int
    log_date: str
    morning_message: str
    evening_summary: str
    completed_card_ids: list
    coins_earned: int
    coins_spent: int
    completion_rate: float


# ============================================
# 思维转换相关
# ============================================

class MindsetShiftCreate(BaseModel):
    """创建思维转换"""
    original_thought: str = Field(..., min_length=1, max_length=500)
    reframed_thought: str = Field(..., min_length=1, max_length=500)
    category: str = Field(default="")
    is_public: bool = Field(default=False)


class MindsetShiftResponse(BaseModel):
    """思维转换响应"""
    id: int
    original_thought: str
    reframed_thought: str
    category: str
    likes_count: int
    is_public: bool
    is_ai_generated: bool
    created_at: str


# ============================================
# 通用响应
# ============================================

class MessageResponse(BaseModel):
    """通用消息响应"""
    message: str
    success: bool = True
    data: Optional[dict] = None
