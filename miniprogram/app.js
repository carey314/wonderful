// app.js - Wonderful 小程序入口
const storage = require('./utils/storage')

App({
  onLaunch() {
    // 检查是否完成引导
    const onboardingDone = wx.getStorageSync('onboardingDone')
    if (!onboardingDone) {
      // 首次使用，跳转引导页
      wx.reLaunch({ url: '/pages/onboarding/onboarding' })
      return
    }

    // 初始化存储层
    storage.init()

    // 加载本地缓存数据
    this.loadLocalData()

    // 尝试微信登录
    this.login()
  },

  globalData: {
    userInfo: null,
    coins: 0,
    streakDays: 0,
    baseUrl: '', // 后端 API 地址，部署后填入
  },

  // 从本地缓存加载数据
  loadLocalData() {
    this.globalData.userInfo = wx.getStorageSync('userInfo') || null
    this.globalData.coins = storage.coins.get()
    this.globalData.streakDays = storage.streak.get()
  },

  // 微信登录（获取 openid）
  login() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (res) => {
          if (res.code) {
            // TODO: 将 code 发送到后端 /api/user/login 换取 openid 和 token
            resolve(res.code)
          } else {
            reject(new Error('登录失败'))
          }
        },
        fail: reject,
      })
    })
  },
})
