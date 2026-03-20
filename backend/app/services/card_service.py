"""
Wonderful 卡片/任务服务 — V2
管理任务的 CRUD、状态流转和智能优先级
"""

import json
from datetime import datetime, date
from app.database import get_db
from app.services.coin_service import calculate_coin_reward, add_coins


def create_card(user_id: int, card_data: dict) -> dict:
    """创建新卡片 — V2：支持 project, subtasks, isUrgent, isImportant, energy"""
    # 将 subtasks 列表序列化为 JSON 字符串
    subtasks = card_data.get("subtasks", [])
    if isinstance(subtasks, list):
        # 如果是 Pydantic SubtaskItem 对象列表，转 dict
        subtasks_json = json.dumps(
            [s if isinstance(s, dict) else s.model_dump() if hasattr(s, 'model_dump') else dict(s) for s in subtasks],
            ensure_ascii=False,
        )
    else:
        subtasks_json = "[]"

    with get_db() as db:
        cursor = db.execute(
            """INSERT INTO cards
            (user_id, title, description, priority, card_type, category, project,
             due_date, parent_card_id, estimated_minutes, coin_reward,
             is_urgent, is_important, energy, subtasks_json, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                user_id,
                card_data["title"],
                card_data.get("description", ""),
                card_data.get("priority", "normal"),
                card_data.get("card_type", "daily"),
                card_data.get("category", ""),
                card_data.get("project", ""),
                card_data.get("due_date") or card_data.get("deadline", ""),
                card_data.get("parent_card_id"),
                card_data.get("estimatedMinutes", card_data.get("estimated_minutes", 30)),
                card_data.get("coinReward", card_data.get("coin_reward", 10)),
                1 if card_data.get("isUrgent", card_data.get("is_urgent", False)) else 0,
                1 if card_data.get("isImportant", card_data.get("is_important", False)) else 0,
                card_data.get("energy", "medium"),
                subtasks_json,
                card_data.get("status", "pending"),
            ),
        )
        card_id = cursor.lastrowid
        row = db.execute("SELECT * FROM cards WHERE id = ?", (card_id,)).fetchone()
        return dict(row)


def get_user_cards(user_id: int, status: str = None, card_type: str = None) -> list:
    """获取用户的卡片列表 — V2 优先级排序"""
    query = "SELECT * FROM cards WHERE user_id = ?"
    params = [user_id]

    if status:
        query += " AND status = ?"
        params.append(status)
    if card_type:
        query += " AND card_type = ?"
        params.append(card_type)

    query += " ORDER BY CASE priority WHEN 'urgent_important' THEN 1 WHEN 'urgent' THEN 2 WHEN 'important' THEN 3 WHEN 'normal' THEN 4 END, created_at DESC"

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
    """更新卡片字段 — V2：支持 camelCase 到 snake_case 映射"""
    # camelCase -> snake_case 字段映射
    field_map = {
        "estimatedMinutes": "estimated_minutes",
        "coinReward": "coin_reward",
        "isUrgent": "is_urgent",
        "isImportant": "is_important",
        "deadline": "due_date",
    }

    fields = []
    values = []
    for key, value in updates.items():
        if value is None:
            continue
        # 特殊处理 subtasks -> subtasks_json
        if key == "subtasks":
            sub_list = value
            if isinstance(sub_list, list):
                subtasks_json = json.dumps(
                    [s if isinstance(s, dict) else s.model_dump() if hasattr(s, 'model_dump') else dict(s) for s in sub_list],
                    ensure_ascii=False,
                )
            else:
                subtasks_json = "[]"
            fields.append("subtasks_json = ?")
            values.append(subtasks_json)
            continue

        # camelCase -> snake_case
        db_field = field_map.get(key, key)
        # bool -> int for SQLite
        if db_field in ("is_urgent", "is_important"):
            value = 1 if value else 0
        fields.append(f"{db_field} = ?")
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


def get_card_children(card_id: int, user_id: int) -> list:
    """获取某卡片的子卡片（vision→goals 或 goal→dailies）"""
    with get_db() as db:
        rows = db.execute(
            """SELECT * FROM cards WHERE parent_card_id = ? AND user_id = ?
               AND status != 'archived'
               ORDER BY CASE status
                 WHEN 'in_progress' THEN 1
                 WHEN 'pending' THEN 2
                 WHEN 'completed' THEN 3
               END, created_at ASC""",
            (card_id, user_id),
        ).fetchall()
        return [dict(row) for row in rows]


def get_today_tasks(user_id: int) -> list:
    """获取用户今日任务（pending + in_progress + 今日完成的）"""
    today = date.today().isoformat()
    with get_db() as db:
        rows = db.execute(
            """SELECT * FROM cards WHERE user_id = ? AND card_type = 'daily'
               AND (status IN ('pending', 'in_progress')
                    OR (status = 'completed' AND date(completed_at) = ?))
               ORDER BY CASE priority
                 WHEN 'urgent_important' THEN 1
                 WHEN 'urgent' THEN 2
                 WHEN 'important' THEN 3
                 WHEN 'normal' THEN 4
               END, created_at DESC""",
            (user_id, today),
        ).fetchall()
        return [dict(row) for row in rows]


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
