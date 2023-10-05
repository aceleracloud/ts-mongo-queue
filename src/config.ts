/**
 * GET_RECURSION_LIMIT defines the maximum number of recursive calls the `get` method can make.
 *
 * In certain situations, the `get` method might fetch a message that exceeds the retry threshold
 * and needs to be moved to the deadQueue. After moving the message to the deadQueue, the `get`
 * method will recursively call itself to retrieve the next available message. This is to ensure
 * that a valid message (one that hasn't exceeded the retry threshold) is returned to the caller.
 * However, if there's a sequence of messages that all need to be moved to the deadQueue,
 * this can result in the `get` method continuously calling itself.
 *
 * By setting the GET_RECURSION_LIMIT, we provide a safeguard against potential infinite recursive
 * loops in such scenarios. It ensures that the `get` method doesn't keep calling itself
 * indefinitely when encountering multiple consecutive dead messages.
 */
export const GET_RECURSION_LIMIT = +(process.env.QUEUE_GET_RECURSION_LIMIT ?? 500)
