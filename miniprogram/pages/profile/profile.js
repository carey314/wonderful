// 个人中心页面
Page({
  data: {
    userInfo: {},
    useDays: 23,
    stats: {
      totalCompleted: 156,
      streakDays: 23,
      totalCoins: 2350,
      completionRate: 73,
    },
    badges: [
      { id: '1', icon: '🌱', name: '新芽', unlocked: true },
      { id: '2', icon: '🌿', name: '成长', unlocked: false },
      { id: '3', icon: '🌳', name: '参天', unlocked: false },
      { id: '4', icon: '⭐', name: '清零大师', unlocked: true },
      { id: '5', icon: '🏆', name: '终结拖延', unlocked: true },
      { id: '6', icon: '💎', name: '里程碑', unlocked: false },
    ],
    settings: {
      morningTime: '08:00',
      eveningTime: '21:00',
      aiStyle: '温暖朋友',
    },
    // 安全气囊
    airbag: {
      remaining: 2,     // 本月剩余次数
      total: 2,         // 每月总次数
      usedThisMonth: 0, // 本月已使用
      lastResetMonth: '', // 上次重置月份
    },
    showAirbagModal: false, // 是否显示气囊弹窗
  },

  onLoad() {
    const app = getApp()
    if (app.globalData.userInfo) {
      this.setData({ userInfo: app.globalData.userInfo })
    }
    this.loadAirbagData()
  },

  onShow() {
    this.loadAirbagData()
  },

  // 加载安全气囊数据
  loadAirbagData() {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${now.getMonth() + 1}`
    let airbag = wx.getStorageSync('airbagData') || {
      remaining: 2,
      total: 2,
      usedThisMonth: 0,
      lastResetMonth: currentMonth,
    }

    // 每月自动重置
    if (airbag.lastResetMonth !== currentMonth) {
      airbag = {
        remaining: 2,
        total: 2,
        usedThisMonth: 0,
        lastResetMonth: currentMonth,
      }
      wx.setStorageSync('airbagData', airbag)
    }

    this.setData({ airbag })
  },

  // 使用安全气囊
  useAirbag() {
    const airbag = { ...this.data.airbag }
    if (airbag.remaining <= 0) {
      wx.showToast({ title: '本月气囊已用完', icon: 'none' })
      return
    }

    airbag.remaining -= 1
    airbag.usedThisMonth += 1
    wx.setStorageSync('airbagData', airbag)

    this.setData({
      airbag,
      showAirbagModal: false,
    })

    wx.vibrateShort({ type: 'medium' })
    wx.showToast({ title: '气囊已激活，连续天数保住了！', icon: 'none', duration: 2500 })
  },

  // 显示/关闭气囊弹窗
  showAirbagInfo() {
    this.setData({ showAirbagModal: true })
  },

  closeAirbagModal() {
    this.setData({ showAirbagModal: false })
  },

  // 阻止弹窗穿透
  preventTap() {},

  // 设置项点击
  onSettingTap(e) {
    const key = e.currentTarget.dataset.key
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
          content: '不是逼自己变好，而是让自己觉得变好很爽。\n\n一个每天跟你聊两句的 AI 朋友，帮你想清楚最值得做的事。',
          showCancel: false,
          confirmText: '好的',
          confirmColor: '#FF8C42',
        })
        break
    }
  },

  // 选择提醒时间
  showTimePicker() {
    wx.showActionSheet({
      itemList: ['早上 7:00 / 晚上 21:00', '早上 8:00 / 晚上 21:30', '早上 9:00 / 晚上 22:00', '自定义时间'],
      success: (res) => {
        const times = [
          { morningTime: '07:00', eveningTime: '21:00' },
          { morningTime: '08:00', eveningTime: '21:30' },
          { morningTime: '09:00', eveningTime: '22:00' },
        ]
        if (res.tapIndex < 3) {
          this.setData({
            'settings.morningTime': times[res.tapIndex].morningTime,
            'settings.eveningTime': times[res.tapIndex].eveningTime,
          })
        }
        // TODO: 保存到后端
      },
    })
  },

  // 选择 AI 风格
  showStylePicker() {
    wx.showActionSheet({
      itemList: ['温暖朋友', '幽默段子手', '理性分析师'],
      success: (res) => {
        const styles = ['温暖朋友', '幽默段子手', '理性分析师']
        this.setData({ 'settings.aiStyle': styles[res.tapIndex] })
        // TODO: 保存到后端
      },
    })
  },

  // 跳转周报页面
  shareWeeklyReport() {
    wx.navigateTo({ url: '/pages/weekly-report/weekly-report' })
  },

  // 跳转搭子模式
  goToBuddy() {
    wx.navigateTo({ url: '/pages/buddy/buddy' })
  },
})
