// 任务卡片组件 - V2 升级版
const { priorityMap, energyMap, formatDeadline } = require('../../utils/util')
const { getTaskProgress, getSubtaskCountText, getTotalEstimatedMinutes, formatMinutes, getProjectInfo, toggleSubtask, isOverdue } = require('../../utils/task-model')

Component({
  properties: {
    // 任务数据对象
    task: {
      type: Object,
      value: {},
    },
    // 显示模式: simple(首页简洁) | detail(列表详细)
    mode: {
      type: String,
      value: 'simple',
    },
    // 是否已完成
    completed: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    priorityLabel: '',
    priorityIcon: '',
    priorityColor: '',
    priorityBg: '',
    energyLabel: '',
    energyColor: '',
    // V2 新增
    expanded: false,
    progress: 0,
    subtaskCountText: '',
    estimatedTimeText: '',
    projectInfo: null,
    deadlineText: '',
    overdue: false,
    hasSubtasks: false,
  },

  observers: {
    'task.priority': function (priority) {
      const info = priorityMap[priority] || priorityMap.normal
      this.setData({
        priorityLabel: info.label,
        priorityIcon: info.icon,
        priorityColor: info.color,
        priorityBg: info.color + '15',
      })
    },
    'task.energy': function (energy) {
      const info = energyMap[energy] || energyMap.medium
      this.setData({
        energyLabel: info.label,
        energyColor: info.color,
      })
    },
    'task': function (task) {
      if (!task) return
      const hasSubtasks = task.subtasks && task.subtasks.length > 0
      const progress = getTaskProgress(task)
      const totalMinutes = getTotalEstimatedMinutes(task)
      this.setData({
        hasSubtasks: hasSubtasks,
        progress: progress,
        subtaskCountText: getSubtaskCountText(task),
        estimatedTimeText: formatMinutes(totalMinutes),
        projectInfo: getProjectInfo(task.project),
        deadlineText: formatDeadline(task.deadline),
        overdue: isOverdue(task),
      })
    },
  },

  methods: {
    // 完成任务
    onComplete() {
      this.triggerEvent('complete', { taskId: this.data.task.id })
    },

    // 跳过/不想做
    onSkip() {
      this.triggerEvent('skip', { taskId: this.data.task.id })
    },

    // 点击卡片查看详情
    onTap() {
      this.triggerEvent('tap', { taskId: this.data.task.id })
    },

    // 展开/折叠子任务
    toggleExpand() {
      this.setData({ expanded: !this.data.expanded })
    },

    // 勾选子任务
    onToggleSubtask(e) {
      const subtaskId = e.currentTarget.dataset.id
      const task = this.data.task
      const updatedTask = toggleSubtask(task, subtaskId)
      const allDone = updatedTask.subtasks.every(function (s) { return s.completed })

      // 通知父页面更新任务数据
      this.triggerEvent('subtaskToggle', {
        taskId: task.id,
        subtaskId: subtaskId,
        updatedTask: updatedTask,
      })

      // 全部子任务完成 → 触发父任务完成事件
      if (allDone) {
        this.triggerEvent('complete', { taskId: task.id })
      }
    },
  },
})
