"""
Wonderful Pydantic 数据模型
用于请求/响应的数据校验
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


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
    """登录返回 token"""
    access_token: str
    token_type: str = "bearer"
    user: UserProfile


# ============================================
# 卡片/任务相关
# ============================================

class CardCreate(BaseModel):
    """创建卡片"""
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    priority: str = Field(default="seed")  # firefighter, sniper, seed, recycle
    card_type: str = Field(default="daily")  # vision, goal, daily
    category: str = Field(default="")
    due_date: Optional[str] = None  # YYYY-MM-DD
    parent_card_id: Optional[int] = None
    estimated_minutes: int = Field(default=30, ge=1, le=480)
    coin_reward: int = Field(default=10, ge=1, le=1000)


class CardUpdate(BaseModel):
    """更新卡片"""
    title: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    priority: Optional[str] = None
    status: Optional[str] = None  # active, completed, paused, archived
    category: Optional[str] = None
    due_date: Optional[str] = None
    estimated_minutes: Optional[int] = Field(default=None, ge=1, le=480)
    coin_reward: Optional[int] = Field(default=None, ge=1, le=1000)
    progress: Optional[int] = Field(default=None, ge=0, le=100)


class CardResponse(BaseModel):
    """卡片响应"""
    id: int
    title: str
    description: str
    priority: str
    status: str
    card_type: str
    category: str
    due_date: str
    parent_card_id: Optional[int]
    estimated_minutes: int
    coin_reward: int
    progress: int
    postponed_count: int
    created_at: str
    completed_at: Optional[str]


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
