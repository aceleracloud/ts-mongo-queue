import { MongoClient } from 'mongodb'

import { Queue } from './queue'

export const MongoQueue = (client: MongoClient, name: string, opts?: { visibility?: number; delay?: number; deadQueue?: Queue; maxRetries?: number }) => {
  return new Queue(client, name, opts)
}
