// 目标详情页 — 展示子项 + AI 拆解 + 手动添加
var { getGoalProgress, getCardTypeInfo, createTask, CARD_TYPES } = require('../../utils/task-model')
var { formatDeadline } = require('../../utils/util')
var storage = require('../../utils/storage')
var api = require('../../utils/api')

Page({
  data: {
    card: null,
    cardType: 'vision',
    cardTypeInfo: null,
    children: [],
    progress: { completed: 0, total: 0, percentage: 0 },
    deadlineText: '',
    // AI 拆解
    aiLoading: false,
    showAiPanel: false,
    aiSuggestions: [],
    selectedAiCount: 0,
    // 手动添加
    newChildTitle: '',
  },

  onLoad: function (options) {
    this._cardId = options.id
    this._cardType = options.type || 'vision'
    this._useApi = false
    this.setData({
      cardType: this._cardType,
      cardTypeInfo: getCardTypeInfo(this._cardType),
    })
  },

  onShow: function () {
    this.loadCard()
  },

  loadCard: function () {
    var self = this

    // 本地先展示
    var localCard = storage.tasks.get(self._cardId)
    if (localCard) {
      self._setCard(localCard)
      var localChildren = storage.tasks.children(self._cardId)
      self._setChildren(localChildren)
    }

    // API
    api.cards.get(self._cardId).then(function (card) {
      self._useApi = true
      self._setCard(card)
      return api.cards.children(self._cardId)
    }).then(function (children) {
      self._setChildren(children)
    }).catch(function () {
      self._useApi = false
    })
  },

  _setCard: function (card) {
    this.setData({
      card: card,
      deadlineText: formatDeadline(card.deadline || card.due_date),
    })
  },

  _setChildren: function (children) {
    var progress = getGoalProgress(children)
    this.setData({
      children: children,
      progress: progress,
    })
  },

  // ---- 手动添加子项 ----

  onNewChildInput: function (e) {
    this.setData({ newChildTitle: e.detail.value })
  },

  addChild: function () {
    var title = this.data.newChildTitle.trim()
    if (!title) return

    var self = this
    var childType = self._cardType === 'vision' ? 'goal' : 'daily'
    var typeInfo = getCardTypeInfo(childType)

    var child = createTask({
      title: title,
      cardType: childType,
      parentCardId: self._cardId,
      card_type: childType,
      parent_card_id: parseInt(self._cardId) || self._cardId,
      coinReward: typeInfo.defaultCoinReward,
    })

    self.setData({ newChildTitle: '' })

    if (self._useApi) {
      api.cards.create(child).then(function () {
        self.loadCard()
      }).catch(function () {
        storage.tasks.create(child)
        self._addChildLocal(child)
      })
    } else {
      storage.tasks.create(child)
      self._addChildLocal(child)
    }
  },

  _addChildLocal: function (child) {
    var children = this.data.children.concat([child])
    this._setChildren(children)
  },

  // ---- 点击子项 ----

  onChildTap: function (e) {
    var child = e.currentTarget.dataset.child
    var childType = child.cardType || child.card_type || 'daily'
    if (childType === 'goal') {
      wx.navigateTo({ url: '/pages/goals/goal-detail?id=' + child.id + '&type=goal' })
    } else {
      wx.navigateTo({ url: '/pages/task-detail/task-detail?id=' + child.id })
    }
  },

  // ---- AI 拆解 ----

  onAiDecompose: function () {
    var self = this
    if (!self.data.card) return

    self.setData({ aiLoading: true })

    api.ai.decompose(self._cardId).then(function (res) {
      var suggestions = res.suggested_cards || []
      if (suggestions.length === 0) {
        // 尝试从 message 解析
        suggestions = self._parseFromText(res.message)
      }
      suggestions.forEach(function (s) { s.selected = true })
      self.setData({
        aiSuggestions: suggestions,
        showAiPanel: true,
        aiLoading: false,
        selectedAiCount: suggestions.length,
      })
    }).catch(function () {
      // 离线兜底
      var suggestions = self._generateFallback()
      suggestions.forEach(function (s) { s.selected = true })
      self.setData({
        aiSuggestions: suggestions,
        showAiPanel: true,
        aiLoading: false,
        selectedAiCount: suggestions.length,
      })
    })
  },

  _parseFromText: function (text) {
    if (!text || typeof text !== 'string') return []
    try {
      var match = text.match(/\[[\s\S]*\]/)
      if (match) {
        return JSON.parse(match[0]).filter(function (s) { return s.title })
      }
    } catch (e) {}
    return []
  },

  _generateFallback: function () {
    var card = this.data.card
    if (this._cardType === 'vision') {
      return [
        { title: '阶段一：基础入门', description: '打好基础', estimatedMinutes: 2400 },
        { title: '阶段二：进阶提升', description: '深入学习', estimatedMinutes: 3600 },
        { title: '阶段三：实战项目', description: '动手实践', estimatedMinutes: 4800 },
        { title: '阶段四：总结复盘', description: '查漏补缺', estimatedMinutes: 1200 },
      ]
    }
    return [
      { title: '第一步：了解基本概念', estimatedMinutes: 30 },
      { title: '第二步：跟着教程实操', estimatedMinutes: 60 },
      { title: '第三步：独立完成练习', estimatedMinutes: 45 },
      { title: '第四步：总结笔记', estimatedMinutes: 30 },
    ]
  },

  toggleAiSuggestion: function (e) {
    var idx = e.currentTarget.dataset.index
    var suggestions = this.data.aiSuggestions.slice()
    suggestions[idx].selected = !suggestions[idx].selected
    var count = suggestions.filter(function (s) { return s.selected }).length
    this.setData({ aiSuggestions: suggestions, selectedAiCount: count })
  },

  applyAiSuggestions: function () {
    var self = this
    var selected = self.data.aiSuggestions.filter(function (s) { return s.selected })
    if (selected.length === 0) {
      self.setData({ showAiPanel: false })
      return
    }

    var childType = self._cardType === 'vision' ? 'goal' : 'daily'
    var typeInfo = getCardTypeInfo(childType)

    var tasks = selected.map(function (s) {
      return createTask({
        title: s.title,
        description: s.description || '',
        estimatedMinutes: s.estimatedMinutes || 30,
        project: s.project || '',
        cardType: childType,
        card_type: childType,
        parentCardId: self._cardId,
        parent_card_id: parseInt(self._cardId) || self._cardId,
        coinReward: typeInfo.defaultCoinReward,
      })
    })

    self.setData({ showAiPanel: false, aiSuggestions: [] })

    if (self._useApi) {
      var promises = tasks.map(function (t) { return api.cards.create(t) })
      Promise.all(promises).then(function () {
        self.loadCard()
      }).catch(function () {
        storage.tasks.createBatch(tasks)
        self.loadCard()
      })
    } else {
      storage.tasks.createBatch(tasks)
      var children = self.data.children.concat(tasks)
      self._setChildren(children)
    }

    wx.showToast({ title: '已添加 ' + selected.length + ' 个' + typeInfo.label, icon: 'none' })
  },

  closeAiPanel: function () {
    this.setData({ showAiPanel: false, aiSuggestions: [] })
  },
})
