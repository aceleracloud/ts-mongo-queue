import { Db, Collection, FindOneAndUpdateOptions } from 'mongodb'

import { id, now, nowPlusSecs } from './helpers'
import { GET_RECURSION_LIMIT } from './config'

export class Queue {
  private db: Db
  private collection: Collection
  private visibility: number
  private delay: number
  private deadQueue?: Queue
  private maxRetries?: number

  /**
   * Constructs a new Mongo Queue.
   * @param db - The MongoClient instance.
   * @param name - The name of the queue.
   * @param opts - Queue options.
   */
  constructor(db: Db, name: string, opts?: { visibility?: number; delay?: number; deadQueue?: Queue; maxRetries?: number }) {
    if (!db || !Queue.isConnected(db)) {
      throw new Error('MongoQueue: provide a mongodb.MongoClient.db')
    }

    if (!name) {
      throw new Error('MongoQueue: Provide a queue name.')
    }

    this.db = db
    this.collection = this.db.collection(name)
    this.visibility = opts?.visibility ?? 60
    this.delay = opts?.delay ?? 60

    if (opts?.deadQueue) {
      this.deadQueue = opts.deadQueue
      this.maxRetries = opts.maxRetries ?? 5
    }
  }

  /**
   * Check if a MongoClient instance is connected.
   * @param db - The MongoClient Db.
   * @returns A promise that resolves to a boolean indicating if the client is connected.
   */
  static async isConnected(db: Db): Promise<boolean> {
    try {
      const adminDb = db.admin()
      await adminDb.ping()

      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Creates necessary indexes for the queue.
   */
  async createIndexes(): Promise<void> {
    await this.collection.createIndex({ deleted: 1, visible: 1 })
    await this.collection.createIndex({ ack: 1 }, { unique: true, sparse: true })
  }

  /**
   * Add a new message to the queue.
   * @param payload - The message payload.
   * @param opts - Message options.
   * @returns A promise that resolves to the ID and ack of the message.
   */
  async add(payload: any, opts?: { delay?: number }): Promise<{ _id: string; ack: string; payload: any }> {
    const delay = opts?.delay ?? this.delay
    const visible = delay ? nowPlusSecs(delay) : now()

    const msg = {
      visible: visible,
      payload: payload,
      ack: id(),
    }

    const result = await this.collection.insertOne(msg)

    return {
      _id: result.insertedId.toHexString(),
      ack: msg.ack,
      payload: msg.payload,
    }
  }

  /**
   * Adds multiple messages to the queue.
   * @param payloads - An array of payloads to be added to the queue.
   * @param opts - Optional configuration object.
   * @param opts.delay - Time in seconds to delay the visibility of the messages.
   * @returns An object containing arrays of the message IDs and acknowledgments (acks).
   *
   * @throws Will throw an error if the insertion fails.
   */
  async addMany(payloads: any[], opts?: { delay?: number }): Promise<Array<{ _id: string; ack: string; payload: any }>> {
    const delay = opts?.delay ?? this.delay
    const visible = delay ? nowPlusSecs(delay) : now()
    const msgs = payloads.map(payload => ({
      visible,
      payload,
      ack: id(),
    }))

    try {
      const results = await this.collection.insertMany(msgs)

      return msgs.map((msg, index) => ({
        _id: results.insertedIds[index].toHexString(),
        ack: msg.ack,
        payload: msg.payload,
      }))
    } catch (error: any) {
      throw new Error(`Failed to insert many messages: ${error.message}`)
    }
  }

  /**
   * Acknowledges the processing of a message from the queue.
   * @param ack - The acknowledgment token of the message to be acknowledged.
   * @returns The ID of the acknowledged message.
   *
   * @throws Will throw an error if the acknowledgment fails or if the ack token is not identified.
   */
  async ack(ack: string): Promise<string> {
    const query = {
      ack,
      deleted: null,
    }
    const update = {
      $set: {
        deleted: now(),
      },
    }
    const options: FindOneAndUpdateOptions = { returnDocument: 'after' }

    try {
      const result = await this.collection.findOneAndUpdate(query, update, options)
      const msg = result?.value

      if (!msg) {
        throw new Error(`Queue.ack(): Unidentified ack : ${ack}`)
      }

      return msg._id.toHexString()
    } catch (error: any) {
      throw new Error(`Failed to acknowledge message: ${error.message}`)
    }
  }

  /**
   * Retrieves the next available message from the queue.
   * @param opts - Optional configuration object.
   * @param opts.visibility - Time in seconds the message should be hidden after being fetched.
   * @returns The retrieved message or undefined if there's no available message.
   *
   * @throws Will throw an error if the fetching fails or if moving a dead message fails.
   */
  async get(opts?: { visibility?: number; retryCount?: number }): Promise<{ id: string; ack: string; payload: any; tries: number } | undefined> {
    const visibility = opts?.visibility ?? this.visibility
    const retryCount = opts?.retryCount ?? 0

    if (retryCount > GET_RECURSION_LIMIT) {
      throw new Error('Reached maximum get retries')
    }

    const query = {
      deleted: null,
      visible: { $lte: now() },
    }

    const update = {
      $inc: { tries: 1 },
      $set: {
        ack: id(),
        visible: nowPlusSecs(visibility),
      },
    }
    const options: FindOneAndUpdateOptions = { sort: { _id: 1 }, returnDocument: 'after' }

    try {
      const result = await this.collection.findOneAndUpdate(query, update, options)
      const msg = result?.value

      if (!msg) return undefined

      const transformedMsg = {
        id: msg._id.toHexString(),
        ack: msg.ack,
        payload: msg.payload,
        tries: msg.tries,
      }

      if (this.deadQueue && transformedMsg.tries > (this.maxRetries ?? 5)) {
        await this.deadQueue.add(transformedMsg)
        await this.ack(transformedMsg.ack)
        return await this.get(opts)
      }

      return transformedMsg
    } catch (error: any) {
      throw new Error(`Failed to get message: ${error.message}`)
    }
  }

  /**
   * Updates the visibility timeout of a message.
   * @param ack - The acknowledgment token for the message.
   * @param opts - Optional configuration object.
   * @param opts.visibility - Time in seconds the message should be hidden.
   * @returns The ID of the message as a string.
   *
   * @throws Will throw an error if the message is not found or any other unexpected error occurs.
   */
  async ping(ack: string, opts: { visibility?: number } = {}): Promise<string> {
    const visibility = opts.visibility ?? this.visibility
    const query = {
      ack: ack,
      deleted: null,
    }
    const update = {
      $set: {
        visible: nowPlusSecs(visibility),
      },
    }

    const result = await this.collection.findOneAndUpdate(query, update, { returnDocument: 'after' })
    const msg = result?.value

    if (!msg) {
      throw new Error(`Queue.ping(): Unidentified ack: ${ack}`)
    }

    return msg._id.toString()
  }

  /**
   * Removes all the messages marked as deleted from the queue.
   * @returns A promise with the result of the deletion operation.
   *
   * @throws Will throw an error if any unexpected error occurs during the deletion process.
   */
  async clean(): Promise<void> {
    const query = {
      deleted: { $exists: true },
    }

    await this.collection.deleteMany(query)
  }

  /**
   * Retrieves the total count of messages in the queue.
   * @returns A promise with the total count of messages.
   *
   * @throws Will throw an error if any unexpected error occurs during the counting process.
   */
  async total(): Promise<number> {
    return this.collection.countDocuments()
  }

  /**
   * Retrieves the size of the queue, counting only the messages that are currently visible.
   * @returns A promise with the count of visible messages.
   *
   * @throws Will throw an error if any unexpected error occurs during the counting process.
   */
  async size(): Promise<number> {
    const query = {
      deleted: null,
      visible: { $lte: now() },
    }

    return this.collection.countDocuments(query)
  }

  /**
   * Retrieves the count of messages that are currently in-flight.
   * In-flight messages are the ones that have been picked up for processing but not yet deleted or made visible again.
   * @returns A promise with the count of in-flight messages.
   *
   * @throws Will throw an error if any unexpected error occurs during the counting process.
   */
  async inFlight(): Promise<number> {
    const query = {
      ack: { $exists: true },
      visible: { $gt: now() },
      deleted: null,
    }

    return this.collection.countDocuments(query)
  }

  /**
   * Retrieves the count of messages that have been processed and marked as done (deleted).
   * @returns A promise with the count of done messages.
   *
   * @throws Will throw an error if any unexpected error occurs during the counting process.
   */
  async done(): Promise<number> {
    const query = {
      deleted: { $exists: true },
    }

    return this.collection.countDocuments(query)
  }
}
