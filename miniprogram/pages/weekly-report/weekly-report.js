// Wonderful Wrapped 周报
const { formatCoins } = require('../../utils/util')

Page({
  data: {
    // 周报数据
    weekNum: 0,
    dateRange: '',
    stats: {
      tasksCompleted: 0,
      totalCoins: 0,
      streakDays: 0,
      completionRate: 0,
      bestTimeSlot: '',
      totalMinutes: 0,
      beatPercent: 0,
    },
    // 每日完成数（用于迷你柱状图）
    dailyBars: [],
    // 本周亮点
    highlights: [],
    // 分享图生成状态
    isGeneratingImage: false,
    // 显示渲染完成动画
    showContent: false,
  },

  onLoad() {
    this.generateReport()
    // 延迟显示内容，制造入场效果
    setTimeout(() => {
      this.setData({ showContent: true })
    }, 300)
  },

  // 生成周报数据（MVP 用本地累计数据 + mock）
  generateReport() {
    const app = getApp()
    const now = new Date()

    // 计算本周是第几周
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const weekNum = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7)

    // 计算本周日期范围
    const dayOfWeek = now.getDay() || 7
    const monday = new Date(now)
    monday.setDate(now.getDate() - dayOfWeek + 1)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const dateRange = `${monday.getMonth() + 1}.${monday.getDate()} - ${sunday.getMonth() + 1}.${sunday.getDate()}`

    // 从本地存储获取真实数据
    const streakDays = app.globalData.streakDays || wx.getStorageSync('streakDays') || 0
    const totalCoins = app.globalData.coins || wx.getStorageSync('coins') || 0

    // Mock 补充数据（后续对接后端替换）
    const tasksCompleted = Math.floor(Math.random() * 8) + 8
    const totalPlanned = tasksCompleted + Math.floor(Math.random() * 4) + 1
    const completionRate = Math.round((tasksCompleted / totalPlanned) * 100)
    const totalMinutes = tasksCompleted * (20 + Math.floor(Math.random() * 25))
    const beatPercent = Math.min(95, Math.floor(Math.random() * 30) + 60)

    const timeSlots = ['上午 9-11点', '下午 2-4点', '晚上 8-10点', '上午 10-12点']
    const bestTimeSlot = timeSlots[Math.floor(Math.random() * timeSlots.length)]

    // 每日完成数（模拟 7 天柱状图数据）
    const dayNames = ['一', '二', '三', '四', '五', '六', '日']
    const dailyBars = dayNames.map((name, i) => {
      const count = i < dayOfWeek ? Math.floor(Math.random() * 4) + 1 : 0
      return { day: name, count, height: Math.max(count * 25, 8) }
    })

    // 本周亮点
    const highlights = this.generateHighlights(tasksCompleted, streakDays, completionRate)

    this.setData({
      weekNum,
      dateRange,
      stats: {
        tasksCompleted,
        totalCoins: Math.floor(totalCoins * 0.3) + Math.floor(Math.random() * 100),
        streakDays,
        completionRate,
        bestTimeSlot,
        totalMinutes,
        beatPercent,
      },
      dailyBars,
      highlights,
    })
  },

  // 生成本周亮点
  generateHighlights(tasks, streak, rate) {
    const all = [
      { icon: '🏆', text: `完成了 ${tasks} 个任务，你太能干了` },
      { icon: '🔥', text: `连续打卡 ${streak} 天，稳如老狗` },
      { icon: '📈', text: `完成率 ${rate}%，持续进步中` },
      { icon: '⚡', text: `效率提升，平均每个任务越来越快` },
      { icon: '💪', text: `打败了大部分用户，你就是卷王` },
    ]
    // 随机选3条
    return all.sort(() => Math.random() - 0.5).slice(0, 3)
  },

  // 分享到朋友圈
  onShareToMoments() {
    wx.showToast({ title: '长按保存图片分享', icon: 'none', duration: 2000 })
    // TODO: 用 canvas 生成分享图片
    // MVP 阶段提示用户截图分享
  },

  // 微信好友分享
  onShareAppMessage() {
    return {
      title: `我在 Wonderful 的第 ${this.data.weekNum} 周，完成了 ${this.data.stats.tasksCompleted} 个任务！`,
      path: '/pages/index/index',
    }
  },

  // 返回
  goBack() {
    wx.navigateBack()
  },
})
