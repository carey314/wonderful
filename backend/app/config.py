"""
Wonderful 配置管理
统一管理所有环境变量和配置项
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# 加载 .env 文件
load_dotenv()

# ============================================
# 基础路径
# ============================================
BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
DB_PATH = BASE_DIR / "wonderful.db"

# ============================================
# FastAPI 配置
# ============================================
APP_TITLE = "Wonderful API"
APP_VERSION = "0.1.0"
APP_DESCRIPTION = "Wonderful - AI 认知陪伴 + 个人成长系统"
DEBUG = os.getenv("DEBUG", "true").lower() == "true"

# ============================================
# AI 引擎配置
# ============================================
# DeepSeek（主力模型，性价比最高）
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = "https://api.deepseek.com"
DEEPSEEK_MODEL = "deepseek-chat"  # DeepSeek V3

# 智谱 GLM-4-Flash（备用/免费模型）
GLM_API_KEY = os.getenv("GLM_API_KEY", "")
GLM_BASE_URL = "https://open.bigmodel.cn/api/paas/v4"
GLM_MODEL = "glm-4-flash"

# AI 默认引擎：deepseek 或 glm
AI_DEFAULT_ENGINE = os.getenv("AI_DEFAULT_ENGINE", "deepseek")

# ============================================
# JWT 认证配置
# ============================================
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "wonderful-dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 168  # 7天

# ============================================
# 微信小程序配置
# ============================================
WX_APP_ID = os.getenv("WX_APP_ID", "")
WX_APP_SECRET = os.getenv("WX_APP_SECRET", "")
WX_LOGIN_URL = "https://api.weixin.qq.com/sns/jscode2session"

# ============================================
# 金币系统配置
# ============================================
COIN_RULES = {
    "complete_daily": 10,          # 完成每日任务基础奖励
    "complete_goal": 100,          # 完成中期目标
    "complete_vision": 500,        # 完成长期愿景
    "streak_multiplier_7": 1.5,    # 连续7天加成倍数
    "streak_multiplier_30": 2.0,   # 连续30天加成倍数
    "early_complete_bonus": 1.2,   # 提前完成加成
    "procrastinated_bonus": 2.0,   # 完成拖延任务加成
    "focus_mode_bonus": 1.2,       # 专注模式加成
}
