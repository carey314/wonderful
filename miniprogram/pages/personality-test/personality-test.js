// 拖延人格测评
Page({
  data: {
    step: 'cover', // cover → quiz → analyzing → result
    currentIndex: 0,
    selectedOption: -1,
    progressPct: 0,
    answers: [],
    result: null,

    questions: [
      {
        emoji: '⏰',
        question: '闹钟响了，你的第一反应是？',
        options: [
          { letter: 'A', label: '再睡5分钟...结果睡了40分钟', type: 'perfectionist' },
          { letter: 'B', label: '躺着刷会手机再起', type: 'dreamer' },
          { letter: 'C', label: '想到今天要做的事就焦虑', type: 'worrier' },
          { letter: 'D', label: '不想起但还是起了，只是很慢', type: 'defier' },
        ],
      },
      {
        emoji: '📱',
        question: '打开手机准备学习/工作，结果？',
        options: [
          { letter: 'A', label: '先刷10分钟短视频"热热身"', type: 'dreamer' },
          { letter: 'B', label: '打开文档后发现桌面该整理了', type: 'perfectionist' },
          { letter: 'C', label: '想到要做的事太多，不知从何开始', type: 'worrier' },
          { letter: 'D', label: '就是不想做别人安排的事', type: 'defier' },
        ],
      },
      {
        emoji: '📅',
        question: 'deadline 还有3天，你通常会？',
        options: [
          { letter: 'A', label: '最后一天熬夜冲刺', type: 'crisis' },
          { letter: 'B', label: '做了个超详细的计划但没执行', type: 'dreamer' },
          { letter: 'C', label: '总觉得做得不够好，反复修改开头', type: 'perfectionist' },
          { letter: 'D', label: '心想"3天够了"然后继续躺平', type: 'overdoer' },
        ],
      },
      {
        emoji: '🍦',
        question: '完成一件小事后，你会？',
        options: [
          { letter: 'A', label: '"奖励"自己玩2小时', type: 'overdoer' },
          { letter: 'B', label: '觉得做得不够完美，想重做', type: 'perfectionist' },
          { letter: 'C', label: '马上想下一件事，根本停不下来', type: 'crisis' },
          { letter: 'D', label: '发朋友圈让大家知道我做了', type: 'dreamer' },
        ],
      },
      {
        emoji: '😓',
        question: '拖延的时候，你内心的OS是？',
        options: [
          { letter: 'A', label: '"等我状态好了再做"', type: 'worrier' },
          { letter: 'B', label: '"为什么非要按别人说的做"', type: 'defier' },
          { letter: 'C', label: '"反正最后我总能搞定的"', type: 'crisis' },
          { letter: 'D', label: '"我要做就做到最好"', type: 'perfectionist' },
        ],
      },
      {
        emoji: '🌙',
        question: '睡前你通常在想什么？',
        options: [
          { letter: 'A', label: '"明天一定要早起"（然后并没有）', type: 'dreamer' },
          { letter: 'B', label: '"今天又什么都没做..."然后焦虑', type: 'worrier' },
          { letter: 'C', label: '"还好最后赶完了"然后刷手机', type: 'crisis' },
          { letter: 'D', label: '"今天过得也还行吧"毫无负担', type: 'overdoer' },
        ],
      },
    ],
  },

  // 开始测评
  startTest() {
    this.setData({
      step: 'quiz',
      currentIndex: 0,
      selectedOption: -1,
      answers: [],
      progressPct: (1 / this.data.questions.length) * 100,
    })
  },

  // 选择选项
  selectOption(e) {
    const idx = e.currentTarget.dataset.idx
    this.setData({ selectedOption: idx })
    wx.vibrateShort({ type: 'light' })
  },

  // 下一题
  nextQuestion() {
    if (this.data.selectedOption === -1) return

    const currentQ = this.data.questions[this.data.currentIndex]
    const selectedType = currentQ.options[this.data.selectedOption].type
    const answers = [...this.data.answers, selectedType]

    if (this.data.currentIndex >= this.data.questions.length - 1) {
      // 最后一题 → 分析
      this.setData({ answers, step: 'analyzing' })
      setTimeout(() => this.analyzeResult(answers), 2000)
      return
    }

    const nextIndex = this.data.currentIndex + 1
    this.setData({
      answers,
      currentIndex: nextIndex,
      selectedOption: -1,
      progressPct: ((nextIndex + 1) / this.data.questions.length) * 100,
    })
  },

  // 分析结果 - 统计最多的类型
  analyzeResult(answers) {
    const count = {}
    answers.forEach((type) => {
      count[type] = (count[type] || 0) + 1
    })

    let maxType = 'dreamer'
    let maxCount = 0
    Object.entries(count).forEach(([type, c]) => {
      if (c > maxCount) {
        maxType = type
        maxCount = c
      }
    })

    const resultMap = {
      perfectionist: {
        emoji: '✨',
        type: '完美主义拖延者',
        subtitle: '"做不到100分，不如不做"',
        description: '你对自己要求很高，总觉得准备不够充分。比起"做得不好"，你更害怕"做了但不完美"。结果就是迟迟不开始。',
        traits: ['注重细节到极致', '经常推翻重来', '害怕被评价', '准备工作做很久'],
        tip: '试试"先完成再完美"。给自己一个"垃圾初稿"的许可，60分就是胜利。',
      },
      dreamer: {
        emoji: '☁️',
        type: '幻想家拖延者',
        subtitle: '"明天的我一定很厉害"',
        description: '你擅长制定宏大的计划，想象完成后的美好场景。但执行的时候，总觉得"还有明天"。你不是不努力，只是活在了对未来的想象里。',
        traits: ['计划做得很漂亮', '对未来很乐观', '常高估自己的行动力', '喜欢新鲜感'],
        tip: '把大计划拆成5分钟就能开始的小步骤。从"打开文档"开始，而不是"写完论文"。',
      },
      worrier: {
        emoji: '😰',
        type: '焦虑型拖延者',
        subtitle: '"想太多做太少"',
        description: '你不是不想做，而是想得太多。各种担忧占满了你的脑子：做不好怎么办、别人怎么看、时间够不够。越想越焦虑，越焦虑越不想动。',
        traits: ['容易overthinking', '决策困难', '敏感在意他人评价', '常自我怀疑'],
        tip: '焦虑的时候深呼吸3次，然后问自己："现在能做的最小一步是什么？"做了再说。',
      },
      crisis: {
        emoji: '🔥',
        type: '危机驱动拖延者',
        subtitle: '"deadline是第一生产力"',
        description: '你在最后关头爆发力惊人。平时看似拖延，但每次都能在deadline前冲刺完成。你享受那种肾上腺素飙升的感觉。',
        traits: ['抗压能力强', '临场发挥好', '平时效率低', '喜欢刺激感'],
        tip: '给自己设"假deadline"——提前2天截止。把那种冲刺感提前激活，留出缓冲时间。',
      },
      defier: {
        emoji: '😤',
        type: '叛逆型拖延者',
        subtitle: '"凭什么要听你的"',
        description: '你的拖延更多是一种无声的抗议。当任务是别人安排的，你本能地想要反抗。不是做不了，而是不想被控制。',
        traits: ['独立意识强', '不喜欢被管束', '自己想做的事很高效', '讨厌命令式语气'],
        tip: '试着找到任务中"为自己做"的部分。把"老板让我做报告"变成"我要展示我的分析能力"。',
      },
      overdoer: {
        emoji: '🫠',
        type: '过度承诺拖延者',
        subtitle: '"我可以的...好像不行"',
        description: '你很难对事情说"不"，答应太多事情后发现根本做不完。然后在内疚和疲惫中选择性拖延。你需要学会的不是时间管理，而是说"不"。',
        traits: ['热心肠容易答应别人', '同时juggle很多事', '经常感到疲惫', '难以拒绝请求'],
        tip: '每接一个新任务前，先看看清单上还有多少未完成的。练习说"我现在排不开，下周可以吗？"',
      },
    }

    this.setData({
      step: 'result',
      result: resultMap[maxType] || resultMap.dreamer,
    })
  },

  // 重新测评
  retryTest() {
    this.setData({ step: 'cover' })
  },

  // 分享
  onShareAppMessage() {
    const result = this.data.result
    return {
      title: `我是「${result ? result.type : '拖延星人'}」，你呢？来测测！`,
      path: '/pages/personality-test/personality-test',
    }
  },
})
