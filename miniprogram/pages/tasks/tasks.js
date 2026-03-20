// 任务卡片列表页 - V2 升级版
const {
  createTask, createSubtask, smartSort, getProjectInfo,
  toggleSubtask, PROJECT_PRESETS,
} = require('../../utils/task-model')
const storage = require('../../utils/storage')
const api = require('../../utils/api')

var projectKeys = Object.keys(PROJECT_PRESETS)

Page({
  data: {
    viewMode: 'list', // list | quadrant
    // 项目筛选
    activeFilter: 'all',
    projectFilters: [],
    // 任务数据
    allTasks: [],
    pendingTasks: [],
    completedTasks: [],
    filteredPending: [],
    filteredCompleted: [],
    // 四象限
    quadrantTasks: {
      urgentImportant: [],
      important: [],
      urgent: [],
      normal: [],
    },
  },

  onLoad() {
    this._useApi = false
    this.loadTasks()
  },

  onShow() {
    this.loadTasks()
  },

  // 加载任务：API 优先，离线降级
  loadTasks() {
    var self = this
    // 先展示本地数据
    self._renderAllTasks(smartSort(storage.tasks.list()))

    // 再尝试 API
    api.cards.list().then(function (tasks) {
      self._useApi = true
      self._renderAllTasks(smartSort(tasks))
    }).catch(function () {
      self._useApi = false
    })
  },

  // 渲染所有任务数据
  _renderAllTasks(allTasks) {
    this.setData({ allTasks: allTasks })
    this.refreshViews()
  },

  // 刷新所有视图数据
  refreshViews() {
    var allTasks = this.data.allTasks
    var pendingTasks = allTasks.filter(function (t) { return t.status !== 'completed' && t.status !== 'archived' })
    var completedTasks = allTasks.filter(function (t) { return t.status === 'completed' || t.status === 'archived' })

    // 四象限
    var quadrantTasks = {
      urgentImportant: pendingTasks.filter(function (t) { return t.priority === 'urgent_important' }),
      important: pendingTasks.filter(function (t) { return t.priority === 'important' }),
      urgent: pendingTasks.filter(function (t) { return t.priority === 'urgent' }),
      normal: pendingTasks.filter(function (t) { return t.priority === 'normal' }),
    }

    // 项目筛选标签
    var seen = {}
    var filters = [{ key: 'all', label: '全部', icon: '📋', color: '#7C5CFC', count: pendingTasks.length }]
    pendingTasks.forEach(function (t) {
      var p = t.project
      if (!p) return
      if (seen[p]) { seen[p].count++; return }
      var info = getProjectInfo(p)
      seen[p] = { key: p, label: info.label, icon: info.icon, color: info.color, count: 1 }
      filters.push(seen[p])
    })

    this.setData({ pendingTasks: pendingTasks, completedTasks: completedTasks, quadrantTasks: quadrantTasks, projectFilters: filters })
    this.applyFilter()
  },

  // 应用项目筛选
  applyFilter() {
    var key = this.data.activeFilter
    var pending = this.data.pendingTasks
    var completed = this.data.completedTasks
    if (key === 'all') {
      this.setData({ filteredPending: pending, filteredCompleted: completed })
    } else {
      this.setData({
        filteredPending: pending.filter(function (t) { return t.project === key }),
        filteredCompleted: completed.filter(function (t) { return t.project === key }),
      })
    }
  },

  // 切换视图模式
  switchView(e) {
    this.setData({ viewMode: e.currentTarget.dataset.mode })
  },

  // 筛选标签点击
  onFilterTap(e) {
    this.setData({ activeFilter: e.currentTarget.dataset.key })
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
        self.loadTasks()
      }).catch(function () {
        wx.showToast({ title: '操作失败，请重试', icon: 'none' })
      })
    } else {
      var result = storage.tasks.complete(taskId)
      if (!result) return
      self._renderAllTasks(smartSort(storage.tasks.list()))
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
      api.cards.update(taskId, {
        subtasks: updatedTask.subtasks,
        status: updatedTask.status,
      }).then(function () {
        if (updatedTask.status === 'completed') {
          self.loadTasks()
        }
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
        self._renderAllTasks(smartSort(storage.tasks.list()))
        return
      }
    }

    // 乐观更新 UI
    if (updatedTask.status !== 'completed') {
      var allTasks = self.data.allTasks.map(function (t) {
        return t.id === taskId ? updatedTask : t
      })
      self.setData({ allTasks: allTasks })
      self.refreshViews()
    }
  },

  // 跳过
  onTaskSkip(e) {
    wx.showToast({ title: '换个角度想想~', icon: 'none' })
  },

  // 左滑推迟
  onTaskPostpone: function (e) {
    var taskId = e.detail.taskId
    var self = this
    if (self._useApi) {
      api.cards.postpone(taskId).then(function () {
        wx.showToast({ title: '已推迟到明天', icon: 'none' })
        self.loadTasks()
      }).catch(function () {
        wx.showToast({ title: '操作失败', icon: 'none' })
      })
    } else {
      var task = storage.tasks.get(taskId)
      if (task) {
        storage.tasks.update(taskId, { postponedCount: (task.postponedCount || 0) + 1 })
      }
      wx.showToast({ title: '已推迟到明天', icon: 'none' })
      self._renderAllTasks(smartSort(storage.tasks.list()))
    }
  },

  // 点击任务详情
  onTaskDetail(e) {
    var id = e.detail && e.detail.taskId ? e.detail.taskId : e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/task-detail/task-detail?id=' + id })
  },

  // 添加新任务
  onAddTask() {
    wx.navigateTo({ url: '/pages/add-task/add-task' })
  },
})
