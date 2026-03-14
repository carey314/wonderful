"""
Wonderful 奖励商城路由
自定义奖励的增删改查和兑换
"""

from fastapi import APIRouter, HTTPException, Depends
from app.routers.users import get_current_user_id
from app.models.schemas import (
    RewardCreate, RewardUpdate, RewardResponse, MessageResponse,
)
from app.services.coin_service import spend_coins
from app.database import get_db

router = APIRouter(prefix="/api/rewards", tags=["奖励商城"])


@router.post("/", response_model=RewardResponse, summary="创建自定义奖励")
async def create_reward(
    reward_data: RewardCreate,
    user_id: int = Depends(get_current_user_id),
):
    """用户自定义一个奖励（如：一杯奶茶 50金币）"""
    with get_db() as db:
        cursor = db.execute(
            "INSERT INTO rewards (user_id, title, emoji, coin_cost) VALUES (?, ?, ?, ?)",
            (user_id, reward_data.title, reward_data.emoji, reward_data.coin_cost),
        )
        row = db.execute("SELECT * FROM rewards WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return _to_response(row)


@router.get("/", response_model=list[RewardResponse], summary="获取奖励列表")
async def list_rewards(user_id: int = Depends(get_current_user_id)):
    """获取用户的奖励商城列表"""
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM rewards WHERE user_id = ? AND is_active = 1 ORDER BY coin_cost ASC",
            (user_id,),
        ).fetchall()
    return [_to_response(row) for row in rows]


@router.put("/{reward_id}", response_model=RewardResponse, summary="更新奖励")
async def update_reward(
    reward_id: int,
    updates: RewardUpdate,
    user_id: int = Depends(get_current_user_id),
):
    """更新奖励信息"""
    data = updates.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="没有需要更新的内容")

    # 构建更新语句
    fields = []
    values = []
    for key, value in data.items():
        if key == "is_active":
            value = 1 if value else 0
        fields.append(f"{key} = ?")
        values.append(value)

    values.extend([reward_id, user_id])

    with get_db() as db:
        db.execute(
            f"UPDATE rewards SET {', '.join(fields)} WHERE id = ? AND user_id = ?",
            values,
        )
        row = db.execute(
            "SELECT * FROM rewards WHERE id = ? AND user_id = ?",
            (reward_id, user_id),
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="奖励不存在")
    return _to_response(row)


@router.post("/{reward_id}/redeem", response_model=MessageResponse, summary="兑换奖励")
async def redeem_reward(
    reward_id: int,
    user_id: int = Depends(get_current_user_id),
):
    """
    花金币兑换奖励
    花金币不是"浪费"，是你赚到的！
    """
    with get_db() as db:
        reward = db.execute(
            "SELECT * FROM rewards WHERE id = ? AND user_id = ? AND is_active = 1",
            (reward_id, user_id),
        ).fetchone()

    if not reward:
        raise HTTPException(status_code=404, detail="奖励不存在")

    # 扣金币
    success, remaining = spend_coins(user_id, reward["coin_cost"])
    if not success:
        raise HTTPException(
            status_code=400,
            detail=f"金币不足！需要 {reward['coin_cost']}，当前余额 {remaining}",
        )

    # 记录兑换
    with get_db() as db:
        db.execute(
            "UPDATE rewards SET times_redeemed = times_redeemed + 1 WHERE id = ?",
            (reward_id,),
        )
        db.execute(
            "INSERT INTO reward_redemptions (user_id, reward_id, coins_spent) VALUES (?, ?, ?)",
            (user_id, reward_id, reward["coin_cost"]),
        )

    return MessageResponse(
        message=f"🎉 兑换成功！享受你的「{reward['title']}」吧！剩余金币：{remaining}",
        data={"remaining_coins": remaining, "reward_title": reward["title"]},
    )


@router.delete("/{reward_id}", response_model=MessageResponse, summary="删除奖励")
async def delete_reward(
    reward_id: int,
    user_id: int = Depends(get_current_user_id),
):
    """删除（停用）奖励"""
    with get_db() as db:
        result = db.execute(
            "UPDATE rewards SET is_active = 0 WHERE id = ? AND user_id = ?",
            (reward_id, user_id),
        )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="奖励不存在")
    return MessageResponse(message="奖励已删除")


def _to_response(row) -> RewardResponse:
    """将数据库行转换为响应模型"""
    return RewardResponse(
        id=row["id"],
        title=row["title"],
        emoji=row["emoji"],
        coin_cost=row["coin_cost"],
        times_redeemed=row["times_redeemed"],
        is_active=bool(row["is_active"]),
        created_at=row["created_at"],
    )
