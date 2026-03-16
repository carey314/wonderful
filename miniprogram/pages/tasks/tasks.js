// 任务卡片列表页 - V2 升级版
const {
  createTask, createSubtask, smartSort, getProjectInfo,
  toggleSubtask, PROJECT_PRESETS,
} = require('../../utils/task-model')

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
    this.loadTasks()
  },

  // 加载任务数据
  loadTasks() {
    // TODO: 对接后端 API，目前使用 mock 数据
    const allTasks = smartSort([
      createTask({
        title: '学完 Python 基础课程',
        description: '第8章 + 3道练习题',
        priority: 'important',
        energy: 'high',
        estimatedMinutes: 45,
        project: 'study',
        subtasks: [
          createSubtask({ title: '阅读教程内容', estimatedMinutes: 20, completed: true }),
          createSubtask({ title: '完成练习题1', estimatedMinutes: 8, completed: true }),
          createSubtask({ title: '完成练习题2', estimatedMinutes: 8 }),
          createSubtask({ title: '完成练习题3', estimatedMinutes: 9 }),
        ],
      }),
      createTask({
        title: '写完项目方案书',
        description: '标题+三个要点，先不管格式',
        priority: 'urgent_important',
        energy: 'high',
        estimatedMinutes: 60,
        project: 'work',
        deadline: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        subtasks: [
          createSubtask({ title: '梳理需求要点', estimatedMinutes: 15 }),
          createSubtask({ title: '写大纲框架', estimatedMinutes: 20 }),
          createSubtask({ title: '填充内容', estimatedMinutes: 25 }),
        ],
      }),
      createTask({
        title: '回复3封邮件',
        description: '待处理的客户邮件',
        priority: 'urgent',
        energy: 'low',
        estimatedMinutes: 15,
        project: 'work',
      }),
      createTask({
        title: '每天跑步30分钟',
        description: '今天至少跑2公里',
        priority: 'normal',
        energy: 'medium',
        estimatedMinutes: 30,
        project: 'health',
      }),
      createTask({
        title: '整理书桌',
        description: '清理桌面，物品归位',
        priority: 'normal',
        energy: 'low',
        estimatedMinutes: 15,
        project: 'life',
        status: 'completed',
      }),
    ])

    this.setData({ allTasks })
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

  // 任务完成
  onTaskComplete(e) {
    const { taskId } = e.detail
    const allTasks = this.data.allTasks.map((t) => {
      if (t.id === taskId) return Object.assign({}, t, { status: 'completed' })
      return t
    })
    this.setData({ allTasks })
    this.refreshViews()

    const task = allTasks.find((t) => t.id === taskId)
    wx.vibrateShort({ type: 'medium' })
    wx.showToast({ title: `+${task ? task.coinReward : 0} 金币`, icon: 'none' })
  },

  // 子任务勾选
  onSubtaskToggle(e) {
    const { taskId, updatedTask } = e.detail
    const allTasks = this.data.allTasks.map((t) => t.id === taskId ? updatedTask : t)
    this.setData({ allTasks })
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
