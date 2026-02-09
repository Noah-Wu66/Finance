import { ObjectId } from 'mongodb'

export function maybeObjectId(value: string) {
  return ObjectId.isValid(value) ? new ObjectId(value) : null
}

export function userIdOrFilter(userId: string) {
  const filter: Array<Record<string, unknown>> = [{ user_id: userId }]
  const oid = maybeObjectId(userId)
  if (oid) {
    filter.push({ user_id: oid })
  }
  return { $or: filter }
}
