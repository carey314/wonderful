"""
Wonderful 卡片/任务服务
管理任务的 CRUD、状态流转和智能优先级
"""

import json
from datetime import datetime, date
from app.database import get_db
from app.services.coin_service import calculate_coin_reward, add_coins


def create_card(user_id: int, card_data: dict) -> dict:
    """创建新卡片"""
    with get_db() as db:
        cursor = db.execute(
            """INSERT INTO cards
            (user_id, title, description, priority, card_type, category,
             due_date, parent_card_id, estimated_minutes, coin_reward)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                user_id,
                card_data["title"],
                card_data.get("description", ""),
                card_data.get("priority", "seed"),
                card_data.get("card_type", "daily"),
                card_data.get("category", ""),
                card_data.get("due_date", ""),
                card_data.get("parent_card_id"),
                card_data.get("estimated_minutes", 30),
                card_data.get("coin_reward", 10),
            ),
        )
        card_id = cursor.lastrowid
        row = db.execute("SELECT * FROM cards WHERE id = ?", (card_id,)).fetchone()
        return dict(row)


def get_user_cards(user_id: int, status: str = None, card_type: str = None) -> list:
    """获取用户的卡片列表"""
    query = "SELECT * FROM cards WHERE user_id = ?"
    params = [user_id]

    if status:
        query += " AND status = ?"
        params.append(status)
    if card_type:
        query += " AND card_type = ?"
        params.append(card_type)

    query += " ORDER BY CASE priority WHEN 'firefighter' THEN 1 WHEN 'sniper' THEN 2 WHEN 'seed' THEN 3 WHEN 'recycle' THEN 4 END, created_at DESC"

    with get_db() as db:
        rows = db.execute(query, params).fetchall()
        return [dict(row) for row in rows]


def get_card(card_id: int, user_id: int) -> dict | None:
    """获取单个卡片"""
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM cards WHERE id = ? AND user_id = ?",
            (card_id, user_id),
        ).fetchone()
        return dict(row) if row else None


def update_card(card_id: int, user_id: int, updates: dict) -> dict | None:
    """更新卡片字段"""
    # 只更新传入的非 None 字段
    fields = []
    values = []
    for key, value in updates.items():
        if value is not None:
            fields.append(f"{key} = ?")
            values.append(value)

    if not fields:
        return get_card(card_id, user_id)

    fields.append("updated_at = datetime('now', 'localtime')")
    values.extend([card_id, user_id])

    with get_db() as db:
        db.execute(
            f"UPDATE cards SET {', '.join(fields)} WHERE id = ? AND user_id = ?",
            values,
        )
        return get_card(card_id, user_id)


def complete_card(card_id: int, user_id: int) -> dict | None:
    """
    完成卡片，计算并发放金币

    Returns:
        包含金币信息的卡片数据，或 None
    """
    card = get_card(card_id, user_id)
    if not card or card["status"] == "completed":
        return None

    # 获取用户信息计算加成
    with get_db() as db:
        user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()

    # 判断是否拖延任务（推迟超过3次）
    is_procrastinated = card["postponed_count"] >= 3

    # 计算金币
    coins = calculate_coin_reward(
        base_reward=card["coin_reward"],
        streak_days=user["streak_days"],
        is_procrastinated=is_procrastinated,
    )

    # 更新卡片状态
    with get_db() as db:
        db.execute(
            """UPDATE cards SET status = 'completed', progress = 100,
               completed_at = datetime('now', 'localtime'),
               updated_at = datetime('now', 'localtime')
               WHERE id = ? AND user_id = ?""",
            (card_id, user_id),
        )

    # 发放金币
    add_coins(user_id, coins, f"完成任务: {card['title']}")

    card["status"] = "completed"
    card["coins_earned"] = coins
    return card


def delete_card(card_id: int, user_id: int) -> bool:
    """删除卡片（实际是归档）"""
    with get_db() as db:
        result = db.execute(
            """UPDATE cards SET status = 'archived',
               updated_at = datetime('now', 'localtime')
               WHERE id = ? AND user_id = ?""",
            (card_id, user_id),
        )
        return result.rowcount > 0


def get_today_tasks(user_id: int) -> list:
    """获取用户今日任务（活跃的每日任务）"""
    return get_user_cards(user_id, status="active", card_type="daily")


def postpone_card(card_id: int, user_id: int) -> dict | None:
    """推迟任务，增加推迟计数"""
    with get_db() as db:
        db.execute(
            """UPDATE cards SET postponed_count = postponed_count + 1,
               updated_at = datetime('now', 'localtime')
               WHERE id = ? AND user_id = ?""",
            (card_id, user_id),
        )
        return get_card(card_id, user_id)
