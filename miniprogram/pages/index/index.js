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
    // 检查数据是否有变更，避免不必要的重渲染
    var lastVersion = this._dataVersion || 0
    var currentVersion = wx.getStorageSync('_data_version') || 0
    if (currentVersion !== lastVersion || !this._loaded) {
      this._dataVersion = currentVersion
      this._loaded = true
      this.loadTodayData()
      this.loadActiveGoals()
    } else {
      // 仅更新金币和连续天数（轻量）
      var app = getApp()
      this.setData({
        coins: formatCoins(app.globalData.coins || storage.coins.get()),
        streakDays: app.globalData.streakDays || storage.streak.get(),
      })
    }
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

    // 先保存子任务状态变更
    if (self._useApi) {
      api.cards.update(taskId, {
        subtasks: updatedTask.subtasks,
      }).catch(function () {})
    }
    storage.tasks.update(taskId, {
      subtasks: updatedTask.subtasks,
      updatedAt: updatedTask.updatedAt,
    })

    // 乐观更新 UI
    var todayTasks = self.data.todayTasks.map(function (t) {
      return t.id === taskId ? updatedTask : t
    })
    self.setData({ todayTasks: todayTasks })
    self.updateCapacity(todayTasks)
    self.applyFilter()

    // 所有子任务完成 → 弹窗询问
    if (updatedTask._allSubtasksDone) {
      var reward = updatedTask.coinReward || 10
      wx.showModal({
        title: '所有步骤已完成 🎉',
        content: '要把整个任务也标记为完成吗？\n完成可获得 +' + reward + ' 金币',
        confirmText: '完成任务',
        cancelText: '暂不',
        confirmColor: '#7C5CFC',
        success: function (res) {
          if (res.confirm) {
            self.onTaskComplete({ detail: { taskId: taskId } })
          }
        },
      })
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
    var task = storage.tasks.get(taskId)
    var postponedCount = task ? (task.postponedCount || 0) + 1 : 1

    // 推迟 >= 3 次：温和提醒
    if (postponedCount >= 3) {
      var messages = [
        '这个任务已经推迟 ' + postponedCount + ' 次了',
        '试试把它拆成更小的步骤？\n或者降低预期，先做5分钟就好。',
      ]
      wx.showModal({
        title: '又见面了 😊',
        content: messages.join('\n'),
        confirmText: '还是推迟',
        cancelText: '试试拆解',
        confirmColor: '#999',
        success: function (res) {
          if (res.confirm) {
            self._doPostpone(taskId, postponedCount)
          } else {
            // 跳转到任务详情页，引导拆解
            wx.navigateTo({ url: '/pages/task-detail/task-detail?id=' + taskId })
          }
        },
      })
      return
    }

    self._doPostpone(taskId, postponedCount)
  },

  _doPostpone: function (taskId, postponedCount) {
    var self = this
    if (self._useApi) {
      api.cards.postpone(taskId).then(function () {
        var tip = postponedCount >= 2 ? '已推迟到明天（第' + postponedCount + '次）' : '已推迟到明天'
        wx.showToast({ title: tip, icon: 'none' })
        self.loadTodayData()
      }).catch(function () {
        wx.showToast({ title: '操作失败', icon: 'none' })
      })
    } else {
      storage.tasks.update(taskId, { postponedCount: postponedCount })
      var tip = postponedCount >= 2 ? '已推迟到明天（第' + postponedCount + '次）' : '已推迟到明天'
      wx.showToast({ title: tip, icon: 'none' })
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
    storage.mood.save(value)
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
