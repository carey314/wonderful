var {
  getTaskProgress, getSubtaskCountText, formatMinutes, getProjectInfo,
  toggleSubtask, addSubtaskToTask, removeSubtaskFromTask, reorderSubtasks,
  isOverdue, calculateCoinReward,
} = require('../../utils/task-model')
var storage = require('../../utils/storage')
var api = require('../../utils/api')
var { formatDeadline, priorityMap } = require('../../utils/util')

Page({
  data: {
    task: null,
    // Computed display fields
    progress: 0,
    subtaskCountText: '',
    estimatedTimeText: '',
    projectInfo: null,
    priorityLabel: '',
    priorityColor: '',
    deadlineText: '',
    overdue: false,
    coinReward: 0,
    hasSubtasks: false,
    // Subtask input
    newSubtaskTitle: '',
    // AI decompose
    aiLoading: false,
    aiSuggestions: [],
    showAiPanel: false,
    selectedAiCount: 0,
    // 5-min quick start timer
    timerActive: false,
    timerSeconds: 0,
    timerTotal: 300,
    timerDisplay: '05:00',
    timerPercent: 0,
    // State
    _useApi: false,
    saving: false,
  },

  onLoad(options) {
    if (!options.id) {
      wx.navigateBack()
      return
    }
    this._taskId = options.id
    this._timerInterval = null
    this._timerPausedAt = null
    this._timerRemainingOnPause = 0
    this.loadTask()
  },

  onUnload() {
    if (this._timerInterval) {
      clearInterval(this._timerInterval)
    }
  },

  onHide() {
    // Pause timer when going to background
    if (this.data.timerActive && this._timerInterval) {
      this._timerPausedAt = Date.now()
      this._timerRemainingOnPause = this.data.timerSeconds
      clearInterval(this._timerInterval)
      this._timerInterval = null
    }
  },

  onShow() {
    // Resume timer if was paused
    if (this._timerPausedAt && this._timerRemainingOnPause > 0) {
      var elapsed = Math.floor((Date.now() - this._timerPausedAt) / 1000)
      var remaining = Math.max(0, this._timerRemainingOnPause - elapsed)
      this._timerPausedAt = null
      this._timerRemainingOnPause = 0
      if (remaining <= 0) {
        this.onTimerComplete()
      } else {
        this.setData({ timerSeconds: remaining })
        this._updateTimerDisplay(remaining)
        this._startTimerInterval()
      }
    }
  },

  loadTask() {
    var self = this
    var task = storage.tasks.get(self._taskId)
    if (task) {
      self._setTask(task)
    }
    // Try API
    api.cards.get(self._taskId).then(function(t) {
      self._useApi = true
      self._setTask(t)
    }).catch(function() {
      self._useApi = false
    })
  },

  _setTask(task) {
    var pInfo = priorityMap[task.priority] || priorityMap.normal
    this.setData({
      task: task,
      progress: getTaskProgress(task),
      subtaskCountText: getSubtaskCountText(task),
      estimatedTimeText: formatMinutes(task.estimatedMinutes || 0),
      projectInfo: getProjectInfo(task.project),
      priorityLabel: pInfo.label,
      priorityColor: pInfo.color,
      deadlineText: formatDeadline(task.deadline),
      overdue: isOverdue(task),
      coinReward: task.coinReward || 0,
      hasSubtasks: task.subtasks && task.subtasks.length > 0,
    })
  },

  // ---- Subtask CRUD ----

  onNewSubtaskInput(e) {
    this.setData({ newSubtaskTitle: e.detail.value })
  },

  addSubtask() {
    var title = this.data.newSubtaskTitle.trim()
    if (!title) return
    var task = addSubtaskToTask(this.data.task, { title: title })
    this.setData({ newSubtaskTitle: '' })
    this._saveTask(task)
  },

  onToggleSubtask(e) {
    var subtaskId = e.currentTarget.dataset.id
    var task = toggleSubtask(this.data.task, subtaskId)

    // toggleSubtask auto-sets status='completed' when all done
    // If so, save subtask changes only, then use the complete flow (awards coins)
    if (task.status === 'completed') {
      this._setTask(task)
      storage.tasks.update(this._taskId, {
        subtasks: task.subtasks,
        updatedAt: task.updatedAt,
      })
      if (this._useApi) {
        // Save subtask state without status change, then hit /complete for coins
        api.cards.update(this._taskId, { subtasks: task.subtasks }).catch(function () {})
      }
      this.onComplete()
      return
    }

    this._saveTask(task)
  },

  removeSubtask(e) {
    var subtaskId = e.currentTarget.dataset.id
    var task = removeSubtaskFromTask(this.data.task, subtaskId)
    this._saveTask(task)
  },

  moveSubtaskUp(e) {
    var idx = e.currentTarget.dataset.index
    if (idx <= 0) return
    var task = reorderSubtasks(this.data.task, idx, idx - 1)
    this._saveTask(task)
  },

  moveSubtaskDown(e) {
    var idx = e.currentTarget.dataset.index
    if (idx >= this.data.task.subtasks.length - 1) return
    var task = reorderSubtasks(this.data.task, idx, idx + 1)
    this._saveTask(task)
  },

  // ---- AI Decompose ----

  onAiDecompose() {
    var self = this
    var task = self.data.task
    if (!task || !task.title) return

    self.setData({ aiLoading: true })

    var message = '请帮我把这个任务拆解成5-15分钟的可执行子步骤：\n' +
      '任务：' + task.title + '\n' +
      (task.description ? '描述：' + task.description + '\n' : '') +
      '预计总时间：' + (task.estimatedMinutes || 30) + '分钟\n' +
      '请用JSON数组返回，每个元素包含 title 和 estimatedMinutes。只返回JSON数组，不要其他文字。'

    api.ai.chat(message).then(function(res) {
      var suggestions = self._parseAiSubtasks(res.message || res)
      suggestions.forEach(function(s) { s.selected = true })
      self.setData({
        aiSuggestions: suggestions,
        showAiPanel: true,
        aiLoading: false,
        selectedAiCount: suggestions.length,
      })
    }).catch(function() {
      // Offline fallback: simple time-based split
      var suggestions = self._generateFallbackSubtasks(task)
      suggestions.forEach(function(s) { s.selected = true })
      self.setData({
        aiSuggestions: suggestions,
        showAiPanel: true,
        aiLoading: false,
        selectedAiCount: suggestions.length,
      })
    })
  },

  _parseAiSubtasks(text) {
    if (typeof text !== 'string') text = JSON.stringify(text)
    try {
      var jsonMatch = text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        var parsed = JSON.parse(jsonMatch[0])
        return parsed.map(function(item) {
          return {
            title: item.title || item.name || '',
            estimatedMinutes: item.estimatedMinutes || item.minutes || 10,
          }
        }).filter(function(item) { return item.title })
      }
    } catch(e) {}
    // Fallback: parse numbered list
    var lines = text.split('\n').filter(function(line) {
      return /^\d+[.、)]\s*/.test(line.trim())
    })
    return lines.map(function(line) {
      var title = line.replace(/^\d+[.、)]\s*/, '').trim()
      var timeMatch = title.match(/[（(](\d+)[分min]/)
      var minutes = timeMatch ? parseInt(timeMatch[1]) : 10
      title = title.replace(/[（(]\d+[分min].*?[）)]/, '').trim()
      return { title: title, estimatedMinutes: minutes }
    }).filter(function(item) { return item.title })
  },

  _generateFallbackSubtasks(task) {
    var total = task.estimatedMinutes || 30
    var chunkSize = total <= 30 ? 10 : 15
    var count = Math.ceil(total / chunkSize)
    var subtasks = []
    for (var i = 0; i < count; i++) {
      subtasks.push({
        title: '步骤 ' + (i + 1),
        estimatedMinutes: Math.min(chunkSize, total - i * chunkSize),
      })
    }
    return subtasks
  },

  toggleAiSuggestion(e) {
    var idx = e.currentTarget.dataset.index
    var suggestions = this.data.aiSuggestions.slice()
    suggestions[idx].selected = !suggestions[idx].selected
    var count = suggestions.filter(function(s) { return s.selected }).length
    this.setData({ aiSuggestions: suggestions, selectedAiCount: count })
  },

  applyAiSuggestions() {
    var task = this.data.task
    var selected = this.data.aiSuggestions.filter(function(s) { return s.selected })
    if (selected.length === 0) {
      this.setData({ showAiPanel: false })
      return
    }
    var updated = task
    selected.forEach(function(s) {
      updated = addSubtaskToTask(updated, { title: s.title, estimatedMinutes: s.estimatedMinutes })
    })
    this.setData({ showAiPanel: false, aiSuggestions: [] })
    this._saveTask(updated)
    wx.showToast({ title: '已添加 ' + selected.length + ' 个步骤', icon: 'none' })
  },

  closeAiPanel() {
    this.setData({ showAiPanel: false, aiSuggestions: [] })
  },

  // ---- 5-minute Quick Start ----

  startQuickTimer() {
    if (this.data.timerActive) return
    var task = this.data.task
    if (task.status === 'pending') {
      this._saveTaskField({ status: 'in_progress' })
    }
    this.setData({
      timerActive: true,
      timerSeconds: 300,
      timerTotal: 300,
      timerDisplay: '05:00',
      timerPercent: 0,
    })
    this._startTimerInterval()
    wx.vibrateShort({ type: 'light' })
  },

  _startTimerInterval() {
    var self = this
    self._timerInterval = setInterval(function() {
      var remaining = self.data.timerSeconds - 1
      if (remaining <= 0) {
        clearInterval(self._timerInterval)
        self._timerInterval = null
        self.onTimerComplete()
        return
      }
      self._updateTimerDisplay(remaining)
    }, 1000)
  },

  _updateTimerDisplay(remaining) {
    var min = Math.floor(remaining / 60)
    var sec = remaining % 60
    var elapsed = this.data.timerTotal - remaining
    this.setData({
      timerSeconds: remaining,
      timerDisplay: String(min).padStart(2, '0') + ':' + String(sec).padStart(2, '0'),
      timerPercent: Math.round((elapsed / this.data.timerTotal) * 100),
    })
  },

  onTimerComplete() {
    this.setData({ timerActive: false, timerPercent: 100, timerDisplay: '00:00' })
    wx.vibrateShort({ type: 'heavy' })

    // Log the focus session
    var task = this.data.task
    var bonusCoins = Math.max(5, Math.round((task.coinReward || 10) * 0.1))
    storage.focus.log(task.id, 300, bonusCoins)
    storage.coins.add(bonusCoins)

    var self = this
    wx.showModal({
      title: '5分钟到了！',
      content: '你已经开始了，获得 +' + bonusCoins + ' 金币奖励。\n要继续做下去吗？',
      confirmText: '继续做',
      cancelText: '先到这',
      confirmColor: '#7C5CFC',
      success: function(res) {
        if (res.confirm) {
          // User continues - no more timer, just let them work
          wx.showToast({ title: '加油！保持这个状态', icon: 'none' })
        }
      }
    })
  },

  stopTimer() {
    if (this._timerInterval) {
      clearInterval(this._timerInterval)
      this._timerInterval = null
    }
    var elapsed = this.data.timerTotal - this.data.timerSeconds
    this.setData({ timerActive: false, timerPercent: 0 })
    if (elapsed >= 60) {
      // If user worked at least 1 minute, still log it
      storage.focus.log(this.data.task.id, elapsed, 0)
    }
  },

  // ---- Task Actions ----

  onComplete() {
    var self = this
    var taskId = self._taskId

    if (self._useApi) {
      api.cards.complete(taskId).then(function(result) {
        wx.vibrateShort({ type: 'medium' })
        wx.showToast({ title: '+' + (result.coinReward || 0) + ' 金币', icon: 'none' })
        var app = getApp()
        if (app && result.coinReward) {
          app.globalData.coins = (app.globalData.coins || 0) + result.coinReward
        }
        setTimeout(function() { wx.navigateBack() }, 800)
      }).catch(function() {
        wx.showToast({ title: '操作失败', icon: 'none' })
      })
    } else {
      var result = storage.tasks.complete(taskId)
      if (!result) return
      wx.vibrateShort({ type: 'medium' })
      wx.showToast({ title: '+' + result.coinReward + ' 金币', icon: 'none' })
      setTimeout(function() { wx.navigateBack() }, 800)
    }
  },

  // ---- Delete & Postpone ----

  onDelete() {
    var self = this
    wx.showModal({
      title: '删除任务',
      content: '确定要删除「' + self.data.task.title + '」吗？',
      confirmText: '删除',
      confirmColor: '#FF6B6B',
      success: function (res) {
        if (!res.confirm) return
        if (self._useApi) {
          api.cards.delete(self._taskId).catch(function () {})
        }
        storage.tasks.delete(self._taskId)
        wx.showToast({ title: '已删除', icon: 'none' })
        setTimeout(function () { wx.navigateBack() }, 500)
      },
    })
  },

  onPostpone() {
    var self = this
    if (self._useApi) {
      api.cards.postpone(self._taskId).then(function (result) {
        var count = (result && result.data && result.data.postponedCount) || 0
        wx.showToast({ title: '已推迟到明天' + (count >= 3 ? '（第' + count + '次）' : ''), icon: 'none' })
        setTimeout(function () { wx.navigateBack() }, 800)
      }).catch(function () {
        wx.showToast({ title: '操作失败', icon: 'none' })
      })
    } else {
      var task = self.data.task
      var postponedCount = (task.postponedCount || 0) + 1
      storage.tasks.update(self._taskId, { postponedCount: postponedCount })
      wx.showToast({ title: '已推迟到明天', icon: 'none' })
      setTimeout(function () { wx.navigateBack() }, 800)
    }
  },

  // ---- Persistence ----

  _saveTask(updatedTask) {
    this._setTask(updatedTask)
    if (this._useApi) {
      api.cards.update(this._taskId, {
        subtasks: updatedTask.subtasks,
        status: updatedTask.status,
        description: updatedTask.description,
      }).catch(function() {})
    }
    storage.tasks.update(this._taskId, {
      subtasks: updatedTask.subtasks,
      status: updatedTask.status,
      description: updatedTask.description,
      updatedAt: updatedTask.updatedAt,
    })
  },

  _saveTaskField(updates) {
    var task = Object.assign({}, this.data.task, updates, { updatedAt: Date.now() })
    this._setTask(task)
    if (this._useApi) {
      api.cards.update(this._taskId, updates).catch(function() {})
    }
    storage.tasks.update(this._taskId, updates)
  },
})
