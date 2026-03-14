// 任务卡片组件
const { priorityMap, energyMap } = require('../../utils/util')

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
  },

  observers: {
    'task.priority': function (priority) {
      const info = priorityMap[priority] || priorityMap.normal
      this.setData({
        priorityLabel: info.label,
        priorityIcon: info.icon,
        priorityColor: info.color,
        priorityBg: info.color + '15', // 15% 透明度背景
      })
    },
    'task.energy': function (energy) {
      const info = energyMap[energy] || energyMap.medium
      this.setData({
        energyLabel: info.label,
        energyColor: info.color,
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
  },
})
