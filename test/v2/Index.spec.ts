import { Db } from 'mongodb'
import { MongoQueueV2 } from '../../src/index'
import { QueueV2 } from '../../src/v2/queue'

jest.mock('../../src/v2/queue')

describe('MongoQueueV2 function', () => {
  let mockDb: Db

  beforeEach(() => {
    mockDb = {} as Db
    jest.clearAllMocks()
  })

  it('should create and return an instance of QueueV2', () => {
    const result = MongoQueueV2(mockDb, 'test-name')
    expect(result).toBeInstanceOf(QueueV2)
  })

  it('should pass provided arguments to QueueV2 constructor', () => {
    const mockOpts = { visibility: 30, delay: 10 }
    MongoQueueV2(mockDb, 'test-name', mockOpts)
    expect(QueueV2).toHaveBeenCalledWith(mockDb, 'test-name', mockOpts)
  })
})
