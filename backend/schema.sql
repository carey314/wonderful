-- Wonderful 数据库 Schema
-- SQLite 版本，后续可迁移至 PostgreSQL

-- 开启外键约束
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ============================================
-- 用户表
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    openid TEXT UNIQUE NOT NULL,              -- 微信 openid，唯一标识
    nickname TEXT DEFAULT '新朋友',            -- 昵称
    avatar_url TEXT DEFAULT '',               -- 头像地址
    coins INTEGER DEFAULT 0,                  -- 金币余额
    streak_days INTEGER DEFAULT 0,            -- 连续打卡天数
    max_streak_days INTEGER DEFAULT 0,        -- 历史最高连续打卡天数
    last_checkin_date TEXT DEFAULT '',         -- 上次打卡日期 (YYYY-MM-DD)
    morning_remind_time TEXT DEFAULT '08:00', -- 晨启提醒时间
    evening_remind_time TEXT DEFAULT '21:00', -- 晚审提醒时间
    notify_enabled INTEGER DEFAULT 1,         -- 是否开启通知 (0/1)
    settings_json TEXT DEFAULT '{}',          -- 用户个性化设置 (JSON)
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- ============================================
-- 任务卡片表
-- ============================================
CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,                      -- 任务标题
    description TEXT DEFAULT '',              -- 任务描述
    priority TEXT DEFAULT 'normal'            -- V2 优先级: urgent_important, important, urgent, normal
        CHECK(priority IN ('urgent_important', 'important', 'urgent', 'normal')),
    status TEXT DEFAULT 'pending'             -- 状态: pending, in_progress, completed, archived
        CHECK(status IN ('pending', 'in_progress', 'completed', 'archived')),
    card_type TEXT DEFAULT 'daily'            -- 卡片类型: vision(长期愿景), goal(中期目标), daily(每日任务)
        CHECK(card_type IN ('vision', 'goal', 'daily')),
    category TEXT DEFAULT '',                 -- 分类标签（V1 兼容）
    project TEXT DEFAULT '',                  -- V2 项目分组: work, study, life, health, social, finance
    due_date TEXT DEFAULT '',                 -- 截止日期/deadline (YYYY-MM-DD 或 ISO string)
    parent_card_id INTEGER DEFAULT NULL,      -- 父卡片ID（用于目标拆解）
    estimated_minutes INTEGER DEFAULT 30,     -- 预估用时（分钟）
    coin_reward INTEGER DEFAULT 10,           -- 完成可获金币
    is_urgent INTEGER DEFAULT 0,             -- V2 紧急标记 (0/1)
    is_important INTEGER DEFAULT 0,          -- V2 重要标记 (0/1)
    energy TEXT DEFAULT 'medium'             -- V2 精力需求: high, medium, low
        CHECK(energy IN ('high', 'medium', 'low')),
    subtasks_json TEXT DEFAULT '[]',          -- V2 子任务 JSON 数组
    progress INTEGER DEFAULT 0,              -- 进度 (0-100)
    postponed_count INTEGER DEFAULT 0,        -- 被推迟次数（用于拖延检测）
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    completed_at TEXT DEFAULT NULL,
    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_card_id) REFERENCES cards(id) ON DELETE SET NULL
);

-- ============================================
-- 每日记录表
-- ============================================
CREATE TABLE IF NOT EXISTS daily_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    log_date TEXT NOT NULL,                   -- 日期 (YYYY-MM-DD)
    morning_message TEXT DEFAULT '',          -- AI 晨启消息内容
    evening_summary TEXT DEFAULT '',          -- AI 晚审消息内容
    planned_card_ids TEXT DEFAULT '[]',       -- 当日计划的卡片ID列表 (JSON array)
    completed_card_ids TEXT DEFAULT '[]',     -- 当日完成的卡片ID列表 (JSON array)
    coins_earned INTEGER DEFAULT 0,           -- 当日获得金币
    coins_spent INTEGER DEFAULT 0,            -- 当日花费金币
    completion_rate REAL DEFAULT 0.0,         -- 完成率 (0.0-1.0)
    mood TEXT DEFAULT '',                     -- 用户当日心情（可选）
    notes TEXT DEFAULT '',                    -- 用户备注
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, log_date)
);

-- ============================================
-- 思维转换库
-- ============================================
CREATE TABLE IF NOT EXISTS mindset_shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER DEFAULT NULL,             -- NULL 表示系统预设
    original_thought TEXT NOT NULL,           -- 原始想法 "上班好累不想去"
    reframed_thought TEXT NOT NULL,           -- 转换后 "今天上班=赚到了买XX的钱"
    category TEXT DEFAULT '',                 -- 分类: 工作, 学习, 运动, 存钱...
    likes_count INTEGER DEFAULT 0,            -- 点赞数
    is_public INTEGER DEFAULT 0,              -- 是否公开到社区 (0/1)
    is_ai_generated INTEGER DEFAULT 0,        -- 是否 AI 生成 (0/1)
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- 奖励商城
-- ============================================
CREATE TABLE IF NOT EXISTS rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,                      -- 奖励名称 "一杯奶茶"
    emoji TEXT DEFAULT '🎁',                  -- 奖励图标
    coin_cost INTEGER NOT NULL,               -- 兑换所需金币
    times_redeemed INTEGER DEFAULT 0,         -- 已兑换次数
    is_active INTEGER DEFAULT 1,              -- 是否启用 (0/1)
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- 奖励兑换记录
-- ============================================
CREATE TABLE IF NOT EXISTS reward_redemptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    reward_id INTEGER NOT NULL,
    coins_spent INTEGER NOT NULL,
    redeemed_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE CASCADE
);

-- ============================================
-- AI 记忆表（"越用越懂你"）
-- ============================================
CREATE TABLE IF NOT EXISTS ai_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    insight_type TEXT NOT NULL                -- 洞察类型
        CHECK(insight_type IN (
            'efficiency_pattern',             -- 效率模式 "周三下午效率低"
            'procrastination_pattern',        -- 拖延模式 "运动类任务总拖延"
            'preference',                     -- 偏好 "喜欢幽默风格的鼓励"
            'motivation_trigger',             -- 动力触发点 "提到省钱就有动力"
            'behavior_summary',               -- 行为总结 "最近一周完成率上升"
            'custom'                          -- 其他
        )),
    content TEXT NOT NULL,                    -- 洞察内容
    confidence REAL DEFAULT 0.5,             -- 置信度 (0.0-1.0)，随数据积累提升
    source_data TEXT DEFAULT '',              -- 来源数据（用于追溯）
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- AI 对话历史（用于上下文和分析）
-- ============================================
CREATE TABLE IF NOT EXISTS ai_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    conversation_type TEXT NOT NULL           -- 对话类型
        CHECK(conversation_type IN ('morning', 'evening', 'mindset', 'chat')),
    role TEXT NOT NULL                        -- 角色: system, user, assistant
        CHECK(role IN ('system', 'user', 'assistant')),
    content TEXT NOT NULL,                    -- 消息内容
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- 成就表
-- ============================================
CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    achievement_type TEXT NOT NULL,           -- 成就类型
    title TEXT NOT NULL,                      -- 成就名称 "新芽"
    description TEXT DEFAULT '',              -- 成就描述
    emoji TEXT DEFAULT '🏆',
    unlocked_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, achievement_type)
);

-- ============================================
-- 索引
-- ============================================
CREATE INDEX IF NOT EXISTS idx_cards_user_id ON cards(user_id);
CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(user_id, status);
CREATE INDEX IF NOT EXISTS idx_cards_parent ON cards(parent_card_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON daily_logs(user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_mindset_shifts_user ON mindset_shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_mindset_shifts_public ON mindset_shifts(is_public, likes_count DESC);
CREATE INDEX IF NOT EXISTS idx_rewards_user ON rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_memory_user ON ai_memory(user_id, insight_type);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_id, conversation_type);
CREATE INDEX IF NOT EXISTS idx_achievements_user ON achievements(user_id);

-- ============================================
-- 插入系统预设思维转换
-- ============================================
INSERT OR IGNORE INTO mindset_shifts (id, user_id, original_thought, reframed_thought, category, is_public) VALUES
(1, NULL, '上班好累不想去', '今天上班8小时=赚了大概400块，其中128块是今晚的海底捞。所以你不是在"上班"，你是在"吃海底捞"。', '工作', 1),
(2, NULL, '学习好无聊', '学会这个=简历多一行=面试多一个谈资=工资可能多几千。你不是在"学习"，你是在"给自己涨薪"。', '学习', 1),
(3, NULL, '锻炼好痛苦', '现在跑30分钟=60岁还能跑。你不是在"锻炼"，你是在给未来的自己存"健康基金"。', '运动', 1),
(4, NULL, '存钱没意思', '现在存100块=失业时多一天不慌。你不是在"省钱"，你是在给自己买"安全感"。', '生活', 1),
(5, NULL, '写代码好难', '每debug一个错=涨了一点经验值。高手不是天生的，是bug喂出来的。', '工作', 1),
(6, NULL, '社交好烦', '今天认识的人=未来某天可能帮你的人。你不是在"社交"，你是在"存人脉"。', '生活', 1),
(7, NULL, '不想学英语', '多会一种语言=世界大了一倍。你不是在"背单词"，你是在"解锁新地图"。', '学习', 1),
(8, NULL, '早起好痛苦', '早起1小时=别人还在睡，你已经多活了1小时。你不是在"早起"，你是在"偷时间"。', '生活', 1);
