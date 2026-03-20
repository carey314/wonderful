// Onboarding 引导流程
const storage = require('../../utils/storage')
const api = require('../../utils/api')
const { createTask } = require('../../utils/task-model')
const { getNavPaddingTop } = require('../../utils/util')

Page({
  data: {
    navPaddingTop: 120,
    step: 1,
    nickname: '',
    wakeTime: '08:00',
    sleepTime: '23:00',
    firstTask: '',
    firstTaskDuration: 30,
    mindsetText: '',

    wakeOptions: ['07:00', '08:00', '09:00', '10:00'],
    sleepOptions: ['22:00', '23:00', '24:00', '01:00'],
    durationOptions: [
      { label: '15分钟', value: 15 },
      { label: '30分钟', value: 30 },
      { label: '1小时', value: 60 },
      { label: '不确定', value: 0 },
    ],

    // 思维转换模板（根据任务关键词生成）
    mindsetTemplates: [
      '学会 {task} 不是为了"会{task}"，是简历上多一行 = 面试时多一个选择 = 未来不喜欢现在的工作时，你有底气说"我还能干别的"。',
      '做了 {task} 的你，比没做的你多了一个可能性。这个可能性值多少钱？说不好，但肯定比你今天刷手机两小时值钱。',
      '{task} 这件事，你做了 = 比 99% 只想不做的人强。这不是在给自己加压，是在给未来的自己多一个退路。',
    ],
  },

  onLoad() {
    this.setData({ navPaddingTop: getNavPaddingTop() })
  },

  // 进入下一步
  nextStep() {
    const nextStep = this.data.step + 1

    // 步骤 4 需要生成思维转换
    if (nextStep === 4) {
      this.generateMindset()
    }

    this.setData({ step: nextStep })
  },

  // 输入昵称
  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value })
  },

  // 选择起床时间
  onWakeSelect(e) {
    this.setData({ wakeTime: e.currentTarget.dataset.value })
  },

  // 选择睡觉时间
  onSleepSelect(e) {
    this.setData({ sleepTime: e.currentTarget.dataset.value })
  },

  // 输入第一个任务
  onFirstTaskInput(e) {
    this.setData({ firstTask: e.detail.value })
  },

  // 选择时长
  onDurationSelect(e) {
    this.setData({ firstTaskDuration: e.currentTarget.dataset.value })
  },

  // 生成思维转换
  generateMindset() {
    const task = this.data.firstTask
    const templates = this.data.mindsetTemplates
    const randomIndex = Math.floor(Math.random() * templates.length)
    const mindsetText = templates[randomIndex].replace(/\{task\}/g, task)
    this.setData({ mindsetText })
  },

  // 重新生成
  regenerateMindset() {
    this.generateMindset()
  },

  // 订阅消息授权
  onSubscribe() {
    // TODO: 调用微信订阅消息授权 API
    // wx.requestSubscribeMessage 需要模板 ID
    wx.showToast({ title: '订阅成功', icon: 'success' })
    setTimeout(() => this.nextStep(), 1000)
  },

  // 完成引导
  onComplete() {
    const app = getApp()

    // 保存用户信息
    const userInfo = {
      nickName: this.data.nickname,
      wakeTime: this.data.wakeTime,
      sleepTime: this.data.sleepTime,
      createdAt: Date.now(),
    }
    app.globalData.userInfo = userInfo
    app.globalData.coins = 100 // 首次奖励
    app.globalData.streakDays = 1

    wx.setStorageSync('userInfo', userInfo)
    wx.setStorageSync('coins', 100)
    wx.setStorageSync('streakDays', 1)
    wx.setStorageSync('onboardingDone', true)

    // 初始化存储层
    storage.init()

    // 触发静默登录
    app.autoLogin()

    // 如果用户输入了第一个任务，登录成功后保存到 API
    var firstTask = this.data.firstTask
    var firstTaskDuration = this.data.firstTaskDuration
    if (firstTask && firstTask.trim()) {
      var task = createTask({
        title: firstTask.trim(),
        estimatedMinutes: firstTaskDuration || 30,
      })
      app.onLoginReady(function () {
        api.cards.create(task).catch(function () {
          // API 失败，降级到本地存储
          storage.tasks.create(task)
        })
      })
    }

    // 跳转首页
    wx.switchTab({ url: '/pages/index/index' })
  },
})
