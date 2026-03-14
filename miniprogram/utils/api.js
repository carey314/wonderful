// api.js - 后端 API 请求封装
// 与后端 FastAPI 路由对齐

const app = getApp()

/**
 * 统一请求方法
 * @param {string} url - 请求路径
 * @param {string} method - 请求方法
 * @param {object} data - 请求数据
 */
function request(url, method = 'GET', data = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${app.globalData.baseUrl}${url}`,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${wx.getStorageSync('token') || ''}`,
      },
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data)
        } else if (res.statusCode === 401) {
          wx.removeStorageSync('token')
          wx.reLaunch({ url: '/pages/onboarding/onboarding' })
          reject(new Error('登录过期'))
        } else {
          reject(new Error(res.data.detail || '请求失败'))
        }
      },
      fail: reject,
    })
  })
}

// 用户相关 - 对应 /api/user
const user = {
  login: (code) => request('/api/user/login', 'POST', { code }),
  getProfile: () => request('/api/user/profile'),
  updateSettings: (data) => request('/api/user/settings', 'PUT', data),
}

// AI 对话相关 - 对应 /api/ai
const ai = {
  morning: () => request('/api/ai/morning', 'POST'),
  evening: () => request('/api/ai/evening', 'POST'),
  mindset: (message) => request('/api/ai/mindset', 'POST', { message }),
  chat: (message) => request('/api/ai/chat', 'POST', { message }),
}

// 任务卡片相关 - 对应 /api/cards
const cards = {
  list: (params) => request('/api/cards', 'GET', params),
  today: () => request('/api/cards/today'),
  create: (data) => request('/api/cards', 'POST', data),
  get: (id) => request(`/api/cards/${id}`),
  update: (id, data) => request(`/api/cards/${id}`, 'PUT', data),
  complete: (id) => request(`/api/cards/${id}/complete`, 'POST'),
  delete: (id) => request(`/api/cards/${id}`, 'DELETE'),
}

// 奖励相关 - 对应 /api/rewards
const rewards = {
  list: () => request('/api/rewards'),
  create: (data) => request('/api/rewards', 'POST', data),
  redeem: (id) => request(`/api/rewards/${id}/redeem`, 'POST'),
}

// 每日记录 - 对应 /api/daily
const daily = {
  today: () => request('/api/daily/today'),
  history: (params) => request('/api/daily', 'GET', params),
}

module.exports = {
  request,
  user,
  ai,
  cards,
  rewards,
  daily,
}
