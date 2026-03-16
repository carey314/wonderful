// task-parser.js - 自然语言解析函数
// 本地规则引擎实现，基于关键词匹配，不依赖 AI API

var taskModel = require('./task-model')
var util = require('./util')

// ============================================================
// 时间关键词 → 相对日期
// ============================================================

var DATE_KEYWORDS = {
  '今天': 0,
  '今日': 0,
  '今晚': 0,
  '明天': 1,
  '明日': 1,
  '后天': 2,
  '大后天': 3,
}

var WEEKDAY_MAP = {
  '周一': 1, '星期一': 1, '礼拜一': 1,
  '周二': 2, '星期二': 2, '礼拜二': 2,
  '周三': 3, '星期三': 3, '礼拜三': 3,
  '周四': 4, '星期四': 4, '礼拜四': 4,
  '周五': 5, '星期五': 5, '礼拜五': 5,
  '周六': 6, '星期六': 6, '礼拜六': 6,
  '周日': 0, '星期日': 0, '星期天': 0, '礼拜天': 0, '周天': 0,
}

// ============================================================
// 项目分类关键词
// ============================================================

var PROJECT_KEYWORDS = {
  work: ['工作', '上班', '公司', '客户', '项目', '方案', '汇报', '报告', '邮件', '会议', '开会',
         '出差', '加班', '同事', '老板', '领导', '甲方', '需求', 'PPT', 'ppt', 'excel', 'Excel'],
  study: ['学习', '学', '看书', '读书', '课程', '教程', '练习', '复习', '考试', '背单词',
          '刷题', '听课', '看视频', '论文', 'Python', 'python', 'Java', 'java', '英语',
          '数学', '编程', '代码', '算法'],
  health: ['运动', '跑步', '健身', '锻炼', '游泳', '瑜伽', '散步', '走路', '早睡', '早起',
           '喝水', '吃药', '体检', '减肥'],
  life: ['整理', '收拾', '打扫', '洗衣', '做饭', '买菜', '超市', '快递', '缴费', '搬家',
         '修', '换', '房间', '家', '衣服'],
  social: ['约', '聚餐', '聚会', '见面', '朋友', '同学', '生日', '送礼', '电话', '联系'],
  finance: ['转账', '还款', '理财', '记账', '报销', '工资', '交租', '房租', '水电'],
}

// ============================================================
// 紧急/重要关键词
// ============================================================

var URGENT_KEYWORDS = ['紧急', '急', '马上', '立刻', '赶紧', 'ASAP', 'asap', '今天必须', '立即', '加急']
var IMPORTANT_KEYWORDS = ['重要', '关键', '核心', '必须', '一定要', '不能忘', '别忘']

// ============================================================
// 能量级别关键词
// ============================================================

var HIGH_ENERGY_KEYWORDS = ['写', '做', '开发', '设计', '方案', '论文', '编程', '代码', '算法', '考试', '演讲', '汇报']
var LOW_ENERGY_KEYWORDS = ['整理', '收拾', '回复', '邮件', '快递', '缴费', '记账', '打扫']

// ============================================================
// 核心解析函数
// ============================================================

/**
 * 解析用户输入的自然语言，拆分为多个任务
 * 支持中文逗号、句号、换行、顿号作为分隔符
 *
 * @param {string} input - 用户原始输入
 * @returns {Array<Object>} 解析出的任务对象数组（createTask 的结果）
 *
 * 示例输入：
 * "明天要交报告，还要学Python第8章，下午3点开会，周末整理房间"
 * "Wonderful项目改首页布局1小时，加子任务组件1.5小时"
 */
function parseInput(input) {
  if (!input || typeof input !== 'string') return []

  var text = input.trim()
  if (!text) return []

  // 第一步：拆分为多个任务片段
  var segments = splitSegments(text)

  // 第二步：逐个解析
  var tasks = []
  for (var i = 0; i < segments.length; i++) {
    var seg = segments[i].trim()
    if (!seg) continue
    var parsed = parseSingleTask(seg)
    if (parsed && parsed.title) {
      tasks.push(taskModel.createTask(parsed))
    }
  }

  return tasks
}

/**
 * 将用户输入拆分为多个任务片段
 * 支持：逗号、句号、分号、顿号、换行
 * 但避免拆开"1.5小时"中的小数点
 */
function splitSegments(text) {
  // 先保护数字中的点号（如 1.5小时）
  var protected_ = text.replace(/(\d)\.(\d)/g, '$1__DOT__$2')

  // 用常见分隔符拆分
  var parts = protected_.split(/[，,。；;、\n]+/)

  // 还原小数点
  return parts.map(function (p) {
    return p.replace(/__DOT__/g, '.')
  })
}

/**
 * 解析单个任务片段
 * @returns {Object} 包含 title, estimatedMinutes, deadline, project, isUrgent, isImportant, energy 等字段
 */
function parseSingleTask(segment) {
  var result = {
    title: '',
    estimatedMinutes: 0,
    deadline: '',
    project: '',
    isUrgent: false,
    isImportant: false,
    energy: 'medium',
  }

  var remaining = segment

  // 1. 提取时间预估（如 "1小时", "30分钟", "1.5h", "45min"）
  var timeResult = extractTime(remaining)
  result.estimatedMinutes = timeResult.minutes
  remaining = timeResult.remaining

  // 2. 提取截止日期
  var deadlineResult = extractDeadline(remaining)
  result.deadline = deadlineResult.deadline
  remaining = deadlineResult.remaining

  // 3. 提取紧急/重要标记
  for (var i = 0; i < URGENT_KEYWORDS.length; i++) {
    if (remaining.indexOf(URGENT_KEYWORDS[i]) !== -1) {
      result.isUrgent = true
      break
    }
  }
  for (var j = 0; j < IMPORTANT_KEYWORDS.length; j++) {
    if (remaining.indexOf(IMPORTANT_KEYWORDS[j]) !== -1) {
      result.isImportant = true
      break
    }
  }

  // 4. 推断项目分类
  result.project = inferProject(remaining)

  // 5. 推断能量级别
  result.energy = inferEnergy(remaining)

  // 6. 清理标题：去掉已提取的时间词、日期词、和无意义的连接词
  remaining = cleanTitle(remaining)

  result.title = remaining.trim()

  // 如果没解析出标题，用原文
  if (!result.title) {
    result.title = segment.trim()
  }

  return result
}

// ============================================================
// 子解析器
// ============================================================

/**
 * 从文本中提取时间预估
 * 支持：1小时、30分钟、1.5h、45min、半小时、一个小时、两小时
 */
function extractTime(text) {
  var minutes = 0
  var remaining = text

  // "X.X小时" 或 "X小时"
  var hourMatch = text.match(/(\d+\.?\d*)\s*[个]?\s*小时/)
  if (hourMatch) {
    minutes = Math.round(parseFloat(hourMatch[1]) * 60)
    remaining = remaining.replace(hourMatch[0], ' ')
    return { minutes: minutes, remaining: remaining }
  }

  // "X分钟" 或 "Xmin"
  var minMatch = text.match(/(\d+)\s*分钟/)
  if (minMatch) {
    minutes = parseInt(minMatch[1], 10)
    remaining = remaining.replace(minMatch[0], ' ')
    return { minutes: minutes, remaining: remaining }
  }

  // "Xh" 或 "X.Xh"
  var hMatch = text.match(/(\d+\.?\d*)\s*h(?:our)?s?/i)
  if (hMatch) {
    minutes = Math.round(parseFloat(hMatch[1]) * 60)
    remaining = remaining.replace(hMatch[0], ' ')
    return { minutes: minutes, remaining: remaining }
  }

  // "Xmin"
  var minMatch2 = text.match(/(\d+)\s*min/i)
  if (minMatch2) {
    minutes = parseInt(minMatch2[1], 10)
    remaining = remaining.replace(minMatch2[0], ' ')
    return { minutes: minutes, remaining: remaining }
  }

  // "半小时" / "半个小时"
  if (text.indexOf('半小时') !== -1 || text.indexOf('半个小时') !== -1) {
    minutes = 30
    remaining = remaining.replace(/半[个]?小时/, ' ')
    return { minutes: minutes, remaining: remaining }
  }

  // 中文数字：一个小时、两小时、三个小时
  var cnHourMap = { '一': 1, '两': 2, '二': 2, '三': 3, '四': 4, '五': 5 }
  var cnMatch = text.match(/(一|两|二|三|四|五)[个]?小时/)
  if (cnMatch) {
    minutes = (cnHourMap[cnMatch[1]] || 1) * 60
    remaining = remaining.replace(cnMatch[0], ' ')
    return { minutes: minutes, remaining: remaining }
  }

  return { minutes: 0, remaining: remaining }
}

/**
 * 从文本中提取截止日期
 * 返回 ISO 日期字符串
 */
function extractDeadline(text) {
  var remaining = text
  var deadline = ''
  var now = new Date()

  // "今天/明天/后天"
  var keys = Object.keys(DATE_KEYWORDS)
  for (var i = 0; i < keys.length; i++) {
    if (text.indexOf(keys[i]) !== -1) {
      var d = new Date(now)
      d.setDate(d.getDate() + DATE_KEYWORDS[keys[i]])
      deadline = toDateString(d)
      remaining = remaining.replace(keys[i], ' ')
      return { deadline: deadline, remaining: remaining }
    }
  }

  // "周X / 星期X"
  var wKeys = Object.keys(WEEKDAY_MAP)
  for (var j = 0; j < wKeys.length; j++) {
    if (text.indexOf(wKeys[j]) !== -1) {
      deadline = toDateString(getNextWeekday(WEEKDAY_MAP[wKeys[j]]))
      remaining = remaining.replace(wKeys[j], ' ')
      return { deadline: deadline, remaining: remaining }
    }
  }

  // "周末" → 最近的周六
  if (text.indexOf('周末') !== -1 || text.indexOf('这周末') !== -1) {
    deadline = toDateString(getNextWeekday(6))
    remaining = remaining.replace(/这?周末/, ' ')
    return { deadline: deadline, remaining: remaining }
  }

  // "下周X"
  var nextWeekMatch = text.match(/下周(一|二|三|四|五|六|日|天)/)
  if (nextWeekMatch) {
    var dayMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0 }
    var targetDay = dayMap[nextWeekMatch[1]]
    var nextWeekDate = getNextWeekday(targetDay)
    // 确保是下周（至少7天后）
    if (nextWeekDate - now < 7 * 86400000) {
      nextWeekDate.setDate(nextWeekDate.getDate() + 7)
    }
    deadline = toDateString(nextWeekDate)
    remaining = remaining.replace(nextWeekMatch[0], ' ')
    return { deadline: deadline, remaining: remaining }
  }

  // "X月X日" 或 "X月X号"
  var dateMatch = text.match(/(\d{1,2})月(\d{1,2})[日号]?/)
  if (dateMatch) {
    var month = parseInt(dateMatch[1], 10)
    var day = parseInt(dateMatch[2], 10)
    var year = now.getFullYear()
    var target = new Date(year, month - 1, day)
    // 如果日期已过去，推到明年
    if (target < now) {
      target.setFullYear(year + 1)
    }
    deadline = toDateString(target)
    remaining = remaining.replace(dateMatch[0], ' ')
    return { deadline: deadline, remaining: remaining }
  }

  // "X天后" / "X天内"
  var daysLaterMatch = text.match(/(\d+)天[后内]/)
  if (daysLaterMatch) {
    var daysLater = new Date(now)
    daysLater.setDate(daysLater.getDate() + parseInt(daysLaterMatch[1], 10))
    deadline = toDateString(daysLater)
    remaining = remaining.replace(daysLaterMatch[0], ' ')
    return { deadline: deadline, remaining: remaining }
  }

  // 时间点提取："下午3点开会" → 提取为今天 + 时间
  var timeMatch = text.match(/(上午|下午|晚上)?(\d{1,2})[点时:：](\d{0,2})/)
  if (timeMatch) {
    // 有时间点但没有日期 → 默认今天
    deadline = toDateString(now)
    // 不从 remaining 中删除时间信息，因为它可能是标题的一部分（如 "3点开会"）
    return { deadline: deadline, remaining: remaining }
  }

  // "要交" "截止" "deadline" → 暗示紧急但无具体日期
  // 不设 deadline，让 isUrgent 标记处理

  return { deadline: '', remaining: remaining }
}

/**
 * 推断项目分类
 */
function inferProject(text) {
  var projects = Object.keys(PROJECT_KEYWORDS)
  var maxScore = 0
  var bestProject = ''

  for (var i = 0; i < projects.length; i++) {
    var keywords = PROJECT_KEYWORDS[projects[i]]
    var score = 0
    for (var j = 0; j < keywords.length; j++) {
      if (text.indexOf(keywords[j]) !== -1) {
        score += keywords[j].length // 关键词越长匹配权重越高
      }
    }
    if (score > maxScore) {
      maxScore = score
      bestProject = projects[i]
    }
  }

  return bestProject
}

/**
 * 推断能量级别
 */
function inferEnergy(text) {
  for (var i = 0; i < HIGH_ENERGY_KEYWORDS.length; i++) {
    if (text.indexOf(HIGH_ENERGY_KEYWORDS[i]) !== -1) return 'high'
  }
  for (var j = 0; j < LOW_ENERGY_KEYWORDS.length; j++) {
    if (text.indexOf(LOW_ENERGY_KEYWORDS[j]) !== -1) return 'low'
  }
  return 'medium'
}

/**
 * 清理标题文本
 * 去掉已经提取的无关修饰词，保留核心任务描述
 */
function cleanTitle(text) {
  // 去掉常见的连接词和填充词
  var fillers = ['要', '还要', '需要', '得', '去', '然后', '接着', '再', '另外', '还有']
  var cleaned = text.trim()

  // 只清除开头的填充词
  for (var i = 0; i < fillers.length; i++) {
    if (cleaned.indexOf(fillers[i]) === 0) {
      cleaned = cleaned.slice(fillers[i].length)
      break // 只清理一个开头填充词
    }
  }

  // 去掉多余空格
  cleaned = cleaned.replace(/\s+/g, ' ').trim()

  return cleaned
}

// ============================================================
// 日期工具
// ============================================================

/**
 * 获取最近的某个星期几的日期
 * 如果今天就是该星期几，返回今天
 */
function getNextWeekday(targetDay) {
  var now = new Date()
  var currentDay = now.getDay()
  var diff = targetDay - currentDay
  if (diff < 0) diff += 7
  if (diff === 0) {
    // 今天就是目标日，返回今天
    return new Date(now)
  }
  var result = new Date(now)
  result.setDate(result.getDate() + diff)
  return result
}

/**
 * Date 转为 YYYY-MM-DD 字符串
 */
function toDateString(date) {
  var y = date.getFullYear()
  var m = String(date.getMonth() + 1).padStart(2, '0')
  var d = String(date.getDate()).padStart(2, '0')
  return y + '-' + m + '-' + d
}

/**
 * 快速解析：只提取任务标题列表（不创建完整任务对象）
 * 用于输入时的实时预览
 */
function quickParse(input) {
  if (!input || typeof input !== 'string') return []
  var segments = splitSegments(input.trim())
  var titles = []
  for (var i = 0; i < segments.length; i++) {
    var seg = segments[i].trim()
    if (seg) {
      var parsed = parseSingleTask(seg)
      if (parsed.title) {
        titles.push({
          title: parsed.title,
          estimatedMinutes: parsed.estimatedMinutes,
          project: parsed.project,
          deadline: parsed.deadline,
        })
      }
    }
  }
  return titles
}

module.exports = {
  parseInput: parseInput,
  quickParse: quickParse,

  // 暴露子解析器以便单元测试
  _splitSegments: splitSegments,
  _parseSingleTask: parseSingleTask,
  _extractTime: extractTime,
  _extractDeadline: extractDeadline,
  _inferProject: inferProject,
  _inferEnergy: inferEnergy,
}
