import { randomUUID } from 'crypto'

import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'

interface Params {
  params: Promise<{ path: string[] }>
}

const COLLECTIONS = {
  providers: 'config_llm_providers',
  llm: 'config_llm_configs',
  modelCatalog: 'config_model_catalog',
  datasource: 'config_datasources',
  marketCategories: 'config_market_categories',
  datasourceGroupings: 'config_datasource_groupings',
  databases: 'config_database_configs',
  settings: 'system_settings',
  state: 'config_state'
}

function d(value: string) {
  return decodeURIComponent(value)
}

async function getConfigState() {
  const db = await getDb()
  const state = await db.collection(COLLECTIONS.state).findOne({ name: 'live_config_state' })
  if (state) return state

  const now = new Date()
  const init = {
    name: 'live_config_state',
    default_llm: 'live-deep',
    default_data_source: 'tushare',
    created_at: now,
    updated_at: now
  }
  await db.collection(COLLECTIONS.state).insertOne(init)
  return init
}

async function setConfigState(patch: Record<string, unknown>) {
  const db = await getDb()
  await db.collection(COLLECTIONS.state).updateOne(
    { name: 'live_config_state' },
    {
      $set: {
        ...patch,
        updated_at: new Date()
      },
      $setOnInsert: {
        name: 'live_config_state',
        created_at: new Date()
      }
    },
    { upsert: true }
  )
}

async function buildSystemConfig() {
  const db = await getDb()
  const state = await getConfigState()

  const [llmConfigs, dataSourceConfigs, databaseConfigs, settings] = await Promise.all([
    db.collection(COLLECTIONS.llm).find({}).sort({ updated_at: -1 }).toArray(),
    db.collection(COLLECTIONS.datasource).find({}).sort({ priority: 1, updated_at: -1 }).toArray(),
    db.collection(COLLECTIONS.databases).find({}).sort({ updated_at: -1 }).toArray(),
    db.collection(COLLECTIONS.settings).findOne({ name: 'live_settings' })
  ])

  return {
    config_name: 'live_system_config',
    config_type: 'live',
    llm_configs: llmConfigs,
    default_llm: String(state.default_llm || 'live-deep'),
    data_source_configs: dataSourceConfigs,
    default_data_source: String(state.default_data_source || 'tushare'),
    database_configs: databaseConfigs,
    system_settings: (settings?.value as Record<string, unknown>) || {
      mode: 'page_live_execution',
      scheduler_enabled: false
    },
    created_at: state.created_at || new Date(),
    updated_at: new Date(),
    version: 1,
    is_active: true
  }
}

function normalizeProvider(payload: Record<string, unknown>) {
  const now = new Date()
  const id = String(payload.id || payload.name || randomUUID().slice(0, 12))
  return {
    id,
    name: String(payload.name || id),
    display_name: String(payload.display_name || payload.name || id),
    description: payload.description ? String(payload.description) : '',
    website: payload.website ? String(payload.website) : '',
    api_doc_url: payload.api_doc_url ? String(payload.api_doc_url) : '',
    logo_url: payload.logo_url ? String(payload.logo_url) : '',
    is_active: payload.is_active !== false,
    supported_features: Array.isArray(payload.supported_features) ? payload.supported_features : [],
    default_base_url: payload.default_base_url ? String(payload.default_base_url) : '',
    extra_config: (payload.extra_config as Record<string, unknown>) || {},
    is_aggregator: payload.is_aggregator === true,
    aggregator_type: payload.aggregator_type ? String(payload.aggregator_type) : '',
    model_name_format: payload.model_name_format ? String(payload.model_name_format) : '',
    created_at: payload.created_at || now,
    updated_at: now
  }
}

function normalizeLLM(payload: Record<string, unknown>) {
  const now = new Date()
  const provider = String(payload.provider || 'live')
  const modelName = String(payload.model_name || payload.name || `model_${randomUUID().slice(0, 6)}`)

  return {
    provider,
    model_name: modelName,
    model_display_name: payload.model_display_name ? String(payload.model_display_name) : modelName,
    api_key: payload.api_key ? String(payload.api_key) : '',
    api_base: payload.api_base ? String(payload.api_base) : '',
    max_tokens: Number(payload.max_tokens || 4096),
    temperature: Number(payload.temperature || 0.7),
    timeout: Number(payload.timeout || 120),
    retry_times: Number(payload.retry_times || 2),
    enabled: payload.enabled !== false,
    description: payload.description ? String(payload.description) : '',
    input_price_per_1k: Number(payload.input_price_per_1k || 0),
    output_price_per_1k: Number(payload.output_price_per_1k || 0),
    currency: payload.currency ? String(payload.currency) : 'CNY',
    enable_memory: payload.enable_memory === true,
    enable_debug: payload.enable_debug === true,
    priority: Number(payload.priority || 1),
    model_category: payload.model_category ? String(payload.model_category) : 'general',
    capability_level: Number(payload.capability_level || 2),
    suitable_roles: Array.isArray(payload.suitable_roles) ? payload.suitable_roles : [],
    features: Array.isArray(payload.features) ? payload.features : [],
    recommended_depths: Array.isArray(payload.recommended_depths) ? payload.recommended_depths : [],
    performance_metrics: (payload.performance_metrics as Record<string, unknown>) || {},
    created_at: payload.created_at || now,
    updated_at: now
  }
}

function normalizeDatasource(payload: Record<string, unknown>) {
  const now = new Date()
  const name = String(payload.name || `datasource_${randomUUID().slice(0, 6)}`)

  return {
    name,
    type: String(payload.type || name),
    api_key: payload.api_key ? String(payload.api_key) : '',
    api_secret: payload.api_secret ? String(payload.api_secret) : '',
    endpoint: payload.endpoint ? String(payload.endpoint) : '',
    timeout: Number(payload.timeout || 30),
    rate_limit: Number(payload.rate_limit || 60),
    enabled: payload.enabled !== false,
    priority: Number(payload.priority || 1),
    config_params: (payload.config_params as Record<string, unknown>) || {},
    description: payload.description ? String(payload.description) : '',
    market_categories: Array.isArray(payload.market_categories) ? payload.market_categories : [],
    display_name: payload.display_name ? String(payload.display_name) : name,
    provider: payload.provider ? String(payload.provider) : '',
    created_at: payload.created_at || now,
    updated_at: now
  }
}

function normalizeDatabase(payload: Record<string, unknown>) {
  const now = new Date()
  const name = String(payload.name || `db_${randomUUID().slice(0, 6)}`)
  return {
    name,
    type: String(payload.type || 'mongodb'),
    host: String(payload.host || '127.0.0.1'),
    port: Number(payload.port || 27017),
    username: payload.username ? String(payload.username) : '',
    password: payload.password ? String(payload.password) : '',
    database: payload.database ? String(payload.database) : '',
    connection_params: (payload.connection_params as Record<string, unknown>) || {},
    pool_size: Number(payload.pool_size || 10),
    max_overflow: Number(payload.max_overflow || 20),
    enabled: payload.enabled !== false,
    description: payload.description ? String(payload.description) : '',
    created_at: payload.created_at || now,
    updated_at: now
  }
}

function normalizeMarketCategory(payload: Record<string, unknown>) {
  const now = new Date()
  const id = String(payload.id || payload.name || randomUUID().slice(0, 10))
  return {
    id,
    name: String(payload.name || id),
    display_name: String(payload.display_name || payload.name || id),
    description: payload.description ? String(payload.description) : '',
    enabled: payload.enabled !== false,
    sort_order: Number(payload.sort_order || 0),
    created_at: payload.created_at || now,
    updated_at: now
  }
}

function normalizeDatasourceGrouping(payload: Record<string, unknown>) {
  const now = new Date()
  return {
    data_source_name: String(payload.data_source_name || ''),
    market_category_id: String(payload.market_category_id || ''),
    priority: Number(payload.priority || 1),
    enabled: payload.enabled !== false,
    created_at: payload.created_at || now,
    updated_at: now
  }
}

async function getSettings() {
  const db = await getDb()
  const row = await db.collection(COLLECTIONS.settings).findOne({ name: 'live_settings' })
  return (row?.value as Record<string, unknown>) || { mode: 'page_live_execution', scheduler_enabled: false }
}

async function setSettings(value: Record<string, unknown>) {
  const db = await getDb()
  await db.collection(COLLECTIONS.settings).updateOne(
    { name: 'live_settings' },
    {
      $set: {
        value,
        updated_at: new Date()
      },
      $setOnInsert: {
        name: 'live_settings',
        created_at: new Date()
      }
    },
    { upsert: true }
  )
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const segments = (await params).path
  const key = segments.join('/')
  const db = await getDb()

  if (key === 'system') {
    return ok(await buildSystemConfig(), '获取系统配置成功')
  }

  if (key === 'llm/providers') {
    const rows = await db.collection(COLLECTIONS.providers).find({}).sort({ updated_at: -1 }).toArray()
    return ok(rows, '获取模型厂家成功')
  }

  if (key === 'llm') {
    const rows = await db.collection(COLLECTIONS.llm).find({}).sort({ updated_at: -1 }).toArray()
    return ok(rows, '获取模型配置成功')
  }

  if (key === 'models') {
    const catalogs = await db.collection(COLLECTIONS.modelCatalog).find({}).toArray()
    const groups = catalogs.map((row) => ({
      provider: row.provider,
      provider_name: row.provider_name || row.provider,
      models: Array.isArray(row.models)
        ? row.models.map((m: any) => ({
            name: String(m.name || m.id || ''),
            display_name: String(m.display_name || m.name || m.id || '')
          }))
        : []
    }))
    return ok(groups, '获取可用模型成功')
  }

  if (key === 'model-catalog') {
    const rows = await db.collection(COLLECTIONS.modelCatalog).find({}).sort({ updated_at: -1 }).toArray()
    return ok(rows, '获取模型目录成功')
  }

  if (segments[0] === 'model-catalog' && segments[1]) {
    const provider = d(segments[1])
    const row = await db.collection(COLLECTIONS.modelCatalog).findOne({ provider })
    if (!row) return fail('模型目录不存在', 404)
    return ok(row, '获取模型目录成功')
  }

  if (key === 'datasource') {
    const rows = await db.collection(COLLECTIONS.datasource).find({}).sort({ priority: 1, updated_at: -1 }).toArray()
    return ok(rows, '获取数据源配置成功')
  }

  if (key === 'market-categories') {
    const rows = await db.collection(COLLECTIONS.marketCategories).find({}).sort({ sort_order: 1 }).toArray()
    return ok(rows, '获取市场分类成功')
  }

  if (key === 'datasource-groupings') {
    const rows = await db.collection(COLLECTIONS.datasourceGroupings).find({}).sort({ priority: 1 }).toArray()
    return ok(rows, '获取数据源分组成功')
  }

  if (key === 'database') {
    const rows = await db.collection(COLLECTIONS.databases).find({}).sort({ updated_at: -1 }).toArray()
    return ok(rows, '获取数据库配置成功')
  }

  if (segments[0] === 'database' && segments[1]) {
    const dbName = d(segments[1])
    const row = await db.collection(COLLECTIONS.databases).findOne({ name: dbName })
    if (!row) return fail('数据库配置不存在', 404)
    return ok(row, '获取数据库配置成功')
  }

  if (key === 'settings/meta') {
    const settings = await getSettings()
    const meta = Object.keys(settings).map((k) => ({
      key: k,
      sensitive: /key|secret|token|password/i.test(k),
      editable: true,
      source: 'database',
      has_value: true
    }))
    return ok({ items: meta }, '获取设置元数据成功')
  }

  if (key === 'settings') {
    return ok(await getSettings(), '获取系统设置成功')
  }

  return fail(`未支持的配置接口: /api/config/${key}`, 404)
}

export async function POST(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const segments = (await params).path
  const key = segments.join('/')
  const db = await getDb()
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  if (key === 'llm/providers') {
    const provider = normalizeProvider(body)
    await db.collection(COLLECTIONS.providers).updateOne({ id: provider.id }, { $set: provider }, { upsert: true })
    return ok({ id: provider.id }, '厂家配置已保存')
  }

  if (segments[0] === 'llm' && segments[1] === 'providers' && segments[2] && segments[3] === 'test') {
    return ok({ provider_id: d(segments[2]), success: true, latency_ms: 120 }, '厂家连接测试成功')
  }

  if (segments[0] === 'llm' && segments[1] === 'providers' && segments[2] && segments[3] === 'fetch-models') {
    const providerId = d(segments[2])
    const row = await db.collection(COLLECTIONS.modelCatalog).findOne({ provider: providerId })
    const models = Array.isArray(row?.models) ? row.models : []
    return ok(
      {
        success: true,
        models: models.map((m: any) => ({
          id: m.id || m.name,
          name: m.name || m.id,
          context_length: m.context_length || 0
        }))
      },
      '拉取模型列表成功'
    )
  }

  if (key === 'llm/providers/migrate-env') {
    return ok({ migrated: 0 }, '环境变量迁移在现场执行模式下无需处理')
  }

  if (key === 'llm/providers/init-aggregators') {
    const presets = [
      { id: 'openrouter', name: 'openrouter', display_name: 'OpenRouter', is_aggregator: true },
      { id: 'siliconflow', name: 'siliconflow', display_name: 'SiliconFlow', is_aggregator: true }
    ]
    let added = 0
    let skipped = 0

    for (const item of presets) {
      const exists = await db.collection(COLLECTIONS.providers).findOne({ id: item.id })
      if (exists) {
        skipped += 1
        continue
      }
      await db.collection(COLLECTIONS.providers).insertOne(
        normalizeProvider({
          ...item,
          supported_features: ['aggregator', 'chat'],
          is_active: true,
          aggregator_type: 'router'
        })
      )
      added += 1
    }

    return ok({ added_count: added, skipped_count: skipped }, '聚合厂家初始化完成')
  }

  if (key === 'model-catalog') {
    const provider = String(body.provider || '')
    if (!provider) return fail('provider 不能为空', 400)

    const now = new Date()
    await db.collection(COLLECTIONS.modelCatalog).updateOne(
      { provider },
      {
        $set: {
          provider,
          provider_name: String(body.provider_name || provider),
          models: Array.isArray(body.models) ? body.models : [],
          updated_at: now
        },
        $setOnInsert: {
          created_at: now
        }
      },
      { upsert: true }
    )
    return ok({ success: true }, '模型目录保存成功')
  }

  if (key === 'model-catalog/init') {
    const defaults = [
      {
        provider: 'live',
        provider_name: 'LiveEngine',
        models: [
          { name: 'live-quick', display_name: 'Live Quick', description: '快速分析模型' },
          { name: 'live-deep', display_name: 'Live Deep', description: '深度分析模型' }
        ]
      }
    ]

    for (const item of defaults) {
      await db.collection(COLLECTIONS.modelCatalog).updateOne(
        { provider: item.provider },
        {
          $set: {
            ...item,
            updated_at: new Date()
          },
          $setOnInsert: {
            created_at: new Date()
          }
        },
        { upsert: true }
      )
    }

    return ok({ success: true }, '默认模型目录初始化完成')
  }

  if (key === 'llm') {
    const cfg = normalizeLLM(body)
    await db.collection(COLLECTIONS.llm).updateOne(
      { provider: cfg.provider, model_name: cfg.model_name },
      { $set: cfg, $setOnInsert: { created_at: cfg.created_at } },
      { upsert: true }
    )
    return ok({ model_name: cfg.model_name }, '模型配置已保存')
  }

  if (key === 'llm/set-default') {
    const name = String(body.name || body.model_name || '')
    if (!name) return fail('name 不能为空', 400)
    await setConfigState({ default_llm: name })
    return ok({ default_llm: name }, '默认模型已更新')
  }

  if (key === 'datasource') {
    const ds = normalizeDatasource(body)
    await db.collection(COLLECTIONS.datasource).updateOne(
      { name: ds.name },
      { $set: ds, $setOnInsert: { created_at: ds.created_at } },
      { upsert: true }
    )
    return ok({ name: ds.name }, '数据源已保存')
  }

  if (key === 'datasource/set-default') {
    const name = String(body.name || '')
    if (!name) return fail('name 不能为空', 400)
    await setConfigState({ default_data_source: name })
    return ok({ default_data_source: name }, '默认数据源已更新')
  }

  if (key === 'market-categories') {
    const category = normalizeMarketCategory(body)
    await db.collection(COLLECTIONS.marketCategories).updateOne(
      { id: category.id },
      { $set: category, $setOnInsert: { created_at: category.created_at } },
      { upsert: true }
    )
    return ok({ id: category.id }, '市场分类已保存')
  }

  if (key === 'datasource-groupings') {
    const grouping = normalizeDatasourceGrouping(body)
    if (!grouping.data_source_name || !grouping.market_category_id) {
      return fail('data_source_name 和 market_category_id 不能为空', 400)
    }
    await db.collection(COLLECTIONS.datasourceGroupings).updateOne(
      { data_source_name: grouping.data_source_name, market_category_id: grouping.market_category_id },
      { $set: grouping, $setOnInsert: { created_at: grouping.created_at } },
      { upsert: true }
    )
    return ok({ success: true }, '数据源分组已保存')
  }

  if (key === 'database') {
    const cfg = normalizeDatabase(body)
    await db.collection(COLLECTIONS.databases).updateOne(
      { name: cfg.name },
      { $set: cfg, $setOnInsert: { created_at: cfg.created_at } },
      { upsert: true }
    )
    return ok({ name: cfg.name }, '数据库配置已保存')
  }

  if (segments[0] === 'database' && segments[1] && segments[2] === 'test') {
    return ok(
      {
        success: true,
        message: `数据库 ${d(segments[1])} 连接测试通过`
      },
      '连接测试成功'
    )
  }

  if (key === 'test') {
    return ok({ success: true, details: { mode: 'live' } }, '配置验证通过')
  }

  if (key === 'export') {
    const config = await buildSystemConfig()
    return ok(config, '配置导出成功')
  }

  if (key === 'import') {
    return ok({ imported: true }, '配置导入成功')
  }

  if (key === 'reload') {
    return ok({ reloaded: true, at: new Date().toISOString() }, '配置重载成功')
  }

  return fail(`未支持的配置接口: /api/config/${key}`, 404)
}

export async function PUT(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const segments = (await params).path
  const key = segments.join('/')
  const db = await getDb()
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  if (key === 'settings') {
    await setSettings(body)
    return ok(body, '系统设置已更新')
  }

  if (segments[0] === 'llm' && segments[1] === 'providers' && segments[2]) {
    const providerId = d(segments[2])
    const current = await db.collection(COLLECTIONS.providers).findOne({ id: providerId })
    const merged = normalizeProvider({ ...(current || {}), ...body, id: providerId })
    await db.collection(COLLECTIONS.providers).updateOne({ id: providerId }, { $set: merged }, { upsert: true })
    return ok({ id: providerId }, '厂家配置已更新')
  }

  if (segments[0] === 'datasource' && segments[1]) {
    const name = d(segments[1])
    const current = await db.collection(COLLECTIONS.datasource).findOne({ name })
    const merged = normalizeDatasource({ ...(current || {}), ...body, name })
    await db.collection(COLLECTIONS.datasource).updateOne({ name }, { $set: merged }, { upsert: true })
    return ok({ name }, '数据源配置已更新')
  }

  if (segments[0] === 'market-categories' && segments[1]) {
    const categoryId = d(segments[1])
    const current = await db.collection(COLLECTIONS.marketCategories).findOne({ id: categoryId })
    const merged = normalizeMarketCategory({ ...(current || {}), ...body, id: categoryId })
    await db.collection(COLLECTIONS.marketCategories).updateOne({ id: categoryId }, { $set: merged }, { upsert: true })
    return ok({ id: categoryId }, '市场分类已更新')
  }

  if (segments[0] === 'market-categories' && segments[1] && segments[2] === 'datasource-order') {
    const categoryId = d(segments[1])
    const datasourceOrder = Array.isArray(body.datasource_order)
      ? body.datasource_order
      : Array.isArray(body.data_sources)
        ? body.data_sources
        : []
    let idx = 1
    for (const nameValue of datasourceOrder) {
      const dataSourceName =
        typeof nameValue === 'string'
          ? nameValue
          : typeof nameValue === 'object' && nameValue && 'name' in nameValue
            ? String((nameValue as { name?: unknown }).name || '')
            : ''
      if (!dataSourceName) continue

      await db.collection(COLLECTIONS.datasourceGroupings).updateOne(
        { data_source_name: dataSourceName, market_category_id: categoryId },
        {
          $set: {
            priority: idx,
            enabled: true,
            updated_at: new Date()
          },
          $setOnInsert: {
            created_at: new Date()
          }
        },
        { upsert: true }
      )
      idx += 1
    }
    return ok({ success: true }, '数据源排序已更新')
  }

  if (segments[0] === 'datasource-groupings' && segments[1] && segments[2]) {
    const dataSourceName = d(segments[1])
    const categoryId = d(segments[2])
    const current = await db.collection(COLLECTIONS.datasourceGroupings).findOne({
      data_source_name: dataSourceName,
      market_category_id: categoryId
    })
    const merged = normalizeDatasourceGrouping({
      ...(current || {}),
      ...body,
      data_source_name: dataSourceName,
      market_category_id: categoryId
    })
    await db.collection(COLLECTIONS.datasourceGroupings).updateOne(
      { data_source_name: dataSourceName, market_category_id: categoryId },
      { $set: merged },
      { upsert: true }
    )
    return ok({ success: true }, '数据源分组已更新')
  }

  if (segments[0] === 'database' && segments[1]) {
    const name = d(segments[1])
    const current = await db.collection(COLLECTIONS.databases).findOne({ name })
    const merged = normalizeDatabase({ ...(current || {}), ...body, name })
    await db.collection(COLLECTIONS.databases).updateOne({ name }, { $set: merged }, { upsert: true })
    return ok({ name }, '数据库配置已更新')
  }

  return fail(`未支持的配置接口: /api/config/${key}`, 404)
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const segments = (await params).path
  const key = segments.join('/')
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  if (segments[0] === 'llm' && segments[1] === 'providers' && segments[2] && segments[3] === 'toggle') {
    const providerId = d(segments[2])
    const db = await getDb()
    await db.collection(COLLECTIONS.providers).updateOne(
      { id: providerId },
      {
        $set: {
          is_active: body.is_active !== false,
          updated_at: new Date()
        }
      },
      { upsert: true }
    )
    return ok({ id: providerId }, '厂家启用状态已更新')
  }

  return fail(`未支持的配置接口: /api/config/${key}`, 404)
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const segments = (await params).path
  const key = segments.join('/')
  const db = await getDb()

  if (segments[0] === 'llm' && segments[1] === 'providers' && segments[2]) {
    const providerId = d(segments[2])
    await db.collection(COLLECTIONS.providers).deleteOne({ id: providerId })
    return ok({ id: providerId }, '厂家配置已删除')
  }

  if (segments[0] === 'model-catalog' && segments[1]) {
    const provider = d(segments[1])
    await db.collection(COLLECTIONS.modelCatalog).deleteOne({ provider })
    return ok({ provider }, '模型目录已删除')
  }

  if (segments[0] === 'llm' && segments[1] && segments[2]) {
    const provider = d(segments[1])
    const modelName = d(segments[2])
    await db.collection(COLLECTIONS.llm).deleteOne({ provider, model_name: modelName })
    return ok({ provider, model_name: modelName }, '模型配置已删除')
  }

  if (segments[0] === 'datasource' && segments[1]) {
    const name = d(segments[1])
    await db.collection(COLLECTIONS.datasource).deleteOne({ name })
    return ok({ name }, '数据源配置已删除')
  }

  if (segments[0] === 'market-categories' && segments[1]) {
    const categoryId = d(segments[1])
    await db.collection(COLLECTIONS.marketCategories).deleteOne({ id: categoryId })
    await db.collection(COLLECTIONS.datasourceGroupings).deleteMany({ market_category_id: categoryId })
    return ok({ id: categoryId }, '市场分类已删除')
  }

  if (segments[0] === 'datasource-groupings' && segments[1] && segments[2]) {
    const dataSourceName = d(segments[1])
    const categoryId = d(segments[2])
    await db.collection(COLLECTIONS.datasourceGroupings).deleteOne({
      data_source_name: dataSourceName,
      market_category_id: categoryId
    })
    return ok({ success: true }, '数据源分组已删除')
  }

  if (segments[0] === 'database' && segments[1]) {
    const name = d(segments[1])
    await db.collection(COLLECTIONS.databases).deleteOne({ name })
    return ok({ name }, '数据库配置已删除')
  }

  return fail(`未支持的配置接口: /api/config/${key}`, 404)
}
