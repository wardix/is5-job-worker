import amqp from 'amqplib'
import axios from 'axios'
import { RowDataPacket } from 'mysql2'
import mysql from 'mysql2/promise'
import { config } from 'dotenv'

config()

const rabbitMQUrl = process.env.AMQP_URL || 'amqp://localhost'
const employeeSyncQueue = process.env.JOB_QUEUE || 'job'
const initialRabbitMQBackoffTime = Number(process.env.BACKOFF_TIME_INIT || 16)
const nusaworkAuthTokenApiUrl = process.env.NUSAWORK_TOKEN_API_URL || ''
const nusaworkAuthTokenApiKey = process.env.NUSAWORK_TOKEN_API_KEY || ''
const nusaworkEmployeeApiUrl = process.env.NUSAWORK_EMPLOYEE_API_URL || ''

const mysqlPool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DB,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
})

async function createRabbitMQChannel(connection: any) {
  const channel = await connection.createChannel()
  channel.on('error', (err: any) =>
    console.error('RabbitMQ Channel error:', err),
  )
  channel.on('close', () => console.log('RabbitMQ Channel closed'))
  return channel
}

async function connectToRabbitMQ() {
  let backoffTime = initialRabbitMQBackoffTime
  while (true) {
    try {
      const connection = await amqp.connect(rabbitMQUrl)
      connection.on('error', (err) => {
        console.error('RabbitMQ Connection error:', err)
        backoffTime *= 2
        connectToRabbitMQ()
      })
      connection.on('close', () => {
        console.log('RabbitMQ Connection closed, attempting to reconnect...')
        backoffTime *= 2
        connectToRabbitMQ()
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

async function startRabbitMQConsumer(connection: any) {
  const channel = await createRabbitMQChannel(connection)
  await channel.assertQueue(employeeSyncQueue, { durable: true })

  console.log('Waiting for messages in employee sync queue...')
  channel.consume(
    employeeSyncQueue,
    (msg: any) => {
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

async function fetchNisEmployeePhoneNumbers() {
  const sql =
    'SELECT EmpId AS employeeId, EmpHP AS phoneNumber FROM Employee ' +
    'WHERE BranchId = ? AND NOT (EmpJoinStatus = ?)'
  const [rows] = await mysqlPool.execute(sql, ['020', 'QUIT'])

  const rowsData = rows as RowDataPacket[]

  const employeePhoneNumbers: any = {}
  for (const { employeeId, phoneNumber } of rowsData) {
    employeePhoneNumbers[employeeId] = phoneNumber
  }
  return employeePhoneNumbers
}

async function updateNisEmployeePhoneNumber(
  employeeId: string,
  phoneNumber: string,
) {
  const sql = 'UPDATE Employee SET EmpHP = ? WHERE EmpId = ?'
  try {
    await mysqlPool.execute(sql, [phoneNumber, employeeId])
    console.log(
      `Employee phone number updated successfully for employeeId: ${employeeId}`,
    )
  } catch (error) {
    console.error(
      `Error updating phone number for employeeId: ${employeeId}`,
      error,
    )
  }
}

async function fetchNusaworkAuthToken() {
  try {
    const response = await axios.get(nusaworkAuthTokenApiUrl, {
      headers: { 'X-Api-Key': nusaworkAuthTokenApiKey },
    })
    return response.data.token
  } catch (error) {
    console.error('Error fetching Nusawork auth token:', error)
  }
}

async function fetchNusaworkEmployeePhoneNumbers(token: string) {
  const url = nusaworkEmployeeApiUrl
  const branches = ['2', '3', '4', '5']

  const payload = {
    fields: { id_branch: branches },
    page_count: 10000,
    paginate: true,
    multi_value: true,
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }

  try {
    const response = await axios.post(url, payload, { headers })
    const employees = response.data.data.list
    const employeePhoneNumbers: any = {}
    for (const employee of employees) {
      if (employee.active_status !== 'Active') continue

      const formattedPhoneNumber = formatPhoneNumber(
        employee.whatsapp || employee.mobile_phone,
      )
      if (formattedPhoneNumber) {
        employeePhoneNumbers[employee.employee_id] = formattedPhoneNumber
      }
    }
    return employeePhoneNumbers
  } catch (error) {
    console.error('Error fetching Nusawork employee phone numbers:', error)
  }
}

function formatPhoneNumber(phoneNumber: string) {
  if (!phoneNumber) return ''
  const digitsOnly = phoneNumber.replace(/[^0-9]/g, '')
  return digitsOnly.startsWith('0')
    ? '62' + digitsOnly.substring(1)
    : digitsOnly
}

async function synchronizeEmployeePhoneNumbers() {
  const nisEmployeePhoneNumbers = await fetchNisEmployeePhoneNumbers()
  const authToken = await fetchNusaworkAuthToken()
  const nusaworkEmployeePhoneNumbers =
    await fetchNusaworkEmployeePhoneNumbers(authToken)

  for (const employeeId in nisEmployeePhoneNumbers) {
    const nisPhoneNumber = nisEmployeePhoneNumbers[employeeId]
    const nusaworkPhoneNumber = nusaworkEmployeePhoneNumbers[employeeId]

    if (!nusaworkPhoneNumber || nisPhoneNumber === nusaworkPhoneNumber) continue

    console.log(`${employeeId}: ${nisPhoneNumber} -> ${nusaworkPhoneNumber}`)
    await updateNisEmployeePhoneNumber(employeeId, nusaworkPhoneNumber)
  }
}

async function executeJob(jobData: any) {
  console.log('Executing job:', jobData)
  if (jobData.name === 'syncEmployeeHP') {
    await synchronizeEmployeePhoneNumbers()
  }
}

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
