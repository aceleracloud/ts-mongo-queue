describe('Configurations', () => {
  afterEach(() => {
    jest.resetModules()
  })

  it('should get QUEUE_GET_RECURSION_LIMIT from environment variables', () => {
    process.env.QUEUE_GET_RECURSION_LIMIT = '300'

    const { GET_RECURSION_LIMIT } = jest.requireActual('../src/config')

    expect(GET_RECURSION_LIMIT).toBe(300)
  })

  it('should default to 500 if QUEUE_GET_RECURSION_LIMIT is not set', () => {
    delete process.env.QUEUE_GET_RECURSION_LIMIT

    const { GET_RECURSION_LIMIT } = jest.requireActual('../src/config')

    expect(GET_RECURSION_LIMIT).toBe(500)
  })
})
