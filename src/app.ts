import path from 'path'
import fs from 'fs'
import {
  fetchNisEmployeePhoneNumbers,
  updateNisEmployeePhoneNumber,
  deleteNisGraphs,
  fetchNisGraphs,
  findDeadGraphs,
  fetchBlockedSubscriberGraphs,
  findOverSpeedGraphs,
  getContactDetail,
  processEngineerTickets,
} from './database'
import {
  fetchNusaworkAuthToken,
  fetchNusaworkEmployeePhoneNumbers,
  sendWaNotification,
  submitSilenceAlert,
  syncNusacontactContact,
} from './api'
import logger from './logger'
import {
  overSpeedBlockedSubscriberMetricFilePath,
  overSpeedBlockedSubscriberMetricName,
  overSpeedBlockedSubscriberThreshold,
} from './config'
import { formatContact } from './nusacontact'
import { convertToSeconds, parseAttributes } from './utils'

async function synchronizeEmployeePhoneNumbers(): Promise<void> {
  const nisEmployeePhoneNumbers = await fetchNisEmployeePhoneNumbers()
  const authToken = await fetchNusaworkAuthToken()
  const nusaworkEmployeePhoneNumbers =
    await fetchNusaworkEmployeePhoneNumbers(authToken)

  for (const { employeeId, phoneNumber } of nisEmployeePhoneNumbers) {
    const nisPhoneNumber = phoneNumber
    const nusaworkPhoneNumber = nusaworkEmployeePhoneNumbers[employeeId]

    if (!nusaworkPhoneNumber || nisPhoneNumber === nusaworkPhoneNumber) continue

    logger.info(`${employeeId}: ${nisPhoneNumber} -> ${nusaworkPhoneNumber}`)
    await updateNisEmployeePhoneNumber(employeeId, nusaworkPhoneNumber)
  }
}

async function deleteDeadGraphLinks(): Promise<void> {
  const nisGraphs = await fetchNisGraphs()
  const deadGraphs = await findDeadGraphs(nisGraphs)
  if (deadGraphs.length == 0) {
    return
  }
  await deleteNisGraphs(deadGraphs)
}

async function generateOverSpeedBlockedSubscriberMetrics(): Promise<void> {
  const metricName = overSpeedBlockedSubscriberMetricName
  const metricFilePath = overSpeedBlockedSubscriberMetricFilePath
  const subscribersGraphMap = await fetchBlockedSubscriberGraphs()
  const graphIds: number[] = []
  for (const graphId in subscribersGraphMap) {
    graphIds.push(+graphId)
  }
  const overSpeedGraphs = await findOverSpeedGraphs(
    graphIds,
    +overSpeedBlockedSubscriberThreshold,
  )
  const overSpeedSubscriberIds: number[] = []
  const overSpeedSubscribers: any[] = []
  for (const subscribers of overSpeedGraphs.map(
    (e) => subscribersGraphMap[`${e}`],
  )) {
    for (const subscriber of subscribers) {
      if (overSpeedSubscriberIds.includes(subscriber.csid)) {
        continue
      }
      overSpeedSubscriberIds.push(subscriber.csid)
      overSpeedSubscribers.push(subscriber)
    }
  }
  const output: string[] = []
  overSpeedSubscribers.forEach(({ csid, acc }) => {
    output.push(`${metricName}{csid="${csid}",acc="${acc}"} 1`)
  })
  const metricDirectoryPath = path.dirname(metricFilePath)
  const tempDirectoryPath = fs.mkdtempSync(
    path.join(metricDirectoryPath, 'temp-'),
  )
  const tempFilePath = path.join(tempDirectoryPath, 'tempfile.txt')
  fs.writeFileSync(tempFilePath, output.join('\n'))

  fs.renameSync(tempFilePath, metricFilePath)
  fs.rmdirSync(tempDirectoryPath)
}

async function syncNusacontactCustomer(phone: string): Promise<void> {
  const contact = await getContactDetail(phone)
  if (JSON.stringify(contact) === '{}') {
    return
  }
  const formattedContact = formatContact(phone, contact)
  await syncNusacontactContact(formattedContact)
}

async function silenceAlert(
  attributes: string,
  contact: string,
  notify: string,
): Promise<void> {
  try {
    const { duration, end, comment, ...matchers } = parseAttributes(attributes)
    if (!comment) {
      throw new Error("`comment' attribute is required")
    }
    if (duration && end) {
      throw new Error("conflict attributes: `duration' and `end'")
    }
    if (!duration && !end) {
      throw new Error("`duration' or `end' attribute is required")
    }
    const now = new Date()
    const endTime = end
      ? new Date(end)
      : new Date(now.getTime() + convertToSeconds(duration) * 1000)
    const silenceData: any = {
      matchers: [],
      startsAt: now.toISOString(),
      endsAt: endTime.toISOString(),
      createdBy: contact,
      comment,
    }
    for (const m in matchers) {
      silenceData.matchers.push({
        name: m,
        value: matchers[m],
        isRegex: false,
      })
    }
    await submitSilenceAlert(silenceData)
    sendWaNotification({ to: notify, msg: 'silenced' })
  } catch (error: any) {
    sendWaNotification({ to: notify, msg: error.message })
  }
}

export async function executeJob(jobData: any): Promise<void> {
  logger.info(`Execute job: ${JSON.stringify(jobData)}`)
  if (jobData.name === 'syncEmployeeHP') {
    await synchronizeEmployeePhoneNumbers()
    return
  }
  if (jobData.name === 'delDeadGraphLink') {
    await deleteDeadGraphLinks()
    return
  }
  if (jobData.name === 'genOverSpeedBlockedSubscriberMetrics') {
    await generateOverSpeedBlockedSubscriberMetrics()
    return
  }
  if (jobData.name === 'syncNusacontactCustomer') {
    await syncNusacontactCustomer(jobData.phone as string)
    return
  }

  if (jobData.name === 'fetchEngineerTickets') {
    const phoneNumber = jobData.notify as string
    await processEngineerTickets(phoneNumber)
    return
  }

  if (jobData.name === 'silenceAlert') {
    const attributes = jobData.attributes as string
    const contact = jobData.contact as string
    const notify = jobData.notify as string
    await silenceAlert(attributes, contact, notify)
    return
  }
}
