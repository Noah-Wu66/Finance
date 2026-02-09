export const capabilityDescriptions = {
  1: '基础模型：适合简单问答',
  2: '标准模型：适合常规分析',
  3: '高级模型：适合复杂推理',
  4: '专业模型：适合高质量报告',
  5: '旗舰模型：适合关键决策支持'
}

export const depthRequirements = {
  全面: {
    min_capability: 4,
    quick_model_min: 4,
    deep_model_min: 5,
    required_features: ['reasoning', 'long_context', 'tool_calling'],
    description: '全面报告，适合策略级评估'
  }
}

export const defaultModelConfigs = {
  'live-deep': {
    model_name: 'live-deep',
    capability_level: 4,
    suitable_roles: ['deep_analysis'],
    features: ['reasoning', 'long_context'],
    recommended_depths: ['全面'],
    performance_metrics: { speed: 3, cost: 3, quality: 5 },
    description: '全面分析模型'
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

export function recommendByDepth(_researchDepth: string) {
  return {
    quick_model: 'live-deep',
    deep_model: 'live-deep',
    quick_model_info: defaultModelConfigs['live-deep'],
    deep_model_info: defaultModelConfigs['live-deep'],
    reason: '全面分析统一使用高能力模型'
  }
}

export function validateModelPair(quickModel: string, deepModel: string, _researchDepth: string) {
  const warnings: string[] = []
  const recommendations: string[] = []

  const quick = defaultModelConfigs[quickModel as keyof typeof defaultModelConfigs]
  const deep = defaultModelConfigs[deepModel as keyof typeof defaultModelConfigs]

  if (!quick) warnings.push(`快速模型 ${quickModel} 未登记能力信息`) 
  if (!deep) warnings.push(`深度模型 ${deepModel} 未登记能力信息`)

  if (quick && deep && quick.capability_level > deep.capability_level) {
    warnings.push('快速模型能力等级高于深度模型，建议对调')
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
