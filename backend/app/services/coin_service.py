"""
Wonderful 金币系统服务
管理金币的发放、消费和规则计算
"""

from app.config import COIN_RULES
from app.database import get_db


def calculate_coin_reward(
    base_reward: int,
    streak_days: int,
    is_early_complete: bool = False,
    is_procrastinated: bool = False,
    is_focus_mode: bool = False,
) -> int:
    """
    计算任务完成后实际获得的金币数

    Args:
        base_reward: 任务基础金币
        streak_days: 当前连续打卡天数
        is_early_complete: 是否提前完成
        is_procrastinated: 是否是拖延很久的任务
        is_focus_mode: 是否在专注模式下完成

    Returns:
        实际获得金币数
    """
    coins = base_reward

    # 连续打卡加成
    if streak_days >= 30:
        coins = int(coins * COIN_RULES["streak_multiplier_30"])
    elif streak_days >= 7:
        coins = int(coins * COIN_RULES["streak_multiplier_7"])

    # 提前完成加成
    if is_early_complete:
        coins = int(coins * COIN_RULES["early_complete_bonus"])

    # 拖延任务完成加成（"终于做了"特别奖励）
    if is_procrastinated:
        coins = int(coins * COIN_RULES["procrastinated_bonus"])

    # 专注模式加成
    if is_focus_mode:
        coins = int(coins * COIN_RULES["focus_mode_bonus"])

    return coins


def add_coins(user_id: int, amount: int, reason: str = "") -> int:
    """
    给用户增加金币

    Returns:
        用户新的金币余额
    """
    with get_db() as db:
        db.execute(
            "UPDATE users SET coins = coins + ?, updated_at = datetime('now', 'localtime') WHERE id = ?",
            (amount, user_id),
        )
        row = db.execute("SELECT coins FROM users WHERE id = ?", (user_id,)).fetchone()
        return row["coins"] if row else 0


def spend_coins(user_id: int, amount: int) -> tuple[bool, int]:
    """
    用户消费金币

    Returns:
        (是否成功, 剩余余额)
    """
    with get_db() as db:
        row = db.execute("SELECT coins FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row or row["coins"] < amount:
            return False, row["coins"] if row else 0

        db.execute(
            "UPDATE users SET coins = coins - ?, updated_at = datetime('now', 'localtime') WHERE id = ?",
            (amount, user_id),
        )
        return True, row["coins"] - amount
