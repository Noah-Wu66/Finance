import { MongoClient } from 'mongodb'

declare global {
  var __mongoClientPromise__: Promise<MongoClient> | undefined
}

function buildMongoUri(): string {
  if (process.env.MONGODB_URI) {
    return process.env.MONGODB_URI
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

const clientPromise =
  global.__mongoClientPromise__ ||
  new MongoClient(uri, {
    maxPoolSize: 20,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000
  }).connect()

if (!global.__mongoClientPromise__) {
  global.__mongoClientPromise__ = clientPromise
}

export async function getDb() {
  const client = await clientPromise
  const dbName = process.env.MONGODB_DB || process.env.MONGODB_DATABASE || 'tradingagents'
  return client.db(dbName)
}
