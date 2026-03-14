// 任务卡片列表页
const { priorityMap } = require('../../utils/util')

Page({
  data: {
    viewMode: 'list', // list | quadrant
    activeFilter: 'all',
    filters: [
      { label: '全部', value: 'all' },
      { label: '今日', value: 'today' },
      { label: '本周', value: 'week' },
      { label: '长期目标', value: 'longterm' },
      { label: '自我提升', value: 'growth' },
      { label: '工作', value: 'work' },
    ],
    pendingTasks: [],
    completedTasks: [],
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
    const allTasks = [
      {
        id: '1',
        title: '学完 Python 基础课程',
        description: '第8章 + 3道练习题',
        priority: 'important',
        energy: 'high',
        estimatedMinutes: 45,
        coinReward: 50,
        status: 'pending',
        category: 'growth',
        progress: 78,
        streakDays: 12,
        dueDate: '3月31日',
      },
      {
        id: '2',
        title: '写完项目方案书',
        description: '标题+三个要点，先不管格式',
        priority: 'urgent_important',
        energy: 'high',
        estimatedMinutes: 60,
        coinReward: 85,
        status: 'pending',
        category: 'work',
        progress: 30,
        dueDate: '明天',
      },
      {
        id: '3',
        title: '回复3封邮件',
        description: '待处理的客户邮件',
        priority: 'urgent',
        energy: 'low',
        estimatedMinutes: 15,
        coinReward: 20,
        status: 'pending',
        category: 'work',
      },
      {
        id: '4',
        title: '每天跑步30分钟',
        description: '今天至少跑2公里',
        priority: 'normal',
        energy: 'medium',
        estimatedMinutes: 30,
        coinReward: 35,
        status: 'pending',
        category: 'health',
        streakDays: 5,
      },
      {
        id: '5',
        title: '整理书桌',
        description: '清理桌面，物品归位',
        priority: 'normal',
        energy: 'low',
        estimatedMinutes: 15,
        coinReward: 30,
        status: 'completed',
        category: 'life',
      },
    ]

    const pendingTasks = allTasks.filter((t) => t.status === 'pending')
    const completedTasks = allTasks.filter((t) => t.status === 'completed')

    // 按四象限分类
    const quadrantTasks = {
      urgentImportant: allTasks.filter((t) => t.priority === 'urgent_important' && t.status === 'pending'),
      important: allTasks.filter((t) => t.priority === 'important' && t.status === 'pending'),
      urgent: allTasks.filter((t) => t.priority === 'urgent' && t.status === 'pending'),
      normal: allTasks.filter((t) => t.priority === 'normal' && t.status === 'pending'),
    }

    this.setData({ pendingTasks, completedTasks, quadrantTasks })
  },

  // 切换视图模式
  switchView(e) {
    const mode = e.currentTarget.dataset.mode
    this.setData({ viewMode: mode })
  },

  // 筛选标签点击
  onFilterTap(e) {
    const filter = e.currentTarget.dataset.filter
    this.setData({ activeFilter: filter })
    // TODO: 根据筛选条件重新加载数据
  },

  // 任务完成
  onTaskComplete(e) {
    const { taskId } = e.detail
    const task = this.data.pendingTasks.find((t) => t.id === taskId)
    if (!task) return

    const pendingTasks = this.data.pendingTasks.filter((t) => t.id !== taskId)
    const completedTasks = [...this.data.completedTasks, { ...task, status: 'completed' }]
    this.setData({ pendingTasks, completedTasks })

    wx.vibrateShort({ type: 'medium' })
    wx.showToast({ title: `+${task.coinReward} 金币 🎉`, icon: 'none' })
  },

  // 点击任务详情
  onTaskDetail(e) {
    const id = e.detail?.taskId || e.currentTarget.dataset.id
    // TODO: 跳转到任务详情页
    wx.showToast({ title: '任务详情开发中', icon: 'none' })
  },

  // 添加新任务
  onAddTask() {
    // TODO: 跳转到创建任务页面
    wx.showToast({ title: '创建任务开发中', icon: 'none' })
  },
})
