# ts-mongo-queue

A TypeScript library for managing queues using MongoDB.

## Technology

![MongoDB](https://img.shields.io/badge/-MongoDB-black?style=flat-square&logo=mongodb)
![TYPESCRIPT](https://img.shields.io/badge/TypeScript-2d79c7?style=flat-square&logo=typescript&logoColor=white)
![JAVASCRIPT](https://img.shields.io/badge/-JavaScript-black?style=flat-square&logo=javascript&logoColor=yellow)
![NODE](https://img.shields.io/badge/-Nodejs-339933?style=flat-square&logo=Node.js&logoColor=white)

## WHO SHOULD USE

Any developer who needs mongodb-queue with support to mongodb-7 and node driver 6.0.1.

## AUTHOR

**Marcus Yoda
[@marcusyoda](https://github.com/marcusyoda)**

## Installation

```bash
npm install ts-mongo-queue
```

Or with Yarn:

```bash
yarn add ts-mongo-queue
```

## Basic Usage

First, import the necessary functions and classes:

```typescript
import { MongoClient } from 'mongodb'
import { MongoQueue } from 'ts-mongo-queue'
```

Next, create an instance of `MongoQueue`:

```typescript
const client = new MongoClient('your_mongodb_connection_string')
const queue = MongoQueue(client, 'your_queue_name')
```

### Add a Message to the Queue

```typescript
const payload = { data: 'test' }
const result = await queue.add(payload)
console.log(result.messageId)
```

### Fetch the Next Message from the Queue

```typescript
const nextMessage = await queue.get()
console.log(nextMessage.payload)
```

Certainly! I'll enhance the "Configuration" section based on the initial information you provided about the library.

---

## Configuration

`ts-mongo-queue` provides a range of configurations to tailor the queue to your specific needs. When creating a new instance of `MongoQueue`, you can provide an optional `opts` object to configure the behavior:

```typescript
const queue = MongoQueue(client, 'your_queue_name', {
  visibility: 30,
  delay: 10,
  deadQueue: new Queue(client, 'dead_queue_name'),
  maxRetries: 5,
})
```

### Options

- **visibility**: The duration (in seconds) a message remains hidden from `get` after being fetched, providing the consumer a window to process and delete the message. Defaults to `30` seconds.

- **delay**: The duration (in seconds) a message waits before becoming visible for the first time. Useful for scheduled jobs or delayed processing. Defaults to no delay.

- **deadQueue**: An optional instance of another `Queue` where messages that exceed the `maxRetries` count are moved. If not provided, messages that fail repeatedly will remain in the primary queue.

- **maxRetries**: The maximum number of attempts to fetch a message before it's considered dead and, if a `deadQueue` is provided, moved there. Defaults to infinite retries.

### Environment Configurations

Some configurations can also be set using environment variables:

- **QUEUE_GET_RECURSION_LIMIT**: Set a limit on how many times the library should attempt to fetch a message recursively. This can be crucial to prevent potential infinite loops or excessive recursions. Default value is `500`.

For setting the environment variable:

```bash
export QUEUE_GET_RECURSION_LIMIT=1000
```

## Testing

The library is fully tested. To run tests:

```bash
yarn test
```

## Contributing

Feel free to open issues or pull requests if you'd like to improve or fix something in the library!

## License

MIT
