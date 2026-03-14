// 搭子模式 - 匿名互助打卡
const { formatCoins } = require('../../utils/util')

Page({
  data: {
    // 是否已匹配搭子
    hasMatch: false,
    // 搭子匹配中动画
    isMatching: false,
    // 目标类型选项
    goalTypes: [
      { id: 'study', icon: '📚', label: '学习', selected: false },
      { id: 'fitness', icon: '💪', label: '运动', selected: false },
      { id: 'early_rise', icon: '🌅', label: '早起', selected: false },
      { id: 'reading', icon: '📖', label: '阅读', selected: false },
      { id: 'coding', icon: '💻', label: '写代码', selected: false },
      { id: 'saving', icon: '💰', label: '存钱', selected: false },
    ],
    selectedGoal: null,
    // 搭子信息（mock）
    buddy: {
      nickname: '匿名搭子',
      avatar: '🧑‍🚀',
      goalType: '学习',
      todayDone: false,
      streakDays: 5,
    },
    // 我的状态
    myStatus: {
      todayDone: false,
      streakDays: 0,
    },
    // 双方都完成 = 双倍金币
    bothDone: false,
    bonusCoins: 0,
    // 历史搭子记录
    buddyHistory: [],
    // 鼓励消息
    encourageMsg: '',
  },

  onLoad() {
    this.loadBuddyData()
  },

  // 加载搭子数据
  loadBuddyData() {
    const buddyData = wx.getStorageSync('buddyData')
    if (buddyData && buddyData.hasMatch) {
      // 检查今日打卡状态
      const today = new Date().toDateString()
      const myDoneToday = buddyData.myLastCheckin === today
      const buddyDoneToday = this.mockBuddyCheckin()

      this.setData({
        hasMatch: true,
        selectedGoal: buddyData.selectedGoal,
        buddy: {
          ...buddyData.buddy,
          todayDone: buddyDoneToday,
        },
        myStatus: {
          todayDone: myDoneToday,
          streakDays: buddyData.myStreakDays || 0,
        },
        bothDone: myDoneToday && buddyDoneToday,
      })

      this.updateEncourageMsg(myDoneToday, buddyDoneToday)
    }
  },

  // 选择目标类型
  onGoalSelect(e) {
    const { id } = e.currentTarget.dataset
    const goalTypes = this.data.goalTypes.map(g => ({
      ...g,
      selected: g.id === id,
    }))
    const selected = goalTypes.find(g => g.id === id)
    this.setData({
      goalTypes,
      selectedGoal: selected,
    })
  },

  // 开始匹配搭子
  startMatching() {
    if (!this.data.selectedGoal) {
      wx.showToast({ title: '先选一个目标类型吧', icon: 'none' })
      return
    }

    this.setData({ isMatching: true })
    wx.vibrateShort({ type: 'medium' })

    // 模拟匹配过程（MVP mock）
    setTimeout(() => {
      const mockBuddies = [
        { nickname: '匿名搭子', avatar: '🧑‍🚀', streakDays: 5 },
        { nickname: '匿名搭子', avatar: '🦊', streakDays: 12 },
        { nickname: '匿名搭子', avatar: '🐳', streakDays: 3 },
        { nickname: '匿名搭子', avatar: '🦋', streakDays: 8 },
        { nickname: '匿名搭子', avatar: '🐼', streakDays: 15 },
      ]
      const randomBuddy = mockBuddies[Math.floor(Math.random() * mockBuddies.length)]

      const buddyData = {
        hasMatch: true,
        selectedGoal: this.data.selectedGoal,
        buddy: {
          ...randomBuddy,
          goalType: this.data.selectedGoal.label,
          todayDone: false,
        },
        myStreakDays: 0,
        myLastCheckin: '',
      }

      wx.setStorageSync('buddyData', buddyData)

      this.setData({
        isMatching: false,
        hasMatch: true,
        buddy: buddyData.buddy,
        myStatus: { todayDone: false, streakDays: 0 },
        encourageMsg: '搭子已就位！一起加油吧 💪',
      })

      wx.vibrateShort({ type: 'heavy' })
    }, 2000)
  },

  // 今日打卡
  onCheckin() {
    if (this.data.myStatus.todayDone) return

    const today = new Date().toDateString()
    const buddyData = wx.getStorageSync('buddyData') || {}
    const newStreak = (buddyData.myStreakDays || 0) + 1

    buddyData.myLastCheckin = today
    buddyData.myStreakDays = newStreak
    wx.setStorageSync('buddyData', buddyData)

    const buddyDone = this.data.buddy.todayDone
    const bothDone = buddyDone
    const bonusCoins = bothDone ? 20 : 0

    // 发放金币
    if (bothDone) {
      const app = getApp()
      app.globalData.coins = (app.globalData.coins || 0) + bonusCoins
      wx.setStorageSync('coins', app.globalData.coins)
    }

    this.setData({
      'myStatus.todayDone': true,
      'myStatus.streakDays': newStreak,
      bothDone,
      bonusCoins,
    })

    this.updateEncourageMsg(true, buddyDone)
    wx.vibrateShort({ type: 'heavy' })

    if (bothDone) {
      wx.showToast({ title: `双人达成！+${bonusCoins} 金币`, icon: 'none' })
    } else {
      wx.showToast({ title: '打卡成功！等搭子跟上', icon: 'none' })
    }
  },

  // 更换搭子
  changeBuddy() {
    wx.showModal({
      title: '更换搭子',
      content: '确定要更换搭子吗？当前搭子的互助记录会保留。',
      confirmColor: '#7C5CFC',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('buddyData')
          this.setData({
            hasMatch: false,
            selectedGoal: null,
            bothDone: false,
            goalTypes: this.data.goalTypes.map(g => ({ ...g, selected: false })),
          })
        }
      },
    })
  },

  // mock 搭子是否完成（随机概率，MVP阶段）
  mockBuddyCheckin() {
    const hour = new Date().getHours()
    // 下午和晚上搭子更可能已完成
    return Math.random() < (hour > 14 ? 0.7 : 0.3)
  },

  // 根据状态更新鼓励消息
  updateEncourageMsg(myDone, buddyDone) {
    let msg = ''
    if (myDone && buddyDone) {
      msg = '你们都完成了！默契满分 🎉'
    } else if (myDone && !buddyDone) {
      msg = '你先完成了！搭子还在努力中...'
    } else if (!myDone && buddyDone) {
      msg = '搭子已经打卡了，别落后哦！'
    } else {
      msg = '新的一天，一起开始吧 ☀️'
    }
    this.setData({ encourageMsg: msg })
  },
})
