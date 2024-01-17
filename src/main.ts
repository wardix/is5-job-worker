import { connectToRabbitMQ, startRabbitMQConsumer } from './rabbitmq'

async function main() {
  try {
    const connection = await connectToRabbitMQ()
    process.once('SIGINT', () => connection.close())
    await startRabbitMQConsumer(connection)
  } catch (error) {
    console.error('Error in main function:', error)
  }
}

main()
