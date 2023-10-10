import { ObjectId } from 'mongodb'

import { Queue } from '../src/queue'
import { id, now, nowPlusSecs } from '../src/helpers'

jest.mock('mongodb', () => {
  const currentMongoDb = jest.requireActual('mongodb')
  const fixedId = '0123456789abcdef01234567'

  return {
    ...currentMongoDb,
    ObjectId: jest.fn(() => new currentMongoDb.ObjectId(fixedId)),
  }
})

jest.mock('../src/helpers', () => ({
  now: jest.fn().mockReturnValue('2023-10-05T03:14:48.786Z'),
  nowPlusSecs: jest.fn().mockReturnValue('2023-10-05T03:15:48.786Z'),
  id: jest.fn().mockReturnValue('65201b95b8f02a5c028789de'),
}))

describe('Queue', () => {
  let collectionMock: any
  let dbMock: any

  beforeEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()

    collectionMock = {
      createIndex: jest.fn(),
      findOneAndUpdate: jest.fn(),
      insertOne: jest.fn(),
      insertMany: jest.fn(),
      deleteMany: jest.fn(),
      countDocuments: jest.fn(),
    }

    dbMock = {
      collection: jest.fn().mockReturnValue(collectionMock),
      admin: jest.fn(() => ({
        ping: jest.fn(),
      })),
    }
  })

  it('should throw an error if MongoClient is not connected', () => {
    expect(() => {
      new Queue(undefined as any, 'test-queue')
    }).toThrow('MongoQueue: provide a mongodb.MongoClient.db')
  })

  it('should throw an error if queue name is not provided', () => {
    expect(() => {
      new Queue(dbMock as any, '')
    }).toThrow('MongoQueue: Provide a queue name.')
  })

  it('should construct with options', async () => {
    const options = {
      visibility: 120,
      delay: 60,
      deadQueue: new Queue(dbMock as any, 'test-queue-dead'),
      maxRetries: 5,
    }

    const queue = new Queue(dbMock as any, 'test-queue', options)

    const expected = queue.getOptions()
    expect(expected).toEqual(options)
  })

  it('should create indexes', async () => {
    const queue = new Queue(dbMock as any, 'test-queue')
    await queue.createIndexes()

    expect(collectionMock.createIndex).toHaveBeenCalledTimes(2)

    expect(collectionMock.createIndex).toHaveBeenNthCalledWith(1, { deleted: 1, visible: 1 })
    expect(collectionMock.createIndex).toHaveBeenNthCalledWith(2, { ack: 1 }, { unique: true, sparse: true })
  })

  it('should add a message to the queue', async () => {
    const queue = new Queue(dbMock as any, 'test-queue')

    const payload = { data: 'test' }

    collectionMock.insertOne.mockResolvedValueOnce({
      insertedId: new ObjectId(),
    })

    const { _id, ack, payload: resultPayload } = await queue.add(payload)

    expect(collectionMock.insertOne).toHaveBeenCalledWith({
      visible: expect.any(String),
      payload: payload,
      ack: expect.any(String),
    })

    expect(_id).toBeDefined()
    expect(ack).toBeDefined()
    expect(payload).toEqual(resultPayload)
  })

  it('should add a message with delay to the queue', async () => {
    const queue = new Queue(dbMock as any, 'test-queue')

    const payload = { data: 'test' }

    collectionMock.insertOne.mockResolvedValueOnce({
      insertedId: new ObjectId(),
    })

    const { _id, ack, payload: resultPayload } = await queue.add(payload, { delay: 60 })

    expect(collectionMock.insertOne).toHaveBeenCalledWith({
      visible: expect.any(String),
      payload: payload,
      ack: expect.any(String),
    })

    expect(_id).toBeDefined()
    expect(ack).toBeDefined()
    expect(payload).toEqual(resultPayload)
  })

  it('should add multiple messages to the queue', async () => {
    const queue = new Queue(dbMock as any, 'test-queue')

    const payloads = [{ data: 'test1' }, { data: 'test2' }]

    const mockResolve = {
      insertedIds: {
        '0': new ObjectId(),
        '1': new ObjectId(),
      },
    }
    collectionMock.insertMany.mockResolvedValueOnce(mockResolve)

    const result = await queue.addMany(payloads)

    expect(collectionMock.insertMany).toHaveBeenCalledWith(expect.any(Array))
    expect(result.length).toBe(2)

    expect(result[0]._id).toBe(mockResolve.insertedIds[0].toHexString())
    expect(result[1]._id).toBe(mockResolve.insertedIds[1].toHexString())
  })

  it('should add multiple messages with delay to the queue', async () => {
    const queue = new Queue(dbMock as any, 'test-queue')

    const payloads = [{ data: 'test1' }, { data: 'test2' }]

    const mockResolve = {
      insertedIds: {
        '0': new ObjectId(),
        '1': new ObjectId(),
      },
    }
    collectionMock.insertMany.mockResolvedValueOnce(mockResolve)

    const result = await queue.addMany(payloads, { delay: 60 })

    expect(collectionMock.insertMany).toHaveBeenCalledWith(expect.any(Array))
    expect(result.length).toBe(2)

    expect(result[0]._id).toBe(mockResolve.insertedIds[0].toHexString())
    expect(result[1]._id).toBe(mockResolve.insertedIds[1].toHexString())
  })

  it('should acknowledge a message', async () => {
    const queue = new Queue(dbMock as any, 'test-queue')

    const mockAckToken = 'ackToken123'
    const mockObjectId = new ObjectId()

    collectionMock.findOneAndUpdate.mockResolvedValueOnce({
      _id: mockObjectId,
      ack: mockAckToken,
    })

    const messageId = await queue.ack(mockAckToken)

    expect(collectionMock.findOneAndUpdate).toHaveBeenCalledWith({ ack: mockAckToken, deleted: null }, expect.any(Object), expect.any(Object))
    expect(messageId).toBe(mockObjectId.toHexString())
  })

  it('should throw an error if trying to acknowledge an unidentified ack', async () => {
    collectionMock.findOneAndUpdate.mockResolvedValueOnce(undefined)

    const queue = new Queue(dbMock as any, 'test-queue')

    await expect(queue.ack('unidentified-ack')).rejects.toThrow('Queue.ack(): Unidentified ack: unidentified-ack')
  })

  it('should throw an error if trying to acknowledge an ack with empty value', async () => {
    collectionMock.findOneAndUpdate.mockResolvedValueOnce(null)

    const queue = new Queue(dbMock as any, 'test-queue')

    await expect(queue.ack('unidentified-ack')).rejects.toThrow('Queue.ack(): Unidentified ack: unidentified-ack')
  })

  it('should get the next available message from the queue', async () => {
    const queue = new Queue(dbMock as any, 'test-queue')

    const mockMsg = {
      _id: new ObjectId(),
      visible: now(),
      payload: { data: 'test' },
      ack: id(),
      tries: 1,
    }

    collectionMock.findOneAndUpdate.mockResolvedValueOnce(mockMsg)

    const result = await queue.get()

    expect(result).toEqual({
      id: mockMsg._id.toHexString(),
      ack: mockMsg.ack,
      payload: mockMsg.payload,
      tries: mockMsg.tries,
    })
  })

  it('should get the next available message from the queue with options', async () => {
    const queue = new Queue(dbMock as any, 'test-queue')

    const mockMsg = {
      _id: new ObjectId(),
      visible: now(),
      payload: { data: 'test' },
      ack: id(),
      tries: 1,
    }

    collectionMock.findOneAndUpdate.mockResolvedValueOnce(mockMsg)

    const result = await queue.get({ visibility: 120 })

    expect(result).toEqual({
      id: mockMsg._id.toHexString(),
      ack: mockMsg.ack,
      payload: mockMsg.payload,
      tries: mockMsg.tries,
    })
  })

  it('need to receive an error if have exceeded GET_RECURSION_LIMIT', async () => {
    const queue = new Queue(dbMock as any, 'test-queue')

    const mockMsg = {
      _id: new ObjectId(),
      visible: now(),
      payload: { data: 'test' },
      ack: id(),
      tries: 1,
    }

    collectionMock.findOneAndUpdate.mockResolvedValueOnce(mockMsg)
    await expect(queue.get({ retryCount: 501 })).rejects.toThrow('Reached maximum get retries')
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

    const queue = new Queue(dbMock as any, 'test-queue', { deadQueue: deadQueueMock as any, maxRetries: 5 })

    collectionMock.findOneAndUpdate.mockResolvedValueOnce(mockMsg)
    collectionMock.findOneAndUpdate.mockResolvedValueOnce(mockMsg)

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
    const queue = new Queue(dbMock as any, 'test-queue')

    const mockMsg = {
      _id: new ObjectId(),
      visible: nowPlusSecs(30),
      payload: { data: 'test' },
      ack: id(),
      tries: 1,
    }

    collectionMock.findOneAndUpdate.mockResolvedValueOnce(mockMsg)

    const result = await queue.ping(mockMsg.ack)

    expect(result).toBe(mockMsg._id.toString())
    expect(collectionMock.findOneAndUpdate).toHaveBeenCalledWith({ ack: mockMsg.ack, deleted: null }, { $set: { visible: expect.any(String) } }, { returnDocument: 'after' })
  })

  it('should ping (update visibility of) a message with options', async () => {
    const queue = new Queue(dbMock as any, 'test-queue')

    const mockMsg = {
      _id: new ObjectId(),
      visible: nowPlusSecs(30),
      payload: { data: 'test' },
      ack: id(),
      tries: 1,
    }

    collectionMock.findOneAndUpdate.mockResolvedValueOnce(mockMsg)

    const result = await queue.ping(mockMsg.ack, { visibility: 120 })

    expect(result).toBe(mockMsg._id.toString())
    expect(collectionMock.findOneAndUpdate).toHaveBeenCalledWith({ ack: mockMsg.ack, deleted: null }, { $set: { visible: expect.any(String) } }, { returnDocument: 'after' })
  })

  it('should throw an error if trying to ping an unidentified ack', async () => {
    collectionMock.findOneAndUpdate.mockResolvedValueOnce(null)

    const queue = new Queue(dbMock as any, 'test-queue')

    await expect(queue.ping('unidentified-ack')).rejects.toThrow('Queue.ping(): Unidentified ack: unidentified-ack')
  })

  it('should throw an error if trying to ping an ack with empty value', async () => {
    collectionMock.findOneAndUpdate.mockResolvedValueOnce(undefined)

    const queue = new Queue(dbMock as any, 'test-queue')

    await expect(queue.ping('unidentified-ack')).rejects.toThrow('Queue.ping(): Unidentified ack: unidentified-ack')
  })

  it('should clean (remove) expired visible messages', async () => {
    const queue = new Queue(dbMock as any, 'test-queue')

    collectionMock.deleteMany.mockResolvedValueOnce({ deletedCount: 1 })

    await queue.clean()

    expect(collectionMock.deleteMany).toHaveBeenCalledWith({ deleted: { $exists: true } })
  })

  it('should return total count of messages in the queue', async () => {
    const queue = new Queue(dbMock as any, 'test-queue')

    collectionMock.countDocuments.mockResolvedValueOnce(5)

    const result = await queue.total()

    expect(collectionMock.countDocuments).toHaveBeenCalledWith()
    expect(result).toBe(5)
  })

  it('should return the size of the queue', async () => {
    const queue = new Queue(dbMock as any, 'test-queue')

    collectionMock.countDocuments.mockResolvedValueOnce(10)

    const result = await queue.size()

    expect(collectionMock.countDocuments).toHaveBeenCalledWith({ deleted: null, visible: { $lte: now() } })
    expect(result).toBe(10)
  })

  it('should return the count of in-flight messages', async () => {
    const queue = new Queue(dbMock as any, 'test-queue')

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
    const queue = new Queue(dbMock as any, 'test-queue')

    collectionMock.countDocuments.mockResolvedValueOnce(7)

    const result = await queue.done()

    expect(collectionMock.countDocuments).toHaveBeenCalledWith({ deleted: { $exists: true } })
    expect(result).toBe(7)
  })
})
