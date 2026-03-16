// 任务卡片列表页 - V2 升级版
const {
  createTask, createSubtask, smartSort, getProjectInfo,
  toggleSubtask, PROJECT_PRESETS,
} = require('../../utils/task-model')
const storage = require('../../utils/storage')

const projectKeys = Object.keys(PROJECT_PRESETS)

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
    this.loadTasks()
  },

  onShow() {
    // 每次回到页面从 storage 重新加载
    this.loadTasks()
  },

  // 从本地存储加载所有任务
  loadTasks() {
    const allTasks = smartSort(storage.tasks.list())
    this.setData({ allTasks: allTasks })
    this.refreshViews()
  },

  // 刷新所有视图数据
  refreshViews() {
    const allTasks = this.data.allTasks
    const pendingTasks = allTasks.filter((t) => t.status !== 'completed' && t.status !== 'archived')
    const completedTasks = allTasks.filter((t) => t.status === 'completed' || t.status === 'archived')

    // 四象限
    const quadrantTasks = {
      urgentImportant: pendingTasks.filter((t) => t.priority === 'urgent_important'),
      important: pendingTasks.filter((t) => t.priority === 'important'),
      urgent: pendingTasks.filter((t) => t.priority === 'urgent'),
      normal: pendingTasks.filter((t) => t.priority === 'normal'),
    }

    // 项目筛选标签
    const seen = {}
    const filters = [{ key: 'all', label: '全部', icon: '📋', color: '#7C5CFC', count: pendingTasks.length }]
    pendingTasks.forEach((t) => {
      const p = t.project
      if (!p) return
      if (seen[p]) { seen[p].count++; return }
      const info = getProjectInfo(p)
      seen[p] = { key: p, label: info.label, icon: info.icon, color: info.color, count: 1 }
      filters.push(seen[p])
    })

    this.setData({ pendingTasks, completedTasks, quadrantTasks, projectFilters: filters })
    this.applyFilter()
  },

  // 应用项目筛选
  applyFilter() {
    const key = this.data.activeFilter
    const pending = this.data.pendingTasks
    const completed = this.data.completedTasks
    if (key === 'all') {
      this.setData({ filteredPending: pending, filteredCompleted: completed })
    } else {
      this.setData({
        filteredPending: pending.filter((t) => t.project === key),
        filteredCompleted: completed.filter((t) => t.project === key),
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

  // 任务完成 -> 持久化
  onTaskComplete(e) {
    const { taskId } = e.detail
    const result = storage.tasks.complete(taskId)
    if (!result) return

    // 重新从 storage 加载
    this.loadTasks()

    wx.vibrateShort({ type: 'medium' })
    wx.showToast({ title: `+${result.coinReward} 金币`, icon: 'none' })
  },

  // 子任务勾选 -> 持久化
  onSubtaskToggle(e) {
    const { taskId, updatedTask } = e.detail
    storage.tasks.update(taskId, {
      subtasks: updatedTask.subtasks,
      status: updatedTask.status,
      updatedAt: updatedTask.updatedAt,
    })

    // 如果子任务全部完成导致主任务完成
    if (updatedTask.status === 'completed') {
      var task = storage.tasks.get(taskId)
      if (task) {
        storage.coins.add(task.coinReward || 0)
        storage.stats.logCompletion(taskId, task.coinReward || 0, task.estimatedMinutes || 0)
        storage.streak.update()
        wx.vibrateShort({ type: 'medium' })
        wx.showToast({ title: `+${task.coinReward || 0} 金币`, icon: 'none' })
      }
      this.loadTasks()
      return
    }

    const allTasks = this.data.allTasks.map((t) => t.id === taskId ? updatedTask : t)
    this.setData({ allTasks: allTasks })
    this.refreshViews()
  },

  // 跳过
  onTaskSkip(e) {
    wx.showToast({ title: '换个角度想想~', icon: 'none' })
  },

  // 点击任务详情
  onTaskDetail(e) {
    const id = e.detail && e.detail.taskId ? e.detail.taskId : e.currentTarget.dataset.id
    wx.showToast({ title: '任务详情开发中', icon: 'none' })
  },

  // 添加新任务
  onAddTask() {
    wx.navigateTo({ url: '/pages/add-task/add-task' })
  },
})
