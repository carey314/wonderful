// 新建任务页面 - V2 升级版
const { createTask, createSubtask, PROJECT_PRESETS, formatMinutes } = require('../../utils/task-model')
const storage = require('../../utils/storage')

const projectList = Object.keys(PROJECT_PRESETS).map(function (key) {
  return Object.assign({ key: key }, PROJECT_PRESETS[key])
})

Page({
  data: {
    title: '',
    description: '',
    estimatedMinutes: 0,
    deadline: '',
    project: '',
    isUrgent: false,
    isImportant: false,
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

  // --- 基础输入 ---

  onTitleInput(e) {
    this.setData({ title: e.detail.value })
  },

  onDescInput(e) {
    this.setData({ description: e.detail.value })
  },

  // --- 时间预估 ---

  onTimeSelect(e) {
    const value = e.currentTarget.dataset.value
    this.setData({
      estimatedMinutes: this.data.estimatedMinutes === value ? 0 : value,
      customTime: '',
    })
  },

  onCustomTimeInput(e) {
    const val = parseInt(e.detail.value, 10)
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
    const key = e.currentTarget.dataset.key
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
    const title = this.data.subtaskInput.trim()
    if (!title) return
    const subtasks = [...this.data.subtasks, { id: 'sub_' + Date.now(), title: title, estimatedMinutes: 0 }]
    this.setData({ subtasks, subtaskInput: '' })
  },

  removeSubtask(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ subtasks: this.data.subtasks.filter((s) => s.id !== id) })
  },

  // --- 提交 ---

  onSubmit() {
    if (!this.data.title.trim()) {
      wx.showToast({ title: '请输入任务名称', icon: 'none' })
      return
    }

    const subtasks = this.data.subtasks.map(function (s) {
      return createSubtask({ title: s.title, estimatedMinutes: s.estimatedMinutes || 0 })
    })

    const task = createTask({
      title: this.data.title.trim(),
      description: this.data.description.trim(),
      estimatedMinutes: this.data.estimatedMinutes || 30,
      deadline: this.data.deadline,
      project: this.data.project,
      isUrgent: this.data.isUrgent,
      isImportant: this.data.isImportant,
      subtasks: subtasks,
    })

    // 持久化到本地存储
    storage.tasks.create(task)

    wx.showToast({ title: '创建成功', icon: 'success' })
    setTimeout(() => {
      wx.switchTab({ url: '/pages/tasks/tasks' })
    }, 1000)
  },
})
