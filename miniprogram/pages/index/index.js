// 首页 - AI 对话界面（年轻化版本）
const api = require('../../utils/api')
const { getGreeting, getWeekday, formatCoins } = require('../../utils/util')

Page({
  data: {
    greeting: '',
    weekday: '',
    dateStr: '',
    coins: 0,
    streakDays: 0,
    messages: [],
    todayTasks: [],       // 待完成
    completedTasks: [],   // 已归档
    actionButtons: [],
    showActions: false,
    showDoneList: false,
    inputValue: '',
    // 情绪签到
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

    // 恢复今日已签到状态
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

  // Mock 数据
  loadMockData() {
    const hour = new Date().getHours()
    const isMorning = hour < 14

    const morningMessages = [
      {
        id: 'msg_1',
        type: 'ai',
        content: '昨天你说要整理房间，但一直没动。我猜你可能觉得太麻烦不知道从哪开始？\n\n要不这样——今天就收拾书桌就好，大概 15 分钟的事。收拾完了今天的奶茶钱就出来了 ☕',
        timestamp: '08:00',
      },
    ]

    const eveningMessages = [
      {
        id: 'msg_e1',
        type: 'ai',
        content: '今天辛苦了 🌙\n\n来看看今天的收获吧——',
        timestamp: '21:00',
      },
    ]

    const todayTasks = [
      {
        id: 'task_1',
        title: '整理书桌',
        description: '把桌面上的东西归位，大概15分钟',
        priority: 'important',
        energy: 'low',
        estimatedMinutes: 15,
        coinReward: 30,
        status: 'pending',
      },
      {
        id: 'task_2',
        title: 'Python 第8章',
        description: '看完教程 + 完成3道练习题',
        priority: 'important',
        energy: 'high',
        estimatedMinutes: 45,
        coinReward: 50,
        status: 'pending',
      },
      {
        id: 'task_3',
        title: '回复邮件',
        description: '回复3封待处理的邮件',
        priority: 'urgent',
        energy: 'low',
        estimatedMinutes: 10,
        coinReward: 20,
        status: 'pending',
      },
    ]

    const actionButtons = isMorning
      ? [
          { label: '就这样', emoji: '👌', action: 'accept', type: 'primary' },
          { label: '调整一下', emoji: '✏️', action: 'adjust', type: 'secondary' },
          { label: '今天有别的事', emoji: '💬', action: 'other', type: 'muted' },
        ]
      : [
          { label: '开始复盘', emoji: '📊', action: 'review', type: 'primary' },
          { label: '今天太累了', emoji: '😴', action: 'skip_review', type: 'muted' },
        ]

    this.setData({
      messages: isMorning ? morningMessages : eveningMessages,
      todayTasks,
      actionButtons,
      showActions: true,
      coins: formatCoins(2350),
      streakDays: 23,
    })
  },

  // 任务完成 → 从待办移到已归档
  onTaskComplete(e) {
    const { taskId } = e.detail
    const task = this.data.todayTasks.find((t) => t.id === taskId)
    if (!task) return

    const coinReward = task.coinReward || 0
    const todayTasks = this.data.todayTasks.filter((t) => t.id !== taskId)
    const completedTasks = [...this.data.completedTasks, { ...task, status: 'completed' }]

    // 更新金币
    const app = getApp()
    app.globalData.coins = (app.globalData.coins || 0) + coinReward
    wx.setStorageSync('coins', app.globalData.coins)

    this.setData({
      todayTasks,
      completedTasks,
      coins: formatCoins(app.globalData.coins),
    })

    wx.vibrateShort({ type: 'medium' })
    wx.showToast({ title: `+${coinReward} 金币 ✨`, icon: 'none' })

    // 所有任务完成时给个鼓励
    if (todayTasks.length === 0) {
      setTimeout(() => {
        this.addAIMessage('今天的任务全部完成了！你太棒了 🎉\n\n奖励自己一下吧，你值得的~')
      }, 1000)
    }
  },

  // 切换已完成列表显示
  toggleDoneList() {
    this.setData({ showDoneList: !this.data.showDoneList })
  },

  // 任务跳过（不想做）-> 触发思维转换
  onTaskSkip(e) {
    this.addAIMessage('这个任务不想做？没关系，换个角度想想看——\n\n整理书桌不是在"收拾"，是在给自己的大脑腾空间。桌面干净了，脑子也跟着清爽。\n\n要不就 5 分钟？5 分钟做完算你赢 💪')
  },

  // 操作按钮点击
  onActionTap(e) {
    const { action } = e.currentTarget.dataset
    this.setData({ showActions: false })

    switch (action) {
      case 'accept':
        this.addAIMessage('好的！那就按这个来，今天轻松搞定。\n\n建议先从「整理书桌」开始，因为它最快，完成了心情好，后面就顺了 😊')
        break
      case 'adjust':
        this.addAIMessage('好，你想怎么调整？\n\n可以告诉我今天的状态，我帮你重新安排 🤔')
        break
      case 'other':
        this.addAIMessage('没问题！今天有什么事要处理？\n\n跟我说说，我帮你规划一下 📋')
        break
      case 'review':
        this.addAIMessage('来看看今天的成果！\n\n✅ 整理书桌 +30金币\n✅ Python第8章 +50金币\n❌ 回复邮件\n\n"回复邮件"已经连续2天没做了。要不要明天第一个做掉？\n\n今日收获: 80金币 🎉')
        break
      case 'skip_review':
        this.addAIMessage('累了就好好休息，明天又是新的一天。\n\n晚安 🌙 明天见~')
        break
    }
  },

  // 添加 AI 消息
  addAIMessage(content) {
    const now = new Date()
    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    const messages = [
      ...this.data.messages,
      { id: `msg_${Date.now()}`, type: 'ai', content, timestamp },
    ]
    this.setData({ messages })
  },

  onInput(e) {
    this.setData({ inputValue: e.detail.value })
  },

  // 发送用户消息
  onSendMessage() {
    const content = this.data.inputValue.trim()
    if (!content) return

    const now = new Date()
    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    const messages = [
      ...this.data.messages,
      { id: `msg_${Date.now()}`, type: 'user', content, timestamp },
    ]
    this.setData({ messages, inputValue: '' })

    setTimeout(() => {
      this.addAIMessage('AI 对话功能即将上线，敬请期待 🚀')
    }, 500)
  },

  // 情绪签到
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

    // 根据心情调整任务推荐和 AI 回复
    const moodResponses = {
      great: '今天状态超棒！趁着好心情，来挑战一个高能量任务吧 💪',
      good: '状态不错呢，保持节奏，今天一定很顺利 😊',
      normal: '平平淡淡也是一天，做一件小事让自己开心一下？🌱',
      low: '有点低落没关系，今天对自己温柔一点。先从最简单的任务开始 🤗',
      angry: '烦躁的时候做点整理类的事情，动动手反而能平静下来 🧹',
      stressed: '压力大的时候，先深呼吸三次。今天只做最重要的一件事就好 🌙',
    }

    // 低能量心情 → 调整任务排序，把低能量任务前置
    if (['low', 'angry', 'stressed'].includes(value)) {
      const sorted = [...this.data.todayTasks].sort((a, b) => {
        const order = { low: 0, medium: 1, high: 2 }
        return (order[a.energy] || 1) - (order[b.energy] || 1)
      })
      this.setData({ todayTasks: sorted })
    }

    setTimeout(() => {
      this.addAIMessage(moodResponses[value] || '记录好啦，今天也要加油哦~')
    }, 500)
  },

  goToProfile() {
    wx.switchTab({ url: '/pages/profile/profile' })
  },
})
