import { config } from 'dotenv'
config()

export const rabbitMQUrl = process.env.AMQP_URL || 'amqp://localhost'
export const employeeSyncQueue = process.env.JOB_QUEUE || 'job'
export const initialRabbitMQBackoffTime = Number(
  process.env.BACKOFF_TIME_INIT || 16,
)
export const nusaworkAuthTokenApiUrl = process.env.NUSAWORK_TOKEN_API_URL || ''
export const nusaworkAuthTokenApiKey = process.env.NUSAWORK_TOKEN_API_KEY || ''
export const nusaworkEmployeeApiUrl =
  process.env.NUSAWORK_EMPLOYEE_API_URL || ''
export const mysqlConfig = {
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DB,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
}
