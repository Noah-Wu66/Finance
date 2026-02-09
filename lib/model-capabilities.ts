export const capabilityDescriptions = {
  1: '基础模型：适合简单问答',
  2: '标准模型：适合常规分析',
  3: '高级模型：适合复杂推理',
  4: '专业模型：适合高质量报告',
  5: '旗舰模型：适合关键决策支持'
}

export const depthRequirements = {
  快速: {
    min_capability: 1,
    quick_model_min: 1,
    deep_model_min: 2,
    required_features: ['fast_response'],
    description: '快速出结论，适合盘中查看'
  },
  基础: {
    min_capability: 2,
    quick_model_min: 2,
    deep_model_min: 2,
    required_features: [],
    description: '基础分析，覆盖关键指标'
  },
  标准: {
    min_capability: 2,
    quick_model_min: 2,
    deep_model_min: 3,
    required_features: ['reasoning'],
    description: '标准分析，适合大多数场景'
  },
  深度: {
    min_capability: 3,
    quick_model_min: 3,
    deep_model_min: 4,
    required_features: ['reasoning', 'long_context'],
    description: '深度研究，适合中长期分析'
  },
  全面: {
    min_capability: 4,
    quick_model_min: 4,
    deep_model_min: 5,
    required_features: ['reasoning', 'long_context', 'tool_calling'],
    description: '全面报告，适合策略级评估'
  }
}

export const defaultModelConfigs = {
  'live-quick': {
    model_name: 'live-quick',
    capability_level: 2,
    suitable_roles: ['quick_analysis'],
    features: ['fast_response', 'cost_effective'],
    recommended_depths: ['快速', '基础'],
    performance_metrics: { speed: 5, cost: 5, quality: 3 },
    description: '现场快速分析模型'
  },
  'live-deep': {
    model_name: 'live-deep',
    capability_level: 4,
    suitable_roles: ['deep_analysis'],
    features: ['reasoning', 'long_context'],
    recommended_depths: ['标准', '深度', '全面'],
    performance_metrics: { speed: 3, cost: 3, quality: 5 },
    description: '现场深度分析模型'
  }
}

export const allBadges = {
  capability_levels: {
    '1': { text: 'L1', color: '#94a3b8', icon: 'Dot' },
    '2': { text: 'L2', color: '#22c55e', icon: 'Circle' },
    '3': { text: 'L3', color: '#3b82f6', icon: 'Star' },
    '4': { text: 'L4', color: '#f59e0b', icon: 'Medal' },
    '5': { text: 'L5', color: '#ef4444', icon: 'Crown' }
  },
  roles: {
    quick_analysis: { text: '快速', color: '#14b8a6', icon: 'Flash' },
    deep_analysis: { text: '深度', color: '#6366f1', icon: 'Brain' },
    both: { text: '通用', color: '#0ea5e9', icon: 'Layers' }
  },
  features: {
    fast_response: { text: '快', color: '#16a34a', icon: 'Bolt' },
    cost_effective: { text: '省', color: '#0ea5e9', icon: 'Wallet' },
    reasoning: { text: '推理', color: '#8b5cf6', icon: 'Puzzle' },
    long_context: { text: '长上下文', color: '#f59e0b', icon: 'File' },
    tool_calling: { text: '工具', color: '#ef4444', icon: 'Wrench' }
  }
}

export function recommendByDepth(researchDepth: string) {
  if (researchDepth === '快速' || researchDepth === '基础') {
    return {
      quick_model: 'live-quick',
      deep_model: 'live-deep',
      quick_model_info: defaultModelConfigs['live-quick'],
      deep_model_info: defaultModelConfigs['live-deep'],
      reason: '快速场景优先使用响应更快的模型'
    }
  }

  return {
    quick_model: 'live-deep',
    deep_model: 'live-deep',
    quick_model_info: defaultModelConfigs['live-deep'],
    deep_model_info: defaultModelConfigs['live-deep'],
    reason: '深度场景建议统一使用高能力模型'
  }
}

export function validateModelPair(quickModel: string, deepModel: string, researchDepth: string) {
  const warnings: string[] = []
  const recommendations: string[] = []

  const quick = defaultModelConfigs[quickModel as keyof typeof defaultModelConfigs]
  const deep = defaultModelConfigs[deepModel as keyof typeof defaultModelConfigs]

  if (!quick) warnings.push(`快速模型 ${quickModel} 未登记能力信息`) 
  if (!deep) warnings.push(`深度模型 ${deepModel} 未登记能力信息`)

  if (quick && deep && quick.capability_level > deep.capability_level) {
    warnings.push('快速模型能力等级高于深度模型，建议对调')
  }

  if (researchDepth === '全面' && deep && deep.capability_level < 4) {
    warnings.push('全面分析建议使用能力等级4以上模型')
  }

  if (warnings.length === 0) {
    recommendations.push('模型搭配合理')
  }

  return {
    valid: warnings.length === 0,
    warnings,
    recommendations
  }
}
