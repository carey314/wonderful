"""
Wonderful 后端主入口
FastAPI 应用初始化和路由注册
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import APP_TITLE, APP_VERSION, APP_DESCRIPTION, DEBUG
from app.database import init_database
from app.routers import users, cards, ai_chat, rewards, daily_logs


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理：启动时初始化数据库"""
    print(f"[Wonderful] 正在启动... DEBUG={DEBUG}")
    init_database()
    print("[Wonderful] 数据库初始化完成")
    yield
    print("[Wonderful] 正在关闭...")


# 创建 FastAPI 应用
app = FastAPI(
    title=APP_TITLE,
    version=APP_VERSION,
    description=APP_DESCRIPTION,
    lifespan=lifespan,
)

# 配置 CORS（开发阶段允许所有来源，生产环境需限制）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if DEBUG else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(users.router)
app.include_router(cards.router)
app.include_router(ai_chat.router)
app.include_router(rewards.router)
app.include_router(daily_logs.router)


# 健康检查
@app.get("/", tags=["系统"])
async def root():
    return {
        "name": "Wonderful API",
        "version": APP_VERSION,
        "status": "running",
        "message": "不是逼自己变好，而是让自己觉得变好很爽",
    }


@app.get("/health", tags=["系统"])
async def health_check():
    return {"status": "ok"}
