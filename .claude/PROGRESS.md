# Wonderful (妙事成长) 项目进度

## 项目概况
- **类型**: 微信小程序 — 个人任务管理 + 自我成长工具
- **中文名**: 妙事成长
- **技术栈**: 微信小程序 (WXML/WXSS/JS) + FastAPI + SQLite 后端
- **设计风格**: 玻璃拟态 (glassmorphism)、渐变色、主色 `#7C5CFC`
- **路径**: `/Users/carey/projects/AI_Project/todoDemo/wonderful`
- **前端目录**: `miniprogram/`
- **后端目录**: `backend/`

## 已完成的功能

### 1. 登录注册流程优化 (已完成)
- 新建 `/pages/login/login` — 返回用户"欢迎回来"一键登录页
- 两标志位路由：`onboardingDone`(永不清除) + `token`(退出清除)
- `app.js` 三层路由：无 onboarding→引导页 / 无 token→登录页 / 有 token→首页
- `profile` 页退出登录→跳转登录页(非 onboarding)
- 登录状态指示器(绿点=已登录 / 灰点=离线)
- `api.js` 双重 401 失败→跳转登录页
- Logo 样式提升到 `app.wxss` 全局共享
- `util.js` 新增 `getNavPaddingTop()` 共享方法
- `login.js` 10 秒登录超时保护
- `_retrying` 标志重置 bug 已修复
- `profile.js` `storage.stats.get()` 双重调用已优化

### 2. 任务引擎升级 Phase 1 (已完成)
**新建文件:**
- `pages/task-detail/task-detail.js` — 任务详情页(子任务 CRUD、AI 拆解、5 分钟启动)
- `pages/task-detail/task-detail.wxml` — 详情页模板
- `pages/task-detail/task-detail.wxss` — 玻璃拟态样式 + 计时器圆环 + AI 面板
- `pages/task-detail/task-detail.json` — 页面配置

**修改文件:**
- `utils/task-model.js` — 新增 `addSubtaskToTask`、`removeSubtaskFromTask`、`reorderSubtasks` + 禀赋进度效应(最低 10%)
- `utils/storage.js` — schema v2，新增 `focus.log()`、`focus.getTodayCount()`
- `app.json` — 注册 task-detail 页面
- `pages/tasks/tasks.js` — `onTaskDetail` 从 toast 改为 `navigateTo`
- `pages/index/index.js` — 新增 `onTaskTap` 方法
- `pages/index/index.wxml` — 两处 `<task-card>` 添加 `bind:tap="onTaskTap"`

**功能清单:**
- 点击任务卡片 → 进入详情页
- 随时添加/删除/排序子任务(不限于创建时)
- 「✨ 帮我拆解」→ AI 自动将任务拆成 5-15 分钟可执行步骤(离线有兜底)
- 「⚡ 5 分钟启动」→ 心理学 5 分钟法则，倒计时结束后问"要继续吗？"
- 5 分钟完成 → 额外金币奖励
- 切后台再回来 → 计时器自动补算时间
- **注意**: 番茄钟功能已砍掉，只保留"5 分钟启动"

**已修复 bug:**
- WXML 中 HTML 实体编码(&#x2728;)替换为真正 Unicode 字符(✨)

### 3. Bug 修复 + 代码质量优化 (已完成)
**修复的 Bug:**
- `task-detail.js:onToggleSubtask` 双重完成 — `toggleSubtask` 自动设 completed + `onComplete` 再调一次，后端 `/complete` 检查 status 返回 null。现在先保存子任务变更，再走 onComplete 流程
- `api.js` 401 竞态 — 模块级 `_retrying` 标志改为共享 `_loginPromise`，多个并发 401 共用同一个登录流程
- `index.js:onSubtaskToggle` API 模式下子任务全部完成时没有发金币 — 改为先 update subtasks 再调 /complete
- 后端 `get_today_tasks` 只查 `status=pending`，in_progress 任务消失 — 改为查 pending + in_progress + 今日完成
- `profile.js` ES6 语法兼容 — const/let/箭头函数/模板字面量/展开运算符全部转为 ES5

**新增功能:**
- 任务详情页新增「推迟到明天」按钮，对接后端 `/api/cards/{id}/postpone`
- 任务详情页新增「删除任务」按钮，带确认弹窗
- `api.js` 新增 `cards.postpone()` 方法

### 4. 目标拆解 + 长短期计划联动 (已完成)
**核心功能**: 愿景(vision) → 目标(goal) → 每日任务(daily) 三级层级

**新建文件:**
- `pages/goals/goals.js/wxml/wxss/json` — 目标页面（替换原转换Tab）
- `pages/goals/goal-detail.js/wxml/wxss/json` — 目标详情页（子项管理 + AI 拆解）

**修改文件:**
- `app.json` — TabBar 替换"转换"为"目标"，新增 goals/goal-detail 页面
- `task-model.js` — 新增 CARD_TYPES、getGoalProgress()、getCardTypeInfo()；createTask 支持 cardType/parentCardId
- `api.js` — 新增 cards.children()、ai.decompose()
- `storage.js` — getTasks 支持 cardType 筛选，新增 getChildTasks()
- `add-task.js/wxml/wxss` — 顶部卡片类型选择器(每日任务/中期目标/长期愿景)，目标可关联父愿景
- `index.js/wxml/wxss` — 首页新增"活跃目标"进度区
- 后端 `cards.py` — 新增 GET /{card_id}/children 接口
- 后端 `card_service.py` — 新增 get_card_children() 函数
- 后端 `ai_chat.py` — 新增 POST /api/ai/decompose 接口（vision→goals、goal→dailies）
- 后端 `prompts/templates.py` — 新增 DECOMPOSE_VISION_PROMPT、DECOMPOSE_GOAL_PROMPT

## 待做 (未来迭代)

### 参与感循环
- 随机掉落(~30% 概率)：额外金币
- 每日任务：3 个随机小目标
- 连续天数成就系统

## 关键架构信息

### 页面结构 (app.json pages)
```
index / tasks / add-task / task-detail / mindset / profile
login / onboarding / personality-test / future-letter / buddy / weekly-report
```

### TabBar
首页 / 卡片 / 添加 / 转换 / 我的

### 核心工具文件
- `utils/task-model.js` — 任务数据模型、工厂函数、排序
- `utils/storage.js` — 本地存储 CRUD (schema v2)
- `utils/api.js` — 后端 API 封装 + 401 自动重试
- `utils/task-parser.js` — 自然语言任务解析
- `utils/util.js` — 通用工具(日期、问候、导航安全距离)

### 后端 API
- 基础 URL: `https://qxju.shop/wonderful-api`
- 用户: `/api/user/login|profile|settings`
- 卡片: `/api/cards` CRUD + `/api/cards/{id}/complete`
- AI: `/api/ai/morning|evening|mindset|chat`
- 奖励: `/api/rewards` CRUD + `/{id}/redeem`
- 日志: `/api/daily/today|history`

### 金币系统
- 赚取: 完成任务(10 基础 + 时间/优先级加成 + 连续天数倍率)
- 后端已有 `is_focus_mode` 参数支持专注奖励
- 后端 rewards API 完整但前端无商店页面
- 花费: Phase 2 花园系统实现

### 设计系统 (app.wxss CSS 变量)
- 主色: `--color-primary: #7C5CFC`
- 玻璃拟态: `--glass-bg`, `--glass-blur`, `--glass-border`
- 渐变: `--gradient-primary`, `--gradient-sunset`, `--gradient-mesh`
- 圆角: `--radius-sm` 到 `--radius-2xl`
- 动画: `float-in`, `scale-in`, `bounce-in`, `pulse-soft`
