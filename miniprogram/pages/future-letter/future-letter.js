// 未来信 - 给未来的自己写信
Page({
  data: {
    mode: 'write', // write | mailbox
    activeTab: 'pending', // pending | delivered

    // 写信
    letterContent: '',
    deliverDays: 7,
    deliverLabel: '7天',
    currentMood: '',
    todayStr: '',

    deliverOptions: [
      { days: 7, label: '1周后', emoji: '📅' },
      { days: 30, label: '1个月后', emoji: '🗓️' },
      { days: 90, label: '3个月后', emoji: '🌸' },
      { days: 180, label: '半年后', emoji: '🌻' },
      { days: 365, label: '1年后', emoji: '🎄' },
    ],

    moodOptions: [
      { emoji: '😊', label: '开心', value: 'happy' },
      { emoji: '😔', label: '低落', value: 'sad' },
      { emoji: '😤', label: '烦躁', value: 'angry' },
      { emoji: '😰', label: '焦虑', value: 'anxious' },
      { emoji: '🤔', label: '迷茫', value: 'confused' },
      { emoji: '💪', label: '充满干劲', value: 'motivated' },
    ],

    // 信箱
    pendingLetters: [],
    deliveredLetters: [],

    // 阅读弹窗
    showReadModal: false,
    readLetter: null,
  },

  onLoad() {
    const now = new Date()
    this.setData({
      todayStr: `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`,
    })
    this.loadLetters()
  },

  onShow() {
    this.loadLetters()
  },

  // 加载信件列表
  loadLetters() {
    const letters = wx.getStorageSync('futureLetters') || []
    const now = Date.now()

    const pendingLetters = []
    const deliveredLetters = []

    letters.forEach((letter) => {
      const deliverTime = letter.deliverTimestamp
      const writeTime = letter.writeTimestamp
      const totalDays = Math.ceil((deliverTime - writeTime) / 86400000)
      const passedDays = Math.ceil((now - writeTime) / 86400000)
      const remainDays = Math.max(0, Math.ceil((deliverTime - now) / 86400000))
      const progressPct = Math.min(100, (passedDays / totalDays) * 100)

      const moodEmoji = this.getMoodEmoji(letter.mood)
      const item = {
        ...letter,
        moodEmoji,
        remainDays,
        progressPct: Math.round(progressPct),
        preview: letter.content.substring(0, 50) + (letter.content.length > 50 ? '...' : ''),
      }

      if (now >= deliverTime) {
        deliveredLetters.push(item)
      } else {
        pendingLetters.push(item)
      }
    })

    this.setData({ pendingLetters, deliveredLetters })
  },

  getMoodEmoji(mood) {
    const map = {
      happy: '😊', sad: '😔', angry: '😤',
      anxious: '😰', confused: '🤔', motivated: '💪',
    }
    return map[mood] || '📝'
  },

  // 写信相关
  onContentInput(e) {
    this.setData({ letterContent: e.detail.value })
  },

  selectDeliver(e) {
    const days = e.currentTarget.dataset.days
    const option = this.data.deliverOptions.find((o) => o.days === days)
    this.setData({
      deliverDays: days,
      deliverLabel: option ? option.label : `${days}天`,
    })
  },

  selectMood(e) {
    this.setData({ currentMood: e.currentTarget.dataset.value })
    wx.vibrateShort({ type: 'light' })
  },

  // 发送（封存）信件
  sendLetter() {
    const { letterContent, deliverDays, currentMood, todayStr } = this.data
    if (!letterContent.trim() || !deliverDays) return

    const now = Date.now()
    const deliverTimestamp = now + deliverDays * 86400000
    const deliverDate = this.formatTimestamp(deliverTimestamp)

    const letter = {
      id: `letter_${now}`,
      content: letterContent.trim(),
      mood: currentMood || 'happy',
      writeDate: todayStr,
      deliverDate,
      writeTimestamp: now,
      deliverTimestamp,
      opened: false,
    }

    const letters = wx.getStorageSync('futureLetters') || []
    letters.push(letter)
    wx.setStorageSync('futureLetters', letters)

    wx.showToast({ title: '信已封存', icon: 'none' })
    wx.vibrateShort({ type: 'medium' })

    this.setData({
      letterContent: '',
      currentMood: '',
      deliverDays: 7,
      deliverLabel: '7天',
    })

    this.loadLetters()
  },

  formatTimestamp(ts) {
    const d = new Date(ts)
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
  },

  // 模式切换
  switchMode(e) {
    this.setData({ mode: e.currentTarget.dataset.mode })
  },

  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab })
  },

  // 打开已送达的信
  openLetter(e) {
    const id = e.currentTarget.dataset.id
    const letter = this.data.deliveredLetters.find((l) => l.id === id)
    if (!letter) return

    // 标记为已读
    const letters = wx.getStorageSync('futureLetters') || []
    const idx = letters.findIndex((l) => l.id === id)
    if (idx >= 0) {
      letters[idx].opened = true
      wx.setStorageSync('futureLetters', letters)
    }

    // 生成成长对比（简单版，后续可对接 AI）
    const daysPassed = Math.ceil((Date.now() - letter.writeTimestamp) / 86400000)
    const comparison = `这封信写于 ${daysPassed} 天前。当时的你心情是「${this.getMoodEmoji(letter.mood)}」。回头看看，你有没有变化呢？`

    this.setData({
      showReadModal: true,
      readLetter: { ...letter, comparison },
    })

    this.loadLetters()
  },

  closeReadModal() {
    this.setData({ showReadModal: false, readLetter: null })
  },
})
