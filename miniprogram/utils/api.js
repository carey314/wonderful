// api.js - 后端 API 请求封装
// 与后端 FastAPI 路由对齐

// 共享登录 Promise，避免多个 401 并发时重复登录
var _loginPromise = null

/**
 * 统一请求方法
 * @param {string} url - 请求路径
 * @param {string} method - 请求方法
 * @param {object} data - 请求数据
 * @param {boolean} _isRetry - 是否为重试请求（内部使用）
 */
function request(url, method, data, _isRetry) {
  if (method === undefined) method = 'GET'
  if (data === undefined) data = {}

  var app = getApp()
  var baseUrl = (app && app.globalData && app.globalData.baseUrl) || 'http://122.51.1.28/wonderful-api'
  var token = wx.getStorageSync('token') || ''

  return new Promise(function (resolve, reject) {
    wx.request({
      url: baseUrl + url,
      method: method,
      data: data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      success: function (res) {
        if (res.statusCode === 200) {
          resolve(res.data)
        } else if (res.statusCode === 401 && !_isRetry) {
          // token 过期，自动重新登录后重试
          _handleUnauthorized(url, method, data, resolve, reject)
        } else {
          reject(new Error((res.data && res.data.detail) || '请求失败'))
        }
      },
      fail: reject,
    })
  })
}

/**
 * 处理 401：多个并发 401 共享同一个登录流程，避免竞态
 */
function _handleUnauthorized(url, method, data, resolve, reject) {
  if (!_loginPromise) {
    // 第一个 401：发起登录
    wx.removeStorageSync('token')
    var app = getApp()

    if (!app || !app.autoLogin) {
      reject(new Error('登录过期'))
      return
    }

    _loginPromise = new Promise(function (loginResolve, loginReject) {
      app.autoLogin()
      app.onLoginReady(function () {
        if (wx.getStorageSync('token')) {
          loginResolve()
        } else {
          loginReject(new Error('登录失败'))
        }
      })
    })
    _loginPromise.then(function () {
      _loginPromise = null
    }).catch(function () {
      _loginPromise = null
      wx.reLaunch({ url: '/pages/login/login' })
    })
  }

  // 所有 401 请求都等待同一个登录 Promise，然后重试
  _loginPromise.then(function () {
    request(url, method, data, true).then(resolve).catch(reject)
  }).catch(function () {
    reject(new Error('登录过期'))
  })
}

// 用户相关 - 对应 /api/user
var user = {
  login: function (code) { return request('/api/user/login', 'POST', { code: code }) },
  devLogin: function () { return request('/api/user/dev-login', 'POST') },
  getProfile: function () { return request('/api/user/profile') },
  updateSettings: function (data) { return request('/api/user/settings', 'PUT', data) },
}

// AI 对话相关 - 对应 /api/ai
var ai = {
  morning: function () { return request('/api/ai/morning', 'POST') },
  evening: function () { return request('/api/ai/evening', 'POST') },
  mindset: function (message) { return request('/api/ai/mindset', 'POST', { message: message }) },
  chat: function (message) { return request('/api/ai/chat', 'POST', { message: message }) },
  decompose: function (cardId) { return request('/api/ai/decompose', 'POST', { message: 'card_id:' + cardId }) },
}

// 任务卡片相关 - 对应 /api/cards
var cards = {
  list: function (params) { return request('/api/cards', 'GET', params) },
  today: function () { return request('/api/cards/today') },
  create: function (data) { return request('/api/cards', 'POST', data) },
  get: function (id) { return request('/api/cards/' + id) },
  update: function (id, data) { return request('/api/cards/' + id, 'PUT', data) },
  complete: function (id) { return request('/api/cards/' + id + '/complete', 'POST') },
  postpone: function (id) { return request('/api/cards/' + id + '/postpone', 'POST') },
  children: function (id) { return request('/api/cards/' + id + '/children') },
  delete: function (id) { return request('/api/cards/' + id, 'DELETE') },
}

// 奖励相关 - 对应 /api/rewards
var rewards = {
  list: function () { return request('/api/rewards') },
  create: function (data) { return request('/api/rewards', 'POST', data) },
  redeem: function (id) { return request('/api/rewards/' + id + '/redeem', 'POST') },
}

// 每日记录 - 对应 /api/daily
var daily = {
  today: function () { return request('/api/daily/today') },
  history: function (params) { return request('/api/daily', 'GET', params) },
}

module.exports = {
  request: request,
  user: user,
  ai: ai,
  cards: cards,
  rewards: rewards,
  daily: daily,
}
