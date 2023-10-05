import { ObjectId } from 'mongodb'

import { Queue } from '../src/queue'
import { id, now, nowPlusSecs } from '../src/helpers'

jest.mock('../src/helpers', () => ({
  ...jest.requireActual('../src/helpers'),
  now: jest.fn().mockReturnValue('2023-10-05T03:14:48.786Z'),
}))

const collectionMock = {
  createIndex: jest.fn(),
  findOneAndUpdate: jest.fn(),
  insertOne: jest.fn(),
  insertMany: jest.fn(),
  deleteMany: jest.fn(),
  countDocuments: jest.fn(),
}

const dbMock = {
  collection: jest.fn().mockReturnValue(collectionMock),
  admin: jest.fn(() => ({
    ping: jest.fn(),
  })),
}

const MongoClientMock = {
  connect: jest.fn(),
  db: jest.fn().mockReturnValue(dbMock),
}

describe('Queue', () => {
  let queue: Queue

  beforeEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()
    queue = new Queue(MongoClientMock as any, 'test-queue')
  })

  it('should throw an error if MongoClient is not connected', () => {
    expect(() => {
      new Queue(undefined as any, 'test-queue')
    }).toThrow('MongoQueue: MongoClient must be connected.')
  })

  it('should throw an error if queue name is not provided', () => {
    expect(() => {
      new Queue(MongoClientMock as any, '')
    }).toThrow('MongoQueue: Provide a queue name.')
  })

  it('should throw an error if MongoClient.db() call fails', () => {
    MongoClientMock.db.mockImplementationOnce(() => {
      throw new Error()
    })
    MongoClientMock.db.mockImplementationOnce(() => {
      throw new Error()
    })

    expect(() => {
      new Queue(MongoClientMock as any, 'test-queue')
    }).toThrow('MongoQueue: MongoClient must be connected.')
  })

  it('should create indexes', async () => {
    await queue.createIndexes()

    expect(collectionMock.createIndex).toHaveBeenCalledTimes(2)

    expect(collectionMock.createIndex).toHaveBeenNthCalledWith(1, { deleted: 1, visible: 1 })
    expect(collectionMock.createIndex).toHaveBeenNthCalledWith(2, { ack: 1 }, { unique: true, sparse: true })
  })

  it('should add a message to the queue', async () => {
    const payload = { data: 'test' }

    collectionMock.insertOne.mockResolvedValueOnce({
      insertedId: new ObjectId(),
    })

    const { messageId, ack } = await queue.add(payload)

    expect(collectionMock.insertOne).toHaveBeenCalledWith({
      visible: expect.any(String),
      payload: payload,
      ack: expect.any(String),
    })

    expect(messageId).toBeDefined()
    expect(ack).toBeDefined()
  })

  it('should add multiple messages to the queue', async () => {
    const payloads = [{ data: 'test1' }, { data: 'test2' }]

    collectionMock.insertMany.mockResolvedValueOnce({
      insertedIds: {
        '0': new ObjectId(),
        '1': new ObjectId(),
      },
    })

    const { messageIds, acks } = await queue.addMany(payloads)

    expect(collectionMock.insertMany).toHaveBeenCalledWith(expect.any(Array))
    expect(messageIds.length).toBe(2)
    expect(acks.length).toBe(2)
  })

  it('should acknowledge a message', async () => {
    const mockAckToken = 'ackToken123'
    const mockObjectId = new ObjectId()

    collectionMock.findOneAndUpdate.mockResolvedValueOnce({
      value: {
        _id: mockObjectId,
        ack: mockAckToken,
      },
    })

    const messageId = await queue.ack(mockAckToken)

    expect(collectionMock.findOneAndUpdate).toHaveBeenCalledWith({ ack: mockAckToken, deleted: null }, expect.any(Object), expect.any(Object))
    expect(messageId).toBe(mockObjectId.toHexString())
  })

  it('should get the next available message from the queue', async () => {
    const mockMsg = {
      _id: new ObjectId(),
      visible: now(),
      payload: { data: 'test' },
      ack: id(),
      tries: 1,
    }

    collectionMock.findOneAndUpdate.mockResolvedValueOnce({ value: mockMsg })

    const result = await queue.get()

    expect(result).toEqual({
      id: mockMsg._id.toHexString(),
      ack: mockMsg.ack,
      payload: mockMsg.payload,
      tries: mockMsg.tries,
    })
  })

  it('should move message to deadQueue after exceeding maxRetries', async () => {
    const mockMsg = {
      _id: new ObjectId(),
      visible: now(),
      payload: { data: 'test' },
      ack: id(),
      tries: 6,
    }

    const deadQueueMock = {
      add: jest.fn(),
    }

    queue = new Queue(MongoClientMock as any, 'test-queue', { deadQueue: deadQueueMock as any, maxRetries: 5 })

    collectionMock.findOneAndUpdate.mockResolvedValueOnce({ value: mockMsg })
    collectionMock.findOneAndUpdate.mockResolvedValueOnce({ value: mockMsg })

    await queue.get()

    expect(deadQueueMock.add).toHaveBeenCalledWith({
      id: mockMsg._id.toHexString(),
      ack: mockMsg.ack,
      payload: mockMsg.payload,
      tries: mockMsg.tries,
    })
    expect(collectionMock.findOneAndUpdate).toHaveBeenCalledTimes(3)
  })

  it('should ping (update visibility of) a message', async () => {
    const mockMsg = {
      _id: new ObjectId(),
      visible: nowPlusSecs(30),
      payload: { data: 'test' },
      ack: id(),
      tries: 1,
    }

    collectionMock.findOneAndUpdate.mockResolvedValueOnce({ value: mockMsg })

    const result = await queue.ping(mockMsg.ack)

    expect(result).toBe(mockMsg._id.toString())
    expect(collectionMock.findOneAndUpdate).toHaveBeenCalledWith({ ack: mockMsg.ack, deleted: null }, { $set: { visible: expect.any(String) } }, { returnDocument: 'after' })
  })

  it('should throw an error if trying to ping an unidentified ack', async () => {
    collectionMock.findOneAndUpdate.mockResolvedValueOnce({ value: null })

    await expect(queue.ping('unidentified-ack')).rejects.toThrow('Queue.ping(): Unidentified ack: unidentified-ack')
  })

  it('should clean (remove) expired visible messages', async () => {
    collectionMock.deleteMany.mockResolvedValueOnce({ deletedCount: 1 })

    await queue.clean()

    expect(collectionMock.deleteMany).toHaveBeenCalledWith({ deleted: { $exists: true } })
  })

  it('should return total count of messages in the queue', async () => {
    collectionMock.countDocuments.mockResolvedValueOnce(5)

    const result = await queue.total()

    expect(collectionMock.countDocuments).toHaveBeenCalledWith()
    expect(result).toBe(5)
  })

  it('should return the size of the queue', async () => {
    collectionMock.countDocuments.mockResolvedValueOnce(10)

    const result = await queue.size()

    expect(collectionMock.countDocuments).toHaveBeenCalledWith({ deleted: null, visible: { $lte: now() } })
    expect(result).toBe(10)
  })

  it('should return the count of in-flight messages', async () => {
    collectionMock.countDocuments.mockResolvedValueOnce(3)

    const result = await queue.inFlight()

    expect(collectionMock.countDocuments).toHaveBeenCalledWith({
      ack: { $exists: true },
      visible: { $gt: now() },
      deleted: null,
    })
    expect(result).toBe(3)
  })

  it('should return the count of done messages', async () => {
    collectionMock.countDocuments.mockResolvedValueOnce(7)

    const result = await queue.done()

    expect(collectionMock.countDocuments).toHaveBeenCalledWith({ deleted: { $exists: true } })
    expect(result).toBe(7)
  })
})
