import { ObjectId } from 'mongodb'

import { getDb } from '@/lib/db'

const ACCOUNT_COLL = 'paper_accounts'
const POSITION_COLL = 'paper_positions'
const ORDER_COLL = 'paper_orders'

const INITIAL_CASH = 1_000_000

interface PaperAccount {
  _id: ObjectId
  user_id: string
  cash: number
  realized_pnl: number
  updated_at: Date
}

interface PaperPosition {
  _id: ObjectId
  user_id: string
  code: string
  quantity: number
  avg_cost: number
  updated_at: Date
}

export type OrderSide = 'buy' | 'sell'

async function getLatestPrice(code: string) {
  const db = await getDb()
  const quote = await db
    .collection('stock_quotes')
    .find({
      $or: [{ symbol: code }, { stock_code: code }, { code }]
    })
    .sort({ trade_date: -1, date: -1, updated_at: -1, created_at: -1 })
    .limit(1)
    .next()

  const price = Number(quote?.close ?? quote?.price ?? quote?.last ?? 0)
  return price > 0 ? price : 10
}

export async function ensureAccount(userId: string) {
  const db = await getDb()
  const accounts = db.collection<PaperAccount>(ACCOUNT_COLL)

  let account = await accounts.findOne({ user_id: userId })
  if (!account) {
    const now = new Date()
    const result = await accounts.insertOne({
      user_id: userId,
      cash: INITIAL_CASH,
      realized_pnl: 0,
      updated_at: now
    } as Omit<PaperAccount, '_id'>)
    account = await accounts.findOne({ _id: result.insertedId })
  }

  return account
}

export async function getPositions(userId: string) {
  const db = await getDb()
  const rows = await db.collection<PaperPosition>(POSITION_COLL).find({ user_id: userId }).sort({ updated_at: -1 }).toArray()

  const items = [] as Array<{
    code: string
    quantity: number
    avg_cost: number
    last_price: number
    market_value: number
    unrealized_pnl: number
  }>

  for (const row of rows) {
    const lastPrice = await getLatestPrice(row.code)
    const marketValue = lastPrice * row.quantity
    const unrealized = (lastPrice - row.avg_cost) * row.quantity
    items.push({
      code: row.code,
      quantity: row.quantity,
      avg_cost: row.avg_cost,
      last_price: lastPrice,
      market_value: marketValue,
      unrealized_pnl: unrealized
    })
  }

  return items
}

export async function getOrders(userId: string, limit = 50) {
  const db = await getDb()
  const rows = await db
    .collection(ORDER_COLL)
    .find({ user_id: userId })
    .sort({ created_at: -1 })
    .limit(Math.min(Math.max(limit, 1), 300))
    .toArray()

  return rows.map((row) => ({
    user_id: row.user_id,
    code: row.code,
    side: row.side,
    quantity: row.quantity,
    price: row.price,
    amount: row.amount,
    status: row.status,
    created_at: row.created_at,
    filled_at: row.filled_at
  }))
}

export async function getAccountSummary(userId: string) {
  const account = await ensureAccount(userId)
  const positions = await getPositions(userId)

  const positionsValue = positions.reduce((sum, item) => sum + item.market_value, 0)
  const equity = Number(account?.cash || 0) + positionsValue

  return {
    account: {
      cash: Number(account?.cash || 0),
      realized_pnl: Number(account?.realized_pnl || 0),
      positions_value: {
        CNY: positionsValue,
        HKD: 0,
        USD: 0
      },
      equity,
      updated_at: account?.updated_at || new Date()
    },
    positions
  }
}

export async function placeOrder(input: {
  userId: string
  code: string
  side: OrderSide
  quantity: number
}) {
  const db = await getDb()
  const accounts = db.collection<PaperAccount>(ACCOUNT_COLL)
  const positions = db.collection<PaperPosition>(POSITION_COLL)
  const orders = db.collection(ORDER_COLL)

  const code = input.code.trim().toUpperCase()
  const quantity = Math.floor(input.quantity)
  if (!code || quantity <= 0) {
    throw new Error('股票代码或数量无效')
  }

  const account = await ensureAccount(input.userId)
  if (!account) {
    throw new Error('账户初始化失败')
  }

  const price = await getLatestPrice(code)
  const amount = Number((price * quantity).toFixed(2))
  const now = new Date()

  const position = await positions.findOne({ user_id: input.userId, code })

  if (input.side === 'buy') {
    if (account.cash < amount) {
      throw new Error('可用资金不足')
    }

    const newQty = (position?.quantity || 0) + quantity
    const newCost =
      newQty > 0
        ? ((position?.avg_cost || 0) * (position?.quantity || 0) + amount) / newQty
        : price

    await positions.updateOne(
      { user_id: input.userId, code },
      {
        $set: {
          quantity: newQty,
          avg_cost: Number(newCost.toFixed(4)),
          updated_at: now
        },
        $setOnInsert: {
          user_id: input.userId,
          code
        }
      },
      { upsert: true }
    )

    await accounts.updateOne(
      { user_id: input.userId },
      {
        $set: {
          cash: Number((account.cash - amount).toFixed(2)),
          updated_at: now
        }
      }
    )
  } else {
    if (!position || position.quantity < quantity) {
      throw new Error('持仓不足，无法卖出')
    }

    const realized = Number(((price - position.avg_cost) * quantity).toFixed(2))
    const leftQty = position.quantity - quantity

    if (leftQty === 0) {
      await positions.deleteOne({ _id: position._id })
    } else {
      await positions.updateOne(
        { _id: position._id },
        {
          $set: {
            quantity: leftQty,
            updated_at: now
          }
        }
      )
    }

    await accounts.updateOne(
      { user_id: input.userId },
      {
        $set: {
          cash: Number((account.cash + amount).toFixed(2)),
          realized_pnl: Number((account.realized_pnl + realized).toFixed(2)),
          updated_at: now
        }
      }
    )
  }

  const order = {
    user_id: input.userId,
    code,
    side: input.side,
    quantity,
    price,
    amount,
    status: 'filled',
    created_at: now,
    filled_at: now
  }

  await orders.insertOne(order)
  return order
}

export async function resetAccount(userId: string) {
  const db = await getDb()
  const now = new Date()

  await db.collection(POSITION_COLL).deleteMany({ user_id: userId })
  await db.collection(ORDER_COLL).deleteMany({ user_id: userId })
  await db.collection(ACCOUNT_COLL).updateOne(
    { user_id: userId },
    {
      $set: {
        cash: INITIAL_CASH,
        realized_pnl: 0,
        updated_at: now
      },
      $setOnInsert: {
        user_id: userId
      }
    },
    { upsert: true }
  )

  return {
    message: '账户已重置',
    cash: INITIAL_CASH
  }
}
