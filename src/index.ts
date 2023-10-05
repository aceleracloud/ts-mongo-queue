import { MongoClient } from 'mongodb'

import { Queue as InnerQueue } from './queue'

export const MongoQueue = (client: MongoClient, name: string, opts?: { visibility?: number; delay?: number; deadQueue?: Queue; maxRetries?: number }) => {
  return new InnerQueue(client, name, opts)
}

export type Queue = InnerQueue
