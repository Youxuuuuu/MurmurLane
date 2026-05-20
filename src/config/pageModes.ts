export const pageModeMeta = {
  Diary: { title: "日记页面", dateBased: true },
  DailySummary: { title: "摘要页面", dateBased: true },
  Letters: { title: "信件页面", dateBased: true },
  Facts: { title: "稳定事实", dateBased: false },
  Preference: { title: "长期偏好", dateBased: false },
  Openloops: { title: "TO DO", dateBased: false },
  Project: { title: "长期任务", dateBased: false },
  Patterns: { title: "行为跟踪", dateBased: false },
};

export const pageModes = Object.keys(pageModeMeta);
export const xiaoyeModeMeta = {
  Ins: {
    title: "ins",
    sourcePath: "~/.cyberboss/weixin-instructions.md",
    apiMode: "weixin_instructions",
  },
  PersonalityAnchor: {
    title: "人格锚点",
    sourcePath: "~/.cyberboss/personality-anchor.md",
    apiMode: "personality_anchor",
  },
};
export const xiaoyeModes = Object.keys(xiaoyeModeMeta);
