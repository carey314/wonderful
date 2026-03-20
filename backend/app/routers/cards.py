"""
Wonderful 卡片/任务路由 — V2
任务的增删改查、完成、推迟，返回 camelCase 格式
"""

import json
from fastapi import APIRouter, HTTPException, Depends
from app.routers.users import get_current_user_id
from app.models.schemas import (
    CardCreate, CardUpdate, CardResponse, MessageResponse, row_to_card_response,
)
from app.services.card_service import (
    create_card, get_user_cards, get_card, update_card,
    complete_card, delete_card, postpone_card, get_today_tasks,
    get_card_children,
)

router = APIRouter(prefix="/api/cards", tags=["卡片系统"])


@router.post("/", response_model=CardResponse, summary="创建新卡片")
async def create_new_card(
    card_data: CardCreate,
    user_id: int = Depends(get_current_user_id),
):
    """创建新的任务卡片 — V2"""
    # 将 Pydantic 模型转为 dict，保留 camelCase 字段名给 service 层处理
    data = card_data.model_dump()
    row = create_card(user_id, data)
    return row_to_card_response(row)


@router.get("/", response_model=list[CardResponse], summary="获取卡片列表")
async def list_cards(
    status: str = None,
    card_type: str = None,
    user_id: int = Depends(get_current_user_id),
):
    """
    获取用户的卡片列表 — V2
    可按状态和类型筛选：
    - status: pending, in_progress, completed, archived
    - card_type: vision, goal, daily
    """
    rows = get_user_cards(user_id, status=status, card_type=card_type)
    return [row_to_card_response(r) for r in rows]


@router.get("/today", response_model=list[CardResponse], summary="获取今日任务")
async def list_today_tasks(user_id: int = Depends(get_current_user_id)):
    """获取今日待办任务（活跃的每日任务）"""
    rows = get_today_tasks(user_id)
    return [row_to_card_response(r) for r in rows]


@router.get("/{card_id}/children", response_model=list[CardResponse], summary="获取子卡片")
async def get_children(
    card_id: int,
    user_id: int = Depends(get_current_user_id),
):
    """获取某卡片的所有子卡片（愿景→目标 或 目标→每日任务）"""
    rows = get_card_children(card_id, user_id)
    return [row_to_card_response(r) for r in rows]


@router.get("/{card_id}", response_model=CardResponse, summary="获取单个卡片")
async def get_single_card(
    card_id: int,
    user_id: int = Depends(get_current_user_id),
):
    """获取指定卡片的详细信息"""
    row = get_card(card_id, user_id)
    if not row:
        raise HTTPException(status_code=404, detail="卡片不存在")
    return row_to_card_response(row)


@router.put("/{card_id}", response_model=CardResponse, summary="更新卡片")
async def update_existing_card(
    card_id: int,
    updates: CardUpdate,
    user_id: int = Depends(get_current_user_id),
):
    """更新卡片的标题、描述、优先级等信息 — V2"""
    row = update_card(card_id, user_id, updates.model_dump(exclude_none=True))
    if not row:
        raise HTTPException(status_code=404, detail="卡片不存在")
    return row_to_card_response(row)


@router.post("/{card_id}/complete", summary="完成卡片")
async def complete_existing_card(
    card_id: int,
    user_id: int = Depends(get_current_user_id),
):
    """
    标记卡片为完成状态，自动计算并发放金币
    返回 V2 格式：包含 coinReward 金额
    """
    result = complete_card(card_id, user_id)
    if not result:
        raise HTTPException(status_code=400, detail="卡片不存在或已完成")

    coins_earned = result.get("coins_earned", 0)
    card_resp = row_to_card_response(result)

    return {
        "message": f"完成了「{result['title']}」！获得 {coins_earned} 金币",
        "success": True,
        "coinReward": coins_earned,
        "card": card_resp.model_dump(),
    }


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
        data={"postponedCount": result["postponed_count"]},
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
