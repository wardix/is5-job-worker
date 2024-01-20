import amqp, { Connection, Channel } from 'amqplib'
import { rabbitMQUrl, jobQueue, initialRabbitMQBackoffTime } from './config'
import { executeJob } from './app'

export async function connectToRabbitMQ(): Promise<Connection> {
  let backoffTime = initialRabbitMQBackoffTime
  while (true) {
    try {
      const connection = await amqp.connect(rabbitMQUrl)
      connection.on('error', (err) => {
        console.error('RabbitMQ Connection error:', err)
        backoffTime *= 2
      })
      connection.on('close', () => {
        console.log('RabbitMQ Connection closed, attempting to reconnect...')
        backoffTime *= 2
      })
      console.log('Connected to RabbitMQ')
      return connection
    } catch (err) {
      console.error('Failed to connect to RabbitMQ:', err)
      await new Promise((resolve) => setTimeout(resolve, backoffTime))
      backoffTime *= 2
    }
  }
}

export async function startRabbitMQConsumer(
  connection: Connection,
): Promise<void> {
  const channel: Channel = await connection.createChannel()
  channel.on('error', (err) => console.error('RabbitMQ Channel error:', err))
  channel.on('close', () => console.log('RabbitMQ Channel closed'))
  await channel.assertQueue(jobQueue, { durable: true })

  console.log('Waiting for messages in the queue...')
  channel.consume(
    jobQueue,
    (msg) => {
      if (msg) {
        try {
          const jobData = JSON.parse(msg.content.toString())
          executeJob(jobData)
          channel.ack(msg)
        } catch (err) {
          console.error('Error processing message:', err)
          channel.nack(msg, false, true)
        }
      }
    },
    { noAck: false },
  )
}
