export interface LearningArticleMeta {
  id: string
  title: string
  category: string
  filePath: string
  summary: string
}

export const learningArticles: LearningArticleMeta[] = [
  {
    id: 'quick-start',
    title: '快速上手',
    category: 'overview',
    filePath: 'docs/overview/quick-start.md',
    summary: '项目快速入门与常用操作说明。'
  },
  {
    id: 'project-overview',
    title: '项目概览',
    category: 'overview',
    filePath: 'docs/overview/project-overview.md',
    summary: '整体结构、功能模块与核心能力说明。'
  },
  {
    id: 'web-interface-guide',
    title: '网页界面指南',
    category: 'usage',
    filePath: 'docs/usage/web-interface-guide.md',
    summary: '原网页功能的操作说明与页面介绍。'
  },
  {
    id: 'investment-analysis-guide',
    title: '投资分析指南',
    category: 'usage',
    filePath: 'docs/usage/investment_analysis_guide.md',
    summary: '股票分析方法与结果解读建议。'
  },
  {
    id: 'configuration-guide',
    title: '配置说明',
    category: 'configuration',
    filePath: 'docs/configuration/configuration_guide.md',
    summary: '模型、数据源和系统参数配置说明。'
  }
]
