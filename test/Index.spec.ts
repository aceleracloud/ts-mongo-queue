import { Db } from 'mongodb'
import { MongoQueue } from '../src/index'
import { Queue } from '../src/queue'

jest.mock('../src/queue')

describe('MongoQueue function', () => {
  let mockDb: Db

  beforeEach(() => {
    mockDb = {} as Db
    jest.clearAllMocks()
  })

  it('should create and return an instance of Queue', () => {
    const result = MongoQueue(mockDb, 'test-name')
    expect(result).toBeInstanceOf(Queue)
  })

  it('should pass provided arguments to Queue constructor', () => {
    const mockOpts = { visibility: 30, delay: 10 }
    MongoQueue(mockDb, 'test-name', mockOpts)
    expect(Queue).toHaveBeenCalledWith(mockDb, 'test-name', mockOpts)
  })
})
