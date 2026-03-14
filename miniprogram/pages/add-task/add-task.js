// 新建任务页面
Page({
  data: {
    title: '',
    estimatedMinutes: 30,
    dueDate: '',
    category: '',
    aiPreview: '',

    timeOptions: [
      { label: '15分钟', value: 15 },
      { label: '30分钟', value: 30 },
      { label: '1小时', value: 60 },
      { label: '不确定', value: 0 },
    ],

    dateOptions: [
      { label: '今天', value: 'today' },
      { label: '本周', value: 'week' },
      { label: '选日期', value: 'custom' },
      { label: '不设', value: '' },
    ],

    categories: [
      { icon: '💼', label: '工作', value: 'work' },
      { icon: '📚', label: '学习', value: 'study' },
      { icon: '💪', label: '健康', value: 'health' },
      { icon: '🏠', label: '生活', value: 'life' },
    ],
  },

  // 输入任务名称
  onTitleInput(e) {
    const title = e.detail.value
    this.setData({ title })

    // 输入完成后延迟生成 AI 思维转换预览
    if (this._aiTimer) clearTimeout(this._aiTimer)
    if (title.length >= 2) {
      this._aiTimer = setTimeout(() => this.generateAIPreview(title), 800)
    } else {
      this.setData({ aiPreview: '' })
    }
  },

  // 选择预估时间
  onTimeSelect(e) {
    this.setData({ estimatedMinutes: e.currentTarget.dataset.value })
  },

  // 选择截止日期
  onDateSelect(e) {
    const value = e.currentTarget.dataset.value
    if (value === 'custom') {
      // TODO: 弹出日期选择器
      wx.showToast({ title: '日期选择开发中', icon: 'none' })
      return
    }
    this.setData({ dueDate: value })
  },

  // 选择分类
  onCategorySelect(e) {
    const value = e.currentTarget.dataset.value
    this.setData({
      category: this.data.category === value ? '' : value,
    })
  },

  // 生成 AI 思维转换预览
  generateAIPreview(title) {
    // TODO: 调用后端 AI API 生成思维转换
    // 目前使用 mock 数据
    const previews = {
      学: `学${title.replace('学', '')}？不错。学会这个 = 简历多一行 = 多一个选择。值得。`,
      写: `写文档不是在给老板交差，是在练习把脑子里的想法变成别人能看懂的东西。这个能力，走哪都值钱。`,
      跑: `你今天不想跑步，60岁的你会花多少钱买一副能跑步的膝盖？这投资回报率，巴菲特看了都眼红。`,
      读: `每看10页书 = 比昨天的自己多知道一点。你不需要今天看完，你只需要比昨天多走一步。`,
    }

    // 简单匹配第一个字
    const firstChar = title[0]
    const preview = previews[firstChar] || `"${title}"这件事做了，你会比现在的自己多一个可能性。这就够了。`

    this.setData({ aiPreview: preview })
  },

  // 提交创建任务
  onSubmit() {
    if (!this.data.title.trim()) {
      wx.showToast({ title: '请输入任务名称', icon: 'none' })
      return
    }

    const taskData = {
      title: this.data.title.trim(),
      estimated_minutes: this.data.estimatedMinutes || 30,
      due_date: this.data.dueDate,
      category: this.data.category,
    }

    // TODO: 调用后端 API 创建任务
    console.log('创建任务:', taskData)

    wx.showToast({ title: '创建成功', icon: 'success' })
    setTimeout(() => {
      wx.switchTab({ url: '/pages/tasks/tasks' })
    }, 1000)
  },
})
