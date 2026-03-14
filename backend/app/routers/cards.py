"""
Wonderful 卡片/任务路由
任务的增删改查、完成、推迟
"""

from fastapi import APIRouter, HTTPException, Depends
from app.routers.users import get_current_user_id
from app.models.schemas import (
    CardCreate, CardUpdate, CardResponse, MessageResponse,
)
from app.services.card_service import (
    create_card, get_user_cards, get_card, update_card,
    complete_card, delete_card, postpone_card, get_today_tasks,
)

router = APIRouter(prefix="/api/cards", tags=["卡片系统"])


@router.post("/", response_model=CardResponse, summary="创建新卡片")
async def create_new_card(
    card_data: CardCreate,
    user_id: int = Depends(get_current_user_id),
):
    """创建新的任务卡片"""
    card = create_card(user_id, card_data.model_dump())
    return card


@router.get("/", response_model=list[CardResponse], summary="获取卡片列表")
async def list_cards(
    status: str = None,
    card_type: str = None,
    user_id: int = Depends(get_current_user_id),
):
    """
    获取用户的卡片列表
    可按状态和类型筛选：
    - status: active, completed, paused, archived
    - card_type: vision, goal, daily
    """
    return get_user_cards(user_id, status=status, card_type=card_type)


@router.get("/today", response_model=list[CardResponse], summary="获取今日任务")
async def list_today_tasks(user_id: int = Depends(get_current_user_id)):
    """获取今日待办任务（活跃的每日任务）"""
    return get_today_tasks(user_id)


@router.get("/{card_id}", response_model=CardResponse, summary="获取单个卡片")
async def get_single_card(
    card_id: int,
    user_id: int = Depends(get_current_user_id),
):
    """获取指定卡片的详细信息"""
    card = get_card(card_id, user_id)
    if not card:
        raise HTTPException(status_code=404, detail="卡片不存在")
    return card


@router.put("/{card_id}", response_model=CardResponse, summary="更新卡片")
async def update_existing_card(
    card_id: int,
    updates: CardUpdate,
    user_id: int = Depends(get_current_user_id),
):
    """更新卡片的标题、描述、优先级等信息"""
    card = update_card(card_id, user_id, updates.model_dump(exclude_none=True))
    if not card:
        raise HTTPException(status_code=404, detail="卡片不存在")
    return card


@router.post("/{card_id}/complete", response_model=MessageResponse, summary="完成卡片")
async def complete_existing_card(
    card_id: int,
    user_id: int = Depends(get_current_user_id),
):
    """
    标记卡片为完成状态，自动计算并发放金币
    金币加成规则：
    - 连续打卡 7天 ×1.5，30天 ×2.0
    - 拖延任务（推迟3次以上）完成 ×2.0
    """
    result = complete_card(card_id, user_id)
    if not result:
        raise HTTPException(status_code=400, detail="卡片不存在或已完成")

    return MessageResponse(
        message=f"完成了「{result['title']}」！获得 {result.get('coins_earned', 0)} 金币",
        data={"coins_earned": result.get("coins_earned", 0), "card_id": card_id},
    )


@router.post("/{card_id}/postpone", response_model=MessageResponse, summary="推迟卡片")
async def postpone_existing_card(
    card_id: int,
    user_id: int = Depends(get_current_user_id),
):
    """推迟任务到明天，增加推迟计数（用于拖延检测）"""
    result = postpone_card(card_id, user_id)
    if not result:
        raise HTTPException(status_code=404, detail="卡片不存在")

    return MessageResponse(
        message="已推迟到明天",
        data={"postponed_count": result["postponed_count"]},
    )


@router.delete("/{card_id}", response_model=MessageResponse, summary="删除卡片")
async def delete_existing_card(
    card_id: int,
    user_id: int = Depends(get_current_user_id),
):
    """删除（归档）卡片"""
    success = delete_card(card_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="卡片不存在")
    return MessageResponse(message="卡片已删除")
