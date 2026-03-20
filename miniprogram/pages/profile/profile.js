// 个人中心页面
var storage = require('../../utils/storage')
var api = require('../../utils/api')

Page({
  data: {
    userInfo: {},
    useDays: 1,
    isLoggedIn: false,
    loginStatusText: '',
    stats: {
      totalCompleted: 0,
      streakDays: 0,
      totalCoins: 0,
      completionRate: 0,
    },
    badges: [
      { id: '1', icon: '🌱', name: '新芽', unlocked: true },
      { id: '2', icon: '🌿', name: '成长', unlocked: false },
      { id: '3', icon: '🌳', name: '参天', unlocked: false },
      { id: '4', icon: '⭐', name: '清零大师', unlocked: false },
      { id: '5', icon: '🏆', name: '终结拖延', unlocked: false },
      { id: '6', icon: '💎', name: '里程碑', unlocked: false },
    ],
    settings: {
      morningTime: '08:00',
      eveningTime: '21:00',
      aiStyle: '温暖朋友',
    },
    // 安全气囊
    airbag: {
      remaining: 2,
      total: 2,
      usedThisMonth: 0,
      lastResetMonth: '',
    },
    showAirbagModal: false,
  },

  onLoad() {
    var app = getApp()
    if (app.globalData.userInfo) {
      this.setData({ userInfo: app.globalData.userInfo })
    }
    this.loadStats()
    this.loadSettings()
    this.loadAirbagData()
  },

  onShow() {
    this.loadStats()
    this.loadAirbagData()
    this.updateLoginStatus()
  },

  updateLoginStatus() {
    var token = wx.getStorageSync('token')
    this.setData({
      isLoggedIn: !!token,
      loginStatusText: token ? '已登录' : '离线模式',
    })
  },

  // 加载统计数据：API 优先 + 本地补充
  loadStats() {
    var self = this
    var stats = storage.stats.get()
    var userInfo = wx.getStorageSync('userInfo')
    var createdAt = userInfo && userInfo.createdAt ? userInfo.createdAt : Date.now()
    var useDays = Math.max(1, Math.ceil((Date.now() - createdAt) / 86400000))

    // 先展示本地数据，同时更新徽章
    self.setData({
      useDays: useDays,
      stats: {
        totalCompleted: stats.totalCompleted,
        streakDays: stats.streakDays,
        totalCoins: stats.totalCoins,
        completionRate: stats.completionRate,
      },
    })
    self.updateBadges(stats)

    // 尝试从 API 获取最新用户信息
    api.user.getProfile().then(function (profile) {
      self.setData({
        userInfo: profile,
        'stats.totalCoins': profile.coins || stats.totalCoins,
        'stats.streakDays': profile.streak_days || stats.streakDays,
      })
    }).catch(function () {})
  },

  // 加载设置
  loadSettings() {
    var settings = storage.settings.get()
    this.setData({
      'settings.morningTime': settings.morningTime || '08:00',
      'settings.eveningTime': settings.eveningTime || '21:00',
      'settings.aiStyle': settings.aiStyle || '温暖朋友',
    })
  },

  // 根据统计数据更新徽章解锁状态
  updateBadges(stats) {
    if (!stats) stats = storage.stats.get()
    var badges = this.data.badges.map(function (b) {
      var unlocked = false
      switch (b.id) {
        case '1': unlocked = true; break // 新芽：注册即解锁
        case '2': unlocked = stats.totalCompleted >= 10; break // 成长：完成10个任务
        case '3': unlocked = stats.totalCompleted >= 100; break // 参天：完成100个任务
        case '4': unlocked = stats.streakDays >= 7; break // 清零大师：连续7天
        case '5': unlocked = stats.streakDays >= 30; break // 终结拖延：连续30天
        case '6': unlocked = stats.totalCoins >= 1000; break // 里程碑：累计1000金币
      }
      return Object.assign({}, b, { unlocked: unlocked })
    })
    this.setData({ badges: badges })
  },

  // 加载安全气囊数据
  loadAirbagData() {
    var now = new Date()
    var currentMonth = now.getFullYear() + '-' + (now.getMonth() + 1)
    var airbag = wx.getStorageSync('airbagData') || {
      remaining: 2,
      total: 2,
      usedThisMonth: 0,
      lastResetMonth: currentMonth,
    }

    if (airbag.lastResetMonth !== currentMonth) {
      airbag = {
        remaining: 2,
        total: 2,
        usedThisMonth: 0,
        lastResetMonth: currentMonth,
      }
      wx.setStorageSync('airbagData', airbag)
    }

    this.setData({ airbag: airbag })
  },

  // 使用安全气囊
  useAirbag() {
    var airbag = Object.assign({}, this.data.airbag)
    if (airbag.remaining <= 0) {
      wx.showToast({ title: '本月气囊已用完', icon: 'none' })
      return
    }

    airbag.remaining -= 1
    airbag.usedThisMonth += 1
    wx.setStorageSync('airbagData', airbag)

    this.setData({
      airbag: airbag,
      showAirbagModal: false,
    })

    wx.vibrateShort({ type: 'medium' })
    wx.showToast({ title: '气囊已激活，连续天数保住了！', icon: 'none', duration: 2500 })
  },

  showAirbagInfo() {
    this.setData({ showAirbagModal: true })
  },

  closeAirbagModal() {
    this.setData({ showAirbagModal: false })
  },

  preventTap() {},

  // 设置项点击
  onSettingTap(e) {
    var key = e.currentTarget.dataset.key
    switch (key) {
      case 'reminder':
        this.showTimePicker()
        break
      case 'style':
        this.showStylePicker()
        break
      case 'share':
        this.shareWeeklyReport()
        break
      case 'about':
        wx.showModal({
          title: 'Wonderful',
          content: '不是逼自己变好，而是让自己觉得变好很爽。\n\n一个帮你整理思路、管理任务的成长工具。',
          showCancel: false,
          confirmText: '好的',
          confirmColor: '#7C5CFC',
        })
        break
    }
  },

  // 选择提醒时间
  showTimePicker() {
    var self = this
    wx.showActionSheet({
      itemList: ['早上 7:00 / 晚上 21:00', '早上 8:00 / 晚上 21:30', '早上 9:00 / 晚上 22:00', '自定义时间'],
      success: function (res) {
        var times = [
          { morningTime: '07:00', eveningTime: '21:00' },
          { morningTime: '08:00', eveningTime: '21:30' },
          { morningTime: '09:00', eveningTime: '22:00' },
        ]
        if (res.tapIndex < 3) {
          self.setData({
            'settings.morningTime': times[res.tapIndex].morningTime,
            'settings.eveningTime': times[res.tapIndex].eveningTime,
          })
          storage.settings.update({
            morningTime: times[res.tapIndex].morningTime,
            eveningTime: times[res.tapIndex].eveningTime,
          })
        }
      },
    })
  },

  // 选择 AI 风格
  showStylePicker() {
    var self = this
    wx.showActionSheet({
      itemList: ['温暖朋友', '幽默段子手', '理性分析师'],
      success: function (res) {
        var styles = ['温暖朋友', '幽默段子手', '理性分析师']
        self.setData({ 'settings.aiStyle': styles[res.tapIndex] })
        storage.settings.update({ aiStyle: styles[res.tapIndex] })
      },
    })
  },

  shareWeeklyReport() {
    wx.navigateTo({ url: '/pages/weekly-report/weekly-report' })
  },

  goToBuddy() {
    wx.navigateTo({ url: '/pages/buddy/buddy' })
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后需要重新登录，确定退出吗？',
      confirmText: '退出',
      confirmColor: '#FF6B9D',
      success: function (res) {
        if (res.confirm) {
          var app = getApp()
          app.logout()
          wx.reLaunch({ url: '/pages/login/login' })
        }
      },
    })
  },
})
