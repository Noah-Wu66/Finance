import { MongoClient } from 'mongodb'

declare global {
  var __mongoClientPromise__: Promise<MongoClient> | undefined
}

function buildMongoUri(): string {
  if (process.env.MONGO_URI) {
    return process.env.MONGO_URI
  }

  const host = process.env.MONGODB_HOST || '127.0.0.1'
  const port = process.env.MONGODB_PORT || '27017'
  const username = process.env.MONGODB_USERNAME
  const password = process.env.MONGODB_PASSWORD
  const database = process.env.MONGODB_DATABASE || 'tradingagents'
  const authSource = process.env.MONGODB_AUTH_SOURCE || 'admin'

  if (username && password) {
    return `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${database}?authSource=${authSource}`
  }

  return `mongodb://${host}:${port}/${database}`
}

const uri = buildMongoUri()

function getClientPromise() {
  if (!global.__mongoClientPromise__) {
    const client = new MongoClient(uri, {
      maxPoolSize: 20,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000
    })
    global.__mongoClientPromise__ = client.connect()
  }

  return global.__mongoClientPromise__
}

export async function getDb() {
  const client = await getClientPromise()
  const dbName = process.env.MONGODB_DB || process.env.MONGODB_DATABASE || 'tradingagents'
  return client.db(dbName)
}
