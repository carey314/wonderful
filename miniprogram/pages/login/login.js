const storage = require('../../utils/storage')
const { getNavPaddingTop } = require('../../utils/util')

Page({
  data: {
    nickname: '',
    isLoading: false,
    navPaddingTop: 120,
  },

  onLoad() {
    this.setData({ navPaddingTop: getNavPaddingTop() })

    var userInfo = wx.getStorageSync('userInfo')
    if (userInfo && userInfo.nickName) {
      this.setData({ nickname: userInfo.nickName })
    }
  },

  onLogin() {
    var self = this
    self.setData({ isLoading: true })
    var app = getApp()
    storage.init()
    app.loadLocalData()
    app.autoLogin()

    // 10秒超时保护
    var timer = setTimeout(function () {
      self.setData({ isLoading: false })
      wx.showToast({ title: '登录超时，请重试', icon: 'none' })
    }, 10000)

    app.onLoginReady(function () {
      clearTimeout(timer)
      self.setData({ isLoading: false })
      wx.switchTab({ url: '/pages/index/index' })
    })
  },

  onSkipLogin() {
    var app = getApp()
    storage.init()
    app.loadLocalData()
    app._setLoginReady()
    wx.switchTab({ url: '/pages/index/index' })
  },
})
