// task-model.js - V2 任务数据模型、默认值、辅助函数

/**
 * 项目分组定义
 * 每个项目带颜色标签，用于前端分组显示
 */
/**
 * 卡片类型定义
 * vision: 长期愿景（3-12个月）
 * goal: 中期目标（1-3个月）
 * daily: 每日任务
 */
var CARD_TYPES = {
  vision: { label: '愿景', icon: '🎯', color: '#7C5CFC', defaultCoinReward: 500 },
  goal:   { label: '目标', icon: '🏁', color: '#3B82F6', defaultCoinReward: 100 },
  daily:  { label: '任务', icon: '📋', color: '#06D6A0', defaultCoinReward: 10 },
}

const PROJECT_PRESETS = {
  work:    { label: '工作', icon: '💼', color: '#7C5CFC' },
  study:   { label: '学习', icon: '📚', color: '#3B82F6' },
  life:    { label: '生活', icon: '🏠', color: '#06D6A0' },
  health:  { label: '健康', icon: '💪', color: '#F59E0B' },
  social:  { label: '社交', icon: '👥', color: '#EC4899' },
  finance: { label: '财务', icon: '💰', color: '#10B981' },
}

/**
 * 每日建议容量上限（分钟）
 * 根据用户实际完成数据可动态调整
 */
const DEFAULT_DAILY_CAPACITY = 480 // 8小时

/**
 * 创建一个子任务对象
 */
function createSubtask(overrides) {
  return Object.assign({
    id: 'sub_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    title: '',
    completed: false,
    estimatedMinutes: 0,
  }, overrides)
}

/**
 * 创建一个完整的 V2 任务对象
 * 兼容 V1 字段（id, title, description, priority, energy, estimatedMinutes, coinReward, status, category）
 * 新增：subtasks, project, deadline, progress 自动计算等
 *
 * @param {Object} overrides - 覆盖默认值的字段
 * @returns {Object} 完整任务对象
 */
function createTask(overrides) {
  const now = Date.now()
  const task = Object.assign({
    // === V1 兼容字段 ===
    id: 'task_' + now + '_' + Math.random().toString(36).slice(2, 8),
    title: '',
    description: '',
    priority: 'normal',         // urgent_important | important | urgent | normal
    energy: 'medium',           // high | medium | low
    estimatedMinutes: 30,
    coinReward: 0,
    status: 'pending',          // pending | in_progress | completed | archived
    category: '',               // V1 分类，保留兼容

    // === V2 新增字段 ===
    cardType: 'daily',          // 卡片类型: vision | goal | daily
    parentCardId: null,         // 父卡片ID（vision→goal→daily 层级关系）
    project: '',                // 项目分组 key（work/study/life/...）或自定义项目ID
    subtasks: [],               // 子任务数组 [{id, title, completed, estimatedMinutes}]
    deadline: '',               // 截止日期 ISO string 或 '' 表示无截止
    isUrgent: false,            // 紧急标记
    isImportant: false,         // 重要标记
    createdAt: now,
    updatedAt: now,

    // 展示状态（非持久化，由页面管理）
    // expanded: false          // 子任务是否展开
  }, overrides)

  // 自动同步 priority 与 isUrgent/isImportant
  if (overrides && overrides.priority && !('isUrgent' in overrides)) {
    task.isUrgent = task.priority === 'urgent' || task.priority === 'urgent_important'
    task.isImportant = task.priority === 'important' || task.priority === 'urgent_important'
  } else if (overrides && ('isUrgent' in overrides || 'isImportant' in overrides)) {
    task.priority = getPriorityFromFlags(task.isUrgent, task.isImportant)
  }

  // 自动计算金币奖励（如果没有手动设置）
  if (!overrides || !overrides.coinReward) {
    task.coinReward = calculateCoinReward(task)
  }

  // V1 category 到 V2 project 的兼容映射
  if (task.category && !task.project) {
    var categoryToProject = { growth: 'study', study: 'study' }
    task.project = categoryToProject[task.category] || task.category
  }

  return task
}

/**
 * 根据紧急/重要标记得到 priority 字符串
 */
function getPriorityFromFlags(isUrgent, isImportant) {
  if (isUrgent && isImportant) return 'urgent_important'
  if (isImportant) return 'important'
  if (isUrgent) return 'urgent'
  return 'normal'
}

/**
 * 计算任务金币奖励
 * 规则：基础10 + 时间奖励 + 优先级加成
 */
function calculateCoinReward(task) {
  var base = 10
  var timeBonus = Math.floor((task.estimatedMinutes || 0) / 15) * 10
  var priorityBonus = { urgent_important: 30, important: 20, urgent: 15, normal: 0 }
  return base + timeBonus + (priorityBonus[task.priority] || 0)
}

/**
 * 计算任务进度（基于子任务完成情况）
 * 如果没有子任务，返回 status 对应的进度
 *
 * @param {Object} task
 * @returns {number} 0-100
 */
function getTaskProgress(task) {
  if (!task.subtasks || task.subtasks.length === 0) {
    if (task.status === 'completed' || task.status === 'archived') return 100
    if (task.status === 'in_progress') return 50
    return 0
  }
  var done = task.subtasks.filter(function (s) { return s.completed }).length
  var raw = Math.round((done / task.subtasks.length) * 100)
  // Endowed Progress Effect: minimum 10% when subtasks exist but none done
  return done === 0 ? 10 : raw
}

/**
 * 获取子任务统计文本
 * @returns {string} 如 "2/5" 或 ""
 */
function getSubtaskCountText(task) {
  if (!task.subtasks || task.subtasks.length === 0) return ''
  var done = task.subtasks.filter(function (s) { return s.completed }).length
  return done + '/' + task.subtasks.length
}

/**
 * 计算任务总预估时间（含子任务）
 * 如果有子任务且子任务有时间预估，取子任务之和；否则取任务本身的 estimatedMinutes
 */
function getTotalEstimatedMinutes(task) {
  if (!task.subtasks || task.subtasks.length === 0) {
    return task.estimatedMinutes || 0
  }
  var subtaskTotal = task.subtasks.reduce(function (sum, s) {
    return sum + (s.estimatedMinutes || 0)
  }, 0)
  // 如果子任务都没设时间，回退到任务本身的预估
  return subtaskTotal > 0 ? subtaskTotal : (task.estimatedMinutes || 0)
}

/**
 * 计算今日已安排的总时间
 * @param {Array} tasks - 今日任务列表
 * @returns {{ scheduledMinutes: number, capacityMinutes: number, percentage: number, overloaded: boolean }}
 */
function getDailyCapacity(tasks, capacityMinutes) {
  capacityMinutes = capacityMinutes || DEFAULT_DAILY_CAPACITY
  var scheduled = (tasks || []).reduce(function (sum, t) {
    if (t.status === 'completed' || t.status === 'archived') return sum
    return sum + getTotalEstimatedMinutes(t)
  }, 0)
  var pct = capacityMinutes > 0 ? Math.round((scheduled / capacityMinutes) * 100) : 0
  return {
    scheduledMinutes: scheduled,
    capacityMinutes: capacityMinutes,
    percentage: Math.min(pct, 100),
    overloaded: scheduled > capacityMinutes,
  }
}

/**
 * 格式化分钟为可读时间
 * @param {number} minutes
 * @returns {string} 如 "1.5h" 或 "30min"
 */
function formatMinutes(minutes) {
  if (!minutes || minutes <= 0) return ''
  if (minutes < 60) return minutes + 'min'
  var h = Math.floor(minutes / 60)
  var m = minutes % 60
  if (m === 0) return h + 'h'
  return h + 'h' + m + 'min'
}

/**
 * 获取项目信息（颜色、图标、标签）
 * 支持预设项目和自定义项目名
 */
function getProjectInfo(projectKey) {
  if (!projectKey) return null
  if (PROJECT_PRESETS[projectKey]) return PROJECT_PRESETS[projectKey]
  // 自定义项目用默认样式
  return { label: projectKey, icon: '📌', color: '#94A3B8' }
}

/**
 * 按项目分组任务
 * @param {Array} tasks
 * @returns {Array} [{ project, projectInfo, tasks }]
 */
function groupByProject(tasks) {
  var groups = {}
  var order = []
  ;(tasks || []).forEach(function (t) {
    var key = t.project || '_none'
    if (!groups[key]) {
      groups[key] = []
      order.push(key)
    }
    groups[key].push(t)
  })
  return order.map(function (key) {
    return {
      project: key === '_none' ? '' : key,
      projectInfo: key === '_none' ? { label: '未分组', icon: '📋', color: '#94A3B8' } : getProjectInfo(key),
      tasks: groups[key],
    }
  })
}

/**
 * 添加子任务到任务
 */
function addSubtaskToTask(task, subtaskData) {
  var newSub = createSubtask(subtaskData)
  var subtasks = task.subtasks.concat([newSub])
  return Object.assign({}, task, { subtasks: subtasks, updatedAt: Date.now() })
}

/**
 * 从任务中移除子任务
 */
function removeSubtaskFromTask(task, subtaskId) {
  var subtasks = task.subtasks.filter(function(s) { return s.id !== subtaskId })
  return Object.assign({}, task, { subtasks: subtasks, updatedAt: Date.now() })
}

/**
 * 重新排序子任务
 */
function reorderSubtasks(task, fromIndex, toIndex) {
  var subtasks = task.subtasks.slice()
  var moved = subtasks.splice(fromIndex, 1)[0]
  subtasks.splice(toIndex, 0, moved)
  return Object.assign({}, task, { subtasks: subtasks, updatedAt: Date.now() })
}

/**
 * 切换子任务完成状态，并返回更新后的任务对象
 */
function toggleSubtask(task, subtaskId) {
  var updated = Object.assign({}, task, {
    subtasks: task.subtasks.map(function (s) {
      if (s.id === subtaskId) {
        return Object.assign({}, s, { completed: !s.completed })
      }
      return s
    }),
    updatedAt: Date.now(),
  })
  // 标记所有子任务是否全部完成（由 UI 层决定是否弹窗确认）
  updated._allSubtasksDone = updated.subtasks.length > 0 &&
    updated.subtasks.every(function (s) { return s.completed })
  return updated
}

/**
 * 判断任务是否已过期
 */
function isOverdue(task) {
  if (!task.deadline) return false
  var deadlineTime = new Date(task.deadline).getTime()
  var now = new Date()
  now.setHours(23, 59, 59, 999)
  return deadlineTime < now.getTime() && task.status !== 'completed' && task.status !== 'archived'
}

/**
 * 智能排序：紧急重要 > 今天截止 > 重要 > 紧急 > 普通
 */
function smartSort(tasks) {
  var priorityWeight = {
    urgent_important: 4,
    important: 2,
    urgent: 3,
    normal: 0,
  }
  var now = new Date()
  var todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).getTime()

  return tasks.slice().sort(function (a, b) {
    // 过期的排最前
    var aOverdue = isOverdue(a) ? 1 : 0
    var bOverdue = isOverdue(b) ? 1 : 0
    if (aOverdue !== bOverdue) return bOverdue - aOverdue

    // 今天截止的排前面
    var aToday = (a.deadline && new Date(a.deadline).getTime() <= todayEnd) ? 1 : 0
    var bToday = (b.deadline && new Date(b.deadline).getTime() <= todayEnd) ? 1 : 0
    if (aToday !== bToday) return bToday - aToday

    // 优先级
    var aw = priorityWeight[a.priority] || 0
    var bw = priorityWeight[b.priority] || 0
    if (aw !== bw) return bw - aw

    // 创建时间
    return (a.createdAt || 0) - (b.createdAt || 0)
  })
}

/**
 * 计算愿景/目标的完成进度（基于子卡片完成率）
 * @param {Array} children - 子卡片数组
 * @returns {{ completed: number, total: number, percentage: number }}
 */
function getGoalProgress(children) {
  if (!children || children.length === 0) return { completed: 0, total: 0, percentage: 0 }
  var done = children.filter(function (c) { return c.status === 'completed' }).length
  return {
    completed: done,
    total: children.length,
    percentage: Math.round((done / children.length) * 100),
  }
}

/**
 * 获取卡片类型信息
 */
function getCardTypeInfo(cardType) {
  return CARD_TYPES[cardType] || CARD_TYPES.daily
}

module.exports = {
  // 常量
  CARD_TYPES: CARD_TYPES,
  PROJECT_PRESETS: PROJECT_PRESETS,
  DEFAULT_DAILY_CAPACITY: DEFAULT_DAILY_CAPACITY,

  // 工厂函数
  createTask: createTask,
  createSubtask: createSubtask,

  // 计算函数
  getTaskProgress: getTaskProgress,
  getSubtaskCountText: getSubtaskCountText,
  getTotalEstimatedMinutes: getTotalEstimatedMinutes,
  getDailyCapacity: getDailyCapacity,
  calculateCoinReward: calculateCoinReward,
  getPriorityFromFlags: getPriorityFromFlags,

  // 展示函数
  formatMinutes: formatMinutes,
  getProjectInfo: getProjectInfo,
  groupByProject: groupByProject,

  // 目标层级
  getGoalProgress: getGoalProgress,
  getCardTypeInfo: getCardTypeInfo,

  // 操作函数
  addSubtaskToTask: addSubtaskToTask,
  removeSubtaskFromTask: removeSubtaskFromTask,
  reorderSubtasks: reorderSubtasks,
  toggleSubtask: toggleSubtask,
  isOverdue: isOverdue,
  smartSort: smartSort,
}
