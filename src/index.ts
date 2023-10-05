import { Db } from 'mongodb'

import { Queue as InnerQueue } from './queue'

export const MongoQueue = (db: Db, name: string, opts?: { visibility?: number; delay?: number; deadQueue?: Queue; maxRetries?: number }) => {
  return new InnerQueue(db, name, opts)
}

export type Queue = InnerQueue
