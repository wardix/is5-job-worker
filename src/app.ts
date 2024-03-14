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
} from './database'
import {
  fetchNusaworkAuthToken,
  fetchNusaworkEmployeePhoneNumbers,
  syncNusacontactContact,
} from './api'
import logger from './logger'
import {
  overSpeedBlockedSubscriberMetricFilePath,
  overSpeedBlockedSubscriberMetricName,
  overSpeedBlockedSubscriberThreshold,
} from './config'
import { formatContact } from './nusacontact'

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
}
