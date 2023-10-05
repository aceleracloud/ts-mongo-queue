import { id, now, nowPlusSecs } from '../src/helpers'

describe('Helper functions', () => {
  describe('id function', () => {
    it('should return a string of length 32', () => {
      expect(id()).toHaveLength(32)
    })

    it('should return only hexadecimal characters', () => {
      expect(id()).toMatch(/^[0-9a-f]{32}$/)
    })
  })

  describe('now function', () => {
    it('should return the current date-time in ISO format', () => {
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/
      expect(now()).toMatch(isoRegex)
    })
  })

  describe('nowPlusSecs function', () => {
    it('should return a date-time that is the specified number of seconds ahead of the current time', () => {
      const secs = 5
      const futureTime = new Date(Date.now() + secs * 1000)
      expect(nowPlusSecs(secs)).toEqual(futureTime.toISOString())
    })
  })
})
