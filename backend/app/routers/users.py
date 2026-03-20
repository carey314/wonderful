"""
Wonderful 用户系统路由
微信登录、用户信息管理
"""

from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, Header
from jose import jwt, JWTError
import httpx

from app.config import (
    WX_APP_ID, WX_APP_SECRET, WX_LOGIN_URL,
    JWT_SECRET_KEY, JWT_ALGORITHM, JWT_EXPIRE_HOURS,
)
from app.database import get_db
from app.models.schemas import (
    WxLoginRequest, UserProfile, UserSettingsUpdate,
    TokenResponse, MessageResponse,
)

router = APIRouter(tags=["用户系统"])


# ============================================
# 认证依赖
# ============================================

async def get_current_user_id(authorization: str = Header(...)) -> int:
    """从 JWT token 中解析当前用户ID"""
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="无效的认证信息")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="认证已过期，请重新登录")


def _create_token(user_id: int) -> str:
    """创建 JWT token"""
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS)
    payload = {"user_id": user_id, "exp": expire}
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


# ============================================
# 路由
# ============================================

@router.post("/login", response_model=TokenResponse, summary="微信登录")
async def wx_login(request: WxLoginRequest):
    """
    微信小程序登录流程：
    1. 前端调用 wx.login() 获取 code
    2. 后端用 code 换取 openid
    3. 创建/查找用户，返回 JWT token
    """
    # 用 code 换取 openid
    openid = await _get_openid(request.code)

    with get_db() as db:
        # 查找或创建用户
        user = db.execute("SELECT * FROM users WHERE openid = ?", (openid,)).fetchone()

        if not user:
            # 新用户注册
            cursor = db.execute(
                "INSERT INTO users (openid) VALUES (?)",
                (openid,),
            )
            user = db.execute("SELECT * FROM users WHERE id = ?", (cursor.lastrowid,)).fetchone()

    # 生成 token
    token = _create_token(user["id"])

    return TokenResponse(
        token=token,
        user=UserProfile(
            id=user["id"],
            nickname=user["nickname"],
            avatar_url=user["avatar_url"],
            coins=user["coins"],
            streak_days=user["streak_days"],
            max_streak_days=user["max_streak_days"],
            morning_remind_time=user["morning_remind_time"],
            evening_remind_time=user["evening_remind_time"],
            notify_enabled=bool(user["notify_enabled"]),
            created_at=user["created_at"],
        ),
    )


@router.get("/profile", response_model=UserProfile, summary="获取用户信息")
async def get_profile(user_id: int = Depends(get_current_user_id)):
    """获取当前登录用户的详细信息"""
    with get_db() as db:
        user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="用户不存在")

    return UserProfile(
        id=user["id"],
        nickname=user["nickname"],
        avatar_url=user["avatar_url"],
        coins=user["coins"],
        streak_days=user["streak_days"],
        max_streak_days=user["max_streak_days"],
        morning_remind_time=user["morning_remind_time"],
        evening_remind_time=user["evening_remind_time"],
        notify_enabled=bool(user["notify_enabled"]),
        created_at=user["created_at"],
    )


@router.put("/settings", response_model=MessageResponse, summary="更新用户设置")
@router.put("/profile", response_model=MessageResponse, summary="更新用户设置（兼容）")
async def update_profile(
    settings: UserSettingsUpdate,
    user_id: int = Depends(get_current_user_id),
):
    """更新用户昵称、头像、提醒时间等设置"""
    updates = settings.model_dump(exclude_none=True)
    if not updates:
        return MessageResponse(message="没有需要更新的内容")

    fields = []
    values = []
    for key, value in updates.items():
        # notify_enabled 需要转成 0/1
        if key == "notify_enabled":
            value = 1 if value else 0
        fields.append(f"{key} = ?")
        values.append(value)

    fields.append("updated_at = datetime('now', 'localtime')")
    values.append(user_id)

    with get_db() as db:
        db.execute(
            f"UPDATE users SET {', '.join(fields)} WHERE id = ?",
            values,
        )

    return MessageResponse(message="设置已更新")


@router.post("/dev-login", response_model=TokenResponse, summary="开发环境登录（跳过微信）")
async def dev_login():
    """
    开发环境专用登录，自动创建/使用测试用户
    生产环境应禁用此接口
    """
    test_openid = "dev_test_user_001"

    with get_db() as db:
        user = db.execute("SELECT * FROM users WHERE openid = ?", (test_openid,)).fetchone()
        if not user:
            db.execute(
                "INSERT INTO users (openid, nickname) VALUES (?, ?)",
                (test_openid, "测试用户"),
            )
            user = db.execute("SELECT * FROM users WHERE openid = ?", (test_openid,)).fetchone()

    token = _create_token(user["id"])

    return TokenResponse(
        token=token,
        user=UserProfile(
            id=user["id"],
            nickname=user["nickname"],
            avatar_url=user["avatar_url"],
            coins=user["coins"],
            streak_days=user["streak_days"],
            max_streak_days=user["max_streak_days"],
            morning_remind_time=user["morning_remind_time"],
            evening_remind_time=user["evening_remind_time"],
            notify_enabled=bool(user["notify_enabled"]),
            created_at=user["created_at"],
        ),
    )


# ============================================
# 内部工具函数
# ============================================

async def _get_openid(code: str) -> str:
    """用微信 code 换取 openid"""
    if not WX_APP_ID or not WX_APP_SECRET:
        # 开发环境：直接用 code 作为 openid
        return f"dev_{code}"

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            WX_LOGIN_URL,
            params={
                "appid": WX_APP_ID,
                "secret": WX_APP_SECRET,
                "js_code": code,
                "grant_type": "authorization_code",
            },
        )
        data = response.json()

    if "openid" not in data:
        raise HTTPException(
            status_code=400,
            detail=f"微信登录失败: {data.get('errmsg', '未知错误')}",
        )

    return data["openid"]
