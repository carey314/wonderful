// 对话气泡组件
Component({
  properties: {
    // 消息类型: ai | user
    type: {
      type: String,
      value: 'ai',
    },
    // 消息内容
    content: {
      type: String,
      value: '',
    },
    // 时间戳
    timestamp: {
      type: String,
      value: '',
    },
  },
})
