import crypto from 'crypto'

export const id = (): string => {
  return crypto.randomBytes(16).toString('hex')
}

export const now = (): Date => {
  return new Date()
}

export const nowPlusSecs = (secs: number): Date => {
  return new Date(Date.now() + secs * 1000)
}
