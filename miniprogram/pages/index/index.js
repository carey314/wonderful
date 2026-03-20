// 首页 - V2 任务优先 + 自然语言创建
var { getGreeting, getWeekday, formatCoins, formatDeadline } = require('../../utils/util')
var { parseInput } = require('../../utils/task-parser')
var {
  createTask, createSubtask, getTaskProgress, getDailyCapacity,
  formatMinutes, getProjectInfo, smartSort, toggleSubtask,
  PROJECT_PRESETS, getTotalEstimatedMinutes, getGoalProgress,
} = require('../../utils/task-model')
const storage = require('../../utils/storage')
const api = require('../../utils/api')

Page({
  data: {
    greeting: '',
    weekday: '',
    dateStr: '',
    coins: 0,
    streakDays: 0,
    // 任务数据
    todayTasks: [],
    completedTasks: [],
    showDoneList: false,
    // 今日容量
    capacityText: '',
    capacityPercent: 0,
    capacityOverloaded: false,
    // 项目筛选
    projectFilters: [],
    activeFilter: 'all',
    filteredTasks: [],
    // 活跃目标
    activeGoals: [],
    // 输入 & 解析预览
    inputValue: '',
    showPreview: false,
    previewTasks: [],
    // 情绪签到 - 压缩为一行
    moodCheckedIn: false,
    selectedMood: '',
    selectedMoodEmoji: '',
    selectedMoodLabel: '',
    moodList: [
      { emoji: '😆', label: '超开心', value: 'great' },
      { emoji: '😊', label: '还不错', value: 'good' },
      { emoji: '😐', label: '一般般', value: 'normal' },
      { emoji: '😔', label: '有点丧', value: 'low' },
      { emoji: '😤', label: '很烦躁', value: 'angry' },
      { emoji: '😰', label: '压力大', value: 'stressed' },
    ],
  },

  onLoad() {
    var now = new Date()
    var todayKey = 'mood_' + now.getFullYear() + '_' + now.getMonth() + '_' + now.getDate()
    var savedMood = wx.getStorageSync(todayKey)

    this.setData({
      greeting: getGreeting(),
      weekday: getWeekday(),
      dateStr: (now.getMonth() + 1) + '月' + now.getDate() + '日',
    })

    if (savedMood) {
      var moodItem = this.data.moodList.find(function (m) { return m.value === savedMood })
      if (moodItem) {
        this.setData({
          moodCheckedIn: true,
          selectedMood: savedMood,
          selectedMoodEmoji: moodItem.emoji,
          selectedMoodLabel: moodItem.label,
        })
      }
    }

    this._useApi = false
    this.loadTodayData()
    this.loadActiveGoals()
  },

  onShow() {
    this.loadTodayData()
    this.loadActiveGoals()
  },

  // 加载今日数据：API 优先，离线降级到本地存储
  loadTodayData() {
    var self = this
    // 先展示本地数据（立即可见）
    self._renderTasks(storage.tasks.today())

    // 再尝试 API 获取最新数据
    api.cards.today().then(function (tasks) {
      self._useApi = true
      self._renderTasks(tasks)
    }).catch(function () {
      self._useApi = false
      // 已经展示了本地数据，无需额外处理
    })
  },

  // 渲染任务列表
  _renderTasks(allTasks) {
    var todayTasks = smartSort(allTasks.filter(function (t) {
      return t.status !== 'completed' && t.status !== 'archived'
    }))
    var completedTasks = allTasks.filter(function (t) {
      return t.status === 'completed' || t.status === 'archived'
    })

    var app = getApp()
    this.setData({
      todayTasks: todayTasks,
      completedTasks: completedTasks,
      coins: formatCoins(app.globalData.coins || storage.coins.get()),
      streakDays: app.globalData.streakDays || storage.streak.get(),
    })

    this.updateCapacity(todayTasks)
    this.updateProjectFilters(todayTasks)
    this.applyFilter()
  },

  // 更新今日容量
  updateCapacity(tasks) {
    var cap = getDailyCapacity(tasks, 360)
    this.setData({
      capacityText: formatMinutes(cap.scheduledMinutes) + ' / ' + formatMinutes(cap.capacityMinutes),
      capacityPercent: cap.percentage,
      capacityOverloaded: cap.overloaded,
    })
  },

  // 构建项目筛选标签
  updateProjectFilters(tasks) {
    var seen = {}
    var filters = [{ key: 'all', label: '全部', icon: '📋', color: '#7C5CFC', count: tasks.length }]
    tasks.forEach(function (t) {
      var p = t.project
      if (!p || seen[p]) {
        if (p && seen[p]) seen[p].count++
        return
      }
      var info = getProjectInfo(p)
      seen[p] = { key: p, label: info.label, icon: info.icon, color: info.color, count: 1 }
      filters.push(seen[p])
    })
    this.setData({ projectFilters: filters })
  },

  // 应用项目筛选
  applyFilter() {
    var key = this.data.activeFilter
    var tasks = this.data.todayTasks
    if (key === 'all') {
      this.setData({ filteredTasks: tasks })
    } else {
      this.setData({ filteredTasks: tasks.filter(function (t) { return t.project === key }) })
    }
  },

  onFilterTap(e) {
    var key = e.currentTarget.dataset.key
    this.setData({ activeFilter: key })
    this.applyFilter()
  },

  // 任务完成
  onTaskComplete(e) {
    var taskId = e.detail.taskId
    var self = this

    if (self._useApi) {
      api.cards.complete(taskId).then(function (result) {
        wx.vibrateShort({ type: 'medium' })
        wx.showToast({ title: '+' + (result.coinReward || 0) + ' 金币', icon: 'none' })
        // 更新 globalData
        var app = getApp()
        if (app && result.coinReward) {
          app.globalData.coins = (app.globalData.coins || 0) + result.coinReward
        }
        self.loadTodayData()
      }).catch(function () {
        wx.showToast({ title: '操作失败，请重试', icon: 'none' })
      })
    } else {
      var result = storage.tasks.complete(taskId)
      if (!result) return
      self._renderTasks(storage.tasks.today())
      wx.vibrateShort({ type: 'medium' })
      wx.showToast({ title: '+' + result.coinReward + ' 金币', icon: 'none' })
    }
  },

  // 子任务勾选
  onSubtaskToggle(e) {
    var taskId = e.detail.taskId
    var updatedTask = e.detail.updatedTask
    var self = this

    if (self._useApi) {
      if (updatedTask.status === 'completed') {
        // Save subtask changes only, then use /complete endpoint for coins
        api.cards.update(taskId, { subtasks: updatedTask.subtasks }).then(function () {
          return api.cards.complete(taskId)
        }).then(function (result) {
          wx.vibrateShort({ type: 'medium' })
          wx.showToast({ title: '+' + (result.coinReward || 0) + ' 金币', icon: 'none' })
          var app = getApp()
          if (app && result.coinReward) {
            app.globalData.coins = (app.globalData.coins || 0) + result.coinReward
          }
          self.loadTodayData()
        }).catch(function () {
          self.loadTodayData()
        })
        return
      }
      api.cards.update(taskId, {
        subtasks: updatedTask.subtasks,
        status: updatedTask.status,
      }).catch(function () {})
    } else {
      storage.tasks.update(taskId, {
        subtasks: updatedTask.subtasks,
        status: updatedTask.status,
        updatedAt: updatedTask.updatedAt,
      })
      if (updatedTask.status === 'completed') {
        var task = storage.tasks.get(taskId)
        if (task) {
          storage.coins.add(task.coinReward || 0)
          storage.stats.logCompletion(taskId, task.coinReward || 0, task.estimatedMinutes || 0)
          storage.streak.update()
          wx.vibrateShort({ type: 'medium' })
          wx.showToast({ title: '+' + (task.coinReward || 0) + ' 金币', icon: 'none' })
        }
        self._renderTasks(storage.tasks.today())
        return
      }
    }

    // 乐观更新 UI
    if (updatedTask.status !== 'completed') {
      var todayTasks = self.data.todayTasks.map(function (t) {
        return t.id === taskId ? updatedTask : t
      })
      self.setData({ todayTasks: todayTasks })
      self.updateCapacity(todayTasks)
      self.applyFilter()
    }
  },

  // 切换已完成列表
  toggleDoneList() {
    this.setData({ showDoneList: !this.data.showDoneList })
  },

  // 任务跳过
  onTaskSkip(e) {
    wx.showToast({ title: '换个角度想想看~', icon: 'none' })
  },

  // 左滑推迟到明天
  onTaskPostpone: function (e) {
    var taskId = e.detail.taskId
    var self = this
    if (self._useApi) {
      api.cards.postpone(taskId).then(function () {
        wx.showToast({ title: '已推迟到明天', icon: 'none' })
        self.loadTodayData()
      }).catch(function () {
        wx.showToast({ title: '操作失败', icon: 'none' })
      })
    } else {
      var task = storage.tasks.get(taskId)
      if (task) {
        storage.tasks.update(taskId, { postponedCount: (task.postponedCount || 0) + 1 })
      }
      wx.showToast({ title: '已推迟到明天', icon: 'none' })
      self._renderTasks(storage.tasks.today())
    }
  },

  // 点击任务卡片 → 进入详情
  onTaskTap(e) {
    var taskId = e.detail && e.detail.taskId ? e.detail.taskId : ''
    if (taskId) {
      wx.navigateTo({ url: '/pages/task-detail/task-detail?id=' + taskId })
    }
  },

  // --- 输入 & 自然语言解析 ---

  onInput(e) {
    this.setData({ inputValue: e.detail.value })
  },

  // 发送 = 解析输入并弹出预览
  onSendMessage() {
    var content = this.data.inputValue.trim()
    if (!content) return

    var parsed = parseInput(content)
    if (parsed.length === 0) {
      wx.showToast({ title: '没有识别到任务', icon: 'none' })
      return
    }

    this.setData({
      previewTasks: parsed,
      showPreview: true,
    })
  },

  // 确认添加解析出的任务
  onConfirmPreview() {
    var self = this
    var newTasks = this.data.previewTasks
    var taskCount = newTasks.length

    self.setData({ showPreview: false, previewTasks: [], inputValue: '' })

    if (self._useApi) {
      var promises = newTasks.map(function (task) {
        return api.cards.create(task)
      })
      Promise.all(promises).then(function () {
        self.loadTodayData()
      }).catch(function () {
        // 降级到本地存储
        storage.tasks.createBatch(newTasks)
        self._renderTasks(storage.tasks.today())
      })
    } else {
      storage.tasks.createBatch(newTasks)
      self._renderTasks(storage.tasks.today())
    }

    wx.showToast({ title: '已添加 ' + taskCount + ' 个任务', icon: 'none' })
  },

  // 取消预览
  onCancelPreview() {
    this.setData({ showPreview: false, previewTasks: [] })
  },

  // 删除预览中的某个任务
  onRemovePreviewTask(e) {
    var idx = e.currentTarget.dataset.index
    var previewTasks = this.data.previewTasks.filter(function (_, i) { return i !== idx })
    if (previewTasks.length === 0) {
      this.setData({ showPreview: false, previewTasks: [] })
    } else {
      this.setData({ previewTasks: previewTasks })
    }
  },

  // --- 情绪签到 ---

  onMoodTap(e) {
    var value = e.currentTarget.dataset.value
    var emoji = e.currentTarget.dataset.emoji
    var label = e.currentTarget.dataset.label
    var now = new Date()
    var todayKey = 'mood_' + now.getFullYear() + '_' + now.getMonth() + '_' + now.getDate()

    wx.setStorageSync(todayKey, value)
    wx.vibrateShort({ type: 'medium' })

    this.setData({
      moodCheckedIn: true,
      selectedMood: value,
      selectedMoodEmoji: emoji,
      selectedMoodLabel: label,
    })

    // 低能量心情 -> 低能量任务前置
    if (['low', 'angry', 'stressed'].indexOf(value) !== -1) {
      var sorted = this.data.todayTasks.slice().sort(function (a, b) {
        var order = { low: 0, medium: 1, high: 2 }
        return (order[a.energy] || 1) - (order[b.energy] || 1)
      })
      this.setData({ todayTasks: sorted })
      this.applyFilter()
    }

    var moodResponses = {
      great: '状态超棒！来挑战高能量任务吧 💪',
      good: '状态不错，保持节奏 😊',
      normal: '做一件小事让自己开心一下 🌱',
      low: '今天对自己温柔一点，先从简单的开始 🤗',
      angry: '动动手做点整理，反而能平静下来 🧹',
      stressed: '先深呼吸，今天只做最重要的一件事 🌙',
    }
    wx.showToast({ title: moodResponses[value] || '记录好啦~', icon: 'none', duration: 2000 })
  },

  // --- 活跃目标 ---

  loadActiveGoals: function () {
    var self = this
    api.cards.list({ card_type: 'goal', status: 'in_progress' }).then(function (goals) {
      self._renderGoals(goals)
    }).catch(function () {
      var goals = storage.tasks.list({ cardType: 'goal' }).filter(function (g) {
        return g.status === 'in_progress' || g.status === 'pending'
      })
      self._renderGoals(goals)
    })
  },

  _renderGoals: function (goals) {
    // 取前 2 个活跃目标，附带子任务进度
    var self = this
    var top = goals.slice(0, 2)
    if (top.length === 0) {
      self.setData({ activeGoals: [] })
      return
    }

    var enriched = top.map(function (g) {
      var children = storage.tasks.children(g.id)
      var progress = getGoalProgress(children)
      return {
        id: g.id,
        title: g.title,
        progress: progress,
        todayTask: children.find(function (c) {
          return (c.cardType || c.card_type || 'daily') === 'daily' &&
            c.status !== 'completed' && c.status !== 'archived'
        }),
      }
    })

    self.setData({ activeGoals: enriched })
  },

  onGoalTap: function (e) {
    var id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/goals/goal-detail?id=' + id + '&type=goal' })
  },

  goToProfile() {
    wx.switchTab({ url: '/pages/profile/profile' })
  },
})
