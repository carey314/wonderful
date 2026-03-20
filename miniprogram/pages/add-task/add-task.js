// 新建任务页面 - V2 升级版（支持 vision/goal/daily 类型）
var { createTask, createSubtask, PROJECT_PRESETS, formatMinutes, CARD_TYPES } = require('../../utils/task-model')
var storage = require('../../utils/storage')
var api = require('../../utils/api')

var projectList = Object.keys(PROJECT_PRESETS).map(function (key) {
  return Object.assign({ key: key }, PROJECT_PRESETS[key])
})

var cardTypeList = [
  { key: 'daily', label: '每日任务', icon: '📋' },
  { key: 'goal', label: '中期目标', icon: '🏁' },
  { key: 'vision', label: '长期愿景', icon: '🎯' },
]

Page({
  data: {
    title: '',
    description: '',
    estimatedMinutes: 0,
    deadline: '',
    project: '',
    isUrgent: false,
    isImportant: false,
    // 卡片类型
    cardType: 'daily',
    cardTypeList: cardTypeList,
    parentCardId: null,
    parentVisions: [],  // 可选的父愿景列表
    parentVisionIndex: -1,
    // 子任务
    subtasks: [],
    subtaskInput: '',
    // 选项
    projectList: projectList,
    timeOptions: [
      { label: '15min', value: 15 },
      { label: '30min', value: 30 },
      { label: '1h', value: 60 },
      { label: '1.5h', value: 90 },
      { label: '2h', value: 120 },
      { label: '半天', value: 240 },
    ],
    customTime: '',
  },

  onLoad: function (options) {
    if (options.cardType) {
      this.setData({ cardType: options.cardType })
    }
    if (options.parentCardId) {
      this.setData({ parentCardId: options.parentCardId })
    }
    this._loadParentVisions()
  },

  onShow: function () {
    // TabBar 页面无法通过 URL 传参，从 globalData 读取
    var app = getApp()
    if (app.globalData._addCardType) {
      this.setData({ cardType: app.globalData._addCardType })
      app.globalData._addCardType = null
    }
    this._loadParentVisions()
  },

  _loadParentVisions: function () {
    var self = this
    api.cards.list({ card_type: 'vision' }).then(function (visions) {
      self.setData({ parentVisions: visions })
    }).catch(function () {
      var visions = storage.tasks.list({ cardType: 'vision' })
      self.setData({ parentVisions: visions })
    })
  },

  // --- 卡片类型 ---

  onCardTypeSelect: function (e) {
    var key = e.currentTarget.dataset.key
    this.setData({ cardType: key })
  },

  onParentVisionChange: function (e) {
    var idx = parseInt(e.detail.value)
    var visions = this.data.parentVisions
    this.setData({
      parentVisionIndex: idx,
      parentCardId: visions[idx] ? visions[idx].id : null,
    })
  },

  // --- 基础输入 ---

  onTitleInput(e) {
    this.setData({ title: e.detail.value })
  },

  onDescInput(e) {
    this.setData({ description: e.detail.value })
  },

  // --- 时间预估 ---

  onTimeSelect(e) {
    var value = e.currentTarget.dataset.value
    this.setData({
      estimatedMinutes: this.data.estimatedMinutes === value ? 0 : value,
      customTime: '',
    })
  },

  onCustomTimeInput(e) {
    var val = parseInt(e.detail.value, 10)
    if (val > 0) {
      this.setData({ estimatedMinutes: val, customTime: e.detail.value })
    } else {
      this.setData({ customTime: e.detail.value })
    }
  },

  // --- 截止日期 ---

  onDateChange(e) {
    this.setData({ deadline: e.detail.value })
  },

  clearDeadline() {
    this.setData({ deadline: '' })
  },

  // --- 项目选择 ---

  onProjectSelect(e) {
    var key = e.currentTarget.dataset.key
    this.setData({ project: this.data.project === key ? '' : key })
  },

  // --- 紧急/重要标记 ---

  toggleUrgent() {
    this.setData({ isUrgent: !this.data.isUrgent })
  },

  toggleImportant() {
    this.setData({ isImportant: !this.data.isImportant })
  },

  // --- 子任务 ---

  onSubtaskInput(e) {
    this.setData({ subtaskInput: e.detail.value })
  },

  addSubtask() {
    var title = this.data.subtaskInput.trim()
    if (!title) return
    var subtasks = this.data.subtasks.concat([{ id: 'sub_' + Date.now(), title: title, estimatedMinutes: 0 }])
    this.setData({ subtasks: subtasks, subtaskInput: '' })
  },

  removeSubtask(e) {
    var id = e.currentTarget.dataset.id
    this.setData({ subtasks: this.data.subtasks.filter(function (s) { return s.id !== id }) })
  },

  // --- 提交 ---

  onSubmit() {
    if (!this.data.title.trim()) {
      wx.showToast({ title: '请输入任务名称', icon: 'none' })
      return
    }

    var self = this
    var subtasks = this.data.subtasks.map(function (s) {
      return createSubtask({ title: s.title, estimatedMinutes: s.estimatedMinutes || 0 })
    })

    // 使用 createTask 计算 coinReward、priority 等字段
    var cardType = self.data.cardType || 'daily'
    var typeInfo = CARD_TYPES[cardType] || CARD_TYPES.daily

    var task = createTask({
      title: self.data.title.trim(),
      description: self.data.description.trim(),
      estimatedMinutes: self.data.estimatedMinutes || 30,
      deadline: self.data.deadline || undefined,
      project: self.data.project,
      isUrgent: self.data.isUrgent,
      isImportant: self.data.isImportant,
      subtasks: subtasks,
      cardType: cardType,
      card_type: cardType,
      parentCardId: self.data.parentCardId || undefined,
      parent_card_id: self.data.parentCardId || undefined,
      coinReward: typeInfo.defaultCoinReward,
    })

    // 成功后导航
    var successNav = function () {
      if (cardType === 'vision' || cardType === 'goal') {
        wx.switchTab({ url: '/pages/goals/goals' })
      } else {
        wx.switchTab({ url: '/pages/tasks/tasks' })
      }
    }

    // 先尝试 API 创建
    api.cards.create(task).then(function () {
      wx.showToast({ title: '创建成功', icon: 'success' })
      setTimeout(successNav, 1000)
    }).catch(function () {
      // 离线降级：保存到本地存储
      storage.tasks.create(task)
      wx.showToast({ title: '已离线保存', icon: 'success' })
      setTimeout(successNav, 1000)
    })
  },
})
