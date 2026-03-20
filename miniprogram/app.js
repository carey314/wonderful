// app.js - Wonderful 小程序入口
const storage = require('./utils/storage')

App({
  onLaunch() {
    // 首次用户 → 完整引导
    const onboardingDone = wx.getStorageSync('onboardingDone')
    if (!onboardingDone) {
      wx.reLaunch({ url: '/pages/onboarding/onboarding' })
      return
    }

    // 返回用户无 token → 登录页
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.reLaunch({ url: '/pages/login/login' })
      return
    }

    // 正常流程
    storage.init()
    this.loadLocalData()
    this.checkAuth()
  },

  globalData: {
    userInfo: null,
    coins: 0,
    streakDays: 0,
    baseUrl: 'http://122.51.1.28/wonderful-api',  // 备案完成后改回 https://qxju.shop/wonderful-api
    loginReady: false, // 标记登录流程是否完成
  },

  // 登录就绪回调队列
  _loginCallbacks: [],

  // 等待登录完成
  onLoginReady(cb) {
    if (this.globalData.loginReady) {
      cb()
    } else {
      this._loginCallbacks.push(cb)
    }
  },

  // 标记登录完成，执行所有回调
  _setLoginReady() {
    this.globalData.loginReady = true
    this._loginCallbacks.forEach(function (cb) { cb() })
    this._loginCallbacks = []
  },

  // 从本地缓存加载数据
  loadLocalData() {
    this.globalData.userInfo = wx.getStorageSync('userInfo') || null
    this.globalData.coins = storage.coins.get()
    this.globalData.streakDays = storage.streak.get()
  },

  // 检查登录态
  checkAuth() {
    var self = this
    var token = wx.getStorageSync('token')

    if (token) {
      // 有 token，验证有效性
      self._verifyToken().then(function () {
        self._setLoginReady()
      }).catch(function () {
        // token 无效，重新登录
        wx.removeStorageSync('token')
        self.autoLogin()
      })
    } else {
      // 无 token，自动登录
      self.autoLogin()
    }
  },

  // 验证 token 有效性
  _verifyToken() {
    var self = this
    return new Promise(function (resolve, reject) {
      wx.request({
        url: self.globalData.baseUrl + '/api/user/profile',
        method: 'GET',
        header: {
          'Authorization': 'Bearer ' + wx.getStorageSync('token'),
        },
        success: function (res) {
          if (res.statusCode === 200) {
            self.globalData.userInfo = res.data
            self.globalData.coins = res.data.coins || 0
            self.globalData.streakDays = res.data.streak_days || 0
            wx.setStorageSync('userInfo', res.data)
            resolve(res.data)
          } else {
            reject(new Error('token invalid'))
          }
        },
        fail: function (err) {
          console.warn('[Auth] 验证 token 失败，使用本地数据', err)
          // 网络失败不清 token，降级为本地模式
          self._setLoginReady()
          resolve()
        },
      })
    })
  },

  // 自动登录（静默）
  autoLogin() {
    var self = this
    wx.login({
      success: function (res) {
        if (res.code) {
          self._loginWithCode(res.code)
        } else {
          console.warn('[Auth] wx.login 未获取到 code')
          self._onLoginFail()
        }
      },
      fail: function (err) {
        console.warn('[Auth] wx.login 调用失败', err)
        self._onLoginFail()
      },
    })
  },

  // 用 code 调用后端换取 token
  _loginWithCode(code) {
    var self = this
    wx.request({
      url: self.globalData.baseUrl + '/api/user/login',
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { code: code },
      success: function (res) {
        if (res.statusCode === 200 && res.data.token) {
          self._handleLoginSuccess(res.data)
        } else {
          console.warn('[Auth] login 返回异常，尝试 dev-login', res)
          self._devLogin()
        }
      },
      fail: function (err) {
        console.warn('[Auth] login 请求失败，尝试 dev-login', err)
        self._devLogin()
      },
    })
  },

  // 开发环境兜底登录
  _devLogin() {
    var self = this
    wx.request({
      url: self.globalData.baseUrl + '/api/user/dev-login',
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      success: function (res) {
        if (res.statusCode === 200 && res.data.token) {
          self._handleLoginSuccess(res.data)
        } else {
          console.warn('[Auth] dev-login 也失败了', res)
          self._onLoginFail()
        }
      },
      fail: function (err) {
        console.warn('[Auth] dev-login 请求失败', err)
        self._onLoginFail()
      },
    })
  },

  // 登录成功处理
  _handleLoginSuccess(data) {
    // data: { token, user }
    wx.setStorageSync('token', data.token)
    this.globalData.userInfo = data.user
    this.globalData.coins = data.user.coins || 0
    this.globalData.streakDays = data.user.streak_days || 0
    wx.setStorageSync('userInfo', data.user)
    this._setLoginReady()
  },

  // 登录失败处理 — 降级为本地模式
  _onLoginFail() {
    wx.showToast({ title: '网络异常，离线模式', icon: 'none', duration: 2000 })
    this._setLoginReady()
  },

  // 登出
  logout() {
    wx.removeStorageSync('token')
    this.globalData.userInfo = null
    this.globalData.loginReady = false
    this._loginCallbacks = []
  },
})
