import { config } from 'dotenv'

config()

export const rabbitMQUrl = process.env.AMQP_URL || 'amqp://localhost'
export const jobQueue = process.env.JOB_QUEUE || 'job'
export const initialRabbitMQBackoffTime = Number(
  process.env.BACKOFF_TIME_INIT || 16,
)
export const waNotificationApiUrl = process.env.WA_NOTIFICATION_API_URL || ''
export const waNotificationApiKey = process.env.WA_NOTIFICATION_API_KEY || ''

export const nusaworkAuthTokenApiUrl = process.env.NUSAWORK_TOKEN_API_URL || ''
export const nusaworkAuthTokenApiKey = process.env.NUSAWORK_TOKEN_API_KEY || ''
export const nusaworkEmployeeApiUrl =
  process.env.NUSAWORK_EMPLOYEE_API_URL || ''
export const nusaworkAttendanceApiUrl =
  process.env.NUSAWORK_ATTENDANCE_API_URL || ''

export const visitCardSummaryApiUrl =
  process.env.VISITCARD_SUMMARY_API_URL || ''
export const visitCardToken = process.env.VISITCARD_TOKEN || ''

export const silenceAlertApiUrl = process.env.SILENCE_ALERT_API_URL || ''

export const nisMysqlConfig = {
  host: process.env.NIS_MYSQL_HOST,
  port: +(process.env.NIS_MYSQL_PORT || 3306),
  user: process.env.NIS_MYSQL_USER,
  password: process.env.NIS_MYSQL_PASSWORD,
  database: process.env.NIS_MYSQL_DB,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
}

export const zabbixMysqlConfig = {
  host: process.env.ZABBIX_MYSQL_HOST,
  port: +(process.env.ZABBIX_MYSQL_PORT || 3306),
  user: process.env.ZABBIX_MYSQL_USER,
  password: process.env.ZABBIX_MYSQL_PASSWORD,
  database: process.env.ZABBIX_MYSQL_DB,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
}

export const dbzMysqlConfig = {
  host: process.env.DBZ_MYSQL_HOST,
  port: +(process.env.DBZ_MYSQL_PORT || 3306),
  user: process.env.DBZ_MYSQL_USER,
  password: process.env.DBZ_MYSQL_PASSWORD,
  database: process.env.DBZ_MYSQL_DB,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
}

export const overSpeedBlockedSubscriberMetricName =
  process.env.OVER_SPEED_BLOCKED_SUBSCRIBER_METRIC_NAME ||
  'over_speed_blocked_subscriber'
export const overSpeedBlockedSubscriberMetricFilePath =
  process.env.OVER_SPEED_BLOCKED_SUBSCRIBER_METRIC_FILE_PATH ||
  '/tmp/metric.txt'
export const overSpeedBlockedSubscriberThreshold =
  process.env.OVER_SPEED_BLOCKED_SUBSCRIBER_THRESHOLD || 1000000

export const nusacontactSyncContactApiUrl =
  process.env.NUSACONTACT_SYNC_CONTACT_API_URL || ''
export const nusacontactApiKey = process.env.NUSACONTACT_API_KEY || ''
export const nusacontactSyncContactMaxAttempts =
  process.env.NUSACONTACT_SYNC_CONTACT_MAX_ATTEMPTS || '8'

export const birthdayGiftVoucherTemplatePath =
  process.env.BIRTHDAY_GIFT_VOUCHER_TEMPLATE_PATH || '/tmp/template.png'
export const birthdayGiftVoucherPeriodDays =
  process.env.BIRTHDAY_GIFT_VOUCHER_PERIOD_DAYS || 30
export const birthdayWishes = process.env.BIRTHDAY_WISHES || 'Happy birthday'
export const birthdayPicPhones = process.env.BIRTHDAY_PIC_PHONES || '[]'
export const structureIgnoredEmployees =
  process.env.STRUCTURE_IGNORED_EMPLOYEES || '[]'
