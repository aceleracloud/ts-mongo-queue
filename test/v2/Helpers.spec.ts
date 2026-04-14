import { id, now, nowPlusSecs } from '../../src/v2/helpers'

describe('V2 Helper functions', () => {
  describe('id function', () => {
    it('should return a string of length 32', () => {
      expect(id()).toHaveLength(32)
    })

    it('should return only hexadecimal characters', () => {
      expect(id()).toMatch(/^[0-9a-f]{32}$/)
    })
  })

  describe('now function', () => {
    it('should return a Date instance', () => {
      expect(now()).toBeInstanceOf(Date)
    })
  })

  describe('nowPlusSecs function', () => {
    it('should return a Date that is the specified number of seconds ahead of the current time', () => {
      const secs = 5
      const before = Date.now() + secs * 1000
      const result = nowPlusSecs(secs)
      const after = Date.now() + secs * 1000

      expect(result).toBeInstanceOf(Date)
      expect(result.getTime()).toBeGreaterThanOrEqual(before)
      expect(result.getTime()).toBeLessThanOrEqual(after)
    })
  })
})
