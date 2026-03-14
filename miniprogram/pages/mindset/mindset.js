// 思维转换库页面
Page({
  data: {
    activeCategory: 'all',
    categories: [
      { icon: '✨', label: '全部', value: 'all' },
      { icon: '💼', label: '工作', value: 'work' },
      { icon: '📚', label: '学习', value: 'study' },
      { icon: '💪', label: '健康', value: 'health' },
      { icon: '🏠', label: '生活', value: 'life' },
      { icon: '⭐', label: '收藏', value: 'collected' },
    ],
    shifts: [],
    showGenerateModal: false,
    generateInput: '',
    generatedShift: '',
  },

  onLoad() {
    this.loadShifts()
  },

  // 加载思维转换列表
  loadShifts() {
    // TODO: 对接后端 API，目前使用预设库
    const shifts = [
      {
        id: '1',
        category: 'work',
        original: '上班好累不想去',
        reframed: '今天上班 8 小时 = 赚了大概 400 块。其中 128 块是今晚的海底捞。所以你不是在"上班"，你是在"吃海底捞"。',
        likes: 2341,
        liked: false,
        collected: false,
      },
      {
        id: '2',
        category: 'study',
        original: '学习好无聊',
        reframed: '学会这个 = 简历多一行 = 面试多一个选择 = 不爽的时候多一个退路。你不是在"学习"，你是在给自己攒"去你的"基金。',
        likes: 1892,
        liked: false,
        collected: false,
      },
      {
        id: '3',
        category: 'health',
        original: '不想运动太累了',
        reframed: '你今天不想跑步，60 岁的你会花多少钱买一副能跑步的膝盖？现在跑 30 分钟，这投资回报率，巴菲特看了都眼红。',
        likes: 1756,
        liked: false,
        collected: false,
      },
      {
        id: '4',
        category: 'life',
        original: '不想存钱没意思',
        reframed: '现在存 100 块 = 失业时多一天不慌。你不是在"存钱"，你是在给未来的自己买保险。这保险不要钱，只要你今天少点一杯奶茶。',
        likes: 1234,
        liked: false,
        collected: false,
      },
      {
        id: '5',
        category: 'work',
        original: '写文档好无聊',
        reframed: '每写一份文档 = 未来有一天被问到时，你可以说"文档里写了"而不是加班补。你现在写的每个字，都是在给未来的自己省时间。',
        likes: 987,
        liked: false,
        collected: false,
      },
      {
        id: '6',
        category: 'study',
        original: '不想学英语',
        reframed: '多会一种语言 = 世界大了一倍。Netflix 不用看字幕的快乐，你值得拥有。而且出国旅游点菜不用看图了。',
        likes: 1567,
        liked: false,
        collected: false,
      },
      {
        id: '7',
        category: 'health',
        original: '不想早起',
        reframed: '别人还在睡，你已经多活了 2 小时。这是你偷来的时间，谁都拿不走。用这 2 小时做点自己喜欢的事，比睡懒觉爽多了。',
        likes: 2100,
        liked: false,
        collected: false,
      },
      {
        id: '8',
        category: 'work',
        original: '开会好烦',
        reframed: '开会 = 带薪听八卦 + 免费空调 + 不用写代码。这样一想还行？而且你还能观察谁在划水——给自己攒点职场经验。',
        likes: 1423,
        liked: false,
        collected: false,
      },
    ]

    this.setData({ shifts })
  },

  // 切换分类
  onCategoryTap(e) {
    const value = e.currentTarget.dataset.value
    this.setData({ activeCategory: value })
    // TODO: 筛选对应分类
  },

  // 点赞
  onLike(e) {
    const id = e.currentTarget.dataset.id
    const shifts = this.data.shifts.map((s) => {
      if (s.id === id) {
        return {
          ...s,
          liked: !s.liked,
          likes: s.liked ? s.likes - 1 : s.likes + 1,
        }
      }
      return s
    })
    this.setData({ shifts })
  },

  // 收藏
  onCollect(e) {
    const id = e.currentTarget.dataset.id
    const shifts = this.data.shifts.map((s) => {
      if (s.id === id) {
        return { ...s, collected: !s.collected }
      }
      return s
    })
    this.setData({ shifts })
    wx.showToast({
      title: shifts.find((s) => s.id === id).collected ? '已收藏' : '已取消收藏',
      icon: 'none',
    })
  },

  // 分享金句卡片
  onShare(e) {
    const id = e.currentTarget.dataset.id
    const shift = this.data.shifts.find((s) => s.id === id)
    if (!shift) return

    // TODO: 使用 Canvas 生成金句分享卡片图片
    wx.showToast({ title: '分享卡片开发中', icon: 'none' })
  },

  // 打开 AI 生成弹窗
  onGenerate() {
    this.setData({
      showGenerateModal: true,
      generateInput: '',
      generatedShift: '',
    })
  },

  // 关闭弹窗
  closeModal() {
    this.setData({ showGenerateModal: false })
  },

  // 输入不想做的事
  onGenerateInput(e) {
    this.setData({ generateInput: e.detail.value })
  },

  // 提交 AI 生成
  onGenerateSubmit() {
    if (!this.data.generateInput.trim()) return

    // TODO: 调用后端 /api/ai/mindset API
    // 目前使用 mock 回复
    wx.showLoading({ title: '思考中...' })
    setTimeout(() => {
      wx.hideLoading()
      this.setData({
        generatedShift: `${this.data.generateInput}？换个角度想——你做了这件事，比没做的人已经领先一步了。而且完成之后的成就感，比刷手机爽多了。试试？`,
      })
    }, 1000)
  },
})
