import crypto from 'crypto'

export const id = (): string => {
  return crypto.randomBytes(16).toString('hex')
}

export const now = (): string => {
  return new Date().toISOString()
}

export const nowPlusSecs = (secs: number): string => {
  return new Date(Date.now() + secs * 1000).toISOString()
}
