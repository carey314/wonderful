// 任务卡片组件 - V3 滑动手势 + 子任务直接可见
var { priorityMap, energyMap, formatDeadline } = require('../../utils/util')
var { getTaskProgress, getSubtaskCountText, getTotalEstimatedMinutes, formatMinutes, getProjectInfo, toggleSubtask, isOverdue } = require('../../utils/task-model')

Component({
  properties: {
    task: { type: Object, value: {} },
    mode: { type: String, value: 'simple' },
    completed: { type: Boolean, value: false },
  },

  data: {
    priorityLabel: '',
    priorityIcon: '',
    priorityColor: '',
    priorityBg: '',
    energyLabel: '',
    energyColor: '',
    // 子任务
    hasSubtasks: false,
    progress: 0,
    subtaskCountText: '',
    visibleSubtasks: [],
    extraSubtaskCount: 0,
    showAllSubtasks: false,
    // 信息
    estimatedTimeText: '',
    projectInfo: null,
    deadlineText: '',
    overdue: false,
  },

  observers: {
    'task.priority': function (priority) {
      var info = priorityMap[priority] || priorityMap.normal
      this.setData({
        priorityLabel: info.label,
        priorityIcon: info.icon,
        priorityColor: info.color,
        priorityBg: info.color + '15',
      })
    },
    'task.energy': function (energy) {
      var info = energyMap[energy] || energyMap.medium
      this.setData({ energyLabel: info.label, energyColor: info.color })
    },
    'task': function (task) {
      if (!task) return
      var subs = task.subtasks || []
      var hasSubtasks = subs.length > 0
      this.setData({
        hasSubtasks: hasSubtasks,
        progress: getTaskProgress(task),
        subtaskCountText: getSubtaskCountText(task),
        visibleSubtasks: subs.slice(0, 3),
        extraSubtaskCount: Math.max(0, subs.length - 3),
        estimatedTimeText: formatMinutes(getTotalEstimatedMinutes(task)),
        projectInfo: getProjectInfo(task.project),
        deadlineText: formatDeadline(task.deadline),
        overdue: isOverdue(task),
      })
    },
  },

  methods: {
    onComplete: function () {
      this.triggerEvent('complete', { taskId: this.data.task.id })
    },
    onPostpone: function () {
      this.triggerEvent('postpone', { taskId: this.data.task.id })
    },
    onTap: function () {
      this.triggerEvent('tap', { taskId: this.data.task.id })
    },
    toggleShowAll: function () {
      this.setData({ showAllSubtasks: !this.data.showAllSubtasks })
    },
    onToggleSubtask: function (e) {
      var subtaskId = e.currentTarget.dataset.id
      var task = this.data.task
      var updatedTask = toggleSubtask(task, subtaskId)
      this.triggerEvent('subtaskToggle', {
        taskId: task.id,
        subtaskId: subtaskId,
        updatedTask: updatedTask,
      })
      if (updatedTask.subtasks.every(function (s) { return s.completed })) {
        this.triggerEvent('complete', { taskId: task.id })
      }
    },
  },
})
