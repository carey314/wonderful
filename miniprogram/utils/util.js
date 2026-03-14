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

module.exports = {
  formatDate,
  getGreeting,
  getWeekday,
  formatCoins,
  priorityMap,
  energyMap,
}
