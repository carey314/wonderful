# Wonderful 项目进度记录

> AI 认知陪伴 + 个人成长系统
> Slogan: "不是逼自己变好，而是让自己觉得变好很爽"

---

## 项目状态：MVP 前端开发完成

**日期**：2026-03-15
**阶段**：Phase 1 - MVP 前端骨架 + 后端架构

---

## 已完成

### 1. 产品规划

- [x] 产品创意与核心定位 (`brainstorm.md`)
- [x] 技术选型与成本方案 (`tech-stack.md`, `costs-summary.md`)
- [x] MVP 需求文档 (`docs/mvp-spec.md`)
- [x] 竞品分析报告 (`docs/competitor-analysis.md`)
- [x] 测试计划 (`docs/test-plan.md`)
- [x] 增长机会调研 (`docs/growth-opportunities.md`)

### 2. 后端架构 (`backend/`)

- [x] FastAPI 项目骨架
- [x] 数据库 Schema 设计（8 张表：users, cards, daily_logs, mindset_shifts, rewards, reward_redemptions, ai_memory, ai_conversations）
- [x] 18 个 API 路由（用户/卡片/AI对话/奖励/日志）
- [x] AI 双引擎设计（DeepSeek 主 + GLM 备 + 兜底模板）
- [x] 金币计算服务（连续打卡加成/拖延任务加成/专注模式加成）
- [x] AI Prompt 模板（晨启/晚审/思维转换/回归/聊天）
- [x] 环境变量配置（`.env.example`）

### 3. 小程序前端 (`miniprogram/`)

**基础页面（6 个）**：
- [x] 首页 AI 对话 (`pages/index/`) — 晨启/晚审对话流、今日任务卡片、情绪签到
- [x] 任务卡片列表 (`pages/tasks/`) — 列表视图 + 四象限视图
- [x] 添加任务 (`pages/add-task/`) — 名称/时间/日期/分类/AI预览
- [x] 思维转换库 (`pages/mindset/`) — 预设转换 + AI 生成弹窗
- [x] 个人中心 (`pages/profile/`) — 金币/统计/成就/设置/安全气囊
- [x] 新手引导 (`pages/onboarding/`) — 6 步引导流程

**新增功能页面（4 个）**：
- [x] 拖延人格测评 (`pages/personality-test/`) — 6 道趣味题、6 种人格类型、分享卡片
- [x] 未来信 (`pages/future-letter/`) — 写信/信箱、倒计时、成长对比
- [x] 搭子模式 (`pages/buddy/`) — 匿名配对、双倍金币、6 种目标类型
- [x] Wonderful Wrapped 周报 (`pages/weekly-report/`) — 数据可视化、柱状图、分享

**复用组件（3 个）**：
- [x] `components/chat-bubble/` — AI/用户对话气泡
- [x] `components/task-card/` — 任务卡片（优先级/金币/进度/操作）
- [x] `components/empty-state/` — 空状态占位

**功能逻辑**：
- [x] 任务完成 → 归档 + 金币结算
- [x] 情绪签到 → AI 调整任务推荐
- [x] 连续打卡安全气囊（每月 2 次）
- [x] 本地数据持久化（localStorage）

**设计风格**：
- [x] 年轻化玻璃拟态（Glassmorphism）
- [x] 紫粉渐变配色（#7C5CFC / #FF6B9D / #06D6A0）
- [x] 弹簧动效 + 入场动画
- [x] Z 世代审美（参考小红书/得物/Notion）

### 4. 配置

- [x] 小程序 AppID 已配置 (`wx106f8a4c669393c5`)
- [x] 后端 `.env` 已配置（AppID + AppSecret）
- [x] Tab 图标已生成（5 组，未选中灰色/选中紫色）

---

## 待完成

### Phase 1 续 — 联调上线

- [ ] 后端部署（阿里云轻量服务器 或 微信云开发）
- [ ] 前后端 API 联调（替换 mock 数据）
- [ ] 注册个体工商户（上架 AI 对话的前提）
- [ ] 申请"深度合成-AI问答"服务类目
- [ ] 申请微信 AI 小程序成长计划（免费 1 亿 Token + 云开发）
- [ ] ICP 备案
- [ ] AI 对话功能对接国产大模型（DeepSeek / GLM）
- [ ] Tab 图标替换为正式设计稿
- [ ] 内容安全审核接入
- [ ] 小程序提交审核

### Phase 2 — 核心体验增强

- [ ] AI 成长伙伴可视化（小植物/小动物成长体）
- [ ] 今日一问（灵魂拷问）
- [ ] 奖励商城完善
- [ ] 专注模式（番茄钟）
- [ ] 数字勋章收藏
- [ ] 数据洞察 + 成就系统完善

### Phase 3 — 增长

- [ ] UGC 思维转换社区
- [ ] 搭子模式后端匹配（真实用户配对）
- [ ] 语音晨启
- [ ] 社交功能（好友 PK）
- [ ] 商业化探索

---

## 项目结构

```
wonderful/
├── brainstorm.md              # 产品创意文档
├── tech-stack.md              # 技术选型方案
├── costs-summary.md           # 费用总览
├── PROGRESS.md                # 本文件 - 进度记录
│
├── docs/                      # 产品文档
│   ├── mvp-spec.md            # MVP 需求文档
│   ├── competitor-analysis.md # 竞品分析
│   ├── test-plan.md           # 测试计划
│   └── growth-opportunities.md# 增长机会报告
│
├── backend/                   # Python + FastAPI 后端
│   ├── app/
│   │   ├── main.py            # 入口
│   │   ├── config.py          # 配置
│   │   ├── database.py        # 数据库
│   │   ├── models/schemas.py  # 数据模型
│   │   ├── routers/           # API 路由（5 个模块）
│   │   ├── services/          # 业务服务（3 个）
│   │   └── prompts/templates.py # AI Prompt
│   ├── schema.sql             # 建表脚本
│   ├── requirements.txt       # 依赖
│   └── .env.example           # 环境变量模板
│
└── miniprogram/               # 微信小程序前端
    ├── pages/                 # 10 个页面
    ├── components/            # 3 个复用组件
    ├── images/                # Tab 图标
    ├── utils/                 # 工具函数 + API 封装
    ├── app.js / app.json / app.wxss  # 全局配置
    └── project.config.json    # 小程序项目配置
```

---

## 关键决策记录

| 日期 | 决策 | 原因 |
|------|------|------|
| 2026-03-15 | AI 对话暂不实现，留占位 | 个人开发者无法申请"深度合成"类目，需先注册个体工商户 |
| 2026-03-15 | 使用国产大模型（DeepSeek + GLM） | 微信禁止境外模型（ChatGPT/Claude），且国产模型成本更低 |
| 2026-03-15 | 先做小程序，不做 App | 零安装、易传播、开发成本低，第一年仅 ¥278-478 |
| 2026-03-15 | 加入拖延人格测评作为冷启动工具 | MBTI 式社交货币，传播性最强 |
| 2026-03-15 | 玻璃拟态 + 紫粉渐变设计风格 | 面向 Z 世代，参考小红书/得物审美 |

---

## 上架所需资质

1. 个体工商户营业执照（注册中）
2. 小程序企业认证（¥30）
3. 算法备案（使用 DeepSeek/GLM 已有备案号）
4. 合作协议（与模型服务商签署）
5. ICP 备案（免费，2-4 周）
6. 内容安全机制

---

*Last updated: 2026-03-15*
