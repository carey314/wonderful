// 目标页 — 愿景 → 目标 层级管理
var { getGoalProgress, getCardTypeInfo, CARD_TYPES } = require('../../utils/task-model')
var storage = require('../../utils/storage')
var api = require('../../utils/api')

Page({
  data: {
    activeTab: 'vision', // vision | goal
    visions: [],
    goals: [],
    // 愿景及其子目标（展开的树形结构）
    visionTree: [],
    // 独立目标（无父愿景的 goal）
    standaloneGoals: [],
    loading: true,
  },

  onLoad: function () {
    this._useApi = false
  },

  onShow: function () {
    this.loadData()
  },

  loadData: function () {
    var self = this
    self.setData({ loading: true })

    // 先展示本地数据
    self._renderLocal()

    // 尝试 API
    var visionsP = api.cards.list({ card_type: 'vision' })
    var goalsP = api.cards.list({ card_type: 'goal' })

    Promise.all([visionsP, goalsP]).then(function (results) {
      self._useApi = true
      self._render(results[0], results[1])
    }).catch(function () {
      self._useApi = false
      self.setData({ loading: false })
    })
  },

  _renderLocal: function () {
    var visions = storage.tasks.list({ cardType: 'vision' })
    var goals = storage.tasks.list({ cardType: 'goal' })
    this._render(visions, goals)
  },

  _render: function (visions, goals) {
    // 构建愿景树：每个 vision 带上其子 goals
    var goalsByParent = {}
    var standalone = []

    goals.forEach(function (g) {
      var pid = g.parentCardId || g.parent_card_id
      if (pid) {
        if (!goalsByParent[pid]) goalsByParent[pid] = []
        goalsByParent[pid].push(g)
      } else {
        standalone.push(g)
      }
    })

    var visionTree = visions.map(function (v) {
      var vid = v.id
      var children = goalsByParent[vid] || []
      var progress = getGoalProgress(children)
      return {
        vision: v,
        children: children,
        progress: progress,
      }
    })

    // 按进度排序：进行中的排前面
    visionTree.sort(function (a, b) {
      var aActive = a.progress.percentage > 0 && a.progress.percentage < 100 ? 1 : 0
      var bActive = b.progress.percentage > 0 && b.progress.percentage < 100 ? 1 : 0
      return bActive - aActive
    })

    this.setData({
      visions: visions,
      goals: goals,
      visionTree: visionTree,
      standaloneGoals: standalone,
      loading: false,
    })
  },

  onTabSwitch: function (e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab })
  },

  onVisionTap: function (e) {
    var id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/goals/goal-detail?id=' + id + '&type=vision' })
  },

  onGoalTap: function (e) {
    var id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/goals/goal-detail?id=' + id + '&type=goal' })
  },

  onAddVision: function () {
    getApp().globalData._addCardType = 'vision'
    wx.switchTab({ url: '/pages/add-task/add-task' })
  },

  onAddGoal: function () {
    getApp().globalData._addCardType = 'goal'
    wx.switchTab({ url: '/pages/add-task/add-task' })
  },
})
