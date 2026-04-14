import { Db } from 'mongodb'

import { Queue as InnerQueue } from './queue'
import { QueueV2 as InnerQueueV2 } from './v2/queue'

export const MongoQueue = (db: Db, name: string, opts?: { visibility?: number; delay?: number; deadQueue?: Queue; maxRetries?: number }) => {
  return new InnerQueue(db, name, opts)
}

export type Queue = InnerQueue

export const MongoQueueV2 = (db: Db, name: string, opts?: { visibility?: number; delay?: number; deadQueue?: QueueV2; maxRetries?: number }) => {
  return new InnerQueueV2(db, name, opts)
}

export type QueueV2 = InnerQueueV2
