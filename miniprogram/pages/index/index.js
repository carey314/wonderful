// 首页 - V2 任务优先 + 自然语言创建
const { getGreeting, getWeekday, formatCoins, formatDeadline } = require('../../utils/util')
const { parseInput } = require('../../utils/task-parser')
const {
  createTask, createSubtask, getTaskProgress, getDailyCapacity,
  formatMinutes, getProjectInfo, smartSort, toggleSubtask,
  PROJECT_PRESETS, getTotalEstimatedMinutes,
} = require('../../utils/task-model')

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
    const now = new Date()
    const todayKey = `mood_${now.getFullYear()}_${now.getMonth()}_${now.getDate()}`
    const savedMood = wx.getStorageSync(todayKey)

    this.setData({
      greeting: getGreeting(),
      weekday: getWeekday(),
      dateStr: `${now.getMonth() + 1}月${now.getDate()}日`,
    })

    if (savedMood) {
      const moodItem = this.data.moodList.find((m) => m.value === savedMood)
      if (moodItem) {
        this.setData({
          moodCheckedIn: true,
          selectedMood: savedMood,
          selectedMoodEmoji: moodItem.emoji,
          selectedMoodLabel: moodItem.label,
        })
      }
    }

    this.loadTodayData()
  },

  onShow() {
    const app = getApp()
    this.setData({
      coins: formatCoins(app.globalData.coins),
      streakDays: app.globalData.streakDays,
    })
  },

  // 加载今日数据
  async loadTodayData() {
    try {
      // TODO: 对接后端 API 后替换 mock 数据
      this.loadMockData()
    } catch (err) {
      console.error('加载今日数据失败:', err)
      this.loadMockData()
    }
  },

  // V2 Mock 数据 — 使用 createTask 工厂函数
  loadMockData() {
    const todayTasks = smartSort([
      createTask({
        title: '完成项目方案',
        description: '客户要的运营方案初稿',
        priority: 'urgent_important',
        energy: 'high',
        estimatedMinutes: 90,
        project: 'work',
        deadline: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        subtasks: [
          createSubtask({ title: '梳理需求要点', estimatedMinutes: 20 }),
          createSubtask({ title: '写大纲框架', estimatedMinutes: 30 }),
          createSubtask({ title: '填充内容细节', estimatedMinutes: 30 }),
          createSubtask({ title: '排版美化', estimatedMinutes: 10 }),
        ],
      }),
      createTask({
        title: 'Python 第8章',
        description: '看完教程 + 完成3道练习题',
        priority: 'important',
        energy: 'high',
        estimatedMinutes: 45,
        project: 'study',
        subtasks: [
          createSubtask({ title: '阅读教程内容', estimatedMinutes: 20 }),
          createSubtask({ title: '完成练习题1', estimatedMinutes: 8 }),
          createSubtask({ title: '完成练习题2', estimatedMinutes: 8 }),
          createSubtask({ title: '完成练习题3', estimatedMinutes: 9 }),
        ],
      }),
      createTask({
        title: '回复客户邮件',
        priority: 'urgent',
        energy: 'low',
        estimatedMinutes: 10,
        project: 'work',
      }),
      createTask({
        title: '整理书桌',
        description: '把桌面上的东西归位',
        priority: 'normal',
        energy: 'low',
        estimatedMinutes: 15,
        project: 'life',
      }),
      createTask({
        title: '跑步30分钟',
        priority: 'normal',
        energy: 'high',
        estimatedMinutes: 30,
        project: 'health',
      }),
    ])

    this.setData({
      todayTasks,
      coins: formatCoins(2350),
      streakDays: 23,
    })

    this.updateCapacity(todayTasks)
    this.updateProjectFilters(todayTasks)
    this.applyFilter()
  },

  // 更新今日容量
  updateCapacity(tasks) {
    const cap = getDailyCapacity(tasks, 360) // 建议6h
    this.setData({
      capacityText: formatMinutes(cap.scheduledMinutes) + ' / ' + formatMinutes(cap.capacityMinutes),
      capacityPercent: cap.percentage,
      capacityOverloaded: cap.overloaded,
    })
  },

  // 构建项目筛选标签
  updateProjectFilters(tasks) {
    const seen = {}
    const filters = [{ key: 'all', label: '全部', icon: '📋', color: '#7C5CFC', count: tasks.length }]
    tasks.forEach((t) => {
      const p = t.project
      if (!p || seen[p]) {
        if (p && seen[p]) seen[p].count++
        return
      }
      const info = getProjectInfo(p)
      seen[p] = { key: p, label: info.label, icon: info.icon, color: info.color, count: 1 }
      filters.push(seen[p])
    })
    this.setData({ projectFilters: filters })
  },

  // 应用项目筛选
  applyFilter() {
    const key = this.data.activeFilter
    const tasks = this.data.todayTasks
    if (key === 'all') {
      this.setData({ filteredTasks: tasks })
    } else {
      this.setData({ filteredTasks: tasks.filter((t) => t.project === key) })
    }
  },

  onFilterTap(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ activeFilter: key })
    this.applyFilter()
  },

  // 任务完成 -> 归档 + 金币
  onTaskComplete(e) {
    const { taskId } = e.detail
    const task = this.data.todayTasks.find((t) => t.id === taskId)
    if (!task) return

    const coinReward = task.coinReward || 0
    const todayTasks = this.data.todayTasks.filter((t) => t.id !== taskId)
    const completedTasks = [...this.data.completedTasks, { ...task, status: 'completed' }]

    const app = getApp()
    app.globalData.coins = (app.globalData.coins || 0) + coinReward
    wx.setStorageSync('coins', app.globalData.coins)

    this.setData({ todayTasks, completedTasks, coins: formatCoins(app.globalData.coins) })

    this.updateCapacity(todayTasks)
    this.updateProjectFilters(todayTasks)
    this.applyFilter()

    wx.vibrateShort({ type: 'medium' })
    wx.showToast({ title: `+${coinReward} 金币 ✨`, icon: 'none' })

    if (todayTasks.length === 0) {
      wx.showToast({ title: '今日任务全部完成 🎉', icon: 'none', duration: 2000 })
    }
  },

  // 子任务勾选
  onSubtaskToggle(e) {
    const { taskId, updatedTask } = e.detail
    const todayTasks = this.data.todayTasks.map((t) => t.id === taskId ? updatedTask : t)
    this.setData({ todayTasks })
    this.updateCapacity(todayTasks)
    this.applyFilter()
  },

  // 切换已完成列表
  toggleDoneList() {
    this.setData({ showDoneList: !this.data.showDoneList })
  },

  // 任务跳过
  onTaskSkip(e) {
    wx.showToast({ title: '换个角度想想看~', icon: 'none' })
  },

  // --- 输入 & 自然语言解析 ---

  onInput(e) {
    this.setData({ inputValue: e.detail.value })
  },

  // 发送 = 解析输入并弹出预览
  onSendMessage() {
    const content = this.data.inputValue.trim()
    if (!content) return

    const parsed = parseInput(content)
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
    const newTasks = this.data.previewTasks
    const todayTasks = smartSort([...this.data.todayTasks, ...newTasks])

    this.setData({
      todayTasks,
      showPreview: false,
      previewTasks: [],
      inputValue: '',
    })

    this.updateCapacity(todayTasks)
    this.updateProjectFilters(todayTasks)
    this.applyFilter()

    wx.showToast({ title: `已添加 ${newTasks.length} 个任务`, icon: 'none' })
  },

  // 取消预览
  onCancelPreview() {
    this.setData({ showPreview: false, previewTasks: [] })
  },

  // 删除预览中的某个任务
  onRemovePreviewTask(e) {
    const idx = e.currentTarget.dataset.index
    const previewTasks = this.data.previewTasks.filter((_, i) => i !== idx)
    if (previewTasks.length === 0) {
      this.setData({ showPreview: false, previewTasks: [] })
    } else {
      this.setData({ previewTasks })
    }
  },

  // --- 情绪签到 ---

  onMoodTap(e) {
    const { value, emoji, label } = e.currentTarget.dataset
    const now = new Date()
    const todayKey = `mood_${now.getFullYear()}_${now.getMonth()}_${now.getDate()}`

    wx.setStorageSync(todayKey, value)
    wx.vibrateShort({ type: 'medium' })

    this.setData({
      moodCheckedIn: true,
      selectedMood: value,
      selectedMoodEmoji: emoji,
      selectedMoodLabel: label,
    })

    // 低能量心情 -> 低能量任务前置
    if (['low', 'angry', 'stressed'].includes(value)) {
      const sorted = [...this.data.todayTasks].sort((a, b) => {
        const order = { low: 0, medium: 1, high: 2 }
        return (order[a.energy] || 1) - (order[b.energy] || 1)
      })
      this.setData({ todayTasks: sorted })
      this.applyFilter()
    }

    const moodResponses = {
      great: '状态超棒！来挑战高能量任务吧 💪',
      good: '状态不错，保持节奏 😊',
      normal: '做一件小事让自己开心一下 🌱',
      low: '今天对自己温柔一点，先从简单的开始 🤗',
      angry: '动动手做点整理，反而能平静下来 🧹',
      stressed: '先深呼吸，今天只做最重要的一件事 🌙',
    }
    wx.showToast({ title: moodResponses[value] || '记录好啦~', icon: 'none', duration: 2000 })
  },

  goToProfile() {
    wx.switchTab({ url: '/pages/profile/profile' })
  },
})
