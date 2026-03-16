// Wonderful Wrapped 周报
const { formatCoins } = require('../../utils/util')
const storage = require('../../utils/storage')

Page({
  data: {
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
    dailyBars: [],
    highlights: [],
    isGeneratingImage: false,
    showContent: false,
  },

  onLoad() {
    this.generateReport()
    setTimeout(() => {
      this.setData({ showContent: true })
    }, 300)
  },

  // 生成周报数据（使用真实本地数据）
  generateReport() {
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

    // 从 storage 获取真实统计数据
    const stats = storage.stats.get()
    const weeklyDaily = storage.stats.getWeeklyDailyCount()

    const streakDays = stats.streakDays
    const tasksCompleted = stats.weekCompleted
    const totalMinutes = stats.weekMinutes
    const weekCoins = stats.weekCoins || 0
    const completionRate = stats.completionRate

    // 每日完成数柱状图（真实数据）
    const dayNames = ['一', '二', '三', '四', '五', '六', '日']
    const maxCount = Math.max.apply(null, weeklyDaily.map(function (d) { return d.count }).concat([1]))
    const dailyBars = dayNames.map(function (name, i) {
      var dayData = weeklyDaily[i] || { count: 0 }
      return {
        day: name,
        count: dayData.count,
        height: Math.max(Math.round((dayData.count / maxCount) * 100), 8),
      }
    })

    // 本周亮点
    const highlights = this.generateHighlights(tasksCompleted, streakDays, completionRate)

    this.setData({
      weekNum: weekNum,
      dateRange: dateRange,
      stats: {
        tasksCompleted: tasksCompleted,
        totalCoins: weekCoins,
        streakDays: streakDays,
        completionRate: completionRate,
        bestTimeSlot: '待统计',
        totalMinutes: totalMinutes,
        beatPercent: 0,
      },
      dailyBars: dailyBars,
      highlights: highlights,
    })
  },

  // 生成本周亮点
  generateHighlights(tasks, streak, rate) {
    var highlights = []
    if (tasks > 0) highlights.push({ icon: '🏆', text: '本周完成了 ' + tasks + ' 个任务' })
    if (streak > 0) highlights.push({ icon: '🔥', text: '连续打卡 ' + streak + ' 天' })
    if (rate > 0) highlights.push({ icon: '📈', text: '总完成率 ' + rate + '%' })
    if (highlights.length === 0) {
      highlights.push({ icon: '🌱', text: '本周刚开始，加油！' })
    }
    return highlights.slice(0, 3)
  },

  onShareToMoments() {
    wx.showToast({ title: '长按保存图片分享', icon: 'none', duration: 2000 })
  },

  onShareAppMessage() {
    return {
      title: '我在 Wonderful 的第 ' + this.data.weekNum + ' 周，完成了 ' + this.data.stats.tasksCompleted + ' 个任务！',
      path: '/pages/index/index',
    }
  },

  goBack() {
    wx.navigateBack()
  },
})
