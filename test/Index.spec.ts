import { MongoClient } from 'mongodb'
import { MongoQueue } from '../src/index'
import { Queue } from '../src/queue'

jest.mock('../src/queue')

describe('MongoQueue function', () => {
  let mockClient: MongoClient

  beforeEach(() => {
    mockClient = {} as MongoClient
    jest.clearAllMocks()
  })

  it('should create and return an instance of Queue', () => {
    const result = MongoQueue(mockClient, 'test-name')
    expect(result).toBeInstanceOf(Queue)
  })

  it('should pass provided arguments to Queue constructor', () => {
    const mockOpts = { visibility: 30, delay: 10 }
    MongoQueue(mockClient, 'test-name', mockOpts)
    expect(Queue).toHaveBeenCalledWith(mockClient, 'test-name', mockOpts)
  })
})
