// util.js - 通用工具方法

/**
 * 格式化日期为友好的中文显示
 */
function formatDate(date) {
  const d = new Date(date)
  const now = new Date()
  const diff = now - d
  const oneDay = 86400000

  if (diff < oneDay && d.getDate() === now.getDate()) {
    return '今天'
  } else if (diff < 2 * oneDay) {
    return '昨天'
  } else if (diff < 7 * oneDay) {
    return `${Math.floor(diff / oneDay)}天前`
  } else {
    return `${d.getMonth() + 1}月${d.getDate()}日`
  }
}

/**
 * 获取当前时段的问候语
 */
function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 9) return '早上好'
  if (hour < 12) return '上午好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  if (hour < 22) return '晚上好'
  return '夜深了'
}

/**
 * 获取星期几的中文显示
 */
function getWeekday() {
  const days = ['日', '一', '二', '三', '四', '五', '六']
  return `周${days[new Date().getDay()]}`
}

/**
 * 格式化金币数量显示
 */
function formatCoins(num) {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + 'w'
  }
  return num.toLocaleString()
}

/**
 * 格式化截止日期为友好的中文显示（面向未来）
 * 用于 V2 任务卡片的 deadline 展示
 * @param {string} dateStr - ISO 日期字符串 (YYYY-MM-DD) 或 Date 可解析格式
 * @returns {string} 如 "今天"、"明天"、"后天"、"周五"、"3月28日"
 */
function formatDeadline(dateStr) {
  if (!dateStr) return ''
  var target = new Date(dateStr)
  if (isNaN(target.getTime())) return ''

  var now = new Date()
  // 归一化到日期（去掉时间部分）
  var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  var targetStart = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  var diffDays = Math.round((targetStart - todayStart) / 86400000)

  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '明天'
  if (diffDays === 2) return '后天'
  if (diffDays < 0) return '已过期'
  if (diffDays <= 7) {
    var days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return days[target.getDay()]
  }
  return (target.getMonth() + 1) + '月' + target.getDate() + '日'
}

/**
 * 获取今天的 ISO 日期字符串 (YYYY-MM-DD)
 */
function getTodayString() {
  var d = new Date()
  var y = d.getFullYear()
  var m = String(d.getMonth() + 1).padStart(2, '0')
  var day = String(d.getDate()).padStart(2, '0')
  return y + '-' + m + '-' + day
}

/**
 * 优先级标签映射 - 年轻化配色
 */
const priorityMap = {
  urgent_important: { label: '紧急重要', icon: '🚨', color: '#FF6B6B' },
  important: { label: '重要', icon: '🎯', color: '#7C5CFC' },
  urgent: { label: '紧急', icon: '⚡', color: '#FF6B9D' },
  normal: { label: '日常', icon: '🌱', color: '#06D6A0' },
}

/**
 * 任务能量级别 - 年轻化配色
 */
const energyMap = {
  high: { label: '高能量', color: '#7C5CFC' },
  medium: { label: '中能量', color: '#FBBF24' },
  low: { label: '低能量', color: '#06D6A0' },
}

/**
 * 获取导航栏安全区域顶部间距（状态栏 + 胶囊按钮）
 */
function getNavPaddingTop() {
  try {
    var menuRect = wx.getMenuButtonBoundingClientRect()
    return menuRect.bottom + 12
  } catch (e) {
    return 120
  }
}

module.exports = {
  formatDate,
  formatDeadline,
  getTodayString,
  getGreeting,
  getWeekday,
  formatCoins,
  getNavPaddingTop,
  priorityMap,
  energyMap,
}
