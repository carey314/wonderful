"""
Wonderful 每日记录路由
查看历史记录和统计数据
"""

import json
from fastapi import APIRouter, Depends
from app.routers.users import get_current_user_id
from app.models.schemas import DailyLogResponse, MessageResponse
from app.database import get_db

router = APIRouter(prefix="/api/logs", tags=["每日记录"])


@router.get("/today", response_model=DailyLogResponse | None, summary="获取今日记录")
async def get_today_log(user_id: int = Depends(get_current_user_id)):
    """获取今天的每日记录（晨启/晚审内容、完成情况）"""
    from datetime import date
    today = date.today().isoformat()

    with get_db() as db:
        row = db.execute(
            "SELECT * FROM daily_logs WHERE user_id = ? AND log_date = ?",
            (user_id, today),
        ).fetchone()

    if not row:
        return None
    return _to_response(row)


@router.get("/history", response_model=list[DailyLogResponse], summary="获取历史记录")
async def get_history(
    limit: int = 7,
    user_id: int = Depends(get_current_user_id),
):
    """获取最近 N 天的每日记录"""
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM daily_logs WHERE user_id = ? ORDER BY log_date DESC LIMIT ?",
            (user_id, min(limit, 90)),  # 最多查90天
        ).fetchall()

    return [_to_response(row) for row in rows]


@router.get("/stats", response_model=MessageResponse, summary="获取统计数据")
async def get_stats(
    days: int = 7,
    user_id: int = Depends(get_current_user_id),
):
    """
    获取最近 N 天的统计数据
    包括：完成率、金币收入、最高效时段等
    """
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM daily_logs WHERE user_id = ? ORDER BY log_date DESC LIMIT ?",
            (user_id, min(days, 90)),
        ).fetchall()

    if not rows:
        return MessageResponse(
            message="还没有足够的数据",
            data={"total_days": 0},
        )

    total_coins = sum(row["coins_earned"] for row in rows)
    avg_completion = sum(row["completion_rate"] for row in rows) / len(rows)

    # 获取用户总完成任务数
    completed_count = db.execute(
        "SELECT COUNT(*) as cnt FROM cards WHERE user_id = ? AND status = 'completed'",
        (user_id,),
    ).fetchone()

    return MessageResponse(
        message="统计数据",
        data={
            "total_days": len(rows),
            "total_coins_earned": total_coins,
            "avg_completion_rate": round(avg_completion, 2),
            "total_completed_cards": completed_count["cnt"] if completed_count else 0,
        },
    )


def _to_response(row) -> DailyLogResponse:
    """将数据库行转换为响应模型"""
    # 安全解析 JSON 字段
    try:
        completed_ids = json.loads(row["completed_card_ids"]) if row["completed_card_ids"] else []
    except (json.JSONDecodeError, TypeError):
        completed_ids = []

    return DailyLogResponse(
        id=row["id"],
        log_date=row["log_date"],
        morning_message=row["morning_message"] or "",
        evening_summary=row["evening_summary"] or "",
        completed_card_ids=completed_ids,
        coins_earned=row["coins_earned"],
        coins_spent=row["coins_spent"],
        completion_rate=row["completion_rate"],
    )
