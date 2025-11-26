import amqp from 'amqplib'
import type { ChannelModel, Channel } from 'amqplib'
import { rabbitMQUrl, jobQueue, initialRabbitMQBackoffTime } from './config'
import { executeJob } from './app'
import logger from './logger'
import * as Sentry from '@sentry/node';

export async function connectToRabbitMQ(): Promise<ChannelModel> {
  let backoffTime = initialRabbitMQBackoffTime
  while (true) {
    try {
      const connection = await amqp.connect(rabbitMQUrl)
      connection.on('error', (error) => {
        Sentry.captureException(error)
        const errorMessage = (error as Error).message
        logger.error(`RabbitMQ Connection error: ${errorMessage}`)
        backoffTime *= 2
      })
      connection.on('close', () => {
        logger.info('RabbitMQ Connection closed, attempting to reconnect...')
        backoffTime *= 2
      })
      logger.info('Connected to RabbitMQ')
      return connection
    } catch (error) {
      Sentry.captureException(error)
      const errorMessage = (error as Error).message
      logger.error(`Failed to connect to RabbitMQ: ${errorMessage}`)
      await new Promise((resolve) => setTimeout(resolve, backoffTime))
      backoffTime *= 2
    }
  }
}

export async function startRabbitMQConsumer(
  connection: ChannelModel,
): Promise<void> {
  const channel: Channel = await connection.createChannel()
  channel.on('error', (error) => {
    Sentry.captureException(error)
    const errorMessage = (error as Error).message
    logger.error(`RabbitMQ Channel error: ${errorMessage}`)
  })
  channel.on('close', () => logger.info('RabbitMQ Channel closed'))
  await channel.assertQueue(jobQueue, { durable: true })

  logger.info('Waiting for messages in the queue...')
  channel.consume(
    jobQueue,
    async (msg) => {
      if (msg) {
        try {
          const jobData = JSON.parse(msg.content.toString())
          await executeJob(jobData)
          channel.ack(msg)
        } catch (error) {
          Sentry.captureException(error)
          const errorMessage = (error as Error).message
          logger.error(`Error processing message: ${errorMessage}`)
          channel.nack(msg, false, true)
        }
      }
    },
    { noAck: false },
  )
}
