// storage.js - 本地存储服务层
// 与 api.js 的 cards 接口对齐，将来可无缝切换到后端 API

var KEYS = {
  TASKS: 'w_v1_tasks',
  COMPLETED_LOG: 'w_v1_completed_log',
  SETTINGS: 'w_v1_settings',
  MINDSET_STATE: 'w_v1_mindset_state',
  FOCUS_LOG: 'w_v1_focus_log',
  SCHEMA_VERSION: 'w_v1_schema_version',
}

var CURRENT_SCHEMA_VERSION = 2

// ========================
// 底层工具
// ========================

function _get(key, defaultValue) {
  try {
    var val = wx.getStorageSync(key)
    if (val === '' || val === undefined || val === null) return defaultValue
    return val
  } catch (e) {
    return defaultValue
  }
}

function _set(key, value) {
  try {
    wx.setStorageSync(key, value)
  } catch (e) {
    console.error('storage write failed:', key, e)
  }
}

// ========================
// 初始化 & 迁移
// ========================

function init() {
  var version = _get(KEYS.SCHEMA_VERSION, 0)
  if (version < CURRENT_SCHEMA_VERSION) {
    migrate(version)
    _set(KEYS.SCHEMA_VERSION, CURRENT_SCHEMA_VERSION)
  }
}

function migrate(fromVersion) {
  if (fromVersion < 1) {
    if (!_get(KEYS.TASKS, null)) _set(KEYS.TASKS, [])
    if (!_get(KEYS.COMPLETED_LOG, null)) _set(KEYS.COMPLETED_LOG, [])
    if (!_get(KEYS.SETTINGS, null)) {
      _set(KEYS.SETTINGS, {
        morningTime: '08:00',
        eveningTime: '21:00',
        aiStyle: '温暖朋友',
        dailyCapacityMinutes: 360,
      })
    }
    if (!_get(KEYS.MINDSET_STATE, null)) {
      _set(KEYS.MINDSET_STATE, { liked: {}, collected: {} })
    }
  }
  if (fromVersion < 2) {
    if (!_get(KEYS.FOCUS_LOG, null)) _set(KEYS.FOCUS_LOG, [])
  }
}

// ========================
// 任务 CRUD
// ========================

function getTasks(params) {
  var tasks = _get(KEYS.TASKS, [])
  if (params) {
    if (params.status) {
      tasks = tasks.filter(function (t) { return t.status === params.status })
    }
    if (params.project) {
      tasks = tasks.filter(function (t) { return t.project === params.project })
    }
    if (params.cardType || params.card_type) {
      var ct = params.cardType || params.card_type
      tasks = tasks.filter(function (t) { return (t.cardType || t.card_type || 'daily') === ct })
    }
  }
  return tasks
}

function getChildTasks(parentId) {
  var tasks = _get(KEYS.TASKS, [])
  return tasks.filter(function (t) {
    return (t.parentCardId || t.parent_card_id) === parentId && t.status !== 'archived'
  })
}

function getTodayTasks() {
  var tasks = _get(KEYS.TASKS, [])
  var now = new Date()
  var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  var todayEnd = todayStart + 86400000

  return tasks.filter(function (t) {
    // 未完成的任务都显示
    if (t.status === 'pending' || t.status === 'in_progress') return true
    // 今日完成的也显示
    if ((t.status === 'completed' || t.status === 'archived') && t.updatedAt) {
      return t.updatedAt >= todayStart && t.updatedAt < todayEnd
    }
    return false
  })
}

function getTask(id) {
  var tasks = _get(KEYS.TASKS, [])
  for (var i = 0; i < tasks.length; i++) {
    if (tasks[i].id === id) return tasks[i]
  }
  return null
}

function addTask(task) {
  var tasks = _get(KEYS.TASKS, [])
  tasks.push(task)
  _set(KEYS.TASKS, tasks)
  return task
}

function addTasks(newTasks) {
  var tasks = _get(KEYS.TASKS, [])
  tasks = tasks.concat(newTasks)
  _set(KEYS.TASKS, tasks)
  return newTasks
}

function updateTask(id, updates) {
  var tasks = _get(KEYS.TASKS, [])
  var index = -1
  for (var i = 0; i < tasks.length; i++) {
    if (tasks[i].id === id) { index = i; break }
  }
  if (index === -1) return null

  tasks[index] = Object.assign({}, tasks[index], updates, { updatedAt: Date.now() })
  _set(KEYS.TASKS, tasks)
  return tasks[index]
}

function completeTask(id) {
  var tasks = _get(KEYS.TASKS, [])
  var task = null
  var index = -1
  for (var i = 0; i < tasks.length; i++) {
    if (tasks[i].id === id) { task = tasks[i]; index = i; break }
  }
  if (!task) return null

  var coinReward = task.coinReward || 0

  // 更新任务状态
  tasks[index] = Object.assign({}, task, { status: 'completed', updatedAt: Date.now() })
  _set(KEYS.TASKS, tasks)

  // 增加金币
  addCoins(coinReward)

  // 记录完成日志
  logCompletion(id, coinReward, task.estimatedMinutes || 0)

  // 更新连续天数
  updateStreak()

  return { task: tasks[index], coinReward: coinReward }
}

function deleteTask(id) {
  var tasks = _get(KEYS.TASKS, [])
  var filtered = tasks.filter(function (t) { return t.id !== id })
  if (filtered.length === tasks.length) return false
  _set(KEYS.TASKS, filtered)
  return true
}

// ========================
// 统计
// ========================

function logCompletion(taskId, coinReward, minutesSpent) {
  var log = _get(KEYS.COMPLETED_LOG, [])
  log.push({
    taskId: taskId,
    coinReward: coinReward,
    minutes: minutesSpent,
    timestamp: Date.now(),
  })
  _set(KEYS.COMPLETED_LOG, log)
}

function getStats() {
  var tasks = _get(KEYS.TASKS, [])
  var log = _get(KEYS.COMPLETED_LOG, [])
  var coins = _get('coins', 0)
  var streakDays = _get('streakDays', 0)

  var totalCompleted = tasks.filter(function (t) { return t.status === 'completed' }).length
  var totalAll = tasks.length
  var completionRate = totalAll > 0 ? Math.round((totalCompleted / totalAll) * 100) : 0

  // 本周数据
  var now = new Date()
  var dayOfWeek = now.getDay() || 7
  var mondayTs = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 1).getTime()

  var weekLog = log.filter(function (l) { return l.timestamp >= mondayTs })
  var weekCompleted = weekLog.length
  var weekMinutes = weekLog.reduce(function (sum, l) { return sum + (l.minutes || 0) }, 0)
  var weekCoins = weekLog.reduce(function (sum, l) { return sum + (l.coinReward || 0) }, 0)

  // 今日数据
  var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  var todayCompleted = log.filter(function (l) { return l.timestamp >= todayStart }).length

  return {
    totalCompleted: totalCompleted,
    streakDays: streakDays,
    totalCoins: coins,
    completionRate: completionRate,
    todayCompleted: todayCompleted,
    weekCompleted: weekCompleted,
    weekMinutes: weekMinutes,
    weekCoins: weekCoins,
  }
}

function getWeeklyDailyCount() {
  var log = _get(KEYS.COMPLETED_LOG, [])
  var now = new Date()
  var dayOfWeek = now.getDay() || 7

  var result = []
  for (var i = 1; i <= 7; i++) {
    var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + i)
    var dayStart = d.getTime()
    var dayEnd = dayStart + 86400000
    var count = log.filter(function (l) { return l.timestamp >= dayStart && l.timestamp < dayEnd }).length
    result.push({ date: d.toISOString().slice(0, 10), count: count })
  }
  return result
}

// ========================
// 金币
// ========================

function getCoins() {
  return _get('coins', 0)
}

function addCoins(amount) {
  var current = _get('coins', 0)
  var newTotal = current + amount
  _set('coins', newTotal)
  try { getApp().globalData.coins = newTotal } catch (e) {}
  return newTotal
}

function spendCoins(amount) {
  var current = _get('coins', 0)
  if (current < amount) return { success: false, remaining: current }
  var newTotal = current - amount
  _set('coins', newTotal)
  try { getApp().globalData.coins = newTotal } catch (e) {}
  return { success: true, remaining: newTotal }
}

// ========================
// 连续天数
// ========================

function getStreak() {
  return _get('streakDays', 0)
}

function updateStreak() {
  var log = _get(KEYS.COMPLETED_LOG, [])
  var now = new Date()
  var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  var todayLog = log.filter(function (l) { return l.timestamp >= todayStart })

  if (todayLog.length === 1) {
    // 今天第一次完成任务
    var yesterdayStart = todayStart - 86400000
    var yesterdayLog = log.filter(function (l) {
      return l.timestamp >= yesterdayStart && l.timestamp < todayStart
    })

    var currentStreak = _get('streakDays', 0)
    if (yesterdayLog.length > 0) {
      currentStreak += 1
    } else if (currentStreak === 0) {
      currentStreak = 1
    } else {
      currentStreak = 1
    }

    _set('streakDays', currentStreak)
    try { getApp().globalData.streakDays = currentStreak } catch (e) {}
    return currentStreak
  }

  return _get('streakDays', 0)
}

// ========================
// 专注/快速启动记录
// ========================

function logFocusSession(taskId, durationSeconds, bonusCoins) {
  var log = _get(KEYS.FOCUS_LOG, [])
  log.push({
    taskId: taskId,
    duration: durationSeconds,
    bonusCoins: bonusCoins || 0,
    timestamp: Date.now(),
  })
  _set(KEYS.FOCUS_LOG, log)
}

function getTodayFocusCount() {
  var log = _get(KEYS.FOCUS_LOG, [])
  var now = new Date()
  var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return log.filter(function(l) { return l.timestamp >= todayStart }).length
}

// ========================
// 设置
// ========================

function getSettings() {
  return _get(KEYS.SETTINGS, {
    morningTime: '08:00',
    eveningTime: '21:00',
    aiStyle: '温暖朋友',
    dailyCapacityMinutes: 360,
  })
}

function updateSettings(updates) {
  var settings = getSettings()
  settings = Object.assign({}, settings, updates)
  _set(KEYS.SETTINGS, settings)
  return settings
}

// ========================
// 思维转换状态
// ========================

function getMindsetState() {
  return _get(KEYS.MINDSET_STATE, { liked: {}, collected: {} })
}

function toggleMindsetLike(shiftId) {
  var state = getMindsetState()
  state.liked[shiftId] = !state.liked[shiftId]
  _set(KEYS.MINDSET_STATE, state)
  return state.liked[shiftId]
}

function toggleMindsetCollect(shiftId) {
  var state = getMindsetState()
  state.collected[shiftId] = !state.collected[shiftId]
  _set(KEYS.MINDSET_STATE, state)
  return state.collected[shiftId]
}

// ========================
// 调试
// ========================

function getStorageInfo() {
  try {
    var info = wx.getStorageInfoSync()
    return {
      used: info.currentSize,
      limit: info.limitSize,
      percentage: Math.round((info.currentSize / info.limitSize) * 100),
    }
  } catch (e) {
    return { used: 0, limit: 10240, percentage: 0 }
  }
}

// ========================
// 导出
// ========================

module.exports = {
  init: init,

  tasks: {
    list: getTasks,
    today: getTodayTasks,
    children: getChildTasks,
    get: getTask,
    create: addTask,
    createBatch: addTasks,
    update: updateTask,
    complete: completeTask,
    delete: deleteTask,
  },

  stats: {
    get: getStats,
    logCompletion: logCompletion,
    getWeeklyDailyCount: getWeeklyDailyCount,
  },

  coins: {
    get: getCoins,
    add: addCoins,
    spend: spendCoins,
  },

  streak: {
    get: getStreak,
    update: updateStreak,
  },

  focus: {
    log: logFocusSession,
    getTodayCount: getTodayFocusCount,
  },

  settings: {
    get: getSettings,
    update: updateSettings,
  },

  mindset: {
    getState: getMindsetState,
    toggleLike: toggleMindsetLike,
    toggleCollect: toggleMindsetCollect,
  },

  getStorageInfo: getStorageInfo,
  KEYS: KEYS,
}
